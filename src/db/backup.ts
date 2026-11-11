/** JSON backup/restore and CSV export. Import is fully validated before anything is written. */
import { isValidDateKey } from '@/lib/date';
import { HABIT_BY_ID, HABITS, renderHabitTitle, validateTargets } from '@/lib/habits';
import { centsToInput, isExpenseCategory, MAX_EXPENSE_CENTS } from '@/lib/money';
import { completionPercent } from '@/lib/stats';
import { getAllSettings, getDayRecords, getExpenses, getHabitTargets, getWeights, validateWeight } from './repo';
import type { Db } from './types';

export const BACKUP_FORMAT = 'trackerapp-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  habitTargets: Record<string, number[]>;
  completions: { date: string; habitId: string; completed: boolean }[];
  expenses: { date: string; amountCents: number; category: string; description: string }[];
  weights: { date: string; weightKg: number }[];
  settings: Record<string, unknown>;
}

export async function buildBackup(db: Db): Promise<BackupFile> {
  const [habitTargets, rows, expenses, weights, settings] = await Promise.all([
    getHabitTargets(db),
    db.getAllAsync<{ date: string; habit_id: string; completed: number }>('SELECT date, habit_id, completed FROM habit_completions ORDER BY date, habit_id'),
    getExpenses(db),
    getWeights(db),
    getAllSettings(db),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habitTargets,
    completions: rows.map((r) => ({ date: r.date, habitId: r.habit_id, completed: r.completed === 1 })),
    expenses: expenses
      .slice()
      .reverse()
      .map((e) => ({ date: e.date, amountCents: e.amountCents, category: e.category, description: e.description })),
    weights: weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    settings,
  };
}

export type ValidationResult = { ok: true; data: BackupFile } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate an unknown parsed JSON value as a backup. Collects up to 10 errors. */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => {
    if (errors.length < 10) errors.push(m);
  };
  if (!isObj(raw)) return { ok: false, errors: ['File is not a TrackerApp backup (expected a JSON object).'] };
  if (raw.format !== BACKUP_FORMAT) err('Missing or wrong "format" — this is not a TrackerApp backup.');
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) err('Unsupported backup version.');
  for (const k of ['completions', 'expenses', 'weights'] as const) if (!Array.isArray(raw[k])) err(`"${k}" must be a list.`);
  if (!isObj(raw.habitTargets)) err('"habitTargets" must be an object.');
  if (raw.settings !== undefined && !isObj(raw.settings)) err('"settings" must be an object.');
  if (errors.length) return { ok: false, errors };

  const seenCompletion = new Set<string>();
  (raw.completions as unknown[]).forEach((c, i) => {
    if (!isObj(c)) return err(`completions[${i}] is not an object.`);
    if (!isValidDateKey(c.date)) return err(`completions[${i}] has invalid date.`);
    if (typeof c.habitId !== 'string' || !HABIT_BY_ID[c.habitId]) return err(`completions[${i}] has unknown habit.`);
    if (typeof c.completed !== 'boolean') return err(`completions[${i}] "completed" must be true/false.`);
    const key = `${c.date}|${c.habitId}`;
    if (seenCompletion.has(key)) return err(`Duplicate completion for ${c.habitId} on ${c.date}.`);
    seenCompletion.add(key);
  });

  (raw.expenses as unknown[]).forEach((e, i) => {
    if (!isObj(e)) return err(`expenses[${i}] is not an object.`);
    if (!isValidDateKey(e.date)) return err(`expenses[${i}] has invalid date.`);
    if (typeof e.amountCents !== 'number' || !Number.isInteger(e.amountCents) || e.amountCents <= 0 || e.amountCents > MAX_EXPENSE_CENTS)
      return err(`expenses[${i}] has invalid amount.`);
    if (!isExpenseCategory(e.category)) return err(`expenses[${i}] has unknown category.`);
    if (typeof e.description !== 'string' || e.description.length > 200) return err(`expenses[${i}] has invalid description.`);
  });

  const seenWeight = new Set<string>();
  (raw.weights as unknown[]).forEach((w, i) => {
    if (!isObj(w)) return err(`weights[${i}] is not an object.`);
    if (typeof w.weightKg !== 'number' || validateWeight(String(w.date), w.weightKg)) return err(`weights[${i}] is invalid.`);
    if (seenWeight.has(String(w.date))) return err(`Duplicate weight on ${String(w.date)}.`);
    seenWeight.add(String(w.date));
  });

  for (const [id, targets] of Object.entries(raw.habitTargets as Record<string, unknown>)) {
    const def = HABIT_BY_ID[id];
    if (!def) {
      err(`habitTargets has unknown habit "${id}".`);
      continue;
    }
    if (!Array.isArray(targets) || validateTargets(def, targets as number[])) err(`habitTargets for "${id}" are invalid.`);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      format: BACKUP_FORMAT,
      version: raw.version as number,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      habitTargets: raw.habitTargets as Record<string, number[]>,
      completions: raw.completions as BackupFile['completions'],
      expenses: raw.expenses as BackupFile['expenses'],
      weights: raw.weights as BackupFile['weights'],
      settings: (raw.settings as Record<string, unknown>) ?? {},
    },
  };
}

