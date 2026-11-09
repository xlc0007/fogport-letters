import type {
  AcceptedEvent,
  EndingChoiceId,
  EndingChoiceView,
  EndingView,
} from "@fogport/shared";
import type { GameState, NpcDefinition } from "./model.js";
import { getLocation, world } from "./world.js";
import { fogportStory } from "./story.js";

export const NAME_RETURN_ACTION = "在灯塔钟室敲响旧钟，念出自己的名字";
export const LEAVE_ACTION = "登上旧码头的渡船，带着无名信离开雾港";

export function hasNamelessLetter(state: GameState): boolean {
  return state.inventory.includes("nameless_letter");
}

export function getFoundKeyClueCount(state: GameState): number {
  return fogportStory.keyClues.filter((clue) => state.flags[clue.flagId] === true).length;
}

export function getTrustedNpcs(state: GameState): NpcDefinition[] {
  return world.npcs.filter((npc) => (state.relations[npc.id]?.value ?? 0) >= 65);
}

export function getPresentTrustedNpc(state: GameState): NpcDefinition | null {
  return (
    world.npcs.find(
      (npc) =>
        npc.locationId === state.locationId &&
        (state.relations[npc.id]?.value ?? 0) >= 65,
    ) ?? null
  );
}

function getMostTrustedNpc(state: GameState): NpcDefinition | null {
  const trusted = getTrustedNpcs(state);
  if (trusted.length === 0) return null;
  return [...trusted].sort(
    (left, right) =>
      (state.relations[right.id]?.value ?? 0) - (state.relations[left.id]?.value ?? 0),
  )[0];
}

function rememberedAction(npc: NpcDefinition | null): string {
  return npc
    ? `把无名信交给${npc.name}，托付这份记忆`
    : "把无名信交给信任的人，托付这份记忆";
}

export function getFinalChoiceViews(state: GameState): EndingChoiceView[] {
  const trusted = getTrustedNpcs(state);
  const presentTrusted = getPresentTrustedNpc(state);
  const npcForAction = presentTrusted ?? getMostTrustedNpc(state);
  const hasLetter = hasNamelessLetter(state);
  const foundClues = getFoundKeyClueCount(state);
  const missingClues = fogportStory.keyClues.length - foundClues;

  const choices: Array<Omit<EndingChoiceView, "available" | "blockedReason">> = [
    {
      id: "name_return",
      title: "名字归来",
      description: "在灯塔钟室敲响旧钟，把自己的名字从雾里赎回。",
      action: NAME_RETURN_ACTION,
      requirement: "集齐三条关键线索，带着无名信抵达北岸灯塔钟室。",
    },
    {
      id: "remembered",
      title: "有人记得我",
      description: "把无名信托付给一位信任你的人，让另一个人替你记住。",
      action: rememberedAction(npcForAction),
      requirement: "与一位人物关系达到 65，并在对方身边交出无名信。",
    },
    {
      id: "leave",
      title: "离港带信",
      description: "在旧码头登上一班渡船，带着无名信离开雾港。",
      action: LEAVE_ACTION,
      requirement: "带着无名信抵达旧码头。",
    },
  ];

  return choices.map((choice) => {
    const blockedReason = getBlockedReason(choice.id, {
      hasLetter,
      missingClues,
      locationId: state.locationId,
      trusted,
      presentTrusted,
      npcForAction,
    });
    return {
      ...choice,
      available: blockedReason === "",
      blockedReason,
    };
  });
}

interface ChoiceContext {
  hasLetter: boolean;
  missingClues: number;
  locationId: string;
  trusted: NpcDefinition[];
  presentTrusted: NpcDefinition | null;
  npcForAction: NpcDefinition | null;
}

function getBlockedReason(id: EndingChoiceId, context: ChoiceContext): string {
  if (!context.hasLetter) {
    return "无名信不在身上。";
  }

  if (id === "name_return") {
    if (context.missingClues > 0) {
      return `还差 ${context.missingClues} 条关键线索。`;
    }
    if (context.locationId !== "lighthouse") {
      return "需要前往北岸灯塔钟室。";
    }
    return "";
  }

  if (id === "remembered") {
    if (context.trusted.length === 0) {
      return "还没有关系达到 65 的人物。";
    }
    if (!context.presentTrusted) {
      const npc = context.npcForAction ?? context.trusted[0];
      const place = getLocation(npc.locationId)?.name ?? "别处";
      return `需要到${place}与${npc.name}见面。`;
    }
    return "";
  }

  if (context.locationId !== "dock") {
    return "需要前往旧码头。";
  }
  return "";
}

