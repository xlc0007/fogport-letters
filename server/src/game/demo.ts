import type { AllowedEvent } from "@fogport/shared";
import type { GameState, ModelTurnOutput } from "./model.js";
import { validateAndApplyEvents } from "./events.js";
import {
  getItem,
  getLocation,
  getNpc,
  npcAtLocation,
  world,
} from "./world.js";
import type { TurnPromptContext } from "../ai/prompt.js";
import { fogportStory } from "./story.js";
import { getNpcArcNote } from "./beats.js";
import { getQuestGuide } from "./quest.js";

const TRAVEL_INTENT = /去|前往|走向|走到|走进|离开|回到|返回|赶去|朝|出发|过去|来到|逛逛|逛到|移步|动身|推门/;
const TALK_INTENT = /问|聊|打听|交谈|说话|告诉|询问|喊|叫住|请教|求证|试探|对.{0,4}说|开口/;
const EXPLORE_INTENT = /翻|找|搜|检查|调查|探索|查看|看看|观察|端详|研究|摸|打捞|查阅|翻阅|打开|打量|核对|逛|看看|查看|辨认|留意/;
const REST_INTENT = /休息|歇|喘口气|喘一口气|坐一会儿|坐下|等待|打个盹|缓一缓|缓口气/;
const LETTER_INTENT = /拆开|打开|展开|读|查看|检查|端详|举到灯下|相信|琢磨|研究|看|背面|墨迹|信纸|泡开|翻到/;
const LETTER_TOPIC = /无名信|信封|这封信|那封信|写着.{0,8}名字|名字.{0,6}信/;
const LETTER_EXCLUSION = /退回信|死信|分拣台|信堆|一捆|老周|邮票/;

const NPC_ALIASES: Record<string, string[]> = {
  zhou: ["老周", "周叔", "邮局主管"],
  he: ["何姨", "守夜人", "灯塔婆婆"],
  jiao: ["阿礁", "船匠", "修船匠"],
  wen: ["温简", "书店老板", "简姐"],
};

const LOCATION_ALIASES: Record<string, string[]> = {
  post_office: ["中央邮局", "邮局", "分拣室", "值班室"],
  clock_square: ["钟楼广场", "钟楼", "广场"],
  dock: ["旧码头", "码头", "泊位", "防波堤"],
  rose_alley: ["蔷薇巷", "巷子", "雾灯书店", "书店"],
  lighthouse: ["北岸灯塔", "灯塔", "北岸", "钟室"],
};

const NPC_DIALOGUE: Record<string, string[]> = {
  zhou: [
    "“夜班邮差最该学会的事，是别问一封死信要去找谁。”",
    "“有些信不是寄丢了，是寄到了不该到的地方。”",
    "“我在这间邮局干了四十年，只有那一晚，雾走进了屋里。”",
  ],
  he: [
    "“钟不是坏了。它在等一个还记得自己名字的人。”",
    "“你听，海面每十二秒亮一次。可有些东西，二十年才回来一次。”",
    "“别把名字交给雾。哪怕你只记得一半，也要把它攥紧。”",
  ],
  jiao: [
    "“白鹭号沉的那晚，我在岸上。我听见钟响，只响了一半。”",
    "“船底的钢板会记住撞击，人却不一定。你说怪不怪。”",
    "“有些东西捞上来就该扔回海里。可我总舍不得。”",
  ],
  wen: [
    "“你以为自己是来送信的。其实有些信，是回来找你的。”",
    "“雾灯书店不卖地图。因为雾港的地图，每天早上都不一样。”",
    "“照片比人诚实。它不会记得自己忘了什么。”",
  ],
};

