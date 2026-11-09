import { useCallback, useEffect, useState } from "react";
import type {
  ActiveMode,
  GameStateView,
  HealthResponse,
  SessionSnapshot,
  TurnView,
} from "@fogport/shared";
import { ApiClientError, createSession, displayError, getHealth, getSession } from "./lib/api";
import { clearSavedSessionId, loadSavedSessionId, saveSessionId } from "./lib/storage";
import {
  listSavedGames,
  recordSavedGame,
  removeSavedGame,
  type SavedGame,
} from "./lib/saves";
import {
  evaluateAchievements,
  listAchievements,
  type AchievementView,
} from "./lib/achievements";
import { AchievementToast } from "./components/AchievementToast";
import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { Landing } from "./components/Landing";

interface ActiveGame {
  session: SessionSnapshot;
  turns: TurnView[];
  mode: ActiveMode;
}

type Phase = "boot" | "home" | "new" | "game" | "fatal";

export default function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [saves, setSaves] = useState<SavedGame[]>(() => listSavedGames());
  const [achievements, setAchievements] = useState<AchievementView[]>(() =>
    listAchievements(),
  );
  const [achievementQueue, setAchievementQueue] = useState<AchievementView[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => loadSavedSessionId());
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setPhase("boot");
      setBootError(null);

      let nextHealth: HealthResponse;
      try {
        nextHealth = await getHealth();
      } catch (error) {
        if (!cancelled) {
          setBootError(displayError(error));
          setPhase("fatal");
        }
        return;
      }

      if (cancelled) return;
      setHealth(nextHealth);
      setSaves(listSavedGames());
      setAchievements(listAchievements());
      setCurrentId(loadSavedSessionId());
      setPhase("home");
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  useEffect(() => {
    if (phase === "game" && game) {
      document.title = `${game.session.state.location.name} · 雾港来信 · 第 ${game.session.state.turnCount} 回合`;
    } else if (phase === "home" || phase === "new") {
      document.title = "雾港来信 · 一封没有收件人的信";
    } else if (phase === "fatal") {
      document.title = "雾港来信 · 连接中断";
    }
  }, [phase, game?.session.state.location.name, game?.session.state.turnCount]);

  useEffect(() => {
    if (!game) return;
    saveSessionId(game.session.id);
    setCurrentId(game.session.id);
    const nextSaves = recordSavedGame(game.session);
    setSaves(nextSaves);
    const evaluation = evaluateAchievements(game.session, nextSaves);
    setAchievements(evaluation.achievements);
    if (evaluation.newlyUnlocked.length > 0) {
      setAchievementQueue((previous) => [
        ...previous,
        ...evaluation.newlyUnlocked,
      ]);
    }
  }, [game]);

  const applyGame = useCallback(
    (session: SessionSnapshot, turns: TurnView[], nextMode: ActiveMode) => {
      saveSessionId(session.id);
      setCurrentId(session.id);
      setGame({ session, turns, mode: nextMode });
      setHealth((previous) => (previous ? { ...previous, mode: nextMode } : previous));
      setHomeError(null);
      setPhase("game");
    },
    [],
  );

  const handleStart = useCallback(
    async (playerName?: string) => {
      const result = await createSession(playerName);
      applyGame(result.session, [], result.mode);
    },
    [applyGame],
  );

  const handleLoadSave = useCallback(
    async (sessionId: string) => {
      if (homeBusy) return;
      setHomeBusy(true);
      setHomeError(null);
      try {
        if (game?.session.id === sessionId) {
          saveSessionId(sessionId);
          setCurrentId(sessionId);
          setPhase("game");
          return;
        }
        const detail = await getSession(sessionId);
        applyGame(detail.session, detail.turns, detail.mode);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          const nextSaves = removeSavedGame(sessionId);
          setSaves(nextSaves);
          setCurrentId((previous) => (previous === sessionId ? null : previous));
          if (loadSavedSessionId() === sessionId) clearSavedSessionId();
          setHomeError("这个存档已经不存在了，可能已被删除。");
          return;
        }
        setHomeError(displayError(error));
      } finally {
        setHomeBusy(false);
      }
    },
    [applyGame, game?.session.id, homeBusy],
  );

  const handleContinue = useCallback(() => {
    if (homeBusy) return;
    if (game) {
      setPhase("game");
      return;
    }
    const preferredId =
      currentId && (saves.some((save) => save.id === currentId) || saves.length === 0)
        ? currentId
        : saves[0]?.id ?? currentId;
    if (!preferredId) {
      setHomeError("还没有可以继续的存档。");
      return;
    }
    void handleLoadSave(preferredId);
  }, [currentId, game, handleLoadSave, homeBusy, saves]);

  const handleSave = useCallback(() => {
    if (!game) return;
    saveSessionId(game.session.id);
    setCurrentId(game.session.id);
    setSaves(recordSavedGame(game.session));
  }, [game]);

  const handleHome = useCallback(() => {
    setHomeError(null);
    setPhase("home");
  }, []);

  const handleCreateNew = useCallback(async () => {
    if (!game) {
      throw new Error("当前没有可替换的存档。");
    }
    const result = await createSession(game.session.state.playerName);
    applyGame(result.session, [], result.mode);
  }, [applyGame, game]);

  const handleTurnApplied = useCallback(
    (state: GameStateView, turn: TurnView, nextMode: ActiveMode) => {
      setGame((previous) => {
        if (!previous) return previous;
        return {
          mode: nextMode,
          session: {
            ...previous.session,
            updatedAt: turn.createdAt,
            state,
          },
          turns: [...previous.turns, turn],
        };
      });
      setHealth((previous) => (previous ? { ...previous, mode: nextMode } : previous));
    },
    [],
  );

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true">
        <span className="fog-layer fog-one" />
        <span className="fog-layer fog-two" />
        <span className="fog-layer fog-three" />
        <span className="grain" />
      </div>

      {phase === "boot" && <BootScreen />}

      {phase === "fatal" && (
        <main className="fatal-screen">
          <div className="fatal-card">
            <span className="seal" aria-hidden="true">
              雾
            </span>
            <p className="eyebrow">CONNECTION LOST · 03:17</p>
            <h1>雾太大，信送不到</h1>
            <p className="fatal-message">{bootError ?? "无法连接后端服务。"}</p>
            <p className="fatal-hint">
              请确认已在项目根目录运行 <code>npm run dev</code>，并等待后端提示监听成功。
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setBootAttempt((attempt) => attempt + 1)}
            >
              重新点亮值班灯
            </button>
          </div>
        </main>
      )}

      {phase === "home" && health && (
        <HomeScreen
          mode={health.mode}
          saves={saves}
          achievements={achievements}
          currentId={currentId}
          busy={homeBusy}
          error={homeError}
          onStart={() => setPhase("new")}
          onContinue={handleContinue}
          onLoadSave={(id) => void handleLoadSave(id)}
        />
      )}

      {phase === "new" && health && (
        <Landing
          mode={health.mode}
          requestedMode={health.requestedMode}
          qwenConfigured={health.qwenConfigured}
          onCreate={handleStart}
          onBack={() => setPhase("home")}
        />
      )}

      {phase === "game" && health && game && (
        <GameScreen
          key={game.session.id}
          health={health}
          session={game.session}
          turns={game.turns}
          mode={game.mode}
          onTurnApplied={handleTurnApplied}
          onSave={handleSave}
          onHome={handleHome}
          onCreateNew={handleCreateNew}
        />
      )}

      {achievementQueue[0] && (
        <AchievementToast
          key={achievementQueue[0].id}
          achievement={achievementQueue[0]}
          onDismiss={() => setAchievementQueue((queue) => queue.slice(1))}
        />
      )}
    </div>
  );
}

function BootScreen() {
  return (
    <main className="boot-screen" role="status" aria-live="polite">
      <span className="seal boot-seal" aria-hidden="true">
        雾
      </span>
      <p className="eyebrow">FOGPORT NIGHT POST</p>
      <h1>雾港来信</h1>
      <p className="boot-status">
        正在点亮邮局的灯
        <span className="boot-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
    </main>
  );
}
