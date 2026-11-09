import type { ActiveMode } from "@fogport/shared";

interface ModeBadgeProps {
  mode: ActiveMode;
  className?: string;
}

export function ModeBadge({ mode, className = "" }: ModeBadgeProps) {
  const isQwen = mode === "qwen";
  return (
    <span
      className={`mode-badge ${isQwen ? "mode-qwen" : "mode-demo"} ${className}`.trim()}
      title={
        isQwen
          ? "剧情由 Qwen 模型生成，服务端会确认每回合的状态变化"
          : "本地演示模式，不调用外部模型"
      }
    >
      <span className="mode-orb" aria-hidden="true" />
      <span className="mode-label">
        <span className="mode-label-full">{isQwen ? "Qwen 叙事" : "本地演示"}</span>
        <span className="mode-label-short">{isQwen ? "Qwen" : "演示"}</span>
      </span>
    </span>
  );
}