export function matchAvailableFinalChoice(
  state: GameState,
  action: string,
): EndingChoiceView | null {
  const cleaned = action.trim();
  return (
    getFinalChoiceViews(state).find(
      (choice) => choice.available && choice.action === cleaned,
    ) ?? null
  );
}

const FINAL_CHOICE_PATTERNS: Array<[EndingChoiceId, RegExp]> = [
  ["name_return", /(敲(响|动)?[^，。；]{0,8}(旧钟|钟)|念出[^，。；]{0,8}名字|赎回[^，。；]{0,6}名字)/],
  ["remembered", /(把[^，。；]{0,12}(无名信|信)[^，。；]{0,6}(交给|托付)|托付[^，。；]{0,10}(信|记忆))/],
  ["leave", /(离开雾港|离港|登上[^，。；]{0,10}(渡船|船)|坐船离开)/],
];

export function detectFinalChoiceAttempt(
  state: GameState,
  action: string,
): EndingChoiceView | null {
  const cleaned = action.trim();
  if (cleaned.length > 80) return null;
  const views = getFinalChoiceViews(state);
  const matched = FINAL_CHOICE_PATTERNS.find(([, pattern]) => pattern.test(cleaned));
  if (!matched) return null;
  return views.find((choice) => choice.id === matched[0]) ?? null;
}

export interface FinalChoiceResult {
  state: GameState;
  acceptedEvents: AcceptedEvent[];
  memory: string;
  summaryFragment: string;
  npcName: string | null;
}

export function applyFinalChoice(
  state: GameState,
  id: EndingChoiceId,
): FinalChoiceResult {
  const nextState = structuredClone(state);
  const acceptedEvents: AcceptedEvent[] = [];
  let memory = "";
  let summaryFragment = "";
  let npcName: string | null = null;

  if (id === "name_return") {
    nextState.flags.bells_rung = true;
    nextState.flags.name_spoken = true;
    nextState.flags.truth_known = true;
    acceptedEvents.push(
      {
        type: "set_flag",
        flagId: "bells_rung",
        value: true,
        description: "敲响了灯塔钟室的旧钟",
      },
      {
        type: "set_flag",
        flagId: "name_spoken",
        value: true,
        description: "在钟声里念出了自己的名字",
      },
      {
        type: "set_flag",
        flagId: "truth_known",
        value: true,
        description: "知道了无名信真正的寄件人",
      },
    );
    memory = "你在灯塔钟室敲响旧钟，念出了自己的名字，也知道了无名信是年幼的你写给自己的。";
    summaryFragment = "你完成最后的选择，在旧钟的回声里赎回自己的名字。";
  } else if (id === "remembered") {
    npcName = (getPresentTrustedNpc(state) ?? getMostTrustedNpc(state))?.name ?? "信任的人";
    nextState.flags.letter_entrusted = true;
    acceptedEvents.push({
      type: "set_flag",
      flagId: "letter_entrusted",
      value: true,
      description: `把无名信托付给了${npcName}`,
    });
    memory = `你把无名信交给了${npcName}，请对方替你记住这个名字。`;
    summaryFragment = `你把无名信交给了${npcName}，选择让另一个人替你守住名字。`;
  } else {
    nextState.flags.left_fogport = true;
    acceptedEvents.push({
      type: "set_flag",
      flagId: "left_fogport",
      value: true,
      description: "登上了离港的渡船",
    });
    memory = "你在黎明前登上了离开雾港的渡船，带着无名信和尚未解开的真相。";
    summaryFragment = "你在黎明前登船离开雾港，把未解的真相留在岸上。";
  }

  nextState.memories = [...nextState.memories, memory].slice(-14);
  return { state: nextState, acceptedEvents, memory, summaryFragment, npcName };
}

export function buildEnding(state: GameState): EndingView {
  if (state.flags.name_spoken && state.flags.bells_rung) {
    return buildNameReturnEnding(state);
  }
  if (state.flags.letter_entrusted) {
    return buildRememberedEnding(state);
  }
  if (state.flags.left_fogport) {
    return buildLeaveEnding(state);
  }
  return buildUnresolvedEnding(state);
}

