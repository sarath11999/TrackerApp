/// <reference types="jest" />
import { HABIT_IDS } from '../habits';
import {
  averageCompletion,
  completionPercent,
  currentStreak,
  dailyAverageCents,
  highestSpendingDay,
  longestStreak,
  monthlyTotals,
  statusForPercent,
  summarizeRange,
  sumCents,
  toCountMap,
  totalsByCategory,
  weeklyAverages,
  weightChangeOver,
  weightProgress,
  type DayRecord,
} from '../stats';

const done = (n: number) => HABIT_IDS.slice(0, n);
const rec = (date: string, n: number): DayRecord => ({ date, completed: done(n) });

describe('completion percentage', () => {
  it('uses completed / 16 × 100', () => {
    expect(completionPercent(0)).toBe(0);
    expect(completionPercent(12)).toBe(75);
    expect(completionPercent(13)).toBe(81.25);
    expect(completionPercent(16)).toBe(100);
  });

  it('maps percentages to calendar colors', () => {
    expect(statusForPercent(null)).toBe('none');
    expect(statusForPercent(100)).toBe('green');
    expect(statusForPercent(80)).toBe('green');
    expect(statusForPercent(79.9)).toBe('yellow');
    expect(statusForPercent(50)).toBe('yellow');
    expect(statusForPercent(49)).toBe('red');
    expect(statusForPercent(0)).toBe('red'); // tracked but nothing done ≠ no record
  });
});

describe('streaks', () => {
  const today = '2026-11-11';

  it('is zero for an empty database', () => {
    expect(currentStreak(new Map(), today)).toBe(0);
    expect(longestStreak(new Map())).toBe(0);
  });

  it('counts consecutive days with ≥13 habits', () => {
    const m = toCountMap([rec('2026-11-09', 13), rec('2026-11-10', 16), rec('2026-11-11', 14)]);
    expect(currentStreak(m, today)).toBe(3);
  });

  it('does not penalize an unfinished today', () => {
    const m = toCountMap([rec('2026-11-09', 13), rec('2026-11-10', 13), rec('2026-11-11', 4)]);
    expect(currentStreak(m, today)).toBe(2);
    const noToday = toCountMap([rec('2026-11-09', 13), rec('2026-11-10', 13)]);
    expect(currentStreak(noToday, today)).toBe(2);
  });

  it('breaks on a missing day or a day under 13', () => {
    const gap = toCountMap([rec('2026-11-08', 16), rec('2026-11-10', 16)]);
    expect(currentStreak(gap, today)).toBe(1);
    const low = toCountMap([rec('2026-11-09', 16), rec('2026-11-10', 12)]);
    expect(currentStreak(low, today)).toBe(0);
  });

  it('finds the longest run across month boundaries', () => {
    const m = toCountMap([
      rec('2026-10-30', 13),
      rec('2026-10-31', 13),
      rec('2026-11-01', 13),
      rec('2026-11-02', 13),
      rec('2026-11-04', 16),
      rec('2026-11-05', 16),
    ]);
    expect(longestStreak(m)).toBe(4);
  });

  it('ignores duplicated habit ids in a record', () => {
    const m = toCountMap([{ date: today, completed: ['steps', 'steps', 'steps'] }]);
    expect(m.get(today)).toBe(1);
  });
});

