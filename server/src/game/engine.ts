import type { AcceptedEvent, ActiveMode, AllowedEvent, TurnSource } from "@fogport/shared";
import { generateSafeFallback, generateDemoTurn } from "./demo.js";
import type { GameSession, GameState, ModelTurnOutput, RecentTurn } from "./model.js";
import { validateAndApplyEvents, type EventApplication } from "./events.js";
import { mergeMemories, syncUnresolvedClues } from "./state.js";
import {
  extractJsonObject,
  formatSchemaIssues,
  modelTurnOutputSchema,
  type ParsedModelTurn,
} from "./protocol.js";
import type { TurnPromptContext } from "../ai/prompt.js";
import { GameError } from "../errors.js";
import { applyTurnRules } from "./turnRules.js";
import { formatClockTime, NIGHT_LENGTH_MINUTES } from "./clock.js";
import {
  buildRevealCorrection,
  findPrematureReveal,
  REVEAL_WARNING,
} from "./revealGuard.js";
import {
  getQuestActionEffect,
  getQuestGuide,
  type QuestActionEffect,
} from "./quest.js";
import {
  applyFinalChoice,
  detectFinalChoiceAttempt,
  matchAvailableFinalChoice,
} from "./endings.js";
import type { EndingChoiceView } from "@fogport/shared";
import { getItem, getLocation, world } from "./world.js";

export interface PreparedTurn {
  narration: string;
  proposedEvents: AllowedEvent[];
  acceptedEvents: AcceptedEvent[];
  suggestedActions: string[];
  memoryUpdates: string[];
  summaryAfter: string;
  nextState: GameState;
  source: TurnSource;
  warning: string | null;
  ruleNotes: string[];
  highlights: string[];
  clockAfter: string;
  ended: boolean;
}

interface PrepareTurnInput {
  mode: ActiveMode;
  session: GameSession;
  recentTurns: RecentTurn[];
  playerAction: string;
}

export interface QwenRequestOptions {
  temperature?: number;
}

export type QwenGenerator = (
  context: TurnPromptContext,
  correction?: string,
  options?: QwenRequestOptions,
) => Promise<unknown>;

export interface TurnDependencies {
  qwen?: QwenGenerator;
}

const PARTIAL_WARNING =
  "雾只让这次行动实现了一部分：已经确认的变化列在下方，其余尝试没有发生。";

export async function prepareTurn(
  input: PrepareTurnInput,
  dependencies: TurnDependencies = {},
): Promise<PreparedTurn> {
  const { mode, session, recentTurns, playerAction } = input;
  const context: TurnPromptContext = {
    session,
    recentTurns,
    playerAction,
  };
  const questBefore = getQuestGuide(session.state);
  const finalChoice = resolveFinalChoice(session, playerAction);
  if (finalChoice) return finalChoice;

  if (mode === "demo") {
    return applyMainlineAssist(
      prepareDemoTurn(context),
      session.state,
      questBefore,
      playerAction,
    );
  }

  if (!dependencies.qwen) {
    throw new GameError(
      "QWEN_CONFIG_MISSING",
      "这次叙事服务没有配置，请稍后重试。",
      503,
      false,
    );
  }
  const prepared = await prepareQwenTurn(context, dependencies.qwen);
  return applyMainlineAssist(prepared, session.state, questBefore, playerAction);
}

function resolveFinalChoice(
  session: GameSession,
  playerAction: string,
): PreparedTurn | null {
  const exact = matchAvailableFinalChoice(session.state, playerAction);
  if (exact) {
    return finalizeFinalChoice(session, exact);
  }

  const attempt = detectFinalChoiceAttempt(session.state, playerAction);
  if (!attempt) return null;
  if (attempt.available) {
    return finalizeFinalChoice(session, attempt);
  }
  return finalizeBlockedFinalChoice(session, attempt);
}

