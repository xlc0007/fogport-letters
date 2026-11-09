import type Database from "better-sqlite3";
import type { AcceptedEvent, AllowedEvent, TurnSource } from "@fogport/shared";
import type { GameSession, GameState, RecentTurn } from "../game/model.js";
import type { StoredTurn } from "../game/state.js";
import { world } from "../game/world.js";
import type { PreparedTurn } from "../game/engine.js";
import { GameError } from "../errors.js";
import { NIGHT_LENGTH_MINUTES } from "../game/clock.js";

interface SessionRow {
  id: string;
  player_name: string;
  status: "active";
  turn_count: number;
  location_id: string;
  clock_minutes: number;
  ended_at: string | null;
  stats_json: string;
  summary: string;
  memories_json: string;
  unresolved_clues_json: string;
  opening_narration: string;
  opening_suggestions_json: string;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  item_id: string;
}

interface FlagRow {
  flag_id: string;
  value: number;
}

interface RelationRow {
  npc_id: string;
  value: number;
  known_fact_ids_json: string;
}

interface TurnRow {
  turn_number: number;
  player_action: string;
  narration: string;
  suggested_actions_json: string;
  proposed_events_json: string;
  accepted_events_json: string;
  memory_updates_json: string;
  summary_after: string;
  source: TurnSource;
  warning: string | null;
  clock_after: number | null;
  rule_notes_json: string;
  highlights_json: string;
  created_at: string;
}

interface RecentTurnRow {
  turn_number: number;
  player_action: string;
  narration: string;
  accepted_events_json: string;
}

export interface CreateSessionRecord {
  id: string;
  state: GameState;
  openingNarration: string;
  openingSuggestions: string[];
  now: string;
}

export class SessionRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateSessionRecord): GameSession {
    const { id, state, openingNarration, openingSuggestions, now } = input;

