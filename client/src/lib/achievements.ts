import type { EndingKind, GameStateView, SessionSnapshot } from "@fogport/shared";
import type { SavedGame } from "./saves";

const ACHIEVEMENTS_STORAGE_KEY = "fogport.achievements.v1";
const LOCATION_IDS = ["post_office", "clock_square", "rose_alley", "dock", "lighthouse"];
const BASE_ENDING_KINDS: EndingKind[] = [
  "name_return",
  "remembered",
  "leave",
  "unresolved",
];

interface AchievementStore {
  unlocked: Record<string, string>;
  visitedLocations: string[];
  seenEndings: EndingKind[];
}

export interface AchievementView {
  id: string;
  title: string;
  description: string;
  glyph: string;
  secret: boolean;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: string | null;
}

interface AchievementContext {
  state: GameStateView;
  saves: SavedGame[];
  visitedLocations: string[];
  seenEndings: EndingKind[];
}

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  glyph: string;
  secret?: boolean;
  check: (context: AchievementContext) => boolean;
  progress?: (context: AchievementContext) => string | null;
}

function hasFlag(state: GameStateView, flagId: string): boolean {
  return state.flags.some((flag) => flag.id === flagId);
}

function trustedCount(state: GameStateView): number {
  return state.relationships.filter((person) => person.value >= 65).length;
}

function foundKeyClues(state: GameStateView): number {
  return state.quest.keyClues.filter((clue) => clue.found).length;
}

function seenBaseEndings(seen: EndingKind[]): number {
  return BASE_ENDING_KINDS.filter((kind) => seen.includes(kind)).length;
}

const DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first_night",
    title: "第一夜",
    description: "领取今夜的邮包，开始第一次夜班。",
    glyph: "夜",
    check: () => true,
  },
  {
    id: "letter_opened",
    title: "在灯下",
    description: "拆开无名信，看见纸面浮出的第一句话。",
    glyph: "信",
    check: ({ state }) => hasFlag(state, "letter_opened"),
  },
  {
    id: "side_stories",
    title: "旧纸与照片",
    description: "把死信与旧照片两条支线都读进记忆。",
    glyph: "照",
    check: ({ state }) =>
      hasFlag(state, "clue_dead_letters") && hasFlag(state, "clue_old_photo"),
    progress: ({ state }) => {
      const found =
        Number(hasFlag(state, "clue_dead_letters")) + Number(hasFlag(state, "clue_old_photo"));
      return `${found}/2 条支线`;
    },
  },
  {
    id: "three_clues",
    title: "把线索连成线",
    description: "集齐三条关键线索，拼出无名信背后的过去。",
    glyph: "线",
    check: ({ state }) => foundKeyClues(state) === state.quest.keyClues.length,
    progress: ({ state }) => `${foundKeyClues(state)}/${state.quest.keyClues.length} 条关键线索`,
  },
  {
    id: "someone_trusts",
    title: "有人愿意相信",
    description: "与至少一位人物建立足够的信任。",
    glyph: "人",
    check: ({ state }) => trustedCount(state) >= 1,
    progress: ({ state }) => `${trustedCount(state)}/4 位人物`,
  },
  {
    id: "all_trusted",
    title: "四个人的灯",
    description: "让老周、何姨、阿礁、温简都愿意相信你。",
    glyph: "灯",
    check: ({ state }) => trustedCount(state) === 4,
    progress: ({ state }) => `${trustedCount(state)}/4 位人物`,
  },
  {
    id: "explorer",
    title: "雾港的角落",
    description: "到访雾港的五个主要地点。",
    glyph: "图",
    check: ({ visitedLocations }) =>
      LOCATION_IDS.every((id) => visitedLocations.includes(id)),
    progress: ({ visitedLocations }) =>
      `${LOCATION_IDS.filter((id) => visitedLocations.includes(id)).length}/5 个地点`,
  },
  {
    id: "archivist",
    title: "五个夜晚",
    description: "在存档库留下五个不同的夜晚。",
    glyph: "册",
    check: ({ saves }) => saves.length >= 5,
    progress: ({ saves }) => `${saves.length}/5 个夜晚`,
  },
  {
    id: "first_ending",
    title: "第一次告别",
    description: "走到这一夜的任意一个结局。",
    glyph: "终",
    check: ({ state }) => Boolean(state.ending),
  },
  {
    id: "name_return",
    title: "名字归来",
    description: "在灯塔钟室敲响旧钟，念出自己的名字。",
    glyph: "名",
    secret: true,
    check: ({ state }) =>
      state.ending?.kind === "name_return" && !state.ending.isTrueEnding,
  },
  {
    id: "remembered",
    title: "有人记得我",
    description: "把无名信托付给一个信任你的人。",
    glyph: "记",
    secret: true,
    check: ({ state }) => state.ending?.kind === "remembered",
  },
  {
    id: "leave",
    title: "离港带信",
    description: "在旧码头登船，带着无名信离开雾港。",
    glyph: "舟",
    secret: true,
    check: ({ state }) => state.ending?.kind === "leave",
  },
  {
    id: "unresolved",
    title: "雾中留任",
    description: "时间走到 07:17，雾港忘记了你的名字。",
    glyph: "雾",
    secret: true,
    check: ({ state }) => state.ending?.kind === "unresolved",
  },
  {
    id: "true_ending",
    title: "雾散之后",
    description: "完成完整调查，在旧钟前让名字与记忆一起归来。",
    glyph: "晴",
    secret: true,
    check: ({ state }) => state.ending?.isTrueEnding === true,
  },
  {
    id: "all_endings",
    title: "四种告别",
    description: "在存档中见证四类基础结局。",
    glyph: "四",
    secret: true,
    check: ({ seenEndings }) => seenBaseEndings(seenEndings) === BASE_ENDING_KINDS.length,
  },
];