function endingTitle(id: "name_return" | "remembered" | "leave" | "unresolved"): string {
  return fogportStory.endingSpecs.find((ending) => ending.id === id)?.title ?? "雾中留任";
}

function hasAllKeyClues(state: GameState): boolean {
  return getFoundKeyClueCount(state) === fogportStory.keyClues.length;
}

function buildNameReturnEnding(state: GameState): EndingView {
  const found = getFoundKeyClueCount(state);
  const trusted = getTrustedNpcs(state);
  const fullInvestigation =
    state.flags.clue_dead_letters === true &&
    state.flags.clue_old_photo === true &&
    trusted.length >= 2;

  if (fullInvestigation) {
    const names = trusted.map((npc) => npc.name).join("、");
    return {
      kind: "name_return",
      title: "雾散之后",
      isTrueEnding: true,
      paragraphs: [
        "旧钟响了。第一声沉进海雾，第二声从钟楼方向返回来。雾港所有停摆的钟同时越过 03:17，像一座城终于把憋了二十年的一口气吐了出来。",
        "这一次，你不仅想起了母亲林雾和年幼的自己。你想起老周锁在分拣台底层的退信，想起温简收在书页里的照片，想起阿礁从潮水里抱起的重量，也想起何姨没有换掉的那截钟绳。",
        `钟声停下以后，${names}先后来到灯塔。没有人再问那封信是谁写的；他们只是叫出了你的名字。`,
        "天亮时，街上的钟重新走动。雾港没有忘记任何人。无名信终于抵达收件人，而你终于知道：名字不是被钟留下的，是被一个又一个人记住的。",
      ],
      causedBy: [
        `集齐三条关键线索（${found} / 3）：停摆的 03:17、白鹭号与林雾、雾吞名字钟留回声`,
        "找回死信与旧照片，把散落的过去重新连在一起",
        `让${names}愿意替你记住这个名字`,
        "在黎明前敲响旧钟，念出了自己的名字",
      ],
    };
  }

  return {
    kind: "name_return",
    title: endingTitle("name_return"),
    paragraphs: [
      "旧钟响了。第一声沉进海雾，第二声从钟楼方向返回来。雾港所有停摆的钟同时越过 03:17，像一座城终于把憋了二十年的一口气吐了出来。",
      "你想起母亲林雾留在灯塔的最后一夜：白鹭号沉没，她把自己的名字交给雾，只换回你半个名字。无名信没有外面的寄件人，那是年幼的你写给未来自己的回声，蓝黑墨迹里一直藏着同一句话——别忘了你叫什么。",
      "钟声停下以后，街上的钟重新走动。老周第一次完整地叫出你的名字。你阻止了遗忘，也让那封在死信袋里转了二十年的信，终于抵达了收件人。",
    ],
    causedBy: [
      `集齐三条关键线索（${found} / 3）：停摆的 03:17、白鹭号与林雾、雾吞名字钟留回声`,
      "带着无名信抵达北岸灯塔钟室",
      "在黎明前敲响旧钟，念出了自己的名字",
      "选择面对寄件人的真相：年幼的自己",
    ],
  };
}

interface RememberedVariant {
  title: string;
  paragraphs: string[];
  cause: string;
}

function buildRememberedEnding(state: GameState): EndingView {
  const npc = getPresentTrustedNpc(state) ?? getMostTrustedNpc(state);
  const name = npc?.name ?? "那位信任你的人";
  const location = getLocation(npc?.locationId ?? state.locationId)?.name ?? "雾港";
  const variant = npc ? REMEMBERED_VARIANTS[npc.id] : undefined;

  const paragraphs = variant?.paragraphs ?? [
    `你把无名信放进${name}手里。对方没有问这封信为什么没有寄件人，只是把信按在胸口，认真地点了点头。远处的旧钟没有响。`,
    "你没能把三条线索全部串成完整的真相，也不知道二十年前的钟声究竟带走了母亲多少记忆。但雾带不走两个人共同守着的东西。",
    `名字没有完全回到你身上，却没有孤零零地留在雾里。${name}答应你：明天、后天，以及每一个雾起的夜晚，都会记得${state.playerName}。`,
  ];

  return {
    kind: "remembered",
    title: variant?.title ?? endingTitle("remembered"),
    npcId: npc?.id,
    paragraphs,
    causedBy: [
      `与${name}的关系达到信任（65 以上）`,
      `在${location}把无名信交到${name}手里`,
      variant?.cause ?? "选择让另一个人替你记住名字",
    ],
  };
}