const TRUST_LINES: Record<string, string> = {
  zhou: "老周沉默了很久，终于把那串从不离身的旧钥匙放在了柜台上。",
  he: "何姨第一次转过身来，认真地看着你，像在确认一个久别的人。",
  jiao: "阿礁把沾满桐油的手在围裙上擦干，朝你伸了过来。",
  wen: "温简把书店最里面那盏灯调亮了一些，示意你坐下。",
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

interface DemoResult {
  output: ModelTurnOutput;
}

export function generateDemoTurn(context: TurnPromptContext): ModelTurnOutput {
  return buildDemoTurn(context).output;
}

function buildDemoTurn(context: TurnPromptContext): DemoResult {
  const { session, playerAction } = context;
  const state = session.state;
  const action = playerAction.trim();
  const seed = hashSeed(`${session.id}:${session.turnCount + 1}:${action}`);
  const location = getLocation(state.locationId);
  if (!location) {
    throw new Error(`未知地点：${state.locationId}`);
  }

  const currentNpc = npcAtLocation(location.id);
  const mentionedNpcIds = findMentionedNpcs(action);
  const movementDestination = findMovementDestination(action, state.locationId);
  const isLetterFocused = isLetterAction(action);
  const hasLetter = state.inventory.includes("nameless_letter");
  const talkTarget = resolveTalkTarget(mentionedNpcIds, currentNpc?.id, action);

  const events: AllowedEvent[] = [];
  const memoryUpdate: string[] = [];
  let narration = "";
  let outcome = "";

  if (movementDestination) {
    if (movementDestination === state.locationId) {
      narration = genericNarration(location.atmosphere, action, seed);
      outcome = `你留在${location.name}，没有急着离开。`;
    } else {
      const destination = getLocation(movementDestination);
      if (!destination) {
        narration = genericNarration(location.atmosphere, action, seed);
        outcome = `你试着辨认方向，却只在雾里绕了一圈。`;
      } else if (location.exits.includes(destination.id)) {
        events.push({ type: "move_location", locationId: destination.id });
        const arrival = pick(
          [
            `你把无名信按进邮包，沿着湿透的石板路向${destination.name}走去。雾在身后合拢，像替${location.name}关上了一扇门。`,
            `你离开${location.name}。灯笼的光被雾削成一小团，走到${destination.name}时，鞋底已经湿透。`,
            `你选择去${destination.name}。沿途的窗都黑着，只有潮声跟着你转过街角。`,
          ],
          seed,
        );
        const npcThere = npcAtLocation(destination.id);
        narration = `${arrival}\n\n${destination.atmosphere}${
          npcThere ? `\n\n${npcThere.greeting}` : ""
        }`;
        outcome = `你从${location.name}来到了${destination.name}${npcThere ? `，${npcThere.name}正在附近` : ""}。`;
      } else {
        const routes = location.exits
          .flatMap((exitId) => getLocation(exitId) ?? [])
          .map((entry) => entry.name)
          .join("、");
        narration = `你朝${destination.name}的方向走了几步，雾便在街口合拢。脚下的石板像被谁悄悄挪动过，转了一圈，你又回到了${location.name}。\n\n${location.atmosphere}\n\n要抵达那里，得先经过${routes}。`;
        outcome = `你想直接去${destination.name}，却被雾挡回了${location.name}。`;
      }
    }
  } else if (isLetterFocused && hasLetter) {
    if (state.flags.letter_opened) {
      events.push({ type: "change_stat", statId: "insight", delta: 1 });
      const inspectingInk = /背面|墨迹|水|泡|灯|字迹|纸/.test(action);
      narration = inspectingInk
        ? "你把无名信翻到背面，纸页在灯下几乎透明。\n\n那行蓝黑小字并不在表面。它像沉在纸纤维深处，随着你的呼吸明灭。水痕沿着一道看不见的折线延伸，最后停在信封名字的最后一笔上。\n\n你第一次确定：这封信不是最近写成的。"
        : "你又一次展开那封信。纸面仍然空无一物，只有信封上的名字在灯下显得过分清晰。\n\n你把它举向光，忽然留意到纸角有一条极浅的水线——它不像雨渍，更像被海水反复泡过的痕迹。\n\n有些答案没有增多，只是换了角度等你。";
      outcome = inspectingInk
        ? `你在${location.name}把无名信对着灯光端详，确认它曾被海水浸泡多年。`
        : `你在${location.name}重新读了无名信，确认它曾被海水浸泡过。`;
    } else {
      events.push({ type: "set_flag", flagId: "letter_opened", value: true });
      events.push({ type: "change_stat", statId: "insight", delta: 2 });
      narration =
        "你把信封凑近灯罩。封口的海盐簌簌落下，拆开时却没有撕裂声。\n\n信纸是空白的。就在你轻声念出信封上的名字时，纸面浮出一行蓝黑小字：别忘了你叫什么。\n\n墨迹很快渗进水纹里，像有人隔着很多年，刚刚松开了手。";
      memoryUpdate.push("无名信被拆开后，纸面曾在灯下浮现出一句提醒：别忘了你叫什么。");
      outcome = "你拆开了无名信，纸上浮出一句提醒：别忘了你叫什么。";
    }
  } else if (talkTarget) {
    const npc = getNpc(talkTarget);
    const npcLocation = npc ? getLocation(npc.locationId) : undefined;

    if (!npc) {
      narration = genericNarration(location.atmosphere, action, seed);
      outcome = `你在${location.name}试着与雾交谈，雾没有回答。`;
    } else if (npc.id !== currentNpc?.id) {
      narration = `你朝雾里问起${npc.name}。声音散开得很慢，最后被檐水一滴一滴敲碎。\n\n${location.atmosphere}\n\n这个时辰，${npc.name}多半在${npcLocation?.name ?? "别处"}。有些路不远，只是雾会让人以为它们很远。`;
      outcome = `你想找${npc.name}，但对方此刻并不在${location.name}。`;
    } else {
      const relation = state.relations[npc.id] ?? { value: npc.initialRelation, knownFactIds: [] };
      const unknownFact = npc.facts.find((fact) => !relation.knownFactIds.includes(fact.id));
      const relationDelta = relation.value < 100 ? 5 + (seed % 2) : 0;
      const nextRelationValue = Math.min(100, relation.value + relationDelta);
      const crossesTrust = nextRelationValue >= 65 && relation.value < 65;

      if (relationDelta > 0) {
        events.push({ type: "change_relation", npcId: npc.id, delta: relationDelta });
      }
      if (unknownFact) {
        events.push({ type: "learn_fact", npcId: npc.id, factId: unknownFact.id });
      }
      if (!unknownFact && events.length < 3) {
        events.push({ type: "change_stat", statId: "insight", delta: 1 });
      }

      const dialogue = pick(NPC_DIALOGUE[npc.id] ?? ["“雾大，路上当心。”"], seed);
      const factLine = unknownFact
        ? `\n\n${npc.name}压低声音，把一件藏了很久的事交给你：${unknownFact.text}`
        : `\n\n${npc.name}没有再多说什么。你们在灯下坐了一会儿，远处的潮声替彼此补完了沉默。`;
      const relationLine =
        relationDelta > 0
          ? `\n\n${npc.name}的语气比刚才松了一些。你感觉你们之间的距离缩短了一小步。`
          : "";
      const trustLine = crossesTrust ? `\n\n${TRUST_LINES[npc.id] ?? ""}` : "";
      const arcLine =
        (unknownFact || crossesTrust) && getNpcArcNote(state, npc.id)
          ? `\n\n${getNpcArcNote(state, npc.id)}`
          : "";

      narration = `${npc.greeting}\n\n${dialogue}${factLine}${arcLine}${relationLine}${trustLine}`;
      if (unknownFact) {
        memoryUpdate.push(`${npc.name}告诉你：${unknownFact.text}`);
      }
      if (crossesTrust) {
        memoryUpdate.push(`${npc.name}开始信任你。`);
      }
      outcome = unknownFact
        ? `你与${npc.name}交谈，得知了“${unknownFact.label}”。`
        : `你与${npc.name}又聊了一会儿，彼此的距离近了一些。`;
    }
  } else if (REST_INTENT.test(action)) {
    const stamina = state.stats.stamina ?? 0;
    const will = state.stats.will ?? 0;
    if (stamina < 100) {
      const amount = Math.min(8, 100 - stamina);
      events.push({ type: "change_stat", statId: "stamina", delta: amount });
    }
    if (will < 100) {
      const amount = Math.min(3, 100 - will);
      events.push({ type: "change_stat", statId: "will", delta: amount });
    }
    narration = `你在一处避雨的檐下停了停。${location.atmosphere}\n\n呼吸慢下来以后，冻僵的手指重新有了知觉。远处仍有人走动，但那些声音暂时与你无关。`;
    outcome = `你在${location.name}短暂休息，缓过一口气。`;
  } else if (EXPLORE_INTENT.test(action)) {
    const flagActive = Boolean(state.flags[location.explore.flagId]);
    const item = location.explore.itemId ? getItem(location.explore.itemId) : undefined;
    const alreadyHasItem = item ? state.inventory.includes(item.id) : false;
    const inventoryHasRoom = state.inventory.length < world.inventoryMax;
    const canAddItem = Boolean(item) && !alreadyHasItem && inventoryHasRoom;

    if (!flagActive) {
      events.push({ type: "set_flag", flagId: location.explore.flagId, value: true });
      if (canAddItem && item) {
        events.push({ type: "add_item", itemId: item.id });
      }
      events.push({ type: "change_stat", statId: "insight", delta: 2 });
      memoryUpdate.push(location.explore.memory);
      narration = `${location.explore.narration}${exploreClosure(
        item?.name,
        canAddItem,
        alreadyHasItem,
        inventoryHasRoom,
        seed,
      )}\n\n${getQuestGuide(state).chapterPressure}`;
      outcome = `你在${location.name}发现了“${
        world.flags.find((flag) => flag.id === location.explore.flagId)?.label ?? "新的线索"
      }”。`;
    } else {
      events.push({ type: "change_stat", statId: "insight", delta: 1 });
      if (canAddItem && item) {
        events.push({ type: "add_item", itemId: item.id });
      }
      const itemLine =
        canAddItem && item
          ? `\n\n这一次，你把之前留在原处的「${item.name}」收进了邮包。`
          : "";
      narration = `你重新检查${location.name}，把已经看过的地方又核对了一遍。\n\n${location.atmosphere}\n\n线索还是那些，但它们在脑海里排得更紧了一些。你开始能听见细节之间那根细线被拉直的声音。${itemLine}`;
      if (canAddItem && item) {
        memoryUpdate.push(`你终于把「${item.name}」收进了邮包。`);
      }
      outcome = `你在${location.name}重新梳理了已知的线索。`;
    }
  } else {
    narration = genericNarration(location.atmosphere, action, seed);
    outcome = `你在${location.name}尝试了一次新的行动，雾没有立刻给出答案。`;
  }

  const preview = validateAndApplyEvents(events, state);
  const previewState = preview.errors.length === 0 ? preview.nextState : state;
  const suggestions = buildSuggestions(previewState, seed);

  if ((previewState.stats.stamina ?? 100) <= 25) {
    narration += "\n\n你这才发觉手指有些发抖。黎明还很远，而邮包里的信比刚才更沉了。";
  }

  const summary = buildDemoSummary(previewState, outcome);
  const output: ModelTurnOutput = {
    narration,
    proposedEvents: events,
    suggestedActions: suggestions,
    memoryUpdate,
    summary,
    highlights: [],
  };

  return { output };
}

function findMentionedNpcs(action: string): string[] {
  return world.npcs
    .filter((npc) => {
      const aliases = NPC_ALIASES[npc.id] ?? [];
      return aliases.some((alias) => action.includes(alias));
    })
    .map((npc) => npc.id);
}

function resolveTalkTarget(mentionedIds: string[], currentNpcId: string | undefined, action: string): string | undefined {
  if (!TALK_INTENT.test(action)) {
    return undefined;
  }
  if (currentNpcId && mentionedIds.includes(currentNpcId)) {
    return currentNpcId;
  }
  if (mentionedIds.length > 0) {
    return mentionedIds[0];
  }
  return currentNpcId;
}

function findMovementDestination(action: string, currentLocationId: string): string | undefined {
  if (!TRAVEL_INTENT.test(action)) {
    return undefined;
  }

  let best: { locationId: string; index: number } | undefined;
  for (const [locationId, aliases] of Object.entries(LOCATION_ALIASES)) {
    for (const alias of aliases) {
      const index = action.indexOf(alias);
      if (index === -1 || locationId === currentLocationId) continue;
      if (!best || index < best.index) {
        best = { locationId, index };
      }
    }
  }
  return best?.locationId;
}

function isLetterAction(action: string): boolean {
  return (
    LETTER_TOPIC.test(action) &&
    LETTER_INTENT.test(action) &&
    !LETTER_EXCLUSION.test(action)
  );
}

function exploreClosure(
  itemName: string | undefined,
  canAddItem: boolean,
  alreadyHasItem: boolean,
  inventoryHasRoom: boolean,
  seed: number,
): string {
  if (itemName && canAddItem) {
    return pick(
      [
        `\n\n你把「${itemName}」收好。雾里有水滴敲了一下铁皮，像有人隔着很远向你点头。`,
        `\n\n「${itemName}」贴着掌心发凉。你把它放进邮包，听见自己的呼吸在空街里格外清楚。`,
      ],
      seed,
    );
  }
  if (itemName && alreadyHasItem) {
    return `\n\n你想起邮包里已经有一件同样的东西，便把它留在原处。线索开始彼此碰撞，发出很轻的回响。`;
  }
  if (itemName && !inventoryHasRoom) {
    return `\n\n你想把它一并带走，邮包却已经塞不下。你只得把「${itemName}」放回原处，默默记住它的位置。`;
  }
  return "\n\n你把这些细节收进记忆。天还没有亮，但雾似乎退开了半寸。";
}

function genericNarration(atmosphere: string, action: string, seed: number): string {
  const openings = [
    `你顺着自己的念头行动：${clip(action, 42)}。`,
    `你把那句话留在雾里，照着它做了：${clip(action, 42)}。`,
    `你停了一拍，还是决定试一试。${clip(action, 42)}。`,
  ];
  const middles = [
    "雾没有立刻回答。远处的潮声先是靠近，又从另一个方向退走。",
    "檐水落在石板上，一声接一声，把刚才的动静盖得干干净净。",
    "你听见某个看不见的街角传来脚步，回头时，那里只剩一团慢慢合拢的白。",
    "夜色像一张湿纸贴在眼前。你确信自己错过了什么，却还说不清是什么。",
  ];
  return `${pick(openings, seed)}\n\n${atmosphere}\n\n${pick(middles, seed >>> 2)}`;
}

export function generateSafeFallback(context: TurnPromptContext): ModelTurnOutput {
  const { session, playerAction } = context;
  const location = getLocation(session.state.locationId);
  const seed = hashSeed(`${session.id}:fallback:${session.turnCount + 1}:${playerAction}`);
  const narration = `雾在${location?.name ?? "邮局"}的檐角缓慢聚拢。你试着${clip(
    playerAction.trim(),
    44,
  )}，这个动作在雾里只完成了一半。\n\n${location?.atmosphere ?? "雨声盖住了细小的回响。"}\n\n你记住了自己站过的位置，却没有得到可以确认的结果。`;
  return {
    narration,
    proposedEvents: [],
    suggestedActions: buildSuggestions(session.state, seed),
    memoryUpdate: [],
    summary: session.state.summary,
    highlights: [],
  };
}

function buildSuggestions(state: GameState, seed: number): string[] {
  const location = getLocation(state.locationId);
  if (!location) return ["在雾里辨一辨方向", "整理邮包", "等待天亮"];

  const candidates: string[] = [];
  const npc = npcAtLocation(location.id);
  const exploreFlag = state.flags[location.explore.flagId];

  if (!exploreFlag) {
    candidates.push(location.explore.action);
  }

  if (npc) {
    const relation = state.relations[npc.id] ?? { value: npc.initialRelation, knownFactIds: [] };
    const unknownFact = npc.facts.find((fact) => !relation.knownFactIds.includes(fact.id));
    candidates.push(
      unknownFact
        ? `向${npc.name}打听${unknownFact.label}`
        : `和${npc.name}再聊聊今晚的事`,
    );
  }

  if ((state.stats.stamina ?? 100) < 30) {
    candidates.push("找个避雨处坐下喘口气");
  }

  if (!state.flags.letter_opened && state.inventory.includes("nameless_letter")) {
    candidates.push("拆开那封无名信");
  }

  const rotatedExits = [...location.exits];
  if (rotatedExits.length > 1) {
    const rotateBy = seed % rotatedExits.length;
    rotatedExits.push(...rotatedExits.splice(0, rotateBy));
  }
  for (const exitId of rotatedExits) {
    const exit = getLocation(exitId);
    if (exit) {
      candidates.push(`沿着雾去${exit.name}`);
    }
  }

  if (exploreFlag) {
    candidates.push(`在${location.name}再核对一遍线索`);
  }
  candidates.push("整理邮包，回想已知的线索");
  candidates.push("听一听雾里有没有别的声音");

  const unique = [...new Set(candidates)];
  return unique.slice(0, 3);
}

function buildDemoSummary(state: GameState, outcome: string): string {
  const location = getLocation(state.locationId);
  const foundKeyClues = fogportStory.keyClues.filter(
    (clue) => state.flags[clue.flagId] === true,
  ).length;
  const text = `你作为雾港夜班邮差，正在黎明前阻止雾港忘记${state.playerName}，并追查那封写着自己名字的无名信。${outcome}已确认关键线索 ${foundKeyClues} / ${fogportStory.keyClues.length}。你此刻身在${
    location?.name ?? "雾港"
  }，雾还没有散。`;
  return clip(text, 300);
}
