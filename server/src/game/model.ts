import type { AllowedEvent } from "@fogport/shared";

export interface StatDefinition {
  id: string;
  label: string;
  description: string;
  initial: number;
  min: number;
  max: number;
  maxDelta: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  protected?: boolean;
}

export interface FlagDefinition {
  id: string;
  label: string;
  clueText?: string;
  serverOnly?: boolean;
}

export interface NpcFactDefinition {
  id: string;
  label: string;
  text: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  locationId: string;
  initialRelation: number;
  greeting: string;
  facts: NpcFactDefinition[];
}

export interface LocationExploreDefinition {
  flagId: string;
  itemId?: string;
  action: string;
  narration: string;
  memory: string;
}

export interface LocationDefinition {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  exits: string[];
  npcId?: string;
  explore: LocationExploreDefinition;
}

export interface WorldDefinition {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  premise: string;
  hiddenTruth: string;
  styleGuide: string;
  startLocationId: string;
  stats: StatDefinition[];
  items: ItemDefinition[];
  flags: FlagDefinition[];
  npcs: NpcDefinition[];
  locations: LocationDefinition[];
  initialInventory: string[];
  initialMemories: string[];
  initialClue: string;
  inventoryMax: number;
  maxEventsPerTurn: number;
  relationMaxDelta: number;
}

export interface RelationState {
  value: number;
  knownFactIds: string[];
}

export interface GameState {
  playerName: string;
  locationId: string;
  clockMinutes: number;
  stats: Record<string, number>;
  inventory: string[];
  flags: Record<string, boolean>;
  relations: Record<string, RelationState>;
  summary: string;
  memories: string[];
  unresolvedClues: string[];
}

export interface GameSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "ended";
  endedAt: string | null;
  turnCount: number;
  openingNarration: string;
  openingSuggestions: string[];
  state: GameState;
}

export interface RecentTurn {
  number: number;
  playerAction: string;
  narration: string;
  acceptedEventDescriptions: string[];
}

export interface ModelTurnOutput {
  narration: string;
  proposedEvents: AllowedEvent[];
  suggestedActions: string[];
  memoryUpdate: string[];
  summary: string;
  highlights?: string[];
}
