import { useEffect, useState } from "react";
import type { GameStateView } from "@fogport/shared";
import { GameIcon } from "./GameIcon";
import type { GameIconName } from "../gameIcons";

export type InfoSection =
  | "quest"
  | "clock"
  | "location"
  | "recap"
  | "stats"
  | "clues"
  | "bag"
  | "people";

interface InfoRailProps {
  sessionId: string;
  state: GameStateView;
  active: InfoSection | null;
  onSelect: (section: InfoSection) => void;
}

interface RailItem {
  id: InfoSection;
  label: string;
  icon: GameIconName;
  badge?: string;
  tone?: string;
  summary: string;
  unread?: boolean;
}

interface SeenContent {
  items: string[];
  clues: string[];
}

const UNREAD_STORAGE_PREFIX = "fogport.unread.v1.";

function currentContent(state: GameStateView): SeenContent {
  return {
    items: state.inventory.map((item) => item.id),
    clues: [...state.unresolvedClues],
  };
}

function loadSeenContent(sessionId: string): SeenContent | null {
  try {
    const raw = window.localStorage.getItem(`${UNREAD_STORAGE_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const data = parsed as { items?: unknown; clues?: unknown };
    if (!Array.isArray(data.items) || !Array.isArray(data.clues)) return null;
    return {
      items: data.items.filter((item): item is string => typeof item === "string"),
      clues: data.clues.filter((clue): clue is string => typeof clue === "string"),
    };
  } catch {
    return null;
  }
}

function saveSeenContent(sessionId: string, content: SeenContent): void {
  try {
    window.localStorage.setItem(
      `${UNREAD_STORAGE_PREFIX}${sessionId}`,
      JSON.stringify(content),
    );
  } catch {
    // localStorage 不可用时只影响未读提示，不影响游戏。
  }
}

function keyProgressBadge(progress: string): string {
  const match = progress.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? `${match[1]}/${match[2]}` : "终";
}

export function InfoRail({ sessionId, state, active, onSelect }: InfoRailProps) {
  const foundKeyClues = state.quest.keyClues.filter((clue) => clue.found).length;
  const trustedCount = state.relationships.filter((person) => person.value >= 65).length;
  const [seenContent, setSeenContent] = useState<SeenContent | null>(null);

  useEffect(() => {
    setSeenContent(null);
    const stored = loadSeenContent(sessionId);
    const initial = stored ?? currentContent(state);
    if (!stored) saveSeenContent(sessionId, initial);
    setSeenContent(initial);
    // 只在切换存档时初始化；之后的未读状态由回合变化与打开面板更新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const unreadClues = seenContent
    ? state.unresolvedClues.some((clue) => !seenContent.clues.includes(clue))
    : false;
  const unreadItems = seenContent
    ? state.inventory.some((item) => !seenContent.items.includes(item.id))
    : false;

  function markSeen(kind: "clues" | "bag") {
    if (!seenContent) return;
    const current = currentContent(state);
    const next =
      kind === "clues"
        ? { ...seenContent, clues: current.clues }
        : { ...seenContent, items: current.items };
    saveSeenContent(sessionId, next);
    setSeenContent(next);
  }

  useEffect(() => {
    if (active === "clues" && unreadClues) markSeen("clues");
    if (active === "bag" && unreadItems) markSeen("bag");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, state.inventory, state.unresolvedClues, unreadClues, unreadItems]);

  function handleSelect(section: InfoSection) {
    if (section === "clues") markSeen("clues");
    if (section === "bag") markSeen("bag");
    onSelect(section);
  }
  const clockTone =
    state.clock.remainingMinutes <= 30
      ? "is-critical"
      : state.clock.remainingMinutes <= 60
        ? "is-warning"
        : "";

  const items: RailItem[] = [
    {
      id: "quest",
      label: "主线",
      icon: "quest",
      badge: keyProgressBadge(state.quest.progress),
      tone: "is-primary",
      summary: `${state.quest.objective} · ${state.quest.progress}`,
    },
    {
      id: "clock",
      label: "时间",
      icon: "clock",
      tone: clockTone,
      badge:
        state.clock.remainingMinutes >= 60
          ? `${Math.ceil(state.clock.remainingMinutes / 60)}h`
          : state.clock.remainingMinutes > 0
            ? `${state.clock.remainingMinutes}m`
            : "终",
      summary: `${state.clock.label} · ${state.clock.remainingLabel}`,
    },
    {
      id: "location",
      label: "地点",
      icon: "location",
      summary: state.location.name,
    },
    {
      id: "recap",
      label: "前情",
      icon: "recap",
      summary: "前情提要、最近线索与记忆",
    },
    {
      id: "stats",
      label: "状态",
      icon: "stats",
      summary: state.stats
        .map((stat) => `${stat.label} ${stat.value} · ${stat.condition}`)
        .join("，"),
    },
    {
      id: "clues",
      label: "线索",
      icon: "clues",
      badge: String(state.unresolvedClues.length),
      summary: `${foundKeyClues} / ${state.quest.keyClues.length} 条关键线索`,
      unread: unreadClues,
    },
    {
      id: "bag",
      label: "行囊",
      icon: "bag",
      badge: String(state.inventory.length),
      summary: state.inventory.map((item) => item.name).join("、") || "空",
      unread: unreadItems,
    },
    {
      id: "people",
      label: "人物",
      icon: "people",
      badge: trustedCount > 0 ? String(trustedCount) : undefined,
      summary: trustedCount > 0 ? `${trustedCount} 人信任你` : "人物关系与已知信息",
    },
  ];

  return (
    <nav className="info-rail" aria-label="旅途信息">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`rail-button ${item.tone ?? ""} ${
            active === item.id ? "is-active" : ""
          }`.trim()}
          aria-pressed={active === item.id}
          aria-label={`${item.label}：${item.summary}${item.unread ? "，有新内容" : ""}`}
          title={`${item.label}：${item.summary}${item.unread ? " · 有新内容" : ""}`}
          onClick={() => handleSelect(item.id)}
        >
          <span className="rail-icon">
            <GameIcon name={item.icon} size={25} />
            {item.unread && <span className="rail-unread" aria-hidden="true" />}
          </span>
          <span className="rail-label">{item.label}</span>
          {item.badge && <span className="rail-badge">{item.badge}</span>}
        </button>
      ))}
    </nav>
  );
}
