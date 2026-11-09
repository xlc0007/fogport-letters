import type { ModelTurnOutput } from "./model.js";

const REVEAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "寄件人身份",
    pattern: /寄件人[^。！？\n]{0,10}(?:就是|正是|是)(?:你|你自己|玩家)/,
  },
  {
    label: "寄件人身份",
    pattern: /信[^。！？\n]{0,10}(?:来自|出自|是)(?:你|你自己)/,
  },
  {
    label: "信由玩家所写",
    pattern: /(?:信|它)[^。！？\n]{0,10}(?:就是|正是|是)(?:你|你自己)[^。！？\n]{0,6}(?:写|寄)/,
  },
  {
    label: "信由玩家所写",
    pattern: /你(?:自己)?(?:亲手)?(?:写|寄)的(?:这封|那封)?信/,
  },
  {
    label: "笔迹属于玩家",
    pattern: /(?:笔迹|字迹)[^。！？\n]{0,20}[。！？]?[^。！？\n]{0,6}(?<!不)是(?:你|你自己)的/,
  },
  {
    label: "笔迹属于玩家",
    pattern:
      /(?:像|像极|相似)[^。！？\n]{0,4}(?:你|你自己)[^。！？\n]{0,10}(?:写字|笔迹|字迹|模样)/,
  },
  {
    label: "笔迹属于玩家",
    pattern:
      /不是(?:母亲|妈妈的?)[^。！？\n]{0,8}(?:笔迹|字迹|工整)[^。！？\n]{0,12}(?:而是|是)(?:你|你自己)[^。！？\n]{0,10}(?:写字|笔迹|字迹|模样)/,
  },
  {
    label: "童年书写",
    pattern: /你[^。！？\n]{0,8}(?:初学|小时候|童年)[^。！？\n]{0,8}(?:写字|笔迹|字迹)/,
  },
  {
    label: "写给未来的自己",
    pattern: /你[^。！？\n]{0,6}(?:写给|寄给)[^。！？\n]{0,6}(?:未来|自己)/,
  },
  {
    label: "年幼的玩家",
    pattern: /(?:年幼|小时候|童年)的你[^。！？\n]{0,10}(?:写|寄|信)/,
  },
  {
    label: "玩家获救经历",
    pattern: /二十年前[^。！？\n]{0,10}你[^。！？\n]{0,6}(?:获救|被救|从海里|从雾里)/,
  },
  {
    label: "母亲献名",
    pattern:
      /(?:母亲|林雾)[^。！？\n]{0,12}(?:用|拿|把|献出|交出|放弃)[^。！？\n]{0,8}(?:名字|记忆)[^。！？\n]{0,8}(?:换|救|留)/,
  },
  {
    label: "旧钟期限",
    pattern:
      /旧钟[^。！？\n]{0,12}(?:只|只能|会)[^。！？\n]{0,8}(?:留|保|持续|维持)[^。！？\n]{0,8}二十年/,
  },
];

export function findPrematureReveal(
  output: Pick<ModelTurnOutput, "narration" | "summary" | "memoryUpdate">,
  truthKnown: boolean,
): string | null {
  if (truthKnown) return null;
  const text = [output.narration, output.summary, ...output.memoryUpdate]
    .join("\n")
    .replace(/\r/g, "");
  const match = REVEAL_PATTERNS.find((entry) => entry.pattern.test(text));
  return match?.label ?? null;
}

export function buildRevealCorrection(label: string): string {
  return [
    `上一次叙述提前确认了尚未揭示的主线真相（${label}）。`,
    "在 truth_known 尚未激活时，禁止直接确认：寄件人是玩家、无名信由玩家所写、笔迹属于玩家、母亲用名字或记忆换回玩家、旧钟只保留二十年。",
    "可以保留“熟悉、像童年、似乎与自己有关”的不确定感，但不能下结论。",
    "请完整重写整份 JSON，不要解释这条要求。",
  ].join("\n");
}

export const REVEAL_WARNING =
  "雾让这次讲述变得模糊；已经确认的变化仍然保留，其余部分没有留下痕迹。";
