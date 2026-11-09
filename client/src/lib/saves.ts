import type { SessionSnapshot, SessionStatus } from "@fogport/shared";

const SAVES_STORAGE_KEY = "fogport.saves.v1";
const MAX_SAVES = 20;

export interface SavedGame {
  id: string;
  playerName: string;
  turnCount: number;
  locationName: string;
  clockLabel: string;
  status: SessionStatus;
  endingTitle?: string;
  updatedAt: string;
  savedAt: string;
}

function isSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedGame>;
  return (
    typeof item.id === "string" &&
    typeof item.playerName === "string" &&
    typeof item.turnCount === "number" &&
    typeof item.locationName === "string" &&
    typeof item.clockLabel === "string" &&
    (item.status === "active" || item.status === "ended") &&
    typeof item.updatedAt === "string" &&
    typeof item.savedAt === "string"
  );
}

export function listSavedGames(): SavedGame[] {
  try {
    const raw = window.localStorage.getItem(SAVES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedGame)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, MAX_SAVES);
  } catch {
    return [];
  }
}

function writeSavedGames(games: SavedGame[]): void {
  try {
    window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(games));
  } catch {
    // 存储不可用时仍可继续游玩，只是主页无法记住历史存档。
  }
}

export function recordSavedGame(session: SessionSnapshot): SavedGame[] {
  const state = session.state;
  const entry: SavedGame = {
    id: session.id,
    playerName: state.playerName,
    turnCount: state.turnCount,
    locationName: state.location.name,
    clockLabel: state.clock.label,
    status: state.status,
    endingTitle: state.ending?.title,
    updatedAt: session.updatedAt,
    savedAt: new Date().toISOString(),
  };
  const next = [
    entry,
    ...listSavedGames().filter((game) => game.id !== entry.id),
  ].slice(0, MAX_SAVES);
  writeSavedGames(next);
  return next;
}

export function removeSavedGame(id: string): SavedGame[] {
  const next = listSavedGames().filter((game) => game.id !== id);
  writeSavedGames(next);
  return next;
}

export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