function finalizeFinalChoice(
  session: GameSession,
  choice: EndingChoiceView,
): PreparedTurn {
  const applied = applyFinalChoice(session.state, choice.id);
  const summaryAfter = mergeSummary(
    applied.state.summary,
    applied.summaryFragment,
  );
  applied.state.summary = summaryAfter;

  const rules = applyTurnRules(applied.state, applied.acceptedEvents);
  const finalState = rules.state;
  syncUnresolvedClues(finalState);

  const narration = finalChoiceNarration(choice.id, applied.npcName);
  return {
    narration,
    proposedEvents: [],
    acceptedEvents: applied.acceptedEvents,
    suggestedActions: [],
    memoryUpdates: applied.memory ? [applied.memory] : [],
    summaryAfter,
    nextState: finalState,
    source: "demo",
    warning: null,
    ruleNotes: [`终局 · ${choice.title}`, ...rules.ruleNotes],
    highlights: [],
    clockAfter: formatClockTime(finalState.clockMinutes),
    ended: true,
  };
}

function finalizeBlockedFinalChoice(
  session: GameSession,
  choice: EndingChoiceView,
): PreparedTurn {
  const state = structuredClone(session.state);
  const rules = applyTurnRules(state, [], { fallback: true });
  const finalState = rules.state;
  syncUnresolvedClues(finalState);
  const elapsed = finalState.clockMinutes - session.state.clockMinutes;
  const narration = blockedFinalChoiceNarration(choice.id);
  const warning = `这次尝试没有成功。${choice.blockedReason} 时间过去了 ${elapsed} 分钟；线索、行囊、位置和关系没有变化。`;

  return {
    narration,
    proposedEvents: [],
    acceptedEvents: [],
    suggestedActions: withQuestSuggestion(finalState, []),
    memoryUpdates: [],
    summaryAfter: session.state.summary,
    nextState: finalState,
    source: "safe-fallback",
    warning,
    ruleNotes: rules.ruleNotes,
    highlights: [],
    clockAfter: formatClockTime(finalState.clockMinutes),
    ended: rules.ended,
  };
}

function finalChoiceNarration(
  id: EndingChoiceView["id"],
  npcName: string | null,
): string {
  if (id === "name_return") {
    return polishNarration(
      `你把手按在旧钟的钟锤上。半枚银铃舌贴着掌心发凉，像等了二十年的一声回答。

第一声沉进海雾，第二声从钟楼方向返回来。你念出自己的名字，听见整座雾港的钟同时越过 03:17。

无名信在邮包里轻轻一震。有些话不必再问出口——它为什么知道你的名字，为什么偏偏在今晚回到你手里。`,
    );
  }

  if (id === "remembered") {
    const name = npcName ?? "那个信任你的人";
    return polishNarration(
      `你把无名信放进${name}手里。对方没有追问寄件人，只把信按在胸口，认真地点了点头。

海雾在窗外停了一瞬。你忽然听见自己的名字被另一个人轻声念了一遍，像没能被风带走。

你还没有弄清全部真相，但至少这一刻，城里有人记得你。`,
    );
  }

  return polishNarration(
    `你踏上旧码头的渡船，缆绳在雾里绷紧又松开。无名信贴着胸口，纸角随着心跳轻轻发颤。

岸上的灯一盏盏退远，旧钟的回声从背后追来，最终被海面吞没。你没有回头。

海面在船头外慢慢退开。你带着自己的名字和一封没有寄件人的信，驶向雾港之外。`,
  );
}

function blockedFinalChoiceNarration(id: EndingChoiceView["id"]): string {
  if (id === "name_return") {
    return polishNarration(
      `你把手按在钟锤上，旧钟没有回应。它像在等你还缺的那几段记忆，或者等你真正站到它面前。

钟室外的雾贴着玻璃。你确认自己还没有准备好。`,
    );
  }

  if (id === "remembered") {
    return polishNarration(
      `你攥着无名信，在雾里寻找一个可以托付的人。可此刻身边没有谁真正了解你，也没有谁接得住这个名字。

你把信收回邮包，决定先去找一个愿意相信你的人。`,
    );
  }

  return polishNarration(
    `你朝渡船走去，雾却在跳板前合拢。船夫没有抬头，像看不见你。

你退回岸上。想离开雾港，至少得先带着无名信走到旧码头。`,
  );
}

