import { useEffect, useRef } from "react";
import type { GameStateView } from "@fogport/shared";
import { NPC_PORTRAIT_IDS, PORTRAITS } from "../portraits";
import { FogportMap } from "./FogportMap";
import { GameIcon } from "./GameIcon";
import { Icon } from "./Icons";
import { QuestPanel } from "./QuestPanel";
import type { InfoSection } from "./InfoRail";

interface InfoPanelProps {
  section: InfoSection;
  state: GameStateView;
  onClose: () => void;
}

const SECTION_META: Record<
  InfoSection,
  { title: string; eyebrow: string; icon: "quest" | "clock" | "location" | "recap" | "stats" | "clues" | "bag" | "people" }
> = {
  quest: { title: "主线", eyebrow: "MAIN THREAD", icon: "quest" },
  clock: { title: "时间", eyebrow: "NIGHT CLOCK", icon: "clock" },
  location: { title: "此刻的位置", eyebrow: "LOCATION", icon: "location" },
  recap: { title: "前情提要", eyebrow: "STORY SO FAR", icon: "recap" },
  stats: { title: "状态", eyebrow: "VITALS", icon: "stats" },
  clues: { title: "线索", eyebrow: "CLUES", icon: "clues" },
  bag: { title: "行囊", eyebrow: "SATCHEL", icon: "bag" },
  people: { title: "人物", eyebrow: "RELATIONS", icon: "people" },
};

