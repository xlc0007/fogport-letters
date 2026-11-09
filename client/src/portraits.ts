import linJianwu from "./assets/portraits/lin_jianwu.webp";
import zhou from "./assets/portraits/zhou.webp";
import he from "./assets/portraits/he.webp";
import jiao from "./assets/portraits/jiao.webp";
import wen from "./assets/portraits/wen.webp";
import linWu from "./assets/portraits/lin_wu.webp";

export const PORTRAITS = {
  lin_jianwu: {
    src: linJianwu,
    name: "林见雾",
    role: "夜班邮差",
  },
  zhou: {
    src: zhou,
    name: "老周",
    role: "中央邮局夜班主管",
  },
  he: {
    src: he,
    name: "何姨",
    role: "北岸灯塔守夜人",
  },
  jiao: {
    src: jiao,
    name: "阿礁",
    role: "旧码头修船匠",
  },
  wen: {
    src: wen,
    name: "温简",
    role: "雾灯书店老板",
  },
  lin_wu: {
    src: linWu,
    name: "林雾",
    role: "记忆中的母亲",
  },
} as const;

export type PortraitId = keyof typeof PORTRAITS;

export const NPC_PORTRAIT_IDS: Record<string, PortraitId> = {
  zhou: "zhou",
  he: "he",
  jiao: "jiao",
  wen: "wen",
};