/**
 * The mainline suggestion is server-owned. If Qwen narrates the action but
 * forgets to emit its key move/flag, apply only that deterministic mainline
 * step so a first-class suggestion can never dead-end.
 */
function applyMainlineAssist(
  prepared: PreparedTurn,
  initialState: GameState,
  questBefore: ReturnType<typeof getQuestGuide>,
  playerAction: string,
): PreparedTurn {
  const effect = getQuestActionEffect(initialState, playerAction);
  if (!effect) return prepared;

  const assistEvents: AllowedEvent[] = [];
  if (
    effect.hopLocationId &&
    prepared.nextState.locationId === initialState.locationId
  ) {
    assistEvents.push({ type: "move_location", locationId: effect.hopLocationId });
  }

  if (effect.requiredFlagIds.length > 0) {
    const atTarget =
      effect.targetLocationId === null ||
      prepared.nextState.locationId === effect.targetLocationId;
    if (atTarget) {
      for (const flagId of effect.requiredFlagIds) {
        if (!prepared.nextState.flags[flagId]) {
          assistEvents.push({ type: "set_flag", flagId, value: true });
        }
      }
    }
  }

  if (assistEvents.length === 0) return prepared;

  const applied = validateAndApplyEvents(assistEvents, prepared.nextState);
  if (applied.errors.length > 0 || applied.accepted.length === 0) {
    return prepared;
  }

  const assistedState = applied.nextState;
  syncUnresolvedClues(assistedState);

  const moved = applied.accepted.find((event) => event.type === "move_location");
  const addedFlags = applied.accepted.filter(
    (event): event is Extract<AcceptedEvent, { type: "set_flag" }> =>
      event.type === "set_flag" && event.value,
  );

  const additions: string[] = [];
  const notes: string[] = [];
  const summaryFragments: string[] = [];

  if (moved && moved.type === "move_location") {
    const name = getLocation(moved.locationId)?.name ?? moved.locationId;
    additions.push(`你沿着雾中的路走到了${name}。`);
    notes.push(`主线推进 · 抵达${name}`);
    summaryFragments.push(`你按照主线抵达了${name}。`);
  }

  if (addedFlags.length > 0) {
    const stageText = mainlineStageText(effect);
    additions.push(stageText.narration);
    notes.push(stageText.note);
    summaryFragments.push(stageText.summary);
  }

  const summaryAfter = mergeSummary(
    prepared.summaryAfter,
    summaryFragments.join(" "),
  );
  assistedState.summary = summaryAfter;

  const oldQuestAction = questBefore.recommendedAction;
  const remainingSuggestions = prepared.suggestedActions.filter(
    (suggestion) => suggestion !== oldQuestAction,
  );

  const initialLocation = getLocation(initialState.locationId);
  const baseNarration =
    prepared.source === "safe-fallback"
      ? `雾在${initialLocation?.name ?? "邮局"}的檐角缓慢聚拢。你试着${clip(playerAction, 44)}。\n\n${
          initialLocation?.atmosphere ?? "雨声盖住了细小的回响。"
        }`
      : prepared.narration;

  const assistedNarration = additions.join(" ");
  return {
    ...prepared,
    narration: baseNarration
      ? `${baseNarration.replace(/\s+$/, "")} ${assistedNarration}`
      : assistedNarration,
    acceptedEvents: [...prepared.acceptedEvents, ...applied.accepted],
    suggestedActions: withQuestSuggestion(assistedState, remainingSuggestions),
    summaryAfter,
    ruleNotes: [...prepared.ruleNotes, ...notes],
    nextState: assistedState,
    warning:
      prepared.source === "safe-fallback"
        ? "这次行动的回声被雾截断了，但主线仍然向前推进了。具体变化见下方。"
        : prepared.warning,
  };
}

