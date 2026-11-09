import { useEffect, useRef, useState } from "react";
import type { AcceptedEvent, SessionSnapshot, TurnView } from "@fogport/shared";
import { EndingPanel } from "./EndingPanel";
import { Icon } from "./Icons";

interface StoryFeedProps {
  session: SessionSnapshot;
  turns: TurnView[];
  pendingAction: string | null;
  elapsedSeconds: number;
  onRetryAction: (action: string) => void;
}

const EVENT_META: Record<AcceptedEvent["type"], { mark: string; label: string }> = {
  set_flag: { mark: "记", label: "剧情标记" },
  add_item: { mark: "得", label: "获得物品" },
  remove_item: { mark: "失", label: "失去物品" },
  change_relation: { mark: "缘", label: "关系变化" },
  change_stat: { mark: "变", label: "属性变化" },
  move_location: { mark: "往", label: "位置变化" },
  learn_fact: { mark: "闻", label: "得知信息" },
};

export function StoryFeed({
  session,
  turns,
  pendingAction,
  elapsedSeconds,
  onRetryAction,
}: StoryFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDetailsElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const initialRender = useRef(true);
  const previousTurnCount = useRef(turns.length);
  const previousPending = useRef<boolean>(Boolean(pendingAction));
  const state = session.state;

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    if (initialRender.current) {
      initialRender.current = false;
      feed.scrollTop = turns.length > 0 ? feed.scrollHeight : 0;
      return;
    }

    const grew = turns.length !== previousTurnCount.current;
    const pendingStarted = Boolean(pendingAction) && !previousPending.current;
    previousTurnCount.current = turns.length;
    previousPending.current = Boolean(pendingAction);

    if (grew || pendingStarted) {
      feed.scrollTo({
        top: feed.scrollHeight,
        behavior: grew ? "smooth" : "auto",
      });
    }
  }, [turns.length, pendingAction]);

  useEffect(() => {
    if (state.status !== "ended") return;
    feedRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [state.status]);

  useEffect(() => {
    if (!historyOpen) return;
    const feed = feedRef.current;
    const history = historyRef.current;
    if (!feed || !history) return;
    const top =
      history.getBoundingClientRect().top -
      feed.getBoundingClientRect().top +
      feed.scrollTop;
    feed.scrollTo({ top: Math.max(0, top - 14), behavior: "smooth" });
  }, [historyOpen]);

  const storyArchive = (
    <>
      <header className="story-hero">
        <p className="eyebrow">PROLOGUE · {state.clock.label} · NIGHT POST</p>
        <h1>雾港来信</h1>
        <p className="story-deck">
          黎明 07:17，旧钟最后一响后，整座雾港都会忘记你。那封写着你名字的无名信，是你唯一的线索。
        </p>
        <div className="hero-meta">
          <span className={`clock-meta ${clockTone(state.clock.remainingMinutes)}`}>
            <Icon name="clock" size={14} /> {state.clock.label} · {state.clock.remainingLabel}
          </span>
          <span>
            <Icon name="pin" size={14} /> {state.location.name}
          </span>
          <span>{state.quest.progress}</span>
        </div>
      </header>

      <article className="letter-opening">
        <div className="opening-label">
          <span>序章</span>
          <span>无名之信</span>
        </div>
        <Narrative text={session.openingNarration} />
        <p className="opening-signature">—— 雾港中央邮局，夜班分拣室</p>
      </article>

      {state.turnCount === 0 && <StartingGuide />}

      <div className="turn-list">
        {turns.map((turn, index) => (
          <TurnEntry
            key={turn.number}
            turn={turn}
            isLatest={index === turns.length - 1 && !pendingAction}
            canRetry={state.status === "active"}
            onRetryAction={onRetryAction}
          />
        ))}
      </div>

      {pendingAction && <PendingTurn action={pendingAction} elapsedSeconds={elapsedSeconds} />}
    </>
  );

  return (
    <div className={`story-feed ${state.ending ? "is-ending" : ""}`.trim()} ref={feedRef}>
      <div className="story-inner">
        {state.ending ? (
          <>
            <EndingPanel
              state={state}
              ending={state.ending}

            />
            <details
              className="ending-history"
              ref={historyRef}
              open={historyOpen}
              onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            >
              <summary>
                <span>完整剧情记录</span>
                <span className="ending-history-meta">{turns.length} 个回合 · 展开查看</span>
                <Icon name="chevron" size={15} />
              </summary>
              <div className="ending-history-content">{storyArchive}</div>
            </details>
          </>
        ) : (
          storyArchive
        )}

        <div className="feed-end" aria-hidden="true" />
      </div>
    </div>
  );
}

