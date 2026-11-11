/** All reads and writes of user data. Every function takes the Db explicitly. */
import { isValidDateKey, type DateKey } from '@/lib/date';
import { HABIT_BY_ID, HABIT_IDS, validateTargets } from '@/lib/habits';
import { isExpenseCategory, MAX_EXPENSE_CENTS, type ExpenseCategory } from '@/lib/money';
import type { DayRecord } from '@/lib/stats';
import type { Db } from './types';

const nowIso = () => new Date().toISOString();

function assertDate(date: string): void {
  if (!isValidDateKey(date)) throw new Error(`Invalid date: ${date}`);
}

// ---------- Habits ----------

export async function getHabitTargets(db: Db): Promise<Record<string, number[]>> {
  const rows = await db.getAllAsync<{ id: string; targets: string }>('SELECT id, targets FROM habits');
  const out: Record<string, number[]> = {};
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.targets);
      out[r.id] = Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      out[r.id] = [];
    }
  }
  return out;
}

export async function setHabitTargets(db: Db, habitId: string, targets: number[]): Promise<void> {
  const def = HABIT_BY_ID[habitId];
  if (!def) throw new Error(`Unknown habit: ${habitId}`);
  const err = validateTargets(def, targets);
  if (err) throw new Error(err);
  await db.runAsync('UPDATE habits SET targets = ? WHERE id = ?', [JSON.stringify(targets), habitId]);
}

// ---------- Completions ----------

/** Completed habit ids for a date, and whether the day has any record. */
export async function getDay(db: Db, date: DateKey): Promise<{ tracked: boolean; completed: string[] }> {
  assertDate(date);
  const rows = await db.getAllAsync<{ habit_id: string; completed: number }>(
    'SELECT habit_id, completed FROM habit_completions WHERE date = ?',
    [date],
  );
  return { tracked: rows.length > 0, completed: rows.filter((r) => r.completed === 1).map((r) => r.habit_id) };
}

/** Upsert a single habit's status for a date. One row per (date, habit) is enforced by the primary key. */
export async function setHabitCompleted(db: Db, date: DateKey, habitId: string, completed: boolean): Promise<void> {
  assertDate(date);
  if (!HABIT_BY_ID[habitId]) throw new Error(`Unknown habit: ${habitId}`);
  await db.runAsync(
    `INSERT INTO habit_completions (date, habit_id, completed, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(date, habit_id) DO UPDATE SET completed = excluded.completed, updated_at = excluded.updated_at`,
    [date, habitId, completed ? 1 : 0, nowIso()],
  );
}

/** Delete a single day's habit record. Other days are untouched. */
export async function resetDay(db: Db, date: DateKey): Promise<number> {
  assertDate(date);
  const r = await db.runAsync('DELETE FROM habit_completions WHERE date = ?', [date]);
  return r.changes;
}

/** All tracked days (optionally within a range) with their completed habits. */
export async function getDayRecords(db: Db, start?: DateKey, end?: DateKey): Promise<DayRecord[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (start) {
    where.push('date >= ?');
    params.push(start);
  }
  if (end) {
    where.push('date <= ?');
    params.push(end);
  }
  const rows = await db.getAllAsync<{ date: string; habit_id: string; completed: number }>(
    `SELECT date, habit_id, completed FROM habit_completions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date`,
    params,
  );
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, []);
    if (r.completed === 1) map.get(r.date)!.push(r.habit_id);
  }
  return [...map.entries()].map(([date, completed]) => ({ date, completed }));
}

export async function getFirstTrackedDate(db: Db): Promise<DateKey | null> {
  const r = await db.getFirstAsync<{ d: string | null }>('SELECT MIN(date) AS d FROM habit_completions');
  return r?.d ?? null;
}

// ---------- Expenses ----------

export interface Expense {
  id: number;
  date: DateKey;
  amountCents: number;
  category: ExpenseCategory;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  date: DateKey;
  amountCents: number;
  category: string;
  description: string;
}