const REMEMBERED_VARIANTS: Record<string, RememberedVariant> = {
  zhou: {
    title: "最后一封死信",
    cause: "老周用一枚迟到二十年的邮戳，把你的名字写回了活人的信件里",
    paragraphs: [
      "你把无名信放进老周手里。他没有问收件人，只从抽屉里取出一枚停了二十年的邮戳，在信封背面盖下今天的日期。",
      "他记得那晚的雾，也记得一个孩子在死信袋旁睡着。过去他不敢说，现在他替你记住了全部。",
      "黎明后，雾港的人忘记了你的名字；但每天清晨，老周都会把一封写着你的信放进最上层分拣格，等你自己来取。",
    ],
  },
  he: {
    title: "灯还亮着",
    cause: "何姨把旧钟的绳头接了回去，让灯替你守住名字",
    paragraphs: [
      "你把信放进何姨手里。她没有问寄件人，只把灯芯拨亮，让光柱扫过你的脸。",
      "她记得白鹭号，也记得林雾没能下来的那一夜。这一次，她选择记住另一个人的名字。",
      "07:17，雾港的钟声停了；北岸的灯还亮着。每一个经过海面的人，都能看见灯里写着的你的名字。",
    ],
  },
  jiao: {
    title: "潮水记得",
    cause: "阿礁把名字刻进船底，让潮水每年把它送回岸上",
    paragraphs: [
      "你把信交给阿礁。他满手桐油，接信前先在围裙上擦了又擦。",
      "他记得白鹭号的舱门，也记得那晚从水里抱起的重量。过去他从不提，现在他把你的名字刻在船底。",
      "雾港忘了你，旧码头没有。每年涨潮，总有人在船底听见你的名字。",
    ],
  },
  wen: {
    title: "书页记得",
    cause: "温简把信夹进旧书，让读到的人替你记住名字",
    paragraphs: [
      "你把信交给温简。她没有把它收进抽屉，而是夹进一本没有书名的旧书。",
      "她记得照片背面的字，也记得你小时候坐在书店门槛上的样子。她说，有些人不是被记住，是被读到的。",
      "天亮后，雾港忘记了你的名字；但每个来书店翻书的人，都会在页边读到一行蓝黑小字：别忘了你叫什么。",
    ],
  },
};

function buildLeaveEnding(state: GameState): EndingView {
  if (hasAllKeyClues(state)) {
    return {
      kind: "leave",
      title: "岸上的真相",
      paragraphs: [
        "渡船离岸时，你把三条线索在脑子里重新排了一遍：03:17、白鹭号、钟留回声。现在你知道它们如何相连，也知道自己本可以回去敲响那口钟。",
        "但你没有。你选择让雾港留在岸上，带着真相和无名信去另一座没有名字的港。",
        "身后的灯一盏盏沉进雾里。你记得这座城，记得母亲，也记得自己为何离开；这已经足够你走很远。",
      ],
      causedBy: [
        "在已经知道三条关键线索后仍选择登船离开",
        "把雾港的真相留在岸上，保留自己的名字",
        "带着无名信抵达旧码头并登上渡船",
      ],
    };
  }

  if (state.flags.clue_old_photo === true) {
    return {
      kind: "leave",
      title: "带走的照片",
      paragraphs: [
        "渡船离岸时，你把温简给的照片夹进无名信里。照片上的孩子提着邮包，站在还没被雾吞掉的街口。",
        "你没有敲钟，也没有把信交给谁。旧钟的回声在身后慢慢耗尽；但你带走了一张能证明自己曾经是谁的照片。",
        "远处有另一座港。你摸到照片背面的字，第一次觉得，记得自己并不一定要靠一座城。",
      ],
      causedBy: [
        "在调查完成前选择登船离开",
        "带着温简保存的照片与无名信抵达旧码头",
        "把雾港的真相留在岸上，保留自己的名字",
      ],
    };
  }

  return {
    kind: "leave",
    title: endingTitle("leave"),
    paragraphs: [
      "渡船离岸时，雾港的灯一盏接一盏沉进背后。你把无名信按在胸口，纸页隔着旧帆布，仍然带着海盐和蓝黑墨水的味道。",
      "你没有在黎明前找到阻止遗忘的办法，也没有把三条线索全部接上。旧钟的回声会在你身后耗尽，这座城大概真的会忘记你；但这一次，你选择先记住自己。",
      "船头劈开灰白的海面，远处有另一座没有名字的港。你带着一封没有寄件人的信离开，也带着一个还没有被雾拿走的清晨。",
    ],
    causedBy: [
      "在调查完成前选择登船离开",
      "带着无名信抵达旧码头并登上渡船",
      "把雾港的真相留在岸上，保留自己的名字",
    ],
  };
}

