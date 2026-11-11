/// <reference types="jest" />
import {
  addDays,
  addMonths,
  dateRange,
  diffDays,
  endOfMonth,
  isValidDateKey,
  parseDateKey,
  startOfWeek,
  toDateKey,
} from '../date';
import { HABITS, renderHabitTitle, STREAK_THRESHOLD, TOTAL_HABITS, validateTargets, HABIT_BY_ID, habitsInCategory } from '../habits';
import { centsToInput, formatCents, parseDollarsToCents } from '../money';

describe('date helpers', () => {
  it('formats local dates without UTC shifting', () => {
    // 11:59 pm local must stay on the same calendar day
    expect(toDateKey(new Date(2026, 10, 11, 23, 59, 59))).toBe('2026-11-11');
    expect(toDateKey(new Date(2026, 0, 1, 0, 0, 1))).toBe('2026-01-01');
  });

  it('validates date keys', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-1-01')).toBe(false);
    expect(isValidDateKey(20260101)).toBe(false);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09'); // US DST start
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02'); // US DST end
  });

  it('computes ranges and differences', () => {
    expect(diffDays('2026-11-01', '2026-11-11')).toBe(10);
    expect(diffDays('2026-11-11', '2026-11-01')).toBe(-10);
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(startOfWeek('2026-11-11')).toBe('2026-11-08'); // Wednesday → Sunday
    expect(parseDateKey('2026-11-11').getDay()).toBe(3);
  });
});

describe('habit definitions', () => {
  it('has exactly 16 habits in the required split', () => {
    expect(HABITS).toHaveLength(16);
    expect(TOTAL_HABITS).toBe(16);
    expect(habitsInCategory('fitness')).toHaveLength(4);
    expect(habitsInCategory('nutrition')).toHaveLength(5);
    expect(habitsInCategory('study')).toHaveLength(3);
    expect(habitsInCategory('selfcare')).toHaveLength(4);
    expect(STREAK_THRESHOLD).toBe(13);
  });

  it('renders the exact default titles', () => {
    expect(HABITS.map((h) => renderHabitTitle(h))).toEqual([
      'Walk 10,000 steps',
      '30 minutes jogging',
      '30 minutes strength training',
      '5–10 minutes stretching',
      'Stay within a healthy calorie target',
      'Eat 120 g protein',
      '30 minutes cooking',
      'Drink 2–3 liters of water',
      'Eat vegetables and fruit',
      '10 hours focused study/research',
      'Read or write an academic paper',
      "Set tomorrow's top 3 priorities",
      'Recreational mobile use under 30 minutes',
      'Take prescribed oral minoxidil tablet',
      'Sleep 7–9 hours',
      'No phone 30 minutes before bed',
    ]);
  });

  it('renders and validates custom targets', () => {
    expect(renderHabitTitle(HABIT_BY_ID.steps, [12000])).toBe('Walk 12,000 steps');
    expect(renderHabitTitle(HABIT_BY_ID.water, [2.5, 3.5])).toBe('Drink 2.5–3.5 liters of water');
    expect(validateTargets(HABIT_BY_ID.steps, [12000])).toBeNull();
    expect(validateTargets(HABIT_BY_ID.steps, [10])).not.toBeNull();
    expect(validateTargets(HABIT_BY_ID.sleep, [9, 7])).toBe('Minimum cannot exceed maximum');
    expect(validateTargets(HABIT_BY_ID.protein, [NaN])).not.toBeNull();
  });
});

describe('money helpers', () => {
  it('parses dollars into integer cents without float errors', () => {
    expect(parseDollarsToCents('0.10')).toBe(10);
    expect(parseDollarsToCents('0.2')).toBe(20);
    expect(parseDollarsToCents('19.99')).toBe(1999);
    expect(parseDollarsToCents('$1,234.56')).toBe(123456);
    expect(parseDollarsToCents('12')).toBe(1200);
    expect(parseDollarsToCents('12.')).toBe(1200);
    expect(parseDollarsToCents('.5')).toBe(50);
    expect(parseDollarsToCents('1.005')).toBeNull();
    expect(parseDollarsToCents('-5')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
    expect(parseDollarsToCents('')).toBeNull();
  });

  it('sums cents exactly where floats would drift', () => {
    const cents = ['0.10', '0.20'].map((s) => parseDollarsToCents(s)!);
    expect(cents.reduce((a, b) => a + b, 0)).toBe(30);
    expect(0.1 + 0.2).not.toBe(0.3); // the problem integer cents avoid
  });

  it('formats USD', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(5)).toBe('$0.05');
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(7)).toBe('0.07');
  });
});
