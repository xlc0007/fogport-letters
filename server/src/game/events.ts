import type { AcceptedEvent, AllowedEvent } from "@fogport/shared";
import type { GameState } from "./model.js";
import {
  getFlag,
  getItem,
  getLocation,
  getNpc,
  getStat,
  npcAtLocation,
  world,
} from "./world.js";
import { syncUnresolvedClues } from "./state.js";
import { fogportStory } from "./story.js";

export type EventRejectionCode =
  | "INVALID_EVENT"
  | "EVENT_LIMIT"
  | "UNKNOWN_FLAG"
  | "UNKNOWN_ITEM"
  | "UNKNOWN_NPC"
  | "UNKNOWN_STAT"
  | "UNKNOWN_LOCATION"
  | "UNKNOWN_FACT"
  | "DUPLICATE_ITEM"
  | "DUPLICATE_FACT"
  | "DUPLICATE_FLAG"
  | "ITEM_CAPACITY"
  | "ITEM_NOT_OWNED"
  | "DELTA_TOO_LARGE"
  | "MOVE_SAME_LOCATION"
  | "MOVE_NOT_ADJACENT"
  | "MOVE_TWICE"
  | "STATE_INCONSISTENT";

export interface EventRejection {
  event: AllowedEvent;
  code: EventRejectionCode;
  message: string;
  /** Duplicates/no-ops can be safely dropped without contradicting a narrative. */
  benign: boolean;
}

export interface EventApplication {
  nextState: GameState;
  accepted: AcceptedEvent[];
  rejected: EventRejection[];
  errors: string[];
}

export function validateAndApplyEvents(events: AllowedEvent[], state: GameState): EventApplication {
  const draft = structuredClone(state);

  if (events.length > world.maxEventsPerTurn) {
    const message = `事件数量为 ${events.length}，超过单回合上限 ${world.maxEventsPerTurn}。`;
    return {
      nextState: draft,
      accepted: [],
      rejected: events.map((event) => ({
        event,
        code: "EVENT_LIMIT" as const,
        message,
        benign: false,
      })),
      errors: [message],
    };
  }

  const accepted: AcceptedEvent[] = [];
  const rejected: EventRejection[] = [];
  const errors: string[] = [];
  let moved = false;

  events.forEach((event, index) => {
    const prefix = `第 ${index + 1} 个事件（${event.type}）`;
    const result = applyEvent(event, draft, moved);

    if (result.error) {
      rejected.push({
        event,
        code: result.error.code,
        message: result.error.message,
        benign: result.error.benign ?? false,
      });
      errors.push(`${prefix}：${result.error.message}`);
      return;
    }

    if (event.type === "move_location") {
      moved = true;
    }
    accepted.push(result.accepted!);
  });

  syncUnresolvedClues(draft);

  return { nextState: draft, accepted, rejected, errors };
}

interface EventError {
  code: EventRejectionCode;
  message: string;
  benign?: boolean;
}

interface EventResult {
  accepted?: AcceptedEvent;
  error?: EventError;
}

