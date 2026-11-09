import { useState } from "react";
import type { QuestView } from "@fogport/shared";
import { Icon } from "./Icons";

interface QuestPanelProps {
  quest: QuestView;
  compact?: boolean;
  bare?: boolean;
}

export function QuestPanel({ quest, compact = false, bare = false }: QuestPanelProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  function toggleHint() {
    setHintOpen((open) => {
      if (open) setDetailOpen(false);
      return !open;
    });
  }

  return (
    <section
      className={`quest-panel ${compact ? "quest-compact" : ""} ${
        bare ? "quest-bare" : ""
      } ${quest.completed ? "quest-completed" : ""}`.trim()}
      aria-label="主线任务"
    >
      {!bare && <div className="quest-head">
        <span className="quest-eyebrow">MAIN THREAD · 主线</span>
        <div className="quest-head-right">
          <span className="quest-progress">{quest.progress}</span>
          {compact && (
            <button
              type="button"
              className="quest-hint-inline"
              onClick={toggleHint}
              aria-expanded={hintOpen}
              aria-label={hintOpen ? "收起提示" : "给我一点提示"}
            >
              <Icon name="spark" size={12} />
              提示
            </button>
          )}
        </div>
      </div>}
      <p className="quest-mainline" title={quest.mainQuest}>
        {quest.mainQuest}
      </p>
      <div className="quest-row">
        <span>当前目标</span>
        <p title={quest.objective}>{quest.objective}</p>
      </div>
      <div className="quest-row quest-next">
        <span>下一步</span>
        <p title={quest.nextStep}>{quest.nextStep}</p>
      </div>
      {!quest.completed && (
        <div className="quest-chapter">
          <span>{quest.chapterTitle}</span>
          <p>{quest.chapterPressure}</p>
        </div>
      )}
      {!compact && (
        <div className="quest-foot">
          <button
            type="button"
            className="quest-hint-toggle"
            onClick={toggleHint}
            aria-expanded={hintOpen}
          >
            <Icon name="spark" size={13} />
            {hintOpen ? "收起提示" : "给我一点提示"}
          </button>
        </div>
      )}
      {hintOpen && (
        <div className="quest-hint-box">
          <p className="quest-hint">{quest.hint}</p>
          {detailOpen ? (
            <p className="quest-hint-detail">{quest.hintDetail}</p>
          ) : (
            <button
              type="button"
              className="quest-hint-more"
              onClick={() => setDetailOpen(true)}
            >
              再具体一点
            </button>
          )}
          <p className="quest-hint-note">提示不消耗游戏时间</p>
        </div>
      )}
    </section>
  );
}
