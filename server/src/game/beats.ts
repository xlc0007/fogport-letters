import type { QuestView } from "@fogport/shared";
import type { GameState } from "./model.js";

export interface ChapterBeat {
  title: string;
  pressure: string;
}

const CHAPTER_BEATS: Record<QuestView["stageId"], ChapterBeat> = {
  letter: {
    title: "第一幕 · 最后一班死信",
    pressure: "老周把分拣台的灯拨暗了一点。他不想让你把那封没有收件人的信带出邮局。",
  },
  clock: {
    title: "第二幕 · 停摆的城",
    pressure: "钟楼的门在身后合上。雾里有人用你的声音叫了一声名字，随后只剩齿轮空转的回响。",
  },
  dock: {
    title: "第三幕 · 涨潮之前",
    pressure: "潮水正漫过旧泊位。阿礁说再晚一刻，白鹭号的残骸就会被永远压在船底。",
  },
  lighthouse: {
    title: "第四幕 · 灯室的门",
    pressure: "何姨挡在钟室前。她要知道你愿意拿什么去换一个不被忘记的名字。",
  },
  bell: {
    title: "终幕 · 最后一声钟",
    pressure: "钟绳就在手边。每过一分钟，雾就更近一尺。",
  },
  resolved: {
    title: "终章",
    pressure: "这一夜已经结束。",
  },
};

interface NpcArc {
  early: string;
  mid: string;
  trusted: string;
}

const NPC_ARCS: Record<string, NpcArc> = {
  zhou: {
    early: "他把最旧的分拣格锁着，钥匙从不离身。",
    mid: "那晚的退信被他锁进最底层，每年同一天都会取出来看一次。",
    trusted: "他把那枚旧钥匙放在你掌心。四十年的沉默，终于有了一个开口。",
  },
  he: {
    early: "她守着灯塔，也守着钟室的门。",
    mid: "钟室断掉的绳头始终没有换，她像在等谁来把它接上。",
    trusted: "她终于转过身来，认真看着你，像在确认一个久别的人。",
  },
  jiao: {
    early: "他总把白鹭号的残件留在船坞最深处。",
    mid: "他记得那晚从水里抱起的重量，却从未对任何人说起。",
    trusted: "他把沾满桐油的手擦干，朝你伸了过来。",
  },
  wen: {
    early: "书店最里面的那本书从不借人。",
    mid: "那张照片是替某个人保管的一句没说完的话。",
    trusted: "她把书店最里面那盏灯调亮，示意你坐下。",
  },
};

export function getChapterBeat(stageId: QuestView["stageId"]): ChapterBeat {
  return CHAPTER_BEATS[stageId];
}

export function getNpcArcNote(state: GameState, npcId: string): string {
  const arc = NPC_ARCS[npcId];
  if (!arc) return "";
  const relation = state.relations[npcId];
  if (!relation) return arc.early;
  if (relation.value >= 65) return arc.trusted;
  if (relation.knownFactIds.length > 0) return arc.mid;
  return arc.early;
}