export function InfoPanel({ section, state, onClose }: InfoPanelProps) {
  const meta = SECTION_META[section];
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, section]);

  return (
    <>
      <div className="info-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className={`info-panel info-panel-${section}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="info-panel-title"
      >
        <header className="info-panel-head">
          <div className="info-panel-heading">
            <span className="info-panel-icon">
              <GameIcon name={meta.icon} size={30} />
            </span>
            <div>
              <p className="eyebrow">{meta.eyebrow}</p>
              <div className="info-panel-title-line">
                <h2 id="info-panel-title">{meta.title}</h2>
                {section === "quest" && (
                  <span className="info-panel-progress">{state.quest.progress}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="info-close"
            onClick={onClose}
            aria-label="关闭信息卡"
            ref={closeRef}
          >
            <Icon name="close" size={19} />
          </button>
        </header>
        <div className="info-panel-body" ref={bodyRef}>
          {renderContent(section, state)}
        </div>
        <footer className="info-panel-foot">
          <span>状态、时间与规则由服务端写入</span>
        </footer>
      </aside>
    </>
  );
}

function renderContent(section: InfoSection, state: GameStateView) {
  switch (section) {
    case "quest":
      return <QuestContent state={state} />;
    case "clock":
      return <ClockContent state={state} />;
    case "location":
      return <LocationContent state={state} />;
    case "recap":
      return <RecapContent state={state} />;
    case "stats":
      return <StatsContent state={state} />;
    case "clues":
      return <CluesContent state={state} />;
    case "bag":
      return <BagContent state={state} />;
    case "people":
      return <PeopleContent state={state} />;
  }
}

function QuestContent({ state }: { state: GameStateView }) {
  return (
    <div className="panel-stack">
      <QuestPanel quest={state.quest} bare />
      <p className="panel-note">
        这一夜会如何收束，取决于你掌握的线索、信任的人与最后的选择。满足条件时，最后的选择才会出现在输入区上方。
      </p>
      <p className="panel-note">
        提示不会消耗游戏时间；点建议行动也能走完主线。
      </p>
    </div>
  );
}

function ClockContent({ state }: { state: GameStateView }) {
  const remaining = state.clock.remainingMinutes;
  const tone = remaining <= 30 ? "is-critical" : remaining <= 60 ? "is-warning" : "";
  return (
    <div className="panel-stack">
      <div className={`panel-clock ${tone}`.trim()}>
        <strong>{state.clock.label}</strong>
        <div>
          <span>{state.clock.remainingLabel}</span>
          <em>{state.clock.phase}</em>
        </div>
      </div>
      <ul className="panel-rules">
        <li>每回合基础约 10 分钟。</li>
        <li>移动、发现线索、低体力或低意志会额外耗时，单回合最多 25 分钟。</li>
        <li>07:17 前未完成最终选择，这一夜会以另一种方式收束。</li>
        <li>最终选择可能提前结束这一夜；结束后不能继续行动。</li>
      </ul>
    </div>
  );
}

function LocationContent({ state }: { state: GameStateView }) {
  return (
    <div className="panel-stack">
      <FogportMap state={state} />
      <h3 className="panel-location-name">{state.location.name}</h3>
      <p className="panel-prose">{state.location.description}</p>
      <div>
        <p className="panel-label">可前往</p>
        <div className="panel-exits">
          {state.location.exits.map((exit) => (
            <span key={exit.id}>{exit.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecapContent({ state }: { state: GameStateView }) {
  const recentClues = state.unresolvedClues.slice(-3);
  const recentMemories = state.memories.slice(-6);
  return (
    <div className="panel-stack">
      <p className="panel-prose panel-summary">{state.summary}</p>
      <div>
        <p className="panel-label">最近线索</p>
        {recentClues.length > 0 ? (
          <ul className="panel-list">
            {recentClues.map((clue) => (
              <li key={clue}>{clue}</li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">还没有可以确认的线索。</p>
        )}
      </div>
      <div>
        <p className="panel-label">最近记住的事</p>
        {recentMemories.length > 0 ? (
          <ul className="panel-list">
            {recentMemories.map((memory) => (
              <li key={memory}>{memory}</li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">记忆还很轻。</p>
        )}
      </div>
    </div>
  );
}

function StatsContent({ state }: { state: GameStateView }) {
  return (
    <div className="panel-stack">
      <div className="stat-list">
        {state.stats.map((stat) => (
          <div className="stat-row" key={stat.id}>
            <div className="stat-line">
              <span>
                {stat.label}
                <span className="stat-condition">{stat.condition}</span>
              </span>
              <span className="stat-value">{stat.value}</span>
            </div>
            <div
              className="meter"
              role="progressbar"
              aria-label={`${stat.label}：${stat.description}`}
              aria-valuemin={stat.min}
              aria-valuemax={stat.max}
              aria-valuenow={stat.value}
            >
              <span
                className="meter-fill"
                style={{ width: `${((stat.value - stat.min) / (stat.max - stat.min)) * 100}%` }}
              />
            </div>
            <p className="stat-description">{stat.description}</p>
          </div>
        ))}
      </div>
      <p className="panel-note">
        低体力与低意志会让行动更慢；高洞察会在交谈时多揭示一条信息。
      </p>
    </div>
  );
}

function CluesContent({ state }: { state: GameStateView }) {
  return (
    <div className="panel-stack">
      <ol className="key-clue-list">
        {state.quest.keyClues.map((clue, index) => (
          <li key={clue.id} className={clue.found ? "is-found" : "is-locked"}>
            <span className="key-clue-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{clue.title}</strong>
              {clue.found ? (
                <p>{clue.summary}</p>
              ) : (
                <p className="key-clue-locked">尚未确认 · 跟随主线继续调查</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div>
        <p className="panel-label">全部线索与疑问（{state.unresolvedClues.length}）</p>
        {state.unresolvedClues.length > 0 ? (
          <ul className="panel-list">
            {state.unresolvedClues.map((clue) => (
              <li key={clue}>{clue}</li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">雾里还没有可以握住的线索。</p>
        )}
      </div>
    </div>
  );
}

function BagContent({ state }: { state: GameStateView }) {
  if (state.inventory.length === 0) {
    return <p className="panel-empty">邮包空空如也。</p>;
  }
  return (
    <ul className="panel-items">
      {state.inventory.map((item) => (
        <li key={item.id}>
          <strong>{item.name}</strong>
          <p>{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

function PeopleContent({ state }: { state: GameStateView }) {
  const showMother = state.ending?.kind === "name_return";
  const selfStatus =
    state.ending?.kind === "name_return"
      ? "名字已找回"
      : state.ending
        ? "这一夜已结束"
        : "名字正在褪色";
  const selfPortrait = PORTRAITS.lin_jianwu;
  const motherPortrait = PORTRAITS.lin_wu;

  return (
    <div className="people-gallery">
      <article className="person-card person-card-self">
        <div className="person-portrait">
          <img
            src={selfPortrait.src}
            alt={`${state.playerName}立绘`}
            loading="lazy"
          />
          <span className="person-flag">你</span>
        </div>
        <div className="person-info">
          <div className="person-head">
            <div>
              <h3>{state.playerName}</h3>
              <span className="person-role">夜班邮差</span>
            </div>
            <span className="person-status">{selfStatus}</span>
          </div>
          <p className="person-note">
            雾港中央邮局值夜班。无名信上写着你的名字，工牌上的字却在一点点变淡。
          </p>
        </div>
      </article>

      {state.relationships.map((person) => {
        const portraitId = NPC_PORTRAIT_IDS[person.id];
        const portrait = portraitId ? PORTRAITS[portraitId] : null;
        return (
          <article className="person-card" key={person.id}>
            {portrait && (
              <div className="person-portrait">
                <img
                  src={portrait.src}
                  alt={`${person.name}立绘`}
                  loading="lazy"
                />
                <span className="person-flag">{person.attitude}</span>
              </div>
            )}
            <div className="person-info">
              <div className="person-head">
                <div>
                  <h3>{person.name}</h3>
                  <span className="person-role">{person.role}</span>
                </div>
                <span className="person-status">
                  {person.attitude} · {person.value}
                </span>
              </div>
              <div
                className="meter meter-relation"
                role="progressbar"
                aria-label={`与${person.name}的关系`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={person.value}
              >
                <span className="meter-fill" style={{ width: `${person.value}%` }} />
              </div>
              {person.arcNote && <p className="person-note">{person.arcNote}</p>}
              {person.knownFacts.length > 0 && (
                <details className="relation-details">
                  <summary>
                    已知 {person.knownFacts.length} 件事
                    <Icon name="chevron" size={14} />
                  </summary>
                  <ul className="panel-list">
                    {person.knownFacts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </article>
        );
      })}

      {showMother && (
        <article className="person-card person-card-memory">
          <div className="person-portrait">
            <img
              src={motherPortrait.src}
              alt="林雾立绘"
              loading="lazy"
            />
            <span className="person-flag">记忆</span>
          </div>
          <div className="person-info">
            <div className="person-head">
              <div>
                <h3>{motherPortrait.name}</h3>
                <span className="person-role">{motherPortrait.role}</span>
              </div>
              <span className="person-status">旧钟之前</span>
            </div>
            <p className="person-note">
              旧照片、灯塔日志和那枚停在 03:17 的钟，都指向她。你终于把她的名字从雾里捡了回来。
            </p>
          </div>
        </article>
      )}
    </div>
  );
}