interface ExpenseRow {
  id: number;
  date: string;
  amount_cents: number;
  category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const mapExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  date: r.date,
  amountCents: r.amount_cents,
  category: (isExpenseCategory(r.category) ? r.category : 'Other') as ExpenseCategory,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function validateExpense(input: ExpenseInput): string | null {
  if (!isValidDateKey(input.date)) return 'Choose a valid date';
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'Enter an amount greater than $0.00';
  if (input.amountCents > MAX_EXPENSE_CENTS) return 'Amount is too large';
  if (!isExpenseCategory(input.category)) return 'Choose a category';
  if (input.description.length > 200) return 'Description must be 200 characters or fewer';
  return null;
}

export async function addExpense(db: Db, input: ExpenseInput): Promise<number> {
  const err = validateExpense(input);
  if (err) throw new Error(err);
  const ts = nowIso();
  const r = await db.runAsync(
    'INSERT INTO expenses (date, amount_cents, category, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [input.date, input.amountCents, input.category, input.description.trim(), ts, ts],
  );
  return r.lastInsertRowId;
}

export async function updateExpense(db: Db, id: number, input: ExpenseInput): Promise<void> {
  const err = validateExpense(input);
  if (err) throw new Error(err);
  const r = await db.runAsync(
    'UPDATE expenses SET date = ?, amount_cents = ?, category = ?, description = ?, updated_at = ? WHERE id = ?',
    [input.date, input.amountCents, input.category, input.description.trim(), nowIso(), id],
  );
  if (r.changes === 0) throw new Error('Transaction no longer exists');
}

export async function deleteExpense(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function getExpense(db: Db, id: number): Promise<Expense | null> {
  const r = await db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
  return r ? mapExpense(r) : null;
}

export async function getExpenses(db: Db, start?: DateKey, end?: DateKey): Promise<Expense[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (start) {
    where.push('date >= ?');
    params.push(start);
  }
  if (end) {
    where.push('date <= ?');
    params.push(end);
  }
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, id DESC`,
    params,
  );
  return rows.map(mapExpense);
}

export async function getDaySpendingCents(db: Db, date: DateKey): Promise<number> {
  const r = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(amount_cents) AS total FROM expenses WHERE date = ?', [date]);
  return r?.total ?? 0;
}

// ---------- Weight ----------

export interface WeightEntry {
  id: number;
  date: DateKey;
  weightKg: number;
}

export function validateWeight(date: string, weightKg: number): string | null {
  if (!isValidDateKey(date)) return 'Choose a valid date';
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) return 'Enter a weight between 20 and 400 kg';
  return null;
}

export async function getWeights(db: Db): Promise<WeightEntry[]> {
  const rows = await db.getAllAsync<{ id: number; date: string; weight_kg: number }>('SELECT id, date, weight_kg FROM weights ORDER BY date');
  return rows.map((r) => ({ id: r.id, date: r.date, weightKg: r.weight_kg }));
}

export async function getWeightOn(db: Db, date: DateKey): Promise<WeightEntry | null> {
  const r = await db.getFirstAsync<{ id: number; date: string; weight_kg: number }>('SELECT id, date, weight_kg FROM weights WHERE date = ?', [date]);
  return r ? { id: r.id, date: r.date, weightKg: r.weight_kg } : null;
}

/**
 * Insert a weight. If an entry exists for the date, it is only replaced when
 * `replace` is true — otherwise an error is thrown so nothing is overwritten silently.
 */
export async function saveWeight(db: Db, date: DateKey, weightKg: number, replace = false): Promise<void> {
  const err = validateWeight(date, weightKg);
  if (err) throw new Error(err);
  const value = Math.round(weightKg * 10) / 10;
  const existing = await getWeightOn(db, date);
  const ts = nowIso();
  if (existing) {
    if (!replace) throw new WeightExistsError(existing);
    await db.runAsync('UPDATE weights SET weight_kg = ?, updated_at = ? WHERE id = ?', [value, ts, existing.id]);
  } else {
    await db.runAsync('INSERT INTO weights (date, weight_kg, created_at, updated_at) VALUES (?, ?, ?, ?)', [date, value, ts, ts]);
  }
}

export class WeightExistsError extends Error {
  constructor(public existing: WeightEntry) {
    super(`A weight is already recorded for ${existing.date}`);
    this.name = 'WeightExistsError';
  }
}

export async function deleteWeight(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM weights WHERE id = ?', [id]);
}

// ---------- Settings ----------

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  if (!r) return fallback;
  try {
    return JSON.parse(r.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

export async function getAllSettings(db: Db): Promise<Record<string, unknown>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      /* skip corrupt value */
    }
  }
  return out;
}

// ---------- Clearing ----------

export type ClearScope = 'habits' | 'expenses' | 'weights' | 'all';

export async function clearData(db: Db, scope: ClearScope): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (scope === 'habits' || scope === 'all') await db.runAsync('DELETE FROM habit_completions');
    if (scope === 'expenses' || scope === 'all') await db.runAsync('DELETE FROM expenses');
    if (scope === 'weights' || scope === 'all') await db.runAsync('DELETE FROM weights');
    if (scope === 'all') {
      await db.runAsync('DELETE FROM settings');
      for (const id of HABIT_IDS) {
        await db.runAsync('UPDATE habits SET targets = ? WHERE id = ?', [JSON.stringify(HABIT_BY_ID[id].defaultTargets), id]);
      }
    }
  });
}
