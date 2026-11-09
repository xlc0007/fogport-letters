import type { QuestView } from "@fogport/shared";
import type { GameState } from "./model.js";
import { getLocation } from "./world.js";
import { fogportStory } from "./story.js";
import { getChapterBeat } from "./beats.js";

interface RouteHop {
  distance: number;
  hopId: string;
}

export function getKeyClueCount(state: GameState): number {
  return fogportStory.keyClues.filter((clue) => state.flags[clue.flagId] === true).length;
}

export function keyClueProgressLabel(state: GameState): string {
  return `关键线索 ${getKeyClueCount(state)} / ${fogportStory.keyClues.length}`;
}

export function getQuestGuide(state: GameState, ended = false): QuestView {
  const name = state.playerName;
  const mainQuest = fogportStory.mainQuestTemplate.replace("{name}", name);
  const keyClues = buildKeyClues(state);

  if (ended || state.clockMinutes >= 240) {
    const chapter = getChapterBeat("resolved");
    return {
      stageId: "resolved",
      mainQuest,
      objective: "这一夜已经结束。",
      nextStep: "故事会在结局页收束。",
      chapterTitle: chapter.title,
      chapterPressure: chapter.pressure,
      hint: "你可以重新开始，尝试另一种阻止遗忘的方法。",
      hintDetail: "不同的线索、信任和最终选择会导向不同结局。",
      progress: "结局",
      recommendedAction: null,
      completed: true,
      keyClues,
    };
  }

  const has = (flagId: string) => state.flags[flagId] === true;
  const progress = keyClueProgressLabel(state);

  if (!has("letter_opened")) {
    const chapter = getChapterBeat("letter");
    return {
      stageId: "letter",
      mainQuest,
      objective: "查明无名信的寄件人",
      nextStep: "在灯下检查无名信，寻找寄件人的痕迹",
      chapterTitle: chapter.title,
      chapterPressure: chapter.pressure,
      hint: "先留在中央邮局：答案从你手里的信封开始。",
      hintDetail: "看清纸张、背面和封口；这封信的笔迹与你本人有关。",
      progress,
      recommendedAction: "在灯下检查这封无名信",
      completed: false,
      keyClues,
    };
  }

  if (!has("clue_stopped_clock")) {
    return atLocation(
      state,
      "clock",
      mainQuest,
      progress,
      "确认 03:17 与白鹭号沉没的关系",
      "检查钟楼停摆的指针",
      "前往钟楼广场，核对停摆的钟面",
      "去钟楼广场，看看停摆的钟。",
      "爬上钟楼检修旋梯，检查卡在齿轮里的指针；把它与邮局挂钟的时间对照。",
    );
  }

  if (!has("clue_ship_plaque")) {
    return atLocation(
      state,
      "dock",
      mainQuest,
      progress,
      "查明白鹭号与林雾的过去",
      "在旧泊位打捞沉船遗物",
      "前往旧码头，寻找白鹭号的遗物",
      "去旧码头找阿礁：白鹭号的残骸里应该有名字。",
      "查看旧泊位水下或铜牌上的名录，留意“林雾”和那批无法投递的信。",
    );
  }

  if (!has("clue_lighthouse_log")) {
    return atLocation(
      state,
      "lighthouse",
      mainQuest,
      progress,
      "找到阻止雾港忘记你的方法",
      "翻阅灯室里的旧日志",
      "前往北岸灯塔，查阅灯室日志",
      "去北岸灯塔找何姨，问她旧钟和日志的事。",
      "翻阅灯室桌上的旧日志，找“雾吞名字，钟留回声”那一页。",
    );
  }

  return atLocation(
    state,
    "bell",
    mainQuest,
    progress,
    "做出最后的选择，阻止雾港忘记你",
    "在灯塔钟室敲响旧钟，念出自己的名字",
    "前往北岸灯塔，做出最后的选择",
    "最后的选择在灯塔钟室：带着无名信上去。",
    "你可以敲响旧钟、把信托付给信任的人，或在旧码头离开雾港。屏幕下方会显示可用的结局选择。",
    "做出最后选择：敲钟、托付，或去旧码头离港",
  );
}