function buildUnresolvedEnding(state: GameState): EndingView {
  const found = getFoundKeyClueCount(state);
  const trusted = getTrustedNpcs(state);
  const location = getLocation(state.locationId)?.name ?? "雾港";
  const missing = fogportStory.keyClues.length - found;

  if (hasAllKeyClues(state)) {
    return {
      kind: "unresolved",
      title: "最后一声钟",
      paragraphs: [
        `07:17，旧钟最后一次响起。你站在${location}，手里还攥着那三条已经连成线的线索。`,
        "你知道该往灯塔去，也知道该把无名信举到钟声里；可你迟疑得太久。钟声落下时，名字像一张被海水泡软的纸，从整座城的记忆里剥离。",
        "天亮后，邮包里多了一张蓝纹纸片。上面只有一行新出现的字：下一个二十年，旧钟还会留一次回声。落款处的笔迹与你一模一样。",
      ],
      causedBy: [
        "时间走到 07:17，黎明钟声响起",
        "三条关键线索已经集齐，却没有在钟声前做出最后的选择",
        trusted.length > 0
          ? `虽然${trusted.map((npc) => npc.name).join("、")}曾信任你，但你没有把信交出去`
          : "没有人与你建立起足以托付无名信的信任",
      ],
    };
  }

  if (trusted.length > 0) {
    const names = trusted.map((npc) => npc.name).join("、");
    return {
      kind: "unresolved",
      title: "差一点被记住",
      paragraphs: [
        `07:17，旧钟最后一次响起。你站在${location}，无名信还在邮包里，没有交到任何人手上。`,
        `${names}在雾里找了你很久。他们记得你的声音，记得你坐在灯下的样子，却怎么也想不起你的名字。`,
        "天亮后，你成了雾港的无名夜班邮差。有人在你常坐的位置留了一杯凉茶，杯沿上写着你的名字，但墨迹已经看不清了。",
      ],
      causedBy: [
        "时间走到 07:17，黎明钟声响起",
        `虽然${names}曾信任你，但你没有把信交出去`,
        "在最后一声钟前没有做出可以留住名字的选择",
      ],
    };
  }

  return {
    kind: "unresolved",
    title: endingTitle("unresolved"),
    paragraphs: [
      `07:17，旧钟最后一次响起。你站在${location}，听见自己的名字像一张被海水泡软的纸，从整座城的记忆里慢慢剥离。`,
      "老周抬头看你，眼神客气而陌生；窗后的灯照常亮起，街上的人照常赶路。没有人带着恶意，他们只是不再认识你。你成了雾港的无名夜班邮差，邮包还在，名字却不再属于任何人。",
      "天亮后的第一班死信里，夹着一张蓝纹纸片。上面只有一行新出现的字：下一个二十年，旧钟还会留一次回声。落款处是今晚的日期，笔迹与你一模一样。你把纸片收进邮包——这是雾港忘记你之后，仍然真正交到你手里的新线索。",
    ],
    causedBy: [
      "时间走到 07:17，黎明钟声响起",
      missing > 0
        ? `只找到 ${found} / 3 条关键线索，尚未拼出寄件人的真相`
        : "找到了三条关键线索，却没能在钟声前做出最后的选择",
      trusted.length > 0
        ? `虽然${trusted.map((npc) => npc.name).join("、")}曾信任你，但你没有把信交出去`
        : "没有人与你建立起足以托付无名信的信任",
    ],
  };
}