export function parseBackupJson(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] };
  }
  return validateBackup(raw);
}

/** Replace all user data with a validated backup, atomically. */
export async function restoreBackup(db: Db, data: BackupFile): Promise<void> {
  const ts = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM habit_completions');
    await db.runAsync('DELETE FROM expenses');
    await db.runAsync('DELETE FROM weights');
    await db.runAsync('DELETE FROM settings');
    for (const h of HABITS) {
      const targets = data.habitTargets[h.id] ?? h.defaultTargets;
      await db.runAsync('UPDATE habits SET targets = ? WHERE id = ?', [JSON.stringify(targets), h.id]);
    }
    for (const c of data.completions) {
      await db.runAsync('INSERT INTO habit_completions (date, habit_id, completed, updated_at) VALUES (?, ?, ?, ?)', [
        c.date,
        c.habitId,
        c.completed ? 1 : 0,
        ts,
      ]);
    }
    for (const e of data.expenses) {
      await db.runAsync('INSERT INTO expenses (date, amount_cents, category, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        e.date,
        e.amountCents,
        e.category,
        e.description,
        ts,
        ts,
      ]);
    }
    for (const w of data.weights) {
      await db.runAsync('INSERT INTO weights (date, weight_kg, created_at, updated_at) VALUES (?, ?, ?, ?)', [w.date, w.weightKg, ts, ts]);
    }
    for (const [k, v] of Object.entries(data.settings)) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [k, JSON.stringify(v)]);
    }
  });
}

// ---------- CSV ----------

export function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvLine = (cells: (string | number)[]) => cells.map(csvEscape).join(',');

/** One row per tracked day: date, each habit (1/0), completed count, percentage. */
export async function buildHabitsCsv(db: Db): Promise<string> {
  const [records, targets] = await Promise.all([getDayRecords(db), getHabitTargets(db)]);
  const header = ['date', ...HABITS.map((h) => renderHabitTitle(h, targets[h.id])), 'completed', 'completion_percent'];
  const lines = [csvLine(header)];
  for (const r of records) {
    const set = new Set(r.completed);
    const count = HABITS.filter((h) => set.has(h.id)).length;
    lines.push(csvLine([r.date, ...HABITS.map((h) => (set.has(h.id) ? 1 : 0)), count, Math.round(completionPercent(count))]));
  }
  return lines.join('\n') + '\n';
}

export async function buildExpensesCsv(db: Db): Promise<string> {
  const expenses = (await getExpenses(db)).slice().reverse();
  const lines = [csvLine(['date', 'amount_usd', 'category', 'description'])];
  for (const e of expenses) lines.push(csvLine([e.date, centsToInput(e.amountCents), e.category, e.description]));
  return lines.join('\n') + '\n';
}