function mainlineStageText(effect: QuestActionEffect): {
  narration: string;
  note: string;
  summary: string;
} {
  switch (effect.stageId) {
    case "letter":
      return {
        narration: "你拆开了无名信，信封里的字句终于不再只是猜测。",
        note: "主线推进 · 拆开了无名信",
        summary: "你确认了无名信里的第一层秘密。",
      };
    case "clock":
      return {
        narration: "钟楼的指针确确实实停在 03:17。你把这个时刻和白鹭号沉没联系在了一起。",
        note: "主线推进 · 确认了 03:17",
        summary: "你确认了钟楼停摆在白鹭号沉没的 03:17。",
      };
    case "dock":
      return {
        narration: "你从旧码头的遗物里认出了那个名字。林雾，与无名信终于连成了一条线。",
        note: "主线推进 · 找到了白鹭号的遗物",
        summary: "你在旧码头找到了与林雾有关的白鹭号遗物。",
      };
    case "lighthouse":
      return {
        narration: "你抄下了灯塔日志里的那句话：雾吞名字，钟留回声。",
        note: "主线推进 · 读完灯塔日志",
        summary: "你从灯塔日志里确认了旧钟与名字的联系。",
      };
    default:
      return { narration: "", note: "", summary: "" };
  }
}

function prepareDemoTurn(context: TurnPromptContext): PreparedTurn {
  let output: ModelTurnOutput;
  try {
    output = generateDemoTurn(context);
  } catch {
    return finalizeSafeFallback(context, []);
  }

  const parsed = modelTurnOutputSchema.safeParse(output);
  if (!parsed.success) {
    return finalizeSafeFallback(context, output.proposedEvents);
  }

  const validation = validateAndApplyEvents(parsed.data.proposedEvents, context.session.state);
  if (validation.errors.length > 0) {
    return finalizeFailedValidation(context, parsed.data, validation, "demo");
  }

  return finalizeModelTurn(parsed.data, validation, "demo");
}

async function prepareQwenTurn(
  context: TurnPromptContext,
  qwen: QwenGenerator,
): Promise<PreparedTurn> {
  let correction: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await qwen(context, correction, {
      temperature: attempt === 0 ? 0.85 : 0.45,
    });
    const parsed = parseCandidate(raw);

    if (!parsed.ok) {
      const issueText = parsed.issues.join("；");
      if (attempt === 0) {
        correction = `上一次输出未能解析为符合契约的 JSON。问题如下，请完整重新生成：\n${issueText}`;
        continue;
      }
      throw new GameError(
        "QWEN_INVALID_OUTPUT",
        "这次讲述没能完成。本回合没有消耗时间，也没有改变任何状态，请再试一次或换一种行动。",
        502,
        true,
      );
    }

    const validation = validateAndApplyEvents(parsed.data.proposedEvents, context.session.state);
    const prematureReveal = findPrematureReveal(
      parsed.data,
      context.session.state.flags.truth_known === true,
    );

    if (validation.errors.length > 0 || prematureReveal) {
      if (attempt === 0) {
        correction = [
          validation.errors.length > 0
            ? buildRetryCorrection(context, parsed.data, validation)
            : "",
          prematureReveal ? buildRevealCorrection(prematureReveal) : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        continue;
      }
      if (prematureReveal) {
        return finalizePrematureReveal(context, parsed.data, validation);
      }
      return finalizeFailedValidation(context, parsed.data, validation, "qwen");
    }

    return finalizeModelTurn(parsed.data, validation, "qwen");
  }

  throw new GameError(
    "QWEN_INVALID_OUTPUT",
    "这次讲述没能完成。本回合没有消耗时间，也没有改变任何状态，请再试一次。",
    502,
    true,
  );
}

function finalizeFailedValidation(
  context: TurnPromptContext,
  output: ParsedModelTurn,
  validation: EventApplication,
  source: "qwen" | "demo",
): PreparedTurn {
  if (validation.accepted.length === 0) {
    return finalizeSafeFallback(context, output.proposedEvents);
  }

  const allBenign = validation.rejected.every((rejection) => rejection.benign);
  if (allBenign) {
    return finalizeModelTurn(output, validation, source);
  }

  return finalizePartialTurn(context, output, validation, source);
}