function atLocation(
  state: GameState,
  stageId: QuestView["stageId"],
  mainQuest: string,
  progress: string,
  objective: string,
  localAction: string,
  travelStep: string,
  hint: string,
  hintDetail: string,
  localStep = localAction,
): QuestView {
  const target = stageId === "clock"
    ? "clock_square"
    : stageId === "dock"
      ? "dock"
      : "lighthouse";
  const targetName = locationName(target);
  const route = routeTo(state.locationId, target);
  const chapter = getChapterBeat(stageId);

  if (route === null) {
    return {
      stageId,
      mainQuest,
      objective,
      nextStep: localStep,
      chapterTitle: chapter.title,
      chapterPressure: chapter.pressure,
      hint,
      hintDetail,
      progress,
      recommendedAction: localAction,
      completed: false,
      keyClues: buildKeyClues(state),
    };
  }

  const nextStep = route.distance === 1 ? travelStep : `先经${locationName(route.hopId)}前往${targetName}`;
  return {
    stageId,
    mainQuest,
    objective,
    nextStep,
    chapterTitle: chapter.title,
    chapterPressure: chapter.pressure,
    hint,
    hintDetail,
    progress,
    recommendedAction: `沿雾前往${locationName(route.hopId)}`,
    completed: false,
    keyClues: buildKeyClues(state),
  };
}

function buildKeyClues(state: GameState): QuestView["keyClues"] {
  return fogportStory.keyClues.map((clue) => {
    const found = state.flags[clue.flagId] === true;
    return {
      id: clue.id,
      title: found ? clue.title : "尚未确认的线索",
      summary: found ? clue.summary : "",
      found,
    };
  });
}

function routeTo(fromId: string, toId: string): RouteHop | null {
  if (fromId === toId) return null;
  const from = getLocation(fromId);
  if (!from) return null;

  const queue: Array<{ id: string; firstHop: string | null; distance: number }> = [];
  const visited = new Set<string>([from.id]);
  for (const exitId of from.exits) {
    queue.push({ id: exitId, firstHop: exitId, distance: 1 });
    visited.add(exitId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === toId && current.firstHop) {
      return { hopId: current.firstHop, distance: current.distance };
    }
    const location = getLocation(current.id);
    if (!location) continue;
    for (const exitId of location.exits) {
      if (visited.has(exitId)) continue;
      visited.add(exitId);
      queue.push({
        id: exitId,
        firstHop: current.firstHop,
        distance: current.distance + 1,
      });
    }
  }
  return null;
}

function locationName(id: string): string {
  return getLocation(id)?.name ?? id;
}

export interface QuestActionEffect {
  stageId: QuestView["stageId"];
  targetLocationId: string | null;
  hopLocationId: string | null;
  requiredFlagIds: string[];
}

export function getQuestActionEffect(
  state: GameState,
  action: string,
): QuestActionEffect | null {
  const guide = getQuestGuide(state);
  if (!guide.recommendedAction || action.trim() !== guide.recommendedAction) {
    return null;
  }

  if (guide.stageId === "letter") {
    return {
      stageId: "letter",
      targetLocationId: null,
      hopLocationId: null,
      requiredFlagIds: ["letter_opened"],
    };
  }

  const targetByStage: Partial<Record<QuestView["stageId"], string>> = {
    clock: "clock_square",
    dock: "dock",
    lighthouse: "lighthouse",
    bell: "lighthouse",
  };
  const flagsByStage: Partial<Record<QuestView["stageId"], string[]>> = {
    clock: ["clue_stopped_clock"],
    dock: ["clue_ship_plaque"],
    lighthouse: ["clue_lighthouse_log"],
  };

  const target = targetByStage[guide.stageId];
  if (!target) return null;

  if (state.locationId === target) {
    return {
      stageId: guide.stageId,
      targetLocationId: target,
      hopLocationId: null,
      requiredFlagIds: flagsByStage[guide.stageId] ?? [],
    };
  }

  const route = routeTo(state.locationId, target);
  if (!route) return null;
  return {
    stageId: guide.stageId,
    targetLocationId: target,
    hopLocationId: route.hopId,
    requiredFlagIds: [],
  };
}
