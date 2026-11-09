import { useEffect, useRef, useState } from "react";
import type {
  ActiveMode,
  GameStateView,
  HealthResponse,
  SessionSnapshot,
  TurnView,
} from "@fogport/shared";
import { submitTurn, toUiError, type UiError } from "../lib/api";
import { Composer } from "./Composer";
import { Icon } from "./Icons";
import { InfoPanel } from "./InfoPanel";
import { InfoRail, type InfoSection } from "./InfoRail";
import { ModeBadge } from "./ModeBadge";
import { StoryFeed } from "./StoryFeed";

interface GameScreenProps {
  health: HealthResponse;
  session: SessionSnapshot;
  turns: TurnView[];
  mode: ActiveMode;
  onTurnApplied: (state: GameStateView, turn: TurnView, mode: ActiveMode) => void;
  onSave: () => void;
  onHome: () => void;
  onCreateNew: () => Promise<void>;
}

export function GameScreen({
  health,
  session,
  turns,
  mode,
  onTurnApplied,
  onSave,
  onHome,
  onCreateNew,
}: GameScreenProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [submitStartedAt, setSubmitStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeInfo, setActiveInfo] = useState<InfoSection | null>(null);
  const [endingError, setEndingError] = useState<string | null>(null);
  const [endingBusy, setEndingBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const busyRef = useRef(false);

  const state = session.state;
  const ended = state.status === "ended";
  const mainlineAction = state.quest.recommendedAction;
  const baseSuggestions =
    turns.length > 0 ? turns[turns.length - 1].suggestedActions : session.openingSuggestions;
  const availableFinalActions = new Set(
    state.finalChoices.filter((choice) => choice.available).map((choice) => choice.action),
  );
  const suggestions = [
    ...new Set([
      ...(mainlineAction ? [mainlineAction] : []),
      ...baseSuggestions,
    ]),
  ]
    .filter((suggestion) => !availableFinalActions.has(suggestion))
    .slice(0, 3);
  const qwenBlocked = health.requestedMode === "qwen" && !health.qwenConfigured;

  function estimateActionMinutes(action: string): string {
    const moving = /前往|去|离开|回到|返回|沿雾|登|出发|走向/.test(action);
    const discovery =
      /检查|查看|翻|找|打听|问|聊|读|打捞|调查|查阅|核对|拆|观察|端详|寻找|钟室/.test(
        action,
      );
    const lowCondition = state.stats.some(
      (stat) => (stat.id === "stamina" || stat.id === "will") && stat.value < 30,
    );
    const minutes = Math.min(
      25,
      10 + (moving ? 5 : 0) + (discovery ? 5 : 0) + (lowCondition ? 5 : 0),
    );
    return `约 ${minutes} 分钟`;
  }

  useEffect(() => {
    if (!busy || submitStartedAt === null) {
      setElapsedSeconds(0);
      return;
    }
    const update = () =>
      setElapsedSeconds(
        Math.max(1, Math.ceil((Date.now() - submitStartedAt) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [busy, submitStartedAt]);

  async function handleSubmit(suggestedAction?: string) {
    if (busyRef.current || state.status === "ended") return;

    const action = (suggestedAction ?? input).trim();
    if (!action) return;

    if (suggestedAction !== undefined) {
      setInput(suggestedAction);
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPendingAction(action);
    setSubmitStartedAt(Date.now());
    setElapsedSeconds(1);

    try {
      const result = await submitTurn(session.id, action);
      setInput("");
      onTurnApplied(result.state, result.turn, result.mode);
    } catch (caught) {
      setError(toUiError(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
      setPendingAction(null);
      setSubmitStartedAt(null);
    }
  }

  function retryLastAction() {
    if (busy) return;
    void handleSubmit();
  }

  function handleSave() {
    onSave();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  async function handleEndingRestart() {
    if (endingBusy) return;
    setEndingBusy(true);
    setEndingError(null);
    try {
      await onCreateNew();
    } catch (caught) {
      setEndingError(toUiError(caught).message);
      setEndingBusy(false);
    }
  }

  const clockTone =
    state.clock.remainingMinutes <= 30
      ? "clock-critical"
      : state.clock.remainingMinutes <= 60
        ? "clock-warning"
        : "";

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="brand">
          <span className="seal seal-small" aria-hidden="true">
            雾
          </span>
          <div>
            <p className="brand-name">雾港来信</p>
            <p className="brand-sub">FOGPORT LETTERS · NIGHT POST</p>
          </div>
        </div>

        <div className="game-progress">
          <span className="progress-item">
            <span className="progress-label">所在</span>
            {state.location.name}
          </span>
          <span className="progress-separator" aria-hidden="true" />
          <span className={`progress-item clock-progress ${clockTone}`}>
            <span className="progress-label">
              <Icon name="clock" size={12} /> 时间
            </span>
            {state.clock.label}
            <span className="clock-remaining">· {state.clock.remainingLabel}</span>
          </span>
        </div>

        <div className="header-actions">
          <ModeBadge mode={mode} />
          <button
            type="button"
            className={`header-button header-save-button ${savedFlash ? "is-saved" : ""}`.trim()}
            onClick={handleSave}
            disabled={busy}
            title="保存当前进度"
            aria-label="保存当前进度"
          >
            <Icon name="save" size={14} />
            <span className="header-action-label">{savedFlash ? "已存" : "存档"}</span>
          </button>
          <button
            type="button"
            className="header-button"
            onClick={onHome}
            disabled={busy}
            title="返回主页"
            aria-label="返回主页"
          >
            <Icon name="home" size={14} />
            <span className="header-action-label">主页</span>
          </button>
        </div>
      </header>

      {savedFlash && (
        <div className="save-toast" role="status" aria-live="polite">
          进度已存档
        </div>
      )}

      {qwenBlocked && (
        <div className="inline-alert" role="alert">
          强制 Qwen 模式下缺少 API 配置，新的行动会失败。请补齐后端环境变量后重启服务。
        </div>
      )}

      <div className="game-content">
        <InfoRail
          sessionId={session.id}
          state={state}
          active={activeInfo}
          onSelect={(section) =>
            setActiveInfo((current) => (current === section ? null : section))
          }
        />

        <main className="game-stage">
          <section className="story-column" aria-label="剧情">
            <StoryFeed
              session={session}
              turns={turns}
              pendingAction={pendingAction}
              elapsedSeconds={elapsedSeconds}
              onRetryAction={(action) => void handleSubmit(action)}
            />
            {ended ? (
              <div className="ending-footer">
                <div>
                  <p className="ending-footer-title">这一夜已经结束。</p>
                  <p className="ending-footer-text">
                    这一夜停在 {state.clock.label}。你可以从左侧图标回顾旅途，或带着另一个选择重新开始。
                  </p>
                  {endingError && (
                    <p className="ending-footer-error" role="alert">
                      {endingError}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleEndingRestart}
                  disabled={endingBusy}
                >
                  {endingBusy ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      正在重写信封
                    </>
                  ) : (
                    "开始新的一局"
                  )}
                </button>
              </div>
            ) : (
              <Composer
                input={input}
                suggestions={suggestions}
                mainlineAction={mainlineAction}
                finalChoices={state.finalChoices}
                remainingMinutes={state.clock.remainingMinutes}
                busy={busy}
                error={error}
                elapsedSeconds={elapsedSeconds}
                estimateMinutes={estimateActionMinutes}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                onRetry={retryLastAction}
                onDismissError={() => setError(null)}
              />
            )}
          </section>
        </main>

        {activeInfo && (
          <InfoPanel
            section={activeInfo}
            state={state}
            onClose={() => setActiveInfo(null)}
          />
        )}
      </div>

    </div>
  );
}
