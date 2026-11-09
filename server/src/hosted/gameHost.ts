import type {
  ActiveMode,
  CreateSessionResponse,
  GetSessionResponse,
  SubmitTurnResponse,
} from "@fogport/shared";
import { GameError } from "../errors.js";
import type { GameSession, RecentTurn } from "../game/model.js";
import type { StoredTurn } from "../game/state.js";
import {
  createInitialState,
  toGameStateView,
  toSessionSnapshot,
  toTurnView,
} from "../game/state.js";
import { buildOpeningNarration, buildOpeningSuggestions } from "../game/world.js";
import {
  prepareTurn,
  type QwenGenerator,
  type QwenRequestOptions,
} from "../game/engine.js";
import { buildQwenMessages, type TurnPromptContext } from "../ai/prompt.js";
import {
  createSessionInputSchema,
  submitTurnInputSchema,
} from "../game/protocol.js";

const DEFAULT_PLAYER_NAME = "林见雾";

export interface HostedGamePayload {
  session: GameSession;
  turns: StoredTurn[];
}

export interface HostedTurnResult {
  payload: HostedGamePayload;
  response: SubmitTurnResponse;
}

export function createHostedGame(
  playerName: string | undefined,
  id: string,
  now = new Date().toISOString(),
): HostedGamePayload {
  const parsed = createSessionInputSchema.safeParse({
    playerName: playerName?.trim() || undefined,
  });
  if (!parsed.success) {
    throw new GameError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "玩家代号不合法。",
      400,
      false,
    );
  }

  const name = parsed.data.playerName ?? DEFAULT_PLAYER_NAME;
  const session: GameSession = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "active",
    endedAt: null,
    turnCount: 0,
    openingNarration: buildOpeningNarration(name),
    openingSuggestions: buildOpeningSuggestions(),
    state: createInitialState(name),
  };

  return { session, turns: [] };
}

export function toCreateSessionResponse(
  payload: HostedGamePayload,
  mode: ActiveMode,
): CreateSessionResponse {
  return {
    mode,
    session: toSessionSnapshot(payload.session),
  };
}

export function toGetSessionResponse(
  payload: HostedGamePayload,
  mode: ActiveMode,
): GetSessionResponse {
  return {
    mode,
    session: toSessionSnapshot(payload.session),
    turns: payload.turns.map(toTurnView),
  };
}

export async function playHostedTurn(
  payload: HostedGamePayload,
  playerAction: string,
  mode: ActiveMode,
  qwen: QwenGenerator | undefined,
): Promise<HostedTurnResult> {
  const parsed = submitTurnInputSchema.safeParse({ action: playerAction });
  if (!parsed.success) {
    throw new GameError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "行动不合法。",
      400,
      false,
    );
  }
  if (payload.session.status === "ended") {
    throw new GameError(
      "GAME_OVER",
      "这一夜已经结束。请开始新的一局。",
      409,
      false,
    );
  }

  const recentTurns: RecentTurn[] = payload.turns.slice(-6).map((turn) => ({
    number: turn.number,
    playerAction: turn.playerAction,
    narration: turn.narration,
    acceptedEventDescriptions: turn.acceptedEvents.map((event) => event.description),
  }));

  const prepared = await prepareTurn(
    {
      mode,
      session: payload.session,
      recentTurns,
      playerAction: parsed.data.action,
    },
    { qwen },
  );

  const now = new Date().toISOString();
  const nextSession: GameSession = {
    ...payload.session,
    updatedAt: now,
    turnCount: payload.session.turnCount + 1,
    status: prepared.ended ? "ended" : "active",
    endedAt: prepared.ended ? (payload.session.endedAt ?? now) : payload.session.endedAt,
    state: prepared.nextState,
  };

  const storedTurn: StoredTurn = {
    number: nextSession.turnCount,
    playerAction: parsed.data.action,
    narration: prepared.narration,
    suggestedActions: prepared.suggestedActions,
    proposedEvents: prepared.proposedEvents,
    acceptedEvents: prepared.acceptedEvents,
    memoryUpdates: prepared.memoryUpdates,
    summaryAfter: prepared.summaryAfter,
    source: prepared.source,
    warning: prepared.warning,
    clockAfter: nextSession.state.clockMinutes,
    ruleNotes: prepared.ruleNotes,
    highlights: prepared.highlights,
    createdAt: now,
  };

  const nextPayload: HostedGamePayload = {
    session: nextSession,
    turns: [...payload.turns, storedTurn],
  };

  return {
    payload: nextPayload,
    response: {
      mode,
      state: toGameStateView(nextSession),
      turn: toTurnView(storedTurn),
    },
  };
}

export interface HostedQwenConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export function createQwenGenerator(config: HostedQwenConfig): QwenGenerator {
  const timeoutMs = config.timeoutMs ?? 45_000;
  const endpoint = config.baseUrl.endsWith("/chat/completions")
    ? config.baseUrl
    : `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return async (
    context: TurnPromptContext,
    correction?: string,
    options: QwenRequestOptions = {},
  ) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: buildQwenMessages(context, correction),
          temperature: options.temperature ?? 0.85,
          max_tokens: 2200,
          stream: false,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw qwenUpstreamError(response.status);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new GameError(
          "QWEN_INVALID_OUTPUT",
          "这次讲述没有完成，请稍后重试。",
          502,
          true,
        );
      }

      const content = (payload as {
        choices?: Array<{ message?: { content?: unknown } }>;
      }).choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new GameError(
          "QWEN_INVALID_OUTPUT",
          "这次讲述没有完成，请稍后重试。",
          502,
          true,
        );
      }
      return content;
    } catch (error) {
      if (error instanceof GameError) throw error;
      if (controller.signal.aborted) {
        throw new GameError(
          "QWEN_TIMEOUT",
          "叙事服务响应超时，请稍后重试。",
          504,
          true,
        );
      }
      throw new GameError(
        "QWEN_UPSTREAM_ERROR",
        "暂时无法连接叙事服务，请稍后重试。",
        502,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  };
}

function qwenUpstreamError(status: number): GameError {
  if (status === 401 || status === 403) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "叙事服务鉴权失败，请联系站点管理员检查配置。",
      502,
      false,
    );
  }
  if (status === 404) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "叙事接口或模型不存在，请联系站点管理员检查配置。",
      502,
      false,
    );
  }
  if (status === 429) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "叙事服务繁忙或额度不足，请稍后重试。",
      502,
      true,
    );
  }
  if (status >= 500) {
    return new GameError(
      "QWEN_UPSTREAM_ERROR",
      "叙事服务暂时不可用，请稍后重试。",
      502,
      true,
    );
  }
  return new GameError(
    "QWEN_UPSTREAM_ERROR",
    "叙事服务请求失败，请稍后重试。",
    502,
    false,
  );
}
