import { z } from "zod";

const eventShape = {
  set_flag: z.strictObject({
    type: z.literal("set_flag"),
    flagId: z.string().min(1).max(64),
    value: z.boolean(),
  }),
  add_item: z.strictObject({
    type: z.literal("add_item"),
    itemId: z.string().min(1).max(64),
  }),
  remove_item: z.strictObject({
    type: z.literal("remove_item"),
    itemId: z.string().min(1).max(64),
  }),
  change_relation: z.strictObject({
    type: z.literal("change_relation"),
    npcId: z.string().min(1).max(64),
    delta: z.number().int().min(-10).max(10),
  }),
  change_stat: z.strictObject({
    type: z.literal("change_stat"),
    statId: z.string().min(1).max(64),
    delta: z.number().int().min(-10).max(10),
  }),
  move_location: z.strictObject({
    type: z.literal("move_location"),
    locationId: z.string().min(1).max(64),
  }),
  learn_fact: z.strictObject({
    type: z.literal("learn_fact"),
    npcId: z.string().min(1).max(64),
    factId: z.string().min(1).max(64),
  }),
};

export const allowedEventSchema = z.discriminatedUnion("type", [
  eventShape.set_flag,
  eventShape.add_item,
  eventShape.remove_item,
  eventShape.change_relation,
  eventShape.change_stat,
  eventShape.move_location,
  eventShape.learn_fact,
]);

export const modelTurnOutputSchema = z.strictObject({
  narration: z.string().trim().min(20).max(2000),
  proposedEvents: z.array(allowedEventSchema).max(4),
  suggestedActions: z.array(z.string().trim().min(1).max(48)).min(1).max(3),
  memoryUpdate: z.array(z.string().trim().min(2).max(160)).max(4),
  summary: z.string().trim().min(10).max(400),
  highlights: z.array(z.string()).optional().catch(undefined),
});

export type ParsedModelTurn = z.infer<typeof modelTurnOutputSchema>;

export const createSessionInputSchema = z.strictObject({
  playerName: z
    .string()
    .trim()
    .min(1, "代号不能为空")
    .max(16, "代号最多 16 个字符")
    .regex(/^[^\u0000-\u001f\u007f]+$/, "代号不能包含控制字符")
    .optional(),
});

export const submitTurnInputSchema = z.strictObject({
  action: z
    .string()
    .trim()
    .min(1, "行动不能为空")
    .max(500, "行动最多 500 个字符"),
});

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("响应中没有可解析的 JSON 对象。");
    }
    return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  }
}

export function formatSchemaIssues(error: z.ZodError, limit = 6): string[] {
  return error.issues.slice(0, limit).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "根对象";
    return `${path}：${issue.message}`;
  });
}

export function sanitizeHighlights(narration: string, highlights: unknown): string[] {
  if (!Array.isArray(highlights)) return [];
  const unique = new Set<string>();
  for (const raw of highlights) {
    if (typeof raw !== "string") continue;
    const phrase = raw.trim();
    if (!phrase || phrase.length > 60) continue;
    if (!narration.includes(phrase)) continue;
    unique.add(phrase);
    if (unique.size >= 3) break;
  }
  return [...unique];
}
