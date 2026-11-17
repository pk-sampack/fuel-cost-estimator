export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

export function todayInPakistan(date: Date = new Date()): string {
  return new Date(date.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function isOlderThan(checkedAt: unknown, thresholdDays: number, now: Date = new Date()): boolean {
  const checked = new Date(String(checkedAt)).getTime();
  if (!Number.isFinite(checked)) return true;
  return now.getTime() - checked > thresholdDays * 24 * 60 * 60 * 1000;
}
