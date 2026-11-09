import type { AchievementView } from "../lib/achievements";
import { Overlay } from "./Overlay";

interface AchievementLibraryProps {
  achievements: AchievementView[];
  onClose: () => void;
}

function formatUnlockedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AchievementLibrary({ achievements, onClose }: AchievementLibraryProps) {
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <Overlay eyebrow="ACHIEVEMENTS · 成就" title="雾港的印记" onClose={onClose}>
      <div className="achievement-summary">
        <strong>{unlocked}</strong>
        <span>/ {achievements.length} 枚徽记</span>
        <p>成就记录保存在当前浏览器；换一个夜晚，也别忘了你曾经走到哪里。</p>
      </div>

      <div className="achievement-grid">
        {achievements.map((achievement) => (
          <article
            className={`achievement-card ${achievement.unlocked ? "is-unlocked" : "is-locked"} ${
              achievement.secret ? "is-secret" : ""
            }`.trim()}
            key={achievement.id}
          >
            <span className="achievement-glyph" aria-hidden="true">
              {achievement.glyph}
            </span>
            <div className="achievement-copy">
              <h3>{achievement.title}</h3>
              <p>{achievement.description}</p>
              <div className="achievement-meta">
                {achievement.progress && <span>{achievement.progress}</span>}
                {achievement.unlockedAt && (
                  <span>{formatUnlockedAt(achievement.unlockedAt)} 解锁</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Overlay>
  );
}
