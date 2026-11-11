/**
 * Pure statistics over stored records. Everything here is deterministic and
 * unit-tested; screens feed it rows loaded from SQLite.
 *
 * Conventions
 * - A day is "tracked" if at least one habit row exists for it (checked or
 *   unchecked). Untracked days are "no record" (gray) and are excluded from
 *   averages instead of counting as 0%.
 * - Completion % = completed / 16 × 100 (spending never contributes).
 * - A streak day has ≥ 13 of 16 habits (80%). Today never breaks a streak
 *   while it is still in progress.
 */
import { addDays, dateRange, diffDays, type DateKey, startOfWeek } from './date';
import { CATEGORIES, HABITS, STREAK_THRESHOLD, TOTAL_HABITS, type CategoryId } from './habits';

export interface DayRecord {
  date: DateKey;
  completed: string[]; // habit ids completed that day
}

export type DayStatus = 'none' | 'green' | 'yellow' | 'red';

export function completionPercent(completedCount: number): number {
  return (completedCount / TOTAL_HABITS) * 100;
}

export function roundPercent(p: number): number {
  return Math.round(p);
}

export function statusForPercent(percent: number | null | undefined): DayStatus {
  if (percent === null || percent === undefined) return 'none';
  if (percent >= 80) return 'green';
  if (percent >= 50) return 'yellow';
  return 'red';
}

export function qualifiesForStreak(completedCount: number): boolean {
  return completedCount >= STREAK_THRESHOLD;
}

export type CountMap = Map<DateKey, number>;

export function toCountMap(records: DayRecord[]): CountMap {
  const map: CountMap = new Map();
  for (const r of records) map.set(r.date, new Set(r.completed).size);
  return map;
}

