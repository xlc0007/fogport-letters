import { useState } from "react";
import type { ActiveMode } from "@fogport/shared";
import type { AchievementView } from "../lib/achievements";
import type { SavedGame } from "../lib/saves";
import { formatSavedAt } from "../lib/saves";
import { AchievementLibrary } from "./AchievementLibrary";
import { Icon } from "./Icons";
import { ModeBadge } from "./ModeBadge";
import { SaveLibrary } from "./SaveLibrary";

interface HomeScreenProps {
  mode: ActiveMode;
  saves: SavedGame[];
  achievements: AchievementView[];
  currentId: string | null;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onContinue: () => void;
  onLoadSave: (id: string) => void;
}

export function HomeScreen({
  mode,
  saves,
  achievements,
  currentId,
  busy,
  error,
  onStart,
  onContinue,
  onLoadSave,
}: HomeScreenProps) {
  const [savesOpen, setSavesOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const currentSave =
    saves.find((save) => save.id === currentId) ?? saves[0] ?? null;
  const canContinue = Boolean(currentId || currentSave);
  const unlockedAchievements = achievements.filter(
    (achievement) => achievement.unlocked,
  ).length;

  return (
    <div className="home-screen">
      <header className="home-topbar">
        <div className="brand brand-small">
          <span className="seal seal-small" aria-hidden="true">
            雾
          </span>
          <div>
            <p className="brand-name">雾港来信</p>
            <p className="brand-sub">FOGPORT LETTERS · NIGHT POST</p>
          </div>
        </div>
        <ModeBadge mode={mode} />
      </header>

      <main className="home-main">
        <section className="home-copy" aria-labelledby="home-title">
          <p className="eyebrow">FOGPORT · NIGHT SHIFT · 03:17</p>
          <h1 className="home-title" id="home-title">
            雾港<span>来信</span>
          </h1>
          <p className="home-english">LETTERS FROM THE FOG</p>
          <p className="home-intro">
            今夜，你替整座城送最后一班信。
            <br />
            其中一封没有收件人，却写着你的名字。
          </p>
          <p className="home-intro home-intro-soft">
            黎明 07:17，旧钟最后一响后，雾港会彻底忘记你。
            <br />
            你只有四个小时，和这封信。
          </p>

          {error && (
            <p className="home-error" role="alert">
              {error}
            </p>
          )}

          <div className="home-choices" aria-label="开始或继续游戏">
            <button type="button" className="home-choice home-choice-primary" onClick={onStart}>
              <span className="home-choice-index">01</span>
              <span className="home-choice-copy">
                <strong>开始</strong>
                <span>领取今夜的邮包，走进 03:17 的雾。</span>
              </span>
              <Icon name="arrow" size={17} />
            </button>

            <button
              type="button"
              className="home-choice"
              onClick={onContinue}
              disabled={!canContinue || busy}
            >
              <span className="home-choice-index">02</span>
              <span className="home-choice-copy">
                <strong>{busy ? "正在读取…" : "继续"}</strong>
                <span>
                  {currentSave
                    ? `${currentSave.turnCount === 0 ? "序章" : `第 ${currentSave.turnCount} 回合`} · ${currentSave.clockLabel} · ${currentSave.locationName}`
                    : canContinue
                      ? "回到你上次停留的夜。"
                      : "还没有可以继续的存档。"}
                </span>
              </span>
              <Icon name="arrow" size={17} />
            </button>

            <button
              type="button"
              className="home-choice"
              onClick={() => setSavesOpen(true)}
            >
              <span className="home-choice-index">03</span>
              <span className="home-choice-copy">
                <strong>存档</strong>
                <span>
                  {saves.length > 0
                    ? `${saves.length} 个夜晚 · 查看、读取或整理`
                    : "每一回合都会自动存档。"}
                </span>
              </span>
              <Icon name="arrow" size={17} />
            </button>

            <button
              type="button"
              className="home-choice"
              onClick={() => setAchievementsOpen(true)}
            >
              <span className="home-choice-index">04</span>
              <span className="home-choice-copy">
                <strong>成就</strong>
                <span>
                  {unlockedAchievements} / {achievements.length} 枚徽记 · 查看
                </span>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          </div>

          <div className="home-save-summary">
            <span className="home-save-label">LAST NIGHT · 最近存档</span>
            {currentSave ? (
              <>
                <strong>{currentSave.playerName}</strong>
                <span>
                  {currentSave.clockLabel} · {currentSave.locationName}
                </span>
                <em>{formatSavedAt(currentSave.savedAt)}</em>
              </>
            ) : (
              <span>还没有存档。开始后，每一回合都会自动留下记录。</span>
            )}
          </div>
        </section>

        <div className="home-letter" aria-hidden="true">
          <div className="home-letter-paper">
            <div className="home-letter-postmark">
              <span>雾港</span>
              <span>03:17</span>
            </div>
            <p className="home-letter-to">致</p>
            <p className="home-letter-address">尚未抵达的你</p>
            <p className="home-letter-note">黎明以前，请务必拆阅。</p>
            <div className="home-letter-rule" />
            <p className="home-letter-code">NO ADDRESSEE · NO RETURN</p>
            <span className="home-letter-seal">雾</span>
          </div>
        </div>
      </main>

      <footer className="home-footer">
        <span>雾港中央邮局 · 夜班登记处</span>
        <span>你的选择会留下痕迹 · 每一回合自动存档</span>
      </footer>

      {savesOpen && (
        <SaveLibrary
          saves={saves}
          currentId={currentId}
          busy={busy}
          error={error}
          onClose={() => setSavesOpen(false)}
          onLoad={(id) => {
            setSavesOpen(false);
            onLoadSave(id);
          }}
        />
      )}

      {achievementsOpen && (
        <AchievementLibrary
          achievements={achievements}
          onClose={() => setAchievementsOpen(false)}
        />
      )}
    </div>
  );
}