describe('range summary', () => {
  it('handles no data', () => {
    const s = summarizeRange([], '2026-11-05', '2026-11-11');
    expect(s.trackedDays).toBe(0);
    expect(s.averagePercent).toBeNull();
    expect(s.mostConsistent).toBeNull();
    expect(s.daily).toHaveLength(7);
    expect(s.daily.every((d) => d.percent === null)).toBe(true);
  });

  it('averages only tracked days and keeps missing days as null', () => {
    const records = [rec('2026-11-09', 16), rec('2026-11-11', 8), rec('2026-10-01', 16)];
    const s = summarizeRange(records, '2026-11-09', '2026-11-11');
    expect(s.trackedDays).toBe(2);
    expect(s.averagePercent).toBe(75);
    expect(s.perfectDays).toBe(1);
    expect(s.daily.map((d) => d.percent)).toEqual([100, null, 50]);
  });

  it('computes per-habit and category rates', () => {
    const records = [
      { date: '2026-11-10', completed: ['steps', 'jogging', 'protein'] },
      { date: '2026-11-11', completed: ['steps'] },
    ];
    const s = summarizeRange(records, '2026-11-10', '2026-11-11');
    const steps = s.habitRates.find((r) => r.habitId === 'steps')!;
    expect(steps.rate).toBe(100);
    expect(s.habitRates.find((r) => r.habitId === 'jogging')!.rate).toBe(50);
    expect(s.mostConsistent!.habitId).toBe('steps');
    expect(s.leastConsistent!.rate).toBe(0);
    const fitness = s.categoryRates.find((c) => c.category === 'fitness')!;
    expect(fitness.completed).toBe(3);
    expect(fitness.possible).toBe(8);
    expect(fitness.rate).toBe(37.5);
    expect(s.categoryRates.find((c) => c.category === 'nutrition')!.rate).toBe(10);
  });

  it('averageCompletion respects the range', () => {
    const m = toCountMap([rec('2026-11-01', 16), rec('2026-11-10', 8)]);
    expect(averageCompletion(m, '2026-11-05', '2026-11-11')).toBe(50);
    expect(averageCompletion(m, '2026-12-01', '2026-12-31')).toBeNull();
  });

  it('groups weekly averages', () => {
    const w = weeklyAverages([
      { date: '2026-11-07', percent: 50 }, // Sat
      { date: '2026-11-08', percent: 100 }, // Sun (new week)
      { date: '2026-11-09', percent: null },
      { date: '2026-11-10', percent: 50 },
    ]);
    expect(w).toEqual([
      { weekStart: '2026-11-01', percent: 50 },
      { weekStart: '2026-11-08', percent: 75 },
    ]);
  });
});

describe('expense statistics', () => {
  const ex = [
    { date: '2026-11-11', amountCents: 1250, category: 'Food' },
    { date: '2026-11-11', amountCents: 999, category: 'Groceries' },
    { date: '2026-11-10', amountCents: 5000, category: 'Bills' },
    { date: '2026-10-15', amountCents: 10, category: 'Food' },
    { date: '2025-12-31', amountCents: 20, category: 'Food' },
  ];

  it('sums by range', () => {
    expect(sumCents(ex, '2026-11-11', '2026-11-11')).toBe(2249);
    expect(sumCents(ex, '2026-11-01', '2026-11-30')).toBe(7249);
    expect(sumCents(ex, '2026-01-01', '2026-12-31')).toBe(7259);
    expect(sumCents(ex)).toBe(7279);
    expect(sumCents([])).toBe(0);
  });

  it('groups by category and day', () => {
    expect(totalsByCategory(ex)[0]).toEqual({ category: 'Bills', cents: 5000 });
    expect(totalsByCategory(ex).find((c) => c.category === 'Food')!.cents).toBe(1280);
    expect(highestSpendingDay(ex)).toEqual({ date: '2026-11-10', cents: 5000 });
    expect(highestSpendingDay([])).toBeNull();
  });

  it('computes daily average over calendar days', () => {
    expect(dailyAverageCents(ex, '2026-11-10', '2026-11-11')).toBe(3625);
    expect(dailyAverageCents(ex, '2026-11-01', '2026-11-10')).toBe(500);
  });

  it('builds monthly totals including empty months', () => {
    const m = monthlyTotals(ex, '2026-11', 3);
    expect(m).toEqual([
      { month: '2026-09', cents: 0 },
      { month: '2026-10', cents: 10 },
      { month: '2026-11', cents: 7249 },
    ]);
    expect(monthlyTotals(ex, '2026-01', 2)[0]).toEqual({ month: '2025-12', cents: 20 });
  });
});

describe('weight statistics', () => {
  it('handles no entries', () => {
    const p = weightProgress([], 70);
    expect(p.current).toBeNull();
    expect(p.progressPercent).toBeNull();
  });

  it('computes progress toward the target', () => {
    const entries = [
      { date: '2026-11-01', weightKg: 80 },
      { date: '2026-11-11', weightKg: 77.5 },
      { date: '2026-11-05', weightKg: 79 },
    ];
    const p = weightProgress(entries, 70);
    expect(p.start!.weightKg).toBe(80);
    expect(p.current!.weightKg).toBe(77.5);
    expect(p.changeKg).toBe(-2.5);
    expect(p.remainingKg).toBe(7.5);
    expect(p.progressPercent).toBe(25);
    expect(weightProgress(entries, null).progressPercent).toBeNull();
  });

  it('computes change over a period', () => {
    const entries = [
      { date: '2026-11-01', weightKg: 80 },
      { date: '2026-11-04', weightKg: 79.4 },
      { date: '2026-11-11', weightKg: 78.9 },
    ];
    expect(weightChangeOver(entries, 7, '2026-11-11')).toBe(-0.5);
    expect(weightChangeOver(entries, 30, '2026-11-11')).toBeNull();
  });
});