/** Consecutive qualifying days ending today (or yesterday if today isn't done yet). */
export function currentStreak(counts: CountMap, today: DateKey): number {
  let day = today;
  if (!qualifiesForStreak(counts.get(today) ?? 0)) day = addDays(today, -1);
  let streak = 0;
  while (qualifiesForStreak(counts.get(day) ?? 0)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(counts: CountMap): number {
  const days = [...counts.entries()].filter(([, c]) => qualifiesForStreak(c)).map(([d]) => d).sort();
  let best = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of days) {
    run = prev !== null && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Average completion % across tracked days in [start, end]; null if none tracked. */
export function averageCompletion(counts: CountMap, start: DateKey, end: DateKey): number | null {
  let sum = 0;
  let n = 0;
  for (const [d, c] of counts) {
    if (d >= start && d <= end) {
      sum += completionPercent(c);
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

export interface HabitRate {
  habitId: string;
  completedDays: number;
  rate: number; // 0..100 over tracked days
}

export interface CategoryRate {
  category: CategoryId;
  completed: number;
  possible: number;
  rate: number; // 0..100
}

export interface RangeSummary {
  start: DateKey;
  end: DateKey;
  trackedDays: number;
  averagePercent: number | null;
  perfectDays: number;
  habitRates: HabitRate[];
  categoryRates: CategoryRate[];
  mostConsistent: HabitRate | null;
  leastConsistent: HabitRate | null;
  daily: { date: DateKey; percent: number | null }[];
}

export function summarizeRange(records: DayRecord[], start: DateKey, end: DateKey): RangeSummary {
  const inRange = records.filter((r) => r.date >= start && r.date <= end);
  const byDate = new Map(inRange.map((r) => [r.date, new Set(r.completed)]));
  const trackedDays = byDate.size;

  const habitCounts = new Map<string, number>(HABITS.map((h) => [h.id, 0]));
  let perfectDays = 0;
  let percentSum = 0;
  for (const set of byDate.values()) {
    let count = 0;
    for (const id of set) {
      if (habitCounts.has(id)) {
        habitCounts.set(id, habitCounts.get(id)! + 1);
        count++;
      }
    }
    if (count === TOTAL_HABITS) perfectDays++;
    percentSum += completionPercent(count);
  }

  const habitRates: HabitRate[] = HABITS.map((h) => {
    const completedDays = habitCounts.get(h.id) ?? 0;
    return { habitId: h.id, completedDays, rate: trackedDays ? (completedDays / trackedDays) * 100 : 0 };
  });

  const categoryRates: CategoryRate[] = CATEGORIES.map((c) => {
    const ids = HABITS.filter((h) => h.category === c.id).map((h) => h.id);
    const completed = ids.reduce((s, id) => s + (habitCounts.get(id) ?? 0), 0);
    const possible = ids.length * trackedDays;
    return { category: c.id, completed, possible, rate: possible ? (completed / possible) * 100 : 0 };
  });

  let mostConsistent: HabitRate | null = null;
  let leastConsistent: HabitRate | null = null;
  if (trackedDays > 0) {
    // Ties resolve to the habit listed first.
    for (const r of habitRates) {
      if (!mostConsistent || r.rate > mostConsistent.rate) mostConsistent = r;
      if (!leastConsistent || r.rate < leastConsistent.rate) leastConsistent = r;
    }
  }

  const daily = dateRange(start, end).map((date) => {
    const set = byDate.get(date);
    return { date, percent: set ? completionPercent([...set].filter((id) => habitCounts.has(id)).length) : null };
  });

  return {
    start,
    end,
    trackedDays,
    averagePercent: trackedDays ? percentSum / trackedDays : null,
    perfectDays,
    habitRates,
    categoryRates,
    mostConsistent,
    leastConsistent,
    daily,
  };
}

/** Group a daily series into weeks (Sunday start); each value is the mean of tracked days. */
export function weeklyAverages(daily: { date: DateKey; percent: number | null }[]): { weekStart: DateKey; percent: number | null }[] {
  const groups = new Map<DateKey, number[]>();
  const order: DateKey[] = [];
  for (const d of daily) {
    const w = startOfWeek(d.date);
    if (!groups.has(w)) {
      groups.set(w, []);
      order.push(w);
    }
    if (d.percent !== null) groups.get(w)!.push(d.percent);
  }
  return order.map((w) => {
    const vals = groups.get(w)!;
    return { weekStart: w, percent: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
}

// ---------- Expenses ----------

export interface ExpenseLike {
  date: DateKey;
  amountCents: number;
  category: string;
}

export function sumCents(expenses: ExpenseLike[], start?: DateKey, end?: DateKey): number {
  let total = 0;
  for (const e of expenses) {
    if ((start === undefined || e.date >= start) && (end === undefined || e.date <= end)) total += e.amountCents;
  }
  return total;
}

export function totalsByCategory(expenses: ExpenseLike[]): { category: string; cents: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents);
  return [...map.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
}

export function totalsByDay(expenses: ExpenseLike[]): Map<DateKey, number> {
  const map = new Map<DateKey, number>();
  for (const e of expenses) map.set(e.date, (map.get(e.date) ?? 0) + e.amountCents);
  return map;
}

export function highestSpendingDay(expenses: ExpenseLike[]): { date: DateKey; cents: number } | null {
  let best: { date: DateKey; cents: number } | null = null;
  for (const [date, cents] of totalsByDay(expenses)) {
    if (!best || cents > best.cents || (cents === best.cents && date > best.date)) best = { date, cents };
  }
  return best;
}

/** Average spend per calendar day over [start, end] inclusive, in cents (rounded). */
export function dailyAverageCents(expenses: ExpenseLike[], start: DateKey, end: DateKey): number {
  const days = diffDays(start, end) + 1;
  if (days <= 0) return 0;
  return Math.round(sumCents(expenses, start, end) / days);
}

/** Totals for each of the last `count` months ending at `endMonth` (YYYY-MM). */
export function monthlyTotals(expenses: ExpenseLike[], endMonth: string, count: number): { month: string; cents: number }[] {
  const [y, m] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const map = new Map(months.map((k) => [k, 0]));
  for (const e of expenses) {
    const k = e.date.slice(0, 7);
    if (map.has(k)) map.set(k, map.get(k)! + e.amountCents);
  }
  return months.map((month) => ({ month, cents: map.get(month)! }));
}

// ---------- Weight ----------

export interface WeightLike {
  date: DateKey;
  weightKg: number;
}

export interface WeightProgress {
  start: WeightLike | null;
  current: WeightLike | null;
  changeKg: number | null; // current - start
  targetKg: number | null;
  remainingKg: number | null; // current - target (positive = still to lose)
  progressPercent: number | null; // 0..100 toward target from start
}

export function weightProgress(entries: WeightLike[], targetKg: number | null): WeightProgress {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const start = sorted[0] ?? null;
  const current = sorted[sorted.length - 1] ?? null;
  const changeKg = start && current ? round1(current.weightKg - start.weightKg) : null;
  const remainingKg = current && targetKg !== null ? round1(current.weightKg - targetKg) : null;
  let progressPercent: number | null = null;
  if (start && current && targetKg !== null) {
    const total = start.weightKg - targetKg;
    if (total === 0) progressPercent = current.weightKg === targetKg ? 100 : 0;
    else progressPercent = Math.max(0, Math.min(100, ((start.weightKg - current.weightKg) / total) * 100));
  }
  return { start, current, changeKg, targetKg, remainingKg, progressPercent };
}

/** Change between the latest entry and the latest entry at or before `days` ago. */
export function weightChangeOver(entries: WeightLike[], days: number, today: DateKey): number | null {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const cutoff = addDays(today, -days);
  const base = [...sorted].reverse().find((e) => e.date <= cutoff);
  if (!base) return null;
  return round1(latest.weightKg - base.weightKg);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