function emptyStore(): AchievementStore {
  return { unlocked: {}, visitedLocations: [], seenEndings: [] };
}

function readStore(): AchievementStore {
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();
    const value = parsed as Partial<AchievementStore>;
    const unlocked =
      value.unlocked && typeof value.unlocked === "object" ? value.unlocked : {};
    return {
      unlocked: Object.fromEntries(
        Object.entries(unlocked).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      visitedLocations: Array.isArray(value.visitedLocations)
        ? value.visitedLocations.filter((id): id is string => typeof id === "string")
        : [],
      seenEndings: Array.isArray(value.seenEndings)
        ? value.seenEndings.filter(
            (kind): kind is EndingKind =>
              typeof kind === "string" &&
              BASE_ENDING_KINDS.includes(kind as EndingKind),
          )
        : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: AchievementStore): void {
  try {
    window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用时只影响成就记录，不影响当前游戏。
  }
}

function buildView(
  definition: AchievementDefinition,
  unlockedAt: string | undefined,
  progress: string | null,
): AchievementView {
  const unlocked = Boolean(unlockedAt);
  return {
    id: definition.id,
    title: unlocked || !definition.secret ? definition.title : "隐藏成就",
    description:
      unlocked || !definition.secret
        ? definition.description
        : "继续走进雾里，徽记会在合适的时候亮起。",
    glyph: unlocked || !definition.secret ? definition.glyph : "?",
    secret: Boolean(definition.secret),
    unlocked,
    unlockedAt: unlockedAt ?? null,
    progress: unlocked ? null : progress,
  };
}

export function listAchievements(): AchievementView[] {
  const store = readStore();
  return DEFINITIONS.map((definition) =>
    buildView(definition, store.unlocked[definition.id], null),
  );
}

export interface AchievementEvaluation {
  achievements: AchievementView[];
  newlyUnlocked: AchievementView[];
}

export function evaluateAchievements(
  session: SessionSnapshot,
  saves: SavedGame[],
): AchievementEvaluation {
  const store = readStore();
  const visitedLocations = [...new Set([...store.visitedLocations, session.state.location.id])];
  const seenEndings = [...store.seenEndings];
  if (session.state.ending) {
    const kind = session.state.ending.kind;
    if (!seenEndings.includes(kind)) seenEndings.push(kind);
  }

  const context: AchievementContext = {
    state: session.state,
    saves,
    visitedLocations,
    seenEndings,
  };
  const unlocked = { ...store.unlocked };
  const newlyUnlocked: AchievementView[] = [];
  const achievements: AchievementView[] = [];

  for (const definition of DEFINITIONS) {
    const progress = definition.progress?.(context) ?? null;
    const wasUnlocked = Boolean(unlocked[definition.id]);
    if (!wasUnlocked && definition.check(context)) {
      const unlockedAt = new Date().toISOString();
      unlocked[definition.id] = unlockedAt;
      const view = buildView(definition, unlockedAt, null);
      newlyUnlocked.push(view);
      achievements.push(view);
      continue;
    }
    achievements.push(
      buildView(definition, unlocked[definition.id], progress),
    );
  }

  const nextStore: AchievementStore = {
    unlocked,
    visitedLocations,
    seenEndings,
  };
  writeStore(nextStore);
  return { achievements, newlyUnlocked };
}