function finalizePrematureReveal(
  context: TurnPromptContext,
  output: ParsedModelTurn,
  validation: EventApplication,
): PreparedTurn {
  if (validation.accepted.length === 0) {
    return finalizeSafeFallback(context, output.proposedEvents);
  }
  return finalizePartialTurn(context, output, validation, "qwen", REVEAL_WARNING);
}

function finalizeModelTurn(
  output: ParsedModelTurn,
  validation: EventApplication,
  source: "qwen" | "demo",
): PreparedTurn {
  const narration = compactNarration(output.narration);
  const nextState = validation.nextState;
  nextState.summary = output.summary;
  nextState.memories = mergeMemories(nextState.memories, output.memoryUpdate);

  const rules = applyTurnRules(nextState, validation.accepted);
  const finalState = rules.state;
  syncUnresolvedClues(finalState);

  return {
    narration,
    proposedEvents: output.proposedEvents,
    acceptedEvents: validation.accepted,
    suggestedActions: withQuestSuggestion(finalState, output.suggestedActions),
    memoryUpdates: output.memoryUpdate,
    summaryAfter: output.summary,
    nextState: finalState,
    source,
    warning: null,
    ruleNotes: rules.ruleNotes,
    highlights: [],
    clockAfter: formatClockTime(finalState.clockMinutes),
    ended: finalState.clockMinutes >= NIGHT_LENGTH_MINUTES,
  };
}

function finalizePartialTurn(
  context: TurnPromptContext,
  output: ParsedModelTurn,
  validation: EventApplication,
  source: "qwen" | "demo",
  warning = PARTIAL_WARNING,
): PreparedTurn {
  const location = getLocation(validation.nextState.locationId);
  const confirmed = validation.accepted.map((event) => event.description).join("；");
  const narration = polishNarration(
    `你试着${clip(context.playerAction, 44)}。雾把这段因果截成两半：一半落回了雾港，另一半没有回声。\n\n${
      location?.atmosphere ?? "雨声替代了所有回应。"
    }\n\n你最终能确认的只有：${confirmed}。其余尝试没有留下痕迹。`,
  );

  const nextState = validation.nextState;
  const summary = mergeSummary(
    nextState.summary,
    `你完成了一次部分生效的尝试，确认了：${confirmed}。`,
  );
  nextState.summary = summary;

  const rules = applyTurnRules(nextState, validation.accepted);
  const finalState = rules.state;
  syncUnresolvedClues(finalState);
  const fallbackSuggestions = generateSafeFallback(context).suggestedActions;

  return {
    narration,
    proposedEvents: output.proposedEvents,
    acceptedEvents: validation.accepted,
    suggestedActions: withQuestSuggestion(finalState, fallbackSuggestions),
    memoryUpdates: [],
    summaryAfter: summary,
    nextState: finalState,
    source,
    warning,
    ruleNotes: rules.ruleNotes,
    highlights: [],
    clockAfter: formatClockTime(finalState.clockMinutes),
    ended: finalState.clockMinutes >= NIGHT_LENGTH_MINUTES,
  };
}

function finalizeSafeFallback(
  context: TurnPromptContext,
  proposedEvents: AllowedEvent[],
): PreparedTurn {
  const output = generateSafeFallback(context);
  const nextState = structuredClone(context.session.state);
  const rules = applyTurnRules(nextState, [], { fallback: true });
  const finalState = rules.state;
  syncUnresolvedClues(finalState);
  const elapsed = finalState.clockMinutes - context.session.state.clockMinutes;
  const warning = `这次尝试没有成功。线索、行囊、位置和关系没有变化；时间过去了 ${elapsed} 分钟。你可以再做一次，或换一种行动。`;
  const narration = polishNarration(output.narration);

  return {
    narration,
    proposedEvents,
    acceptedEvents: [],
    suggestedActions: withQuestSuggestion(finalState, output.suggestedActions),
    memoryUpdates: [],
    summaryAfter: context.session.state.summary,
    nextState: finalState,
    source: "safe-fallback",
    warning,
    ruleNotes: rules.ruleNotes,
    highlights: [],
    clockAfter: formatClockTime(finalState.clockMinutes),
    ended: rules.ended,
  };
}

