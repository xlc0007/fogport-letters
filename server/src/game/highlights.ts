import type { AcceptedEvent } from "@fogport/shared";
import { getItem, getLocation, getNpc, world } from "./world.js";

const KEY_TERMS = [
  "无名信",
  "信封",
  "灯塔",
  "钟楼",
  "旧钟",
  "白鹭号",
  "林雾",
  "母亲",
  "钟声",
  "03:17",
];

export function deriveHighlights(
  narration: string,
  acceptedEvents: AcceptedEvent[],
): string[] {
  const candidates: string[] = [];

  const clockMatch = narration.match(/\b\d{2}:\d{2}\b/);
  if (clockMatch) candidates.push(clockMatch[0]);

  for (const event of acceptedEvents) {
    switch (event.type) {
      case "add_item":
      case "remove_item": {
        const item = getItem(event.itemId);
        if (item) candidates.push(item.name);
        break;
      }
      case "learn_fact": {
        const npc = getNpc(event.npcId);
        if (npc) {
          candidates.push(npc.name);
          const fact = npc.facts.find((entry) => entry.id === event.factId);
          if (fact) candidates.push(fact.label);
        }
        break;
      }
      case "change_relation": {
        const npc = getNpc(event.npcId);
        if (npc) candidates.push(npc.name);
        break;
      }
      case "move_location": {
        const location = getLocation(event.locationId);
        if (location) candidates.push(location.name);
        break;
      }
      case "set_flag": {
        const flag = world.flags.find((entry) => entry.id === event.flagId);
        if (flag) candidates.push(flag.label);
        break;
      }
      default:
        break;
    }
  }

  candidates.push(...KEY_TERMS);
  for (const npc of world.npcs) candidates.push(npc.name);
  for (const item of world.items) candidates.push(item.name);

  const quoteMatch = narration.match(/[「“]([^」”\n]{2,24})[」”]/);
  if (quoteMatch) candidates.push(quoteMatch[1]);

  const selected: string[] = [];
  for (const raw of candidates) {
    const phrase = raw.trim();
    if (!phrase || phrase.length > 30) continue;
    if (!narration.includes(phrase)) continue;
    if (selected.some((existing) => existing.includes(phrase) || phrase.includes(existing))) {
      continue;
    }
    selected.push(phrase);
    if (selected.length >= 3) break;
  }

  return selected;
}

export function pickHighlights(
  narration: string,
  acceptedEvents: AcceptedEvent[],
  modelHighlights: string[],
): string[] {
  return modelHighlights.length > 0
    ? modelHighlights
    : deriveHighlights(narration, acceptedEvents);
}
