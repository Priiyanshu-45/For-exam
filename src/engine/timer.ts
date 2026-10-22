export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function remainingMs(deadlineAt: number, now = Date.now()): number {
  return Math.max(0, deadlineAt - now);
}

export function createDeadline(durationMinutes: number, startedAt = Date.now()): number {
  return startedAt + durationMinutes * 60 * 1000;
}

export function timerUrgency(remaining: number): "normal" | "warn" | "final" {
  if (remaining <= 60_000) return "final";
  if (remaining <= 5 * 60_000) return "warn";
  return "normal";
}