function buildRetryCorrection(
  context: TurnPromptContext,
  output: ParsedModelTurn,
  validation: EventApplication,
): string {
  const state = context.session.state;
  const location = getLocation(state.locationId);
  const inventory = state.inventory
    .map((itemId) => `${itemId}（${getItem(itemId)?.name ?? "未知物品"}）`)
    .join("、");
  const activeFlags = world.flags
    .filter((flag) => state.flags[flag.id])
    .map((flag) => flag.id)
    .join("、");
  const knownFacts = world.npcs
    .map((npc) => {
      const relation = state.relations[npc.id];
      if (!relation || relation.knownFactIds.length === 0) return null;
      return `${npc.id}: ${relation.knownFactIds.join("、")}`;
    })
    .filter(Boolean)
    .join("\n");
  const exits =
    location?.exits
      .map((exitId) => `${exitId}（${getLocation(exitId)?.name ?? "未知地点"}）`)
      .join("、") ?? "";

  return [
    "上一次提出的候选事件没有全部通过世界规则。请重新生成完整 JSON，但只保留可以合法发生的事件。",
    `当前地点：${state.locationId}；可前往：${exits || "无"}`,
    `已拥有物品（不可重复添加）：${inventory || "无"}`,
    `已激活标记（不必重复设置）：${activeFlags || "无"}`,
    `已知道的人物事实（禁止重复 learn_fact）：\n${knownFacts || "无"}`,
    `上一轮候选事件：${JSON.stringify(output.proposedEvents)}`,
    "具体问题：",
    ...validation.errors.map((error) => `- ${error}`),
    "移动只能去相邻地点；已经拥有的物品、已经知道的事实不要再次提议。若无法合法表达某个变化，宁可省略该事件。叙事必须与最终合法事件严格一致。",
  ].join("\n");
}

function parseCandidate(
  raw: unknown,
): { ok: true; data: ParsedModelTurn } | { ok: false; issues: string[] } {
  let candidate = raw;
  if (typeof raw === "string") {
    try {
      candidate = extractJsonObject(raw);
    } catch (error) {
      return {
        ok: false,
        issues: [
          `响应不是可解析的 JSON：${error instanceof Error ? error.message : "未知解析错误"}`,
        ],
      };
    }
  }

  const parsed = modelTurnOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, issues: formatSchemaIssues(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

function polishNarration(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAX_MODEL_NARRATION_CHARS = 160;

function compactNarration(input: string): string {
  const polished = polishNarration(input);
  const paragraphs = polished.split(/\n{2,}/).filter(Boolean).slice(0, 2);
  const text = paragraphs.join("\n\n");
  const characters = [...text];
  if (characters.length <= MAX_MODEL_NARRATION_CHARS) return text;

  const clipped = characters.slice(0, MAX_MODEL_NARRATION_CHARS).join("");
  const lastStop = Math.max(
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("！"),
    clipped.lastIndexOf("？"),
    clipped.lastIndexOf("…"),
  );
  if (lastStop >= 40) {
    return clipped.slice(0, lastStop + 1).trim();
  }
  return `${clipped.replace(/[，、；：\s]+$/, "")}…`;
}

function polishSuggestions(input: string[]): string[] {
  const unique = [...new Set(input.map((item) => item.trim()).filter(Boolean))];
  return unique.slice(0, 3);
}

function withQuestSuggestion(state: GameState, suggestions: string[]): string[] {
  if (state.clockMinutes >= NIGHT_LENGTH_MINUTES) return [];
  const action = getQuestGuide(state).recommendedAction;
  return polishSuggestions([...(action ? [action] : []), ...suggestions]);
}

function mergeSummary(previous: string, fragment: string, maxLength = 360): string {
  const cleanFragment = fragment.trim();
  if (!cleanFragment) return previous;
  const combined = `${previous} ${cleanFragment}`.trim();
  if (combined.length <= maxLength) return combined;
  const room = maxLength - cleanFragment.length - 2;
  const prefix = room > 0 ? `…${previous.slice(-room)}` : "";
  return `${prefix} ${cleanFragment}`.trim().slice(0, maxLength);
}

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
