import type { WorldDefinition } from "./model.js";
import { fogportStory } from "./story.js";

export const world: WorldDefinition = {
  id: "fogport",
  title: "雾港来信",
  subtitle: "一封没有收件人的信，写着你的名字",
  genre: "中文海雾悬疑 · 记忆与身份",
  premise: `${fogportStory.logline}

${fogportStory.stakes}`,
  hiddenTruth: fogportStory.promptContext(),
  styleGuide:
    "第二人称叙述，潮湿、克制，但必须简短。每回合只写 80–130 个汉字，分成 1–2 个短段落。只保留本回合确认的关键线索、直接后果和下一步方向；不要复述背景，不要堆砌感官描写，不要一次引入多个新细节。可以写一句关键对白，但不要替玩家做重大决定，不使用 Markdown 标题或列表。",
  startLocationId: "post_office",
  stats: [
    {
      id: "insight",
      label: "洞察",
      description: "观察与联想。洞察足够高时，与人交谈会听出更多弦外之音。",
      initial: 30,
      min: 0,
      max: 100,
      maxDelta: 8,
    },
    {
      id: "will",
      label: "意志",
      description: "抵抗雾的低语。意志低落时，行动会在迟疑中消耗更多时间。",
      initial: 55,
      min: 0,
      max: 100,
      maxDelta: 6,
    },
    {
      id: "stamina",
      label: "体力",
      description: "夜行的本钱。持续行动会消耗体力，疲惫时行动更慢。",
      initial: 72,
      min: 0,
      max: 100,
      maxDelta: 10,
    },
  ],
  items: [
    {
      id: "old_satchel",
      name: "旧帆布邮包",
      description: "边角磨得发白，内衬缝着一个小小的“林”字。",
    },
    {
      id: "nameless_letter",
      name: "无名信",
      description: "没有收件人，没有邮票，信封正面却用蓝黑墨水写着你的名字。",
      protected: true,
    },
    {
      id: "lighthouse_key",
      name: "铜制灯塔钥匙",
      description: "钥匙柄被海盐蚀出白色花纹，齿口还很锋利。",
    },
    {
      id: "clock_hand",
      name: "半截钟表指针",
      description: "断口发黑，指针末端弯向三点十七分。",
    },
    {
      id: "silver_clapper",
      name: "半枚银铃舌",
      description: "断口很新，像是不久前才被谁从钟里取出。",
    },
    {
      id: "faded_negative",
      name: "褪色底片",
      description: "对着灯光看，是码头边一个提着邮包的孩子。",
    },
    {
      id: "tide_log_page",
      name: "潮汐日志残页",
      description: "纸页湿软，记录着二十年前一次没有编号的退潮。",
    },
    {
      id: "harbor_ticket",
      name: "白鹭号旧船票",
      description: "票面日期是二十年前，座位号被水泡得看不清。",
    },
    {
      id: "red_cord",
      name: "一束红棉线",
      description: "温简用来捆旧信的线，打着七道结。",
    },
  ],
  flags: [
    {
      id: "letter_opened",
      label: "拆开了无名信",
      clueText: "信纸在灯下显出一行蓝黑字迹：别忘了你叫什么。",
    },
    {
      id: "clue_dead_letters",
      label: "死信的去向",
      clueText: "近十年的“死信”没有被销毁，而是在凌晨被送往北岸灯塔。",
    },
    {
      id: "clue_stopped_clock",
      label: "停摆的钟楼",
      clueText: "钟楼的指针停在 03:17，正是白鹭号沉没的时刻。",
    },
    {
      id: "clue_ship_plaque",
      label: "白鹭号名录",
      clueText: "旧码头捞起的铜牌上刻着“林雾”——你母亲的名字。",
    },
    {
      id: "clue_old_photo",
      label: "旧照片",
      clueText: "照片背面写着：等雾散的时候再读。字迹与无名信一模一样。",
    },
    {
      id: "clue_lighthouse_log",
      label: "灯塔日志",
      clueText: "雾吞名字，钟留回声。唯持信者可在黎明前赎回一个名字。",
    },
    {
      id: "truth_known",
      label: "雾港的真相",
      clueText: "白鹭号沉没时，林雾用旧钟留住了你的名字；无名信是年幼的你写给自己的。",
      serverOnly: true,
    },
    {
      id: "bells_rung",
      label: "旧钟被敲响",
      serverOnly: true,
    },
    {
      id: "name_spoken",
      label: "念出了自己的真名",
      serverOnly: true,
    },
    {
      id: "dawn_arrived",
      label: "黎明将至",
    },
    {
      id: "letter_entrusted",
      label: "把无名信托付给了信任的人",
      serverOnly: true,
    },
    {
      id: "left_fogport",
      label: "登上了离港的渡船",
      serverOnly: true,
    },
    {
      id: "zhou_trusted",
      label: "老周选择相信你",
    },
    {
      id: "he_trusted",
      label: "何姨选择相信你",
    },
    {
      id: "jiao_trusted",
      label: "阿礁选择相信你",
    },
    {
      id: "wen_trusted",
      label: "温简选择相信你",
    },
  ],
  npcs: [
    {
      id: "zhou",
      name: "老周",
      role: "中央邮局夜班主管",
      locationId: "post_office",
      initialRelation: 48,
      greeting: "老周把眼镜推到额头上，盯着你手里的信看了很久，才慢慢吐出一口气。",
      facts: [
        {
          id: "fact_zhou_dead_letters",
          label: "死信的真实去向",
          text: "近十年的“死信”没有销毁，而是被送往北岸灯塔。",
        },
        {
          id: "fact_zhou_stamp",
          label: "最后一枚退信邮戳",
          text: "二十年前，是他在你的退信上盖下最后一枚邮戳。",
        },
        {
          id: "fact_zhou_locked_letter",
          label: "锁在底层的退信",
          text: "那晚的退信被他锁进最底层，每年同一天都会取出来看一次。",
        },
      ],
    },
    {
      id: "he",
      name: "何姨",
      role: "北岸灯塔守夜人",
      locationId: "lighthouse",
      initialRelation: 28,
      greeting: "何姨没有回头。她把手掌贴在冰凉的灯室玻璃上，像在给什么东西取暖。",
      facts: [
        {
          id: "fact_he_bell",
          label: "旧钟与名字",
          text: "雾会吞掉名字，旧钟能把名字留在回声里。",
        },
        {
          id: "fact_he_last_night",
          label: "白鹭号沉没之夜",
          text: "白鹭号沉没那晚，是林雾独自留在灯塔里敲钟。",
        },
        {
          id: "fact_he_broken_rope",
          label: "没有换掉的钟绳",
          text: "钟室断掉的绳头始终没有换，她像在等谁来把它接上。",
        },
      ],
    },
    {
      id: "jiao",
      name: "阿礁",
      role: "旧码头修船匠",
      locationId: "dock",
      initialRelation: 34,
      greeting: "阿礁从船底滑出来，满手桐油。他看见你手里的信，动作忽然停了。",
      facts: [
        {
          id: "fact_jiao_letters",
          label: "白鹭号的货舱",
          text: "白鹭号沉没前，货舱里装的全是寄不出去的信。",
        },
        {
          id: "fact_jiao_name",
          label: "舱门上的名字",
          text: "他打捞上来的舱门内侧，刻着一个孩子的名字，和你的字迹很像。",
        },
        {
          id: "fact_jiao_weight",
          label: "从水里抱起的重量",
          text: "他记得那晚从水里抱起的重量，却从未对任何人说起。",
        },
      ],
    },
    {
      id: "wen",
      name: "温简",
      role: "雾灯书店老板",
      locationId: "rose_alley",
      initialRelation: 40,
      greeting: "温简把一杯凉透的茶推到你面前。书店里很暖，她的目光却停在窗外没有散的雾上。",
      facts: [
        {
          id: "fact_wen_photo",
          label: "相片和字迹",
          text: "旧照片背面的字迹，与无名信上的一模一样。",
        },
        {
          id: "fact_wen_letter",
          label: "没有收件人的信",
          text: "没有收件人的信，常常是寄给未来的自己。",
        },
        {
          id: "fact_wen_kept_photo",
          label: "没有说完的保管",
          text: "那张照片是替某个人保管的一句没说完的话。",
        },
      ],
    },
  ],
  locations: [
    {
      id: "post_office",
      name: "中央邮局",
      description:
        "穹顶漏着细雨，铁皮分拣格像一排沉默的蜂巢。灯下堆着今天的死信，邮戳机已经凉透。",
      atmosphere: "日光灯在头顶发出细小的电流声，雨水沿铜制灯罩一滴一滴落在分拣台上。",
      exits: ["clock_square"],
      npcId: "zhou",
      explore: {
        flagId: "clue_dead_letters",
        itemId: "lighthouse_key",
        action: "翻找分拣台下的退回信",
        narration:
          "分拣台最下层压着一捆没有邮戳的信。收件人一栏全被水洇开了，只剩一张铅笔便条压在绳结下：送往北岸灯塔，凌晨三点十七分。\n\n你摸进抽屉的夹层，碰到一把冰凉的铜钥匙。钥匙柄上刻着一座小小的灯塔。",
        memory: "中央邮局一直在深夜把无法投递的信秘密送往北岸灯塔。",
      },
    },
    {
      id: "clock_square",
      name: "钟楼广场",
      description:
        "广场中央的钟楼把影子投在积水里。四面钟都停在同一个时刻，鸽子缩在屋檐下，没有一只在叫。",
      atmosphere: "雾贴着石板路缓慢流动，钟楼内部的齿轮间偶尔传来一声金属的轻响。",
      exits: ["post_office", "dock", "rose_alley"],
      explore: {
        flagId: "clue_stopped_clock",
        itemId: "clock_hand",
        action: "检查钟楼停摆的指针",
        narration:
          "钟楼的检修门虚掩着。你借着手电爬上旋梯，在齿轮间找到一截被海盐蚀白的指针。\n\n它指着 03:17。你低头看表，广场上所有的钟都慢了整整七分钟，像在同一天里反复迟疑。",
        memory: "雾港所有的钟都停在或慢向 03:17，那是白鹭号沉没的时刻。",
      },
    },
    {
      id: "dock",
      name: "旧码头",
      description:
        "空船挤在防波堤内，缆绳在雾里发出潮湿的呻吟。白鹭号的旧泊位已经封了二十年，水面仍浮着一层洗不净的油光。",
      atmosphere: "潮水一遍遍舔着系船桩，远处的浮标像一只闭不上的眼睛。",
      exits: ["clock_square", "lighthouse"],
      npcId: "jiao",
      explore: {
        flagId: "clue_ship_plaque",
        itemId: "silver_clapper",
        action: "在旧泊位打捞沉船遗物",
        narration:
          "你在封死的泊位下摸到半枚银铃舌。断口还闪着新光，像是不久前才被谁从钟里取出。\n\n潮水把一块湿透的铜牌推到你脚边。“白鹭号”三个字下面，是一行被海盐咬过的名字：林雾。",
        memory: "白鹭号沉船上有一块刻着“林雾”的铜牌，还有一枚新断的半截银铃舌。",
      },
    },
    {
      id: "rose_alley",
      name: "蔷薇巷",
      description:
        "窄巷两侧的窗都关着，只有雾灯书店门缝漏出一条暖黄的光。墙上的蔷薇早已枯死，藤蔓却还抓着砖缝。",
      atmosphere: "屋檐滴着水，旧唱片的声音从书店门后断断续续地传出来。",
      exits: ["clock_square"],
      npcId: "wen",
      explore: {
        flagId: "clue_old_photo",
        itemId: "faded_negative",
        action: "查看书店橱窗里的旧相片",
        narration:
          "书店橱窗最里面摆着一张旧相片。你认出照片里那个提着邮包的孩子，是自己。\n\n温简没有阻拦，只把一张褪色底片递过来。照片背面有一行蓝黑小字：等雾散的时候再读。",
        memory: "温简保存着一张你童年的照片，背面的字迹与无名信完全相同。",
      },
    },
    {
      id: "lighthouse",
      name: "北岸灯塔",
      description:
        "灯塔立在黑色礁石尽头，光柱每隔十二秒扫过海面。灯室下方有一间上了锁的钟室，门缝里结着盐霜。",
      atmosphere: "海浪在脚下撞碎，塔身深处的旧钟偶尔发出一声不属于金属的叹息。",
      exits: ["dock"],
      npcId: "he",
      explore: {
        flagId: "clue_lighthouse_log",
        itemId: "tide_log_page",
        action: "翻阅灯室里的旧日志",
        narration:
          "灯塔日志摊在桌上，纸边被潮气卷起。最后几页反复写着同一句：雾吞名字，钟留回声。\n\n何姨的字迹在末尾发抖：林雾没能下来。你继续翻，一张潮汐日志的残页从书脊里滑出，上面标着二十年前一次没有编号的退潮。",
        memory: "灯塔日志写着：雾吞名字，钟留回声；白鹭号沉没那夜，林雾没有从灯室下来。",
      },
    },
  ],
  initialInventory: ["old_satchel", "nameless_letter"],
  initialMemories: [
    "你是雾港中央邮局的夜班邮差，今晚负责最后一班分拣。",
    "无名信没有收件人，却写着你的名字；字迹像极了你记忆中母亲的手笔。",
  ],
  initialClue: "为什么这封信知道你的名字？",
  inventoryMax: 8,
  maxEventsPerTurn: 4,
  relationMaxDelta: 8,
};

