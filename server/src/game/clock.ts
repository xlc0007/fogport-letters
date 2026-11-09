import type { ClockView } from "@fogport/shared";

export const START_CLOCK_MINUTES = 3 * 60 + 17;
export const NIGHT_LENGTH_MINUTES = 240;
export const DAWN_CLOCK_MINUTES = START_CLOCK_MINUTES + NIGHT_LENGTH_MINUTES;

export function clampClockMinutes(minutes: number): number {
  return Math.min(NIGHT_LENGTH_MINUTES, Math.max(0, Math.round(minutes)));
}

export function advanceClockMinutes(current: number, delta: number): number {
  return clampClockMinutes(current + delta);
}

export function formatClockTime(minutes: number): string {
  const total = START_CLOCK_MINUTES + clampClockMinutes(minutes);
  const hours = Math.floor(total / 60) % 24;
  const mins = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function formatRemaining(minutes: number): string {
  const remaining = clampClockMinutes(minutes);
  if (remaining <= 0) return "黎明已至";
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  if (hours === 0) return `距黎明 ${mins} 分钟`;
  return `距黎明 ${hours}小时${mins ? `${mins}分` : ""}`;
}

export function clockPhase(minutes: number): string {
  const remaining = NIGHT_LENGTH_MINUTES - clampClockMinutes(minutes);
  if (remaining <= 0) return "黎明";
  if (remaining <= 60) return "天将破晓";
  if (remaining <= 120) return "黎明前";
  if (remaining <= 180) return "凌晨";
  return "深夜";
}

export function getClockView(minutes: number): ClockView {
  const elapsed = clampClockMinutes(minutes);
  return {
    elapsedMinutes: elapsed,
    remainingMinutes: NIGHT_LENGTH_MINUTES - elapsed,
    label: formatClockTime(elapsed),
    remainingLabel: formatRemaining(NIGHT_LENGTH_MINUTES - elapsed),
    phase: clockPhase(elapsed),
  };
}
