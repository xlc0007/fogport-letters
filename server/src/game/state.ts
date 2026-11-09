import type {
  GameStateView,
  SessionSnapshot,
  TurnView,
  RelationshipView,
  FlagView,
} from "@fogport/shared";
import type { GameSession, GameState, ModelTurnOutput } from "./model.js";
import {
  buildInitialSummary,
  getLocation,
  getItem,
  relationAttitude,
  world,
} from "./world.js";
import { getClockView, formatClockTime } from "./clock.js";
import { buildEnding, getFinalChoiceViews } from "./endings.js";
import { statCondition } from "./turnRules.js";
import { getQuestGuide } from "./quest.js";
import { getNpcArcNote } from "./beats.js";

export interface StoredTurn {
  number: number;
  playerAction: string;
  narration: string;
  suggestedActions: string[];
  proposedEvents: ModelTurnOutput["proposedEvents"];
  acceptedEvents: TurnView["acceptedEvents"];
  memoryUpdates: string[];
  summaryAfter: string;
  source: TurnView["source"];
  warning: string | null;
  clockAfter: number | null;
  ruleNotes: string[];
  highlights: string[];
  createdAt: string;
}

export function createInitialState(playerName: string): GameState {
  const stats = Object.fromEntries(world.stats.map((stat) => [stat.id, stat.initial]));
  const flags = Object.fromEntries(world.flags.map((flag) => [flag.id, false]));
  const relations = Object.fromEntries(
    world.npcs.map((npc) => [
      npc.id,
      {
        value: npc.initialRelation,
        knownFactIds: [] as string[],
      },
    ]),
  );

  return {
    playerName,
    locationId: world.startLocationId,
    clockMinutes: 0,
    stats,
    inventory: [...world.initialInventory],
    flags,
    relations,
    summary: buildInitialSummary(playerName),
    memories: [...world.initialMemories],
    unresolvedClues: [world.initialClue],
  };
}

export function collectUnresolvedClues(state: GameState): string[] {
  const clues: string[] = [];
  if (!state.flags.truth_known) {
    clues.push(world.initialClue);
  }
  for (const flag of world.flags) {
    if (state.flags[flag.id] && flag.clueText) {
      clues.push(flag.clueText);
    }
  }
  return [...new Set(clues)];
}

export function syncUnresolvedClues(state: GameState): void {
  state.unresolvedClues = collectUnresolvedClues(state);
}

export function mergeMemories(existing: string[], updates: string[]): string[] {
  const merged = [...existing];
  for (const update of updates) {
    const normalized = update.trim();
    if (normalized && !merged.includes(normalized)) {
      merged.push(normalized);
    }
  }
  return merged.slice(-14);
}

export function toGameStateView(session: GameSession): GameStateView {
  const location = getLocation(session.state.locationId);
  if (!location) {
    throw new Error(`未知地点：${session.state.locationId}`);
  }

  const exits = location.exits.flatMap((id) => {
    const exit = getLocation(id);
    return exit ? [{ id: exit.id, name: exit.name }] : [];
  });

  const inventory = session.state.inventory.flatMap((id) => {
    const item = getItem(id);
    return item ? [{ id: item.id, name: item.name, description: item.description }] : [];
  });

  const relationships: RelationshipView[] = world.npcs.map((npc) => {
    const relation = session.state.relations[npc.id] ?? {
      value: npc.initialRelation,
      knownFactIds: [],
    };
    const knownFacts = relation.knownFactIds.flatMap((factId) => {
      const fact = npc.facts.find((entry) => entry.id === factId);
      return fact ? [fact.text] : [];
    });
    return {
      id: npc.id,
      name: npc.name,
      role: npc.role,
      locationId: npc.locationId,
      locationName: getLocation(npc.locationId)?.name ?? npc.locationId,
      value: relation.value,
      attitude: relationAttitude(relation.value),
      arcNote: getNpcArcNote(session.state, npc.id),
      knownFacts,
    };
  });

  const flags: FlagView[] = world.flags.flatMap((flag) =>
    session.state.flags[flag.id] ? [{ id: flag.id, label: flag.label }] : [],
  );

  return {
    playerName: session.state.playerName,
    status: session.status,
    turnCount: session.turnCount,
    clock: getClockView(session.state.clockMinutes),
    location: {
      id: location.id,
      name: location.name,
      description: location.description,
      exits,
    },
    stats: world.stats.map((definition) => {
      const value = session.state.stats[definition.id] ?? definition.initial;
      return {
        id: definition.id,
        label: definition.label,
        value,
        min: definition.min,
        max: definition.max,
        description: definition.description,
        condition: statCondition(definition.id, value),
      };
    }),
    inventory,
    relationships,
    flags,
    unresolvedClues: [...session.state.unresolvedClues],
    memories: [...session.state.memories],
    summary: session.state.summary,
    ending: session.status === "ended" ? buildEnding(session.state) : null,
    quest: getQuestGuide(session.state, session.status === "ended"),
    finalChoices:
      session.status === "ended" ? [] : getFinalChoiceViews(session.state),
  };
}

export function toSessionSnapshot(session: GameSession): SessionSnapshot {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    openingNarration: session.openingNarration,
    openingSuggestions: [...session.openingSuggestions],
    state: toGameStateView(session),
  };
}

export function toTurnView(turn: StoredTurn): TurnView {
  return {
    number: turn.number,
    playerAction: turn.playerAction,
    narration: turn.narration,
    suggestedActions: [...turn.suggestedActions],
    acceptedEvents: turn.acceptedEvents,
    memoryUpdates: [...turn.memoryUpdates],
    summaryAfter: turn.summaryAfter,
    source: turn.source,
    warning: normalizeWarning(turn.warning),
    createdAt: turn.createdAt,
    clockAfter: turn.clockAfter === null ? null : formatClockTime(turn.clockAfter),
    ruleNotes: [...turn.ruleNotes],
    highlights: [...turn.highlights],
  };
}

function normalizeWarning(warning: string | null): string | null {
  if (!warning) return null;
  if (warning.includes("候选事件") || warning.includes("世界规则校验")) {
    return "这次尝试没有成功。这一回合没有产生可以确认的变化。";
  }
  return warning;
}