function TurnEntry({
  turn,
  isLatest,
  canRetry,
  onRetryAction,
}: {
  turn: TurnView;
  isLatest: boolean;
  canRetry: boolean;
  onRetryAction: (action: string) => void;
}) {
  const warning = friendlyWarning(turn.warning);
  return (
    <article
      className={`turn-entry ${isLatest ? "is-latest" : ""}`.trim()}
      aria-live={isLatest ? "polite" : undefined}
    >
      <div className="turn-rail" aria-hidden="true">
        <span>{String(turn.number).padStart(2, "0")}</span>
        <div className="turn-rail-line" />
      </div>

      <div className="turn-content">
        <p className="turn-kicker">
          TURN {String(turn.number).padStart(2, "0")}
          {turn.clockAfter ? ` · ${turn.clockAfter}` : ""}
        </p>

        <div className="turn-action">
          <span className="action-label">你的行动</span>
          <p>“{turn.playerAction}”</p>
        </div>

        <Narrative text={turn.narration} />

        {warning && (
          <div className="turn-warning" role="status">
            <span aria-hidden="true">!</span>
            <div>
              <p>{warning}</p>
              {isLatest && canRetry && (
                <button
                  type="button"
                  className="inline-retry"
                  onClick={() => onRetryAction(turn.playerAction)}
                >
                  再做一次
                </button>
              )}
            </div>
          </div>
        )}

        {turn.acceptedEvents.length > 0 && (
          <div className="event-list" aria-label="本回合的剧情变化">
            {turn.acceptedEvents.map((event, index) => {
              const meta = EVENT_META[event.type];
              return (
                <span
                  className={`event-chip event-${event.type}`}
                  key={`${turn.number}-${index}-${event.type}`}
                  title={meta.label}
                >
                  <span aria-hidden="true">{meta.mark}</span>
                  {event.description}
                </span>
              );
            })}
          </div>
        )}

        {turn.ruleNotes.length > 0 && (
          <div className="rule-notes" aria-label="时间与属性结算">
            <span className="rule-label">结算</span>
            {turn.ruleNotes.map((note, index) => (
              <span className="rule-chip" key={`${turn.number}-rule-${index}`}>
                {note}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function PendingTurn({ action, elapsedSeconds }: { action: string; elapsedSeconds: number }) {
  return (
    <article className="pending-turn" aria-live="polite" aria-busy="true">
      <div className="turn-rail" aria-hidden="true">
        <span className="pending-number">··</span>
        <div className="turn-rail-line" />
      </div>
      <div className="turn-content">
        <div className="turn-action pending-action">
          <span className="action-label">你的行动</span>
          <p>“{action}”</p>
        </div>
        <div className="pending-narration">
          <span className="fog-dot" />
          <span className="fog-dot" />
          <span className="fog-dot" />
          <p>{waitingMessage(elapsedSeconds)}</p>
          <span className="wait-timer">已等待 {elapsedSeconds} 秒</span>
        </div>
        <div className="pending-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </article>
  );
}

const GUIDE_STORAGE_KEY = "fogport.guide.v1";

function StartingGuide() {
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_STORAGE_KEY) !== "closed";
    } catch {
      return true;
    }
  });

  function rememberOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    try {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, nextOpen ? "open" : "closed");
    } catch {
      // ignore storage failures
    }
  }

  return (
    <details
      className="starting-guide"
      open={open}
      onToggle={(event) => rememberOpen(event.currentTarget.open)}
    >
      <summary>
        <span>开始之前</span>
        <span className="starting-guide-hint">这一夜怎么玩</span>
      </summary>
      <div className="starting-guide-body">
        <p>
          <strong>你是谁</strong>
          雾港中央邮局的夜班邮差。你工牌上的名字正在褪色，老周已经叫不出你的全名。
        </p>
        <p>
          <strong>今夜目标</strong>
          黎明 07:17 前查明无名信的寄件人，找到阻止雾港忘记你的方法；主线需要三条关键线索。
        </p>
        <p>
          <strong>怎么行动</strong>
          点击下方的建议行动即可推进，也可以用自己的话自由输入。建议行动都指向主线或明确后果；提示不消耗时间。
        </p>
        <p>
          <strong>时间会走动</strong>
          每回合默认约 10 分钟，移动、发现线索或状态低落会额外耗时。07:17 会进入结局。
        </p>
        <p>
          <strong>最后的选择</strong>
          线索与信任满足条件后，输入区上方才会出现对应的最后选择；未满足的选择不会提前显示。时间耗尽也会迎来一个结局。
        </p>
        <p>
          <strong>属性会发声</strong>
          疲惫、迟疑与敏锐会改变行动代价和人物反应，可在左侧「状态」中查看。
        </p>
      </div>
    </details>
  );
}

function Narrative({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0);
  return (
    <div className="narration">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function friendlyWarning(warning: string | null): string | null {
  if (!warning) return null;
  if (warning.includes("候选事件") || warning.includes("世界规则校验")) {
    return "这次尝试没有成功。这一回合没有产生可以确认的变化。";
  }
  return warning;
}

function waitingMessage(seconds: number): string {
  if (seconds < 8) return "雾正在重新排列你的脚步…";
  if (seconds < 30) return "这次回声比往常更远。通常需要 10–25 秒。";
  if (seconds < 45) return "仍在等待回应，请勿重复提交；失败后你的行动会保留。";
  return "等待时间较长。若这次尝试失败，你可以直接重试或换一种行动。";
}

function clockTone(remainingMinutes: number): string {
  if (remainingMinutes <= 30) return "clock-critical";
  if (remainingMinutes <= 60) return "clock-warning";
  return "";
}
