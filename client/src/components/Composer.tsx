import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import type { EndingChoiceView } from "@fogport/shared";
import type { UiError } from "../lib/api";
import { FinalChoices } from "./FinalChoices";
import { Icon } from "./Icons";

interface ComposerProps {
  input: string;
  suggestions: string[];
  mainlineAction: string | null;
  finalChoices: EndingChoiceView[];
  remainingMinutes: number;
  busy: boolean;
  error: UiError | null;
  elapsedSeconds: number;
  estimateMinutes: (action: string) => string;
  onInputChange: (value: string) => void;
  onSubmit: (suggestedAction?: string) => void;
  onRetry: () => void;
  onDismissError: () => void;
}

export function Composer({
  input,
  suggestions,
  mainlineAction,
  finalChoices,
  remainingMinutes,
  busy,
  error,
  elapsedSeconds,
  estimateMinutes,
  onInputChange,
  onSubmit,
  onRetry,
  onDismissError,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = input.trim().length > 0 && !busy;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [input]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit) {
        onSubmit();
      }
    }
  }

  return (
    <div className="composer-zone">
      <FinalChoices
        choices={finalChoices}
        remainingMinutes={remainingMinutes}
        busy={busy}
        estimateMinutes={estimateMinutes}
        onChoose={(action) => onSubmit(action)}
      />

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-mark" aria-hidden="true">
            !
          </span>
          <div className="error-body">
            <p>{error.message}</p>
            {error.retryable && input.trim() && (
              <button type="button" className="inline-retry" onClick={onRetry} disabled={busy}>
                重试刚才行动
              </button>
            )}
          </div>
          <button type="button" className="error-close" onClick={onDismissError} aria-label="关闭错误提示">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="choices" aria-label="建议行动">
          <div className="choices-head">
            <span>雾中的路</span>
            <span>点击即行动</span>
          </div>
          <div className="choice-list">
            {suggestions.map((suggestion) => {
              const isMainline = suggestion === mainlineAction;
              return (
                <button
                  type="button"
                  className={`choice-button ${isMainline ? "is-mainline" : ""}`.trim()}
                  key={suggestion}
                  disabled={busy}
                  onClick={() => onSubmit(suggestion)}
                >
                  {isMainline && <span className="choice-tag">主线</span>}
                  <span className="choice-label">{suggestion}</span>
                  <span className="choice-cost" title="预计耗时受移动、发现线索和当前状态影响">
                    {estimateMinutes(suggestion)}
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <form className="composer-form" onSubmit={handleSubmit}>
        <div className="textarea-wrap">
          <textarea
            ref={textareaRef}
            className="action-input"
            value={input}
            maxLength={500}
            rows={2}
            placeholder="在雾港，你打算做什么？例如：把信举到灯下，看看背面有没有被海水泡开的字…"
            aria-label="输入你的行动"
            aria-describedby="action-hint action-count"
            disabled={busy}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="char-count" id="action-count">
            {input.length}/500
          </span>
        </div>
        <div className="composer-bar">
          <span className="keyboard-hint" id="action-hint">
            {busy
              ? `已等待 ${elapsedSeconds} 秒 · 请勿重复提交`
              : "自由输入默认约 10 分钟 · 移动或发现线索会额外耗时"}
          </span>
          <button type="submit" className="send-button" disabled={!canSubmit}>
            {busy ? (
              <>
                <span className="spinner spinner-dark" aria-hidden="true" />
                正在穿过雾 · {elapsedSeconds}s
              </>
            ) : (
              <>
                <Icon name="quill" size={17} />
                寄出这一步
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
