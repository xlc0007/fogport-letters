import { useEffect } from "react";
import type { AchievementView } from "../lib/achievements";
import { Icon } from "./Icons";

interface AchievementToastProps {
  achievement: AchievementView;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [achievement.id]);

  return (
    <div className="achievement-toast" role="status" aria-live="polite">
      <span className="achievement-toast-glyph" aria-hidden="true">
        {achievement.glyph}
      </span>
      <div className="achievement-toast-copy">
        <p>ACHIEVEMENT · 成就解锁</p>
        <strong>{achievement.title}</strong>
        <span>{achievement.description}</span>
      </div>
      <button
        type="button"
        className="achievement-toast-close"
        onClick={onDismiss}
        aria-label="关闭成就提示"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
