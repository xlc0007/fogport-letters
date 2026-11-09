import { randomBytes } from "node:crypto";
import type { ActiveMode, SubmitTurnResponse, TurnView } from "@fogport/shared";
import { GameError } from "../errors.js";
import type { GameSession } from "./model.js";
import { prepareTurn } from "./engine.js";
import { generateWithQwen } from "../ai/qwen.js";
import {
  buildOpeningNarration,
  buildOpeningSuggestions,
} from "./world.js";
import { createInitialState, toGameStateView } from "./state.js";
import { getQuestGuide } from "./quest.js";
import type { SessionRepository } from "../db/sessionRepository.js";

const DEFAULT_PLAYER_NAME = "林见雾";

class TurnCoordinator {
  private readonly active = new Set<string>();

  async runExclusive<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    if (this.active.has(sessionId)) {
      throw new GameError(
        "SESSION_BUSY",
        "上一回合还在生成中，请稍候再提交新的行动。",
        409,
        true,
      );
    }

    this.active.add(sessionId);
    try {
      return await task();
    } finally {
      this.active.delete(sessionId);
    }
  }
}

export class SessionService {
  private readonly coordinator = new TurnCoordinator();

  constructor(private readonly repository: SessionRepository) {}

  createSession(playerName?: string): GameSession {
    const normalizedName = playerName?.trim() || DEFAULT_PLAYER_NAME;
    const id = randomBytes(18).toString("base64url");
    const now = new Date().toISOString();
    const state = createInitialState(normalizedName);
    const questAction = getQuestGuide(state).recommendedAction;
    const openingSuggestions = [
      ...new Set([
        ...(questAction ? [questAction] : []),
        ...buildOpeningSuggestions(),
      ]),
    ].slice(0, 3);

    return this.repository.create({
      id,
      state,
      openingNarration: buildOpeningNarration(normalizedName),
      openingSuggestions,
      now,
    });
  }

  getSession(id: string): GameSession {
    const session = this.repository.getSession(id);
    if (!session) {
      throw new GameError("SESSION_NOT_FOUND", "没有找到这局游戏，存档可能已被删除。", 404, false);
    }
    return session;
  }

  async submitTurn(
    sessionId: string,
    playerAction: string,
    mode: ActiveMode,
  ): Promise<SubmitTurnResponse> {
    return this.coordinator.runExclusive(sessionId, async () => {
      const session = this.getSession(sessionId);
      if (session.status === "ended") {
        throw new GameError(
          "GAME_OVER",
          "这一夜已经结束。请开始新的一局。",
          409,
          false,
        );
      }
      const recentTurns = this.repository.listRecentTurns(sessionId, 6);

      const prepared = await prepareTurn(
        {
          mode,
          session,
          recentTurns,
          playerAction,
        },
        { qwen: generateWithQwen },
      );

      const now = new Date().toISOString();
      const updatedSession = this.repository.appendTurn(session, playerAction, prepared, now);
      const turn: TurnView = {
        number: updatedSession.turnCount,
        playerAction,
        narration: prepared.narration,
        suggestedActions: prepared.suggestedActions,
        acceptedEvents: prepared.acceptedEvents,
        memoryUpdates: prepared.memoryUpdates,
        summaryAfter: prepared.summaryAfter,
        source: prepared.source,
        warning: prepared.warning,
        createdAt: now,
        clockAfter: prepared.clockAfter,
        ruleNotes: prepared.ruleNotes,
        highlights: prepared.highlights,
      };

      return {
        mode,
        state: toGameStateView(updatedSession),
        turn,
      };
    });
  }
}
