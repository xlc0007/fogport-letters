/**
 * 前后端共享的 API 契约与展示模型。
 * 此文件只包含类型，不引入任何运行时模块。
 */

export type RequestedMode = "auto" | "qwen" | "demo";
export type ActiveMode = "qwen" | "demo";
export type TurnSource = "qwen" | "demo" | "safe-fallback";
export type SessionStatus = "active" | "ended";

export type AllowedEvent =
  | { type: "set_flag"; flagId: string; value: boolean }
  | { type: "add_item"; itemId: string }
  | { type: "remove_item"; itemId: string }
  | { type: "change_relation"; npcId: string; delta: number }
  | { type: "change_stat"; statId: string; delta: number }
  | { type: "move_location"; locationId: string }
  | { type: "learn_fact"; npcId: string; factId: string };

export type AcceptedEvent = AllowedEvent & { description: string };

export interface LocationView {
  id: string;
  name: string;
  description: string;
  exits: Array<{ id: string; name: string }>;
}

export interface StatView {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  description: string;
  condition: string;
}

export interface ClockView {
  elapsedMinutes: number;
  remainingMinutes: number;
  label: string;
  remainingLabel: string;
  phase: string;
}

export type EndingKind = "name_return" | "remembered" | "leave" | "unresolved";

export interface EndingView {
  kind: EndingKind;
  title: string;
  paragraphs: string[];
  causedBy: string[];
  npcId?: string;
  isTrueEnding?: boolean;
}

export type EndingChoiceId = "name_return" | "remembered" | "leave";

export interface EndingChoiceView {
  id: EndingChoiceId;
  title: string;
  description: string;
  action: string;
  requirement: string;
  available: boolean;
  blockedReason: string;
}

export interface KeyClueView {
  id: string;
  title: string;
  summary: string;
  found: boolean;
}

export interface QuestView {
  stageId: "letter" | "clock" | "dock" | "lighthouse" | "bell" | "resolved";
  mainQuest: string;
  objective: string;
  nextStep: string;
  chapterTitle: string;
  chapterPressure: string;
  hint: string;
  hintDetail: string;
  progress: string;
  recommendedAction: string | null;
  completed: boolean;
  keyClues: KeyClueView[];
}

export interface ItemView {
  id: string;
  name: string;
  description: string;
}

export interface RelationshipView {
  id: string;
  name: string;
  role: string;
  locationId: string;
  locationName: string;
  value: number;
  attitude: string;
  arcNote: string;
  knownFacts: string[];
}

export interface FlagView {
  id: string;
  label: string;
}

export interface GameStateView {
  playerName: string;
  status: SessionStatus;
  turnCount: number;
  clock: ClockView;
  location: LocationView;
  stats: StatView[];
  inventory: ItemView[];
  relationships: RelationshipView[];
  flags: FlagView[];
  unresolvedClues: string[];
  memories: string[];
  summary: string;
  ending: EndingView | null;
  quest: QuestView;
  finalChoices: EndingChoiceView[];
}

export interface SessionSnapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  openingNarration: string;
  openingSuggestions: string[];
  state: GameStateView;
}

export interface TurnView {
  number: number;
  playerAction: string;
  narration: string;
  suggestedActions: string[];
  acceptedEvents: AcceptedEvent[];
  memoryUpdates: string[];
  summaryAfter: string;
  source: TurnSource;
  warning: string | null;
  createdAt: string;
  clockAfter: string | null;
  ruleNotes: string[];
  highlights: string[];
}

export interface CreateSessionRequest {
  playerName?: string;
}

export interface SubmitTurnRequest {
  action: string;
}

export interface HealthResponse {
  status: "ok";
  mode: ActiveMode;
  requestedMode: RequestedMode;
  qwenConfigured: boolean;
  version: string;
  time: string;
}

export interface CreateSessionResponse {
  mode: ActiveMode;
  session: SessionSnapshot;
}

export interface GetSessionResponse {
  mode: ActiveMode;
  session: SessionSnapshot;
  turns: TurnView[];
}

export interface SubmitTurnResponse {
  mode: ActiveMode;
  state: GameStateView;
  turn: TurnView;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "SESSION_NOT_FOUND"
  | "SESSION_BUSY"
  | "TURN_CONFLICT"
  | "QWEN_CONFIG_MISSING"
  | "QWEN_UPSTREAM_ERROR"
  | "QWEN_TIMEOUT"
  | "QWEN_INVALID_OUTPUT"
  | "GAME_OVER"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
  };
}
