/**
 * Local calendar-date helpers.
 *
 * All records are keyed by a local `YYYY-MM-DD` string. We never convert through
 * UTC (no `toISOString()`), so a record made at 11:30 pm stays on that day.
 */

export type DateKey = string; // YYYY-MM-DD

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== 'string') return false;
  const m = DATE_KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Parse a date key into a local Date at noon (noon avoids DST edge cases). */
export function parseDateKey(key: DateKey): Date {
  const m = DATE_KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid date key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function addMonths(key: DateKey, months: number): DateKey {
  const d = parseDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = daysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(day, last));
  return toDateKey(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Whole calendar days from a to b (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** Inclusive list of date keys from start to end. */
export function dateRange(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function startOfWeek(key: DateKey, weekStartsOn = 0): DateKey {
  const d = parseDateKey(key);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function endOfMonth(key: DateKey): DateKey {
  const d = parseDateKey(key);
  return `${key.slice(0, 8)}${pad(daysInMonth(d.getFullYear(), d.getMonth()))}`;
}

export function startOfYear(key: DateKey): DateKey {
  return `${key.slice(0, 4)}-01-01`;
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function formatLong(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatMedium(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShort(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMonthYear(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function weekdayInitial(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function relativeLabel(key: DateKey, today: DateKey): string {
  const d = diffDays(key, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d === -1) return 'Tomorrow';
  return formatMedium(key);
}