function applyEvent(event: AllowedEvent, state: GameState, moved: boolean): EventResult {
  switch (event.type) {
    case "set_flag": {
      if (!event.flagId || typeof event.value !== "boolean") {
        return invalid("需要合法的 flagId 与布尔值 value。");
      }
      const flag = getFlag(event.flagId);
      if (!flag) {
        return {
          error: {
            code: "UNKNOWN_FLAG",
            message: `不存在剧情标记 ${event.flagId}。`,
          },
        };
      }
      if (flag.serverOnly) {
        return {
          error: {
            code: "INVALID_EVENT",
            message: `剧情标记 ${event.flagId} 只能由主线结局选择设置。`,
          },
        };
      }
      if (typeof state.flags[event.flagId] !== "boolean") {
        return {
          error: {
            code: "STATE_INCONSISTENT",
            message: `剧情标记 ${event.flagId} 不在当前世界状态中。`,
          },
        };
      }
      if (state.flags[event.flagId] === event.value) {
        return {
          error: {
            code: "DUPLICATE_FLAG",
            message: `剧情标记「${flag.label}」已经是 ${event.value ? "true" : "false"}。`,
            benign: true,
          },
        };
      }
      state.flags[event.flagId] = event.value;
      const keyClue = fogportStory.keyClues.some((clue) => clue.flagId === event.flagId);
      const clueLabel = event.flagId === "truth_known" ? "主线真相" : keyClue ? "关键线索" : "发现线索";
      return {
        accepted: {
          ...event,
          description: event.value
            ? `${flag.clueText ? clueLabel : "剧情标记"} · ${flag.label}`
            : `撤销标记 · ${flag.label}`,
        },
      };
    }

    case "add_item": {
      if (!event.itemId) {
        return invalid("需要合法的 itemId。");
      }
      const item = getItem(event.itemId);
      if (!item) {
        return {
          error: {
            code: "UNKNOWN_ITEM",
            message: `不存在物品 ${event.itemId}。`,
          },
        };
      }
      if (state.inventory.includes(event.itemId)) {
        return {
          error: {
            code: "DUPLICATE_ITEM",
            message: `你已经拥有「${item.name}」。`,
            benign: true,
          },
        };
      }
      if (state.inventory.length >= world.inventoryMax) {
        return {
          error: {
            code: "ITEM_CAPACITY",
            message: `背包已满（上限 ${world.inventoryMax} 件），无法获得「${item.name}」。`,
          },
        };
      }
      state.inventory.push(event.itemId);
      return { accepted: { ...event, description: `获得「${item.name}」` } };
    }

    case "remove_item": {
      if (!event.itemId) {
        return invalid("需要合法的 itemId。");
      }
      const item = getItem(event.itemId);
      if (!item) {
        return {
          error: {
            code: "UNKNOWN_ITEM",
            message: `不存在物品 ${event.itemId}。`,
          },
        };
      }
      if (item.protected) {
        return {
          error: {
            code: "INVALID_EVENT",
            message: `「${item.name}」是主线关键物品，不能丢弃。`,
          },
        };
      }
      const itemIndex = state.inventory.indexOf(event.itemId);
      if (itemIndex === -1) {
        return {
          error: {
            code: "ITEM_NOT_OWNED",
            message: `背包中没有「${item.name}」。`,
          },
        };
      }
      state.inventory.splice(itemIndex, 1);
      return { accepted: { ...event, description: `失去「${item.name}」` } };
    }

    case "change_relation": {
      if (!event.npcId) {
        return invalid("需要合法的 npcId。");
      }
      const npc = getNpc(event.npcId);
      if (!npc) {
        return {
          error: {
            code: "UNKNOWN_NPC",
            message: `不存在人物 ${event.npcId}。`,
          },
        };
      }
      if (!Number.isInteger(event.delta) || event.delta === 0) {
        return invalid("关系变化量必须是正整数或负整数。");
      }
      if (Math.abs(event.delta) > world.relationMaxDelta) {
        return {
          error: {
            code: "DELTA_TOO_LARGE",
            message: `关系单次调整绝对值不能超过 ${world.relationMaxDelta}，收到 ${event.delta}。`,
          },
        };
      }
      const relation = state.relations[event.npcId] ?? {
        value: npc.initialRelation,
        knownFactIds: [],
      };
      const previous = relation.value;
      relation.value = clamp(relation.value + event.delta, 0, 100);
      state.relations[event.npcId] = relation;
      const applied = relation.value - previous;
      return {
        accepted: {
          ...event,
          description:
            applied === 0
              ? `与${npc.name}的关系没有进一步变化`
              : `与${npc.name}的关系 ${applied > 0 ? "+" : ""}${applied}`,
        },
      };
    }

    case "change_stat": {
      if (!event.statId) {
        return invalid("需要合法的 statId。");
      }
      const stat = getStat(event.statId);
      if (!stat) {
        return {
          error: {
            code: "UNKNOWN_STAT",
            message: `不存在属性 ${event.statId}。`,
          },
        };
      }
      if (!Number.isInteger(event.delta) || event.delta === 0) {
        return invalid("属性变化量必须是正整数或负整数。");
      }
      if (Math.abs(event.delta) > stat.maxDelta) {
        return {
          error: {
            code: "DELTA_TOO_LARGE",
            message: `${stat.label}单次调整绝对值不能超过 ${stat.maxDelta}，收到 ${event.delta}。`,
          },
        };
      }
      const previous = state.stats[event.statId] ?? stat.initial;
      state.stats[event.statId] = clamp(previous + event.delta, stat.min, stat.max);
      const applied = state.stats[event.statId] - previous;
      return {
        accepted: {
          ...event,
          description:
            applied === 0
              ? `${stat.label}没有进一步变化`
              : `${stat.label} ${applied > 0 ? "+" : ""}${applied}`,
        },
      };
    }

    case "move_location": {
      if (!event.locationId) {
        return invalid("需要合法的 locationId。");
      }
      const destination = getLocation(event.locationId);
      if (!destination) {
        return {
          error: {
            code: "UNKNOWN_LOCATION",
            message: `不存在地点 ${event.locationId}。`,
          },
        };
      }
      if (moved) {
        return {
          error: {
            code: "MOVE_TWICE",
            message: "每个回合最多只能移动一次。",
          },
        };
      }
      const current = getLocation(state.locationId);
      if (!current) {
        return {
          error: {
            code: "STATE_INCONSISTENT",
            message: "当前地点状态异常。",
          },
        };
      }
      if (destination.id === current.id) {
        return {
          error: {
            code: "MOVE_SAME_LOCATION",
            message: `你已经身处${current.name}。`,
            benign: true,
          },
        };
      }
      if (!current.exits.includes(destination.id)) {
        return {
          error: {
            code: "MOVE_NOT_ADJACENT",
            message: `无法从${current.name}直接前往${destination.name}，只能前往相邻地点。`,
          },
        };
      }
      state.locationId = destination.id;
      const npc = npcAtLocation(destination.id);
      return {
        accepted: {
          ...event,
          description: `离开${current.name}，前往${destination.name}${npc ? ` · ${npc.name}在场` : ""}`,
        },
      };
    }

    case "learn_fact": {
      if (!event.npcId || !event.factId) {
        return invalid("需要合法的 npcId 与 factId。");
      }
      const npc = getNpc(event.npcId);
      if (!npc) {
        return {
          error: {
            code: "UNKNOWN_NPC",
            message: `不存在人物 ${event.npcId}。`,
          },
        };
      }
      const fact = npc.facts.find((entry) => entry.id === event.factId);
      if (!fact) {
        return {
          error: {
            code: "UNKNOWN_FACT",
            message: `${npc.name}没有名为 ${event.factId} 的可得知信息。`,
          },
        };
      }
      const relation = state.relations[event.npcId] ?? {
        value: npc.initialRelation,
        knownFactIds: [],
      };
      if (relation.knownFactIds.includes(event.factId)) {
        return {
          error: {
            code: "DUPLICATE_FACT",
            message: `你已经知道「${fact.label}」这件事。`,
            benign: true,
          },
        };
      }
      relation.knownFactIds = [...relation.knownFactIds, event.factId];
      state.relations[event.npcId] = relation;
      return { accepted: { ...event, description: `得知 · ${fact.label}` } };
    }

    default: {
      const exhaustive: never = event;
      return {
        error: {
          code: "INVALID_EVENT",
          message: `不允许的事件类型：${(exhaustive as { type?: string }).type ?? "unknown"}`,
        },
      };
    }
  }
}

function invalid(message: string): EventResult {
  return { error: { code: "INVALID_EVENT", message } };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
