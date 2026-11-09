import type { AcceptedEvent } from "@fogport/shared";
import type { GameState } from "./model.js";
import {
  NIGHT_LENGTH_MINUTES,
  advanceClockMinutes,
  clampClockMinutes,
} from "./clock.js";
import { getFlag, getNpc, world } from "./world.js";

export interface TurnRuleOptions {
  fallback?: boolean;
}

export interface TurnRuleResult {
  state: GameState;
  ruleNotes: string[];
  timeCostMinutes: number;
  ended: boolean;
}

export function applyTurnRules(
  sourceState: GameState,
  acceptedEvents: AcceptedEvent[],
  options: TurnRuleOptions = {},
): TurnRuleResult {
  const state = structuredClone(sourceState);
  const notes: string[] = [];
  const fallback = options.fallback === true;

  const moved = acceptedEvents.some((event) => event.type === "move_location");
  const discovered = acceptedEvents.some(
    (event) =>
      event.type === "add_item" ||
      event.type === "learn_fact" ||
      (event.type === "set_flag" &&
        event.value &&
        Boolean(getFlag(event.flagId)?.clueText)),
  );

  const staminaBefore = state.stats.stamina ?? 0;
  const willBefore = state.stats.will ?? 0;

  let timeCost = 10;

  if (!fallback) {
    let extras = 0;
    if (moved) {
      extras += 5;
    }
    if (discovered) {
      extras += 5;
    }
    if (staminaBefore < 30) {
      extras += 5;
      notes.push("疲惫 · 体力低于 30，行动时间 +5 分钟");
    }
    if (willBefore < 30) {
      extras += 5;
      notes.push("心神动摇 · 意志低于 30，行动时间 +5 分钟");
    }
    timeCost += Math.min(15, extras);
  }

  const beforeClock = state.clockMinutes;
  state.clockMinutes = advanceClockMinutes(beforeClock, timeCost);
  const actualTime = state.clockMinutes - beforeClock;
  if (actualTime > 0) {
    notes.unshift(`时间流逝 · +${actualTime} 分钟`);
  }

  if (!fallback) {
    const staminaLoss = 2 + (moved ? 2 : 0);
    const staminaAfter = clamp(staminaBefore - staminaLoss, 0, 100);
    if (staminaAfter !== staminaBefore) {
      state.stats.stamina = staminaAfter;
      notes.push(`夜行消耗 · 体力 -${staminaBefore - staminaAfter}`);
    }
  }

  if (!fallback && (sourceState.stats.insight ?? 0) >= 60) {
    const learned = acceptedEvents.find((event) => event.type === "learn_fact");
    if (learned && learned.type === "learn_fact") {
      const npc = getNpc(learned.npcId);
      const relation = state.relations[learned.npcId];
      if (npc && relation) {
        const extraFact = npc.facts.find(
          (fact) => !relation.knownFactIds.includes(fact.id),
        );
        if (extraFact) {
          relation.knownFactIds = [...relation.knownFactIds, extraFact.id];
          notes.push(`洞察敏锐 · 额外得知「${extraFact.label}」`);
        }
      }
    }
  }

  if (!fallback) {
    for (const npc of world.npcs) {
      const relation = state.relations[npc.id];
      if (!relation || relation.value < 65) continue;
      const flagId = `${npc.id}_trusted`;
      if (world.flags.some((flag) => flag.id === flagId) && !state.flags[flagId]) {
        state.flags[flagId] = true;
        notes.push(`${npc.name}开始信任你`);
      }
    }
  }

  const ended = state.clockMinutes >= NIGHT_LENGTH_MINUTES;
  if (ended) {
    if (state.flags.dawn_arrived !== true) {
      state.flags.dawn_arrived = true;
      notes.push("黎明已至 · 这一夜走到尽头");
    }
  }

  return {
    state,
    ruleNotes: notes,
    timeCostMinutes: timeCost,
    ended,
  };
}

export function statCondition(statId: string, value: number): string {
  if (statId === "insight") {
    if (value >= 60) return "敏锐";
    if (value >= 30) return "清醒";
    return "迟钝";
  }
  if (statId === "will") {
    if (value >= 60) return "坚定";
    if (value >= 30) return "平稳";
    return "动摇";
  }
  if (statId === "stamina") {
    if (value >= 60) return "充沛";
    if (value >= 30) return "尚可";
    return value < 10 ? "力竭" : "疲惫";
  }
  return "平稳";
}

export function gameplayConditions(state: GameState): string[] {
  const conditions: string[] = [];
  const stamina = state.stats.stamina ?? 0;
  const will = state.stats.will ?? 0;
  const insight = state.stats.insight ?? 0;
  if (stamina < 30) conditions.push("体力不足，行动会比平时更慢");
  if (will < 30) conditions.push("意志低落，行动容易迟疑");
  if (insight >= 60) conditions.push("洞察敏锐，交谈时可能听出更多信息");
  const remaining = NIGHT_LENGTH_MINUTES - clampClockMinutes(state.clockMinutes);
  if (remaining <= 30) conditions.push("黎明近在眼前，时间所剩无几");
  else if (remaining <= 60) conditions.push("距离黎明只剩不到一小时");
  return conditions;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