    const insertSession = this.db.prepare(`
      INSERT INTO sessions (
        id, player_name, status, turn_count, location_id, clock_minutes, ended_at,
        stats_json, summary, memories_json, unresolved_clues_json, opening_narration,
        opening_suggestions_json, created_at, updated_at
      ) VALUES (
        @id, @playerName, 'active', 0, @locationId, @clockMinutes, NULL,
        @statsJson, @summary, @memoriesJson, @cluesJson, @openingNarration,
        @openingSuggestionsJson, @createdAt, @updatedAt
      )
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO session_items (session_id, item_id, position)
      VALUES (?, ?, ?)
    `);
    const insertFlag = this.db.prepare(`
      INSERT INTO session_flags (session_id, flag_id, value)
      VALUES (?, ?, ?)
    `);
    const insertRelation = this.db.prepare(`
      INSERT INTO session_relations (session_id, npc_id, value, known_fact_ids_json)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertSession.run({
        id,
        playerName: state.playerName,
        locationId: state.locationId,
        clockMinutes: state.clockMinutes,
        statsJson: JSON.stringify(state.stats),
        summary: state.summary,
        memoriesJson: JSON.stringify(state.memories),
        cluesJson: JSON.stringify(state.unresolvedClues),
        openingNarration,
        openingSuggestionsJson: JSON.stringify(openingSuggestions),
        createdAt: now,
        updatedAt: now,
      });

      state.inventory.forEach((itemId, index) => {
        insertItem.run(id, itemId, index);
      });
      for (const flag of world.flags) {
        insertFlag.run(id, flag.id, state.flags[flag.id] ? 1 : 0);
      }
      for (const npc of world.npcs) {
        const relation = state.relations[npc.id] ?? {
          value: npc.initialRelation,
          knownFactIds: [],
        };
        insertRelation.run(id, npc.id, relation.value, JSON.stringify(relation.knownFactIds));
      }
    });

    transaction();

    return {
      id,
      createdAt: now,
      updatedAt: now,
      status: "active",
      endedAt: null,
      turnCount: 0,
      openingNarration,
      openingSuggestions: [...openingSuggestions],
      state: structuredClone(state),
    };
  }

  getSession(id: string): GameSession | null {
    const row = this.db
      .prepare(
        `SELECT id, player_name, status, turn_count, location_id, clock_minutes,
                ended_at, stats_json, summary, memories_json, unresolved_clues_json,
                opening_narration, opening_suggestions_json, created_at, updated_at
         FROM sessions WHERE id = ?`,
      )
      .get(id) as SessionRow | undefined;

    if (!row) return null;

    const items = this.db
      .prepare(`SELECT item_id FROM session_items WHERE session_id = ? ORDER BY position ASC`)
      .all(id) as ItemRow[];
    const flags = this.db
      .prepare(`SELECT flag_id, value FROM session_flags WHERE session_id = ?`)
      .all(id) as FlagRow[];
    const relations = this.db
      .prepare(
        `SELECT npc_id, value, known_fact_ids_json FROM session_relations WHERE session_id = ?`,
      )
      .all(id) as RelationRow[];

    const storedStats = parseRecord(row.stats_json, "stats_json");
    const stats: Record<string, number> = {};
    for (const stat of world.stats) {
      const stored = storedStats[stat.id];
      const numeric = typeof stored === "number" && Number.isFinite(stored) ? stored : stat.initial;
      stats[stat.id] = clamp(Math.round(numeric), stat.min, stat.max);
    }

    const storedFlags = new Map(flags.map((flag) => [flag.flag_id, flag.value === 1]));
    const stateFlags: Record<string, boolean> = {};
    for (const flag of world.flags) {
      stateFlags[flag.id] = storedFlags.get(flag.id) ?? false;
    }

    const storedRelations = new Map(relations.map((relation) => [relation.npc_id, relation]));
    const stateRelations: GameState["relations"] = {};
    for (const npc of world.npcs) {
      const stored = storedRelations.get(npc.id);
      const factIds = stored
        ? parseStringArray(stored.known_fact_ids_json, "known_fact_ids_json").filter((factId) =>
            npc.facts.some((fact) => fact.id === factId),
          )
        : [];
      stateRelations[npc.id] = {
        value: clamp(stored?.value ?? npc.initialRelation, 0, 100),
        knownFactIds: [...new Set(factIds)],
      };
    }

    const knownItemIds = new Set(world.items.map((item) => item.id));
    const inventory = items.map((item) => item.item_id).filter((itemId) => knownItemIds.has(itemId));

    const state: GameState = {
      playerName: row.player_name,
      locationId: row.location_id,
      clockMinutes: row.clock_minutes ?? 0,
      stats,
      inventory,
      flags: stateFlags,
      relations: stateRelations,
      summary: row.summary,
      memories: parseStringArray(row.memories_json, "memories_json"),
      unresolvedClues: parseStringArray(row.unresolved_clues_json, "unresolved_clues_json"),
    };

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.ended_at ? "ended" : "active",
      endedAt: row.ended_at,
      turnCount: row.turn_count,
      openingNarration: row.opening_narration,
      openingSuggestions: parseStringArray(
        row.opening_suggestions_json,
        "opening_suggestions_json",
      ),
      state,
    };
  }

  listRecentTurns(sessionId: string, limit = 6): RecentTurn[] {
    const rows = this.db
      .prepare(
        `SELECT turn_number, player_action, narration, accepted_events_json
         FROM turns WHERE session_id = ?
         ORDER BY turn_number DESC LIMIT ?`,
      )
      .all(sessionId, limit) as RecentTurnRow[];

    return rows
      .reverse()
      .map((row) => {
        const events = parseEvents(row.accepted_events_json, "accepted_events_json");
        return {
          number: row.turn_number,
          playerAction: row.player_action,
          narration: row.narration,
          acceptedEventDescriptions: events.map((event) => event.description),
        };
      });
  }

  listTurns(sessionId: string): StoredTurn[] {
    const rows = this.db
      .prepare(
        `SELECT turn_number, player_action, narration, suggested_actions_json,
                proposed_events_json, accepted_events_json, memory_updates_json,
                summary_after, source, warning, clock_after, rule_notes_json,
                highlights_json, created_at
         FROM turns WHERE session_id = ?
         ORDER BY turn_number ASC`,
      )
      .all(sessionId) as TurnRow[];

    return rows.map((row) => ({
      number: row.turn_number,
      playerAction: row.player_action,
      narration: row.narration,
      suggestedActions: parseStringArray(row.suggested_actions_json, "suggested_actions_json"),
      proposedEvents: parseUnknownEvents(row.proposed_events_json, "proposed_events_json"),
      acceptedEvents: parseEvents(row.accepted_events_json, "accepted_events_json"),
      memoryUpdates: parseStringArray(row.memory_updates_json, "memory_updates_json"),
      summaryAfter: row.summary_after,
      source: row.source,
      warning: row.warning,
      clockAfter: row.clock_after,
      ruleNotes: parseStringArray(row.rule_notes_json, "rule_notes_json"),
      highlights: parseStringArray(row.highlights_json, "highlights_json"),
      createdAt: row.created_at,
    }));
  }

  appendTurn(
    session: GameSession,
    playerAction: string,
    prepared: PreparedTurn,
    now: string,
  ): GameSession {
    const nextTurnNumber = session.turnCount + 1;
    const endedAt =
      prepared.ended || prepared.nextState.clockMinutes >= NIGHT_LENGTH_MINUTES
        ? (session.endedAt ?? now)
        : session.endedAt;

    const transaction = this.db.transaction(() => {
      const update = this.db
        .prepare(
          `UPDATE sessions SET
             turn_count = @turnCount,
             location_id = @locationId,
             clock_minutes = @clockMinutes,
             ended_at = @endedAt,
             stats_json = @statsJson,
             summary = @summary,
             memories_json = @memoriesJson,
             unresolved_clues_json = @cluesJson,
             updated_at = @updatedAt
           WHERE id = @id AND turn_count = @expectedTurnCount`,
        )
        .run({
          id: session.id,
          expectedTurnCount: session.turnCount,
          turnCount: nextTurnNumber,
          locationId: prepared.nextState.locationId,
          clockMinutes: prepared.nextState.clockMinutes,
          endedAt,
          statsJson: JSON.stringify(prepared.nextState.stats),
          summary: prepared.summaryAfter,
          memoriesJson: JSON.stringify(prepared.nextState.memories),
          cluesJson: JSON.stringify(prepared.nextState.unresolvedClues),
          updatedAt: now,
        });

      if (update.changes !== 1) {
        throw new GameError(
          "TURN_CONFLICT",
          "这局游戏刚刚在别处推进了。请刷新存档后再试。",
          409,
          true,
        );
      }

      this.db.prepare(`DELETE FROM session_items WHERE session_id = ?`).run(session.id);
      const insertItem = this.db.prepare(
        `INSERT INTO session_items (session_id, item_id, position) VALUES (?, ?, ?)`,
      );
      prepared.nextState.inventory.forEach((itemId, index) => {
        insertItem.run(session.id, itemId, index);
      });

      this.db.prepare(`DELETE FROM session_flags WHERE session_id = ?`).run(session.id);
      const insertFlag = this.db.prepare(
        `INSERT INTO session_flags (session_id, flag_id, value) VALUES (?, ?, ?)`,
      );
      for (const [flagId, value] of Object.entries(prepared.nextState.flags)) {
        insertFlag.run(session.id, flagId, value ? 1 : 0);
      }

      this.db.prepare(`DELETE FROM session_relations WHERE session_id = ?`).run(session.id);
      const insertRelation = this.db.prepare(
        `INSERT INTO session_relations (session_id, npc_id, value, known_fact_ids_json)
         VALUES (?, ?, ?, ?)`,
      );
      for (const [npcId, relation] of Object.entries(prepared.nextState.relations)) {
        insertRelation.run(
          session.id,
          npcId,
          relation.value,
          JSON.stringify(relation.knownFactIds),
        );
      }

      this.db
        .prepare(
          `INSERT INTO turns (
             session_id, turn_number, player_action, narration, suggested_actions_json,
             proposed_events_json, accepted_events_json, memory_updates_json,
             summary_after, state_snapshot_json, source, warning, clock_after,
             rule_notes_json, highlights_json, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          session.id,
          nextTurnNumber,
          playerAction,
          prepared.narration,
          JSON.stringify(prepared.suggestedActions),
          JSON.stringify(prepared.proposedEvents),
          JSON.stringify(prepared.acceptedEvents),
          JSON.stringify(prepared.memoryUpdates),
          prepared.summaryAfter,
          JSON.stringify(prepared.nextState),
          prepared.source,
          prepared.warning,
          prepared.nextState.clockMinutes,
          JSON.stringify(prepared.ruleNotes),
          JSON.stringify(prepared.highlights),
          now,
        );
    });

    transaction();

    return {
      ...session,
      updatedAt: now,
      status: endedAt ? "ended" : "active",
      endedAt,
      turnCount: nextTurnNumber,
      state: prepared.nextState,
    };
  }

  close(): void {
    this.db.close();
  }
}

function parseRecord(text: string, field: string): Record<string, unknown> {
  const value = parseJson(text, field);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`数据库字段 ${field} 格式异常`);
  }
  return value as Record<string, unknown>;
}

function parseStringArray(text: string, field: string): string[] {
  const value = parseJson(text, field);
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`数据库字段 ${field} 格式异常`);
  }
  return value;
}

function parseEvents(text: string, field: string): AcceptedEvent[] {
  const value = parseJson(text, field);
  if (!Array.isArray(value)) {
    throw new Error(`数据库字段 ${field} 格式异常`);
  }
  return value as AcceptedEvent[];
}

function parseUnknownEvents(text: string, field: string): AllowedEvent[] {
  const value = parseJson(text, field);
  if (!Array.isArray(value)) {
    throw new Error(`数据库字段 ${field} 格式异常`);
  }
  return value as AllowedEvent[];
}

function parseJson(text: string, field: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`数据库字段 ${field} 不是合法 JSON`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