export const locationsById = new Map(world.locations.map((location) => [location.id, location]));
export const npcsById = new Map(world.npcs.map((npc) => [npc.id, npc]));
export const itemsById = new Map(world.items.map((item) => [item.id, item]));
export const flagsById = new Map(world.flags.map((flag) => [flag.id, flag]));
export const statsById = new Map(world.stats.map((stat) => [stat.id, stat]));

export function getLocation(id: string) {
  return locationsById.get(id);
}

export function getNpc(id: string) {
  return npcsById.get(id);
}

export function getItem(id: string) {
  return itemsById.get(id);
}

export function getFlag(id: string) {
  return flagsById.get(id);
}

export function getStat(id: string) {
  return statsById.get(id);
}

export function npcAtLocation(locationId: string) {
  return world.npcs.find((npc) => npc.locationId === locationId);
}

export function relationAttitude(value: number): string {
  if (value >= 75) return "信赖";
  if (value >= 55) return "亲近";
  if (value >= 35) return "留意";
  if (value >= 20) return "戒备";
  return "冷淡";
}

export function buildOpeningNarration(playerName: string): string {
  return [
    "雾从海面漫上来的时候，中央邮局只剩下最后一盏灯。",
    `你正把今天的最后一袋信归档，一枚没有邮戳的信封从分拣格里滑落，轻轻撞在铁盘上。信封正面写着你的名字——${playerName}。你下意识摸了摸胸前工牌，蓝黑印字正在灯下一点点变淡，像被水浸开的旧墨。`,
    "里屋传来老周的咳嗽。他隔着门叫你：“小……林？”最后一个字在雾里散掉了。他走出来，目光从你脸上滑过去，又落回那封信上，像忽然忘了该说什么。",
    "墙上的挂钟停在 03:17。老周低声说，黎明 07:17，北岸的旧钟会敲最后一响；那之后，整座雾港都会忘记你。",
    "没有收件人，没有落款，纸角却带着一股旧海盐的味道。信封上的笔迹让你想起很小的时候，想起母亲林雾。你只有四个小时：查明寄件人，找到阻止遗忘的方法。",
  ].join("\n\n");
}

export function buildOpeningSuggestions(): string[] {
  return ["翻找分拣台下的退回信", "走进里屋问问老周"];
}

export function buildInitialSummary(playerName: string): string {
  return `${playerName}在雾港中央邮局值夜班时发现工牌上的名字正在褪色，老周也叫不出他的全名。一封没有收件人、却写着他名字的无名信在 03:17 出现，笔迹来自他的童年。黎明 07:17，北岸旧钟最后一响后，整座雾港都会忘记他。他只有四个小时，查明寄件人并找到阻止遗忘的方法。`;
}
