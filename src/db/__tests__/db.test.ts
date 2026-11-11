/// <reference types="jest" />
import { HABIT_IDS } from '@/lib/habits';
import { summarizeRange, toCountMap, currentStreak, sumCents } from '@/lib/stats';
import { buildBackup, buildExpensesCsv, buildHabitsCsv, parseBackupJson, restoreBackup, validateBackup } from '../backup';
import {
  addExpense,
  clearData,
  deleteExpense,
  deleteWeight,
  getDay,
  getDayRecords,
  getDaySpendingCents,
  getExpense,
  getExpenses,
  getFirstTrackedDate,
  getHabitTargets,
  getSetting,
  getWeights,
  resetDay,
  saveWeight,
  setHabitCompleted,
  setHabitTargets,
  setSetting,
  updateExpense,
  WeightExistsError,
} from '../repo';
import { DB_VERSION, migrate } from '../schema';
import { createRawTestDb, createTestDb } from './testDb';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('migrations', () => {
  it('creates schema, seeds 16 habits and sets user_version', async () => {
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v!.user_version).toBe(DB_VERSION);
    const habits = await db.getAllAsync<{ id: string }>('SELECT id FROM habits ORDER BY sort_order');
    expect(habits.map((h) => h.id)).toEqual(HABIT_IDS);
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(['expenses', 'habit_completions', 'habits', 'settings', 'weights']));
  });

  it('is idempotent and preserves data and custom targets on re-run', async () => {
    await setHabitCompleted(db, '2026-11-11', 'steps', true);
    await setHabitTargets(db, 'steps', [12000]);
    await migrate(db);
    await migrate(db);
    expect((await getDay(db, '2026-11-11')).completed).toEqual(['steps']);
    expect((await getHabitTargets(db)).steps).toEqual([12000]);
    expect((await db.getAllAsync('SELECT id FROM habits')).length).toBe(16);
  });

  it('starts from a truly empty database', async () => {
    const raw = createRawTestDb();
    await migrate(raw);
    expect(await getDayRecords(raw)).toEqual([]);
    expect(await getExpenses(raw)).toEqual([]);
    expect(await getWeights(raw)).toEqual([]);
    expect(await getFirstTrackedDate(raw)).toBeNull();
    expect(await getDaySpendingCents(raw, '2026-11-11')).toBe(0);
    expect(await getSetting(raw, 'theme', 'system')).toBe('system');
    raw.close();
  });
});

describe('habit completions', () => {
  it('persists checkbox changes and computes percentage', async () => {
    for (const id of HABIT_IDS.slice(0, 12)) await setHabitCompleted(db, '2026-11-11', id, true);
    const day = await getDay(db, '2026-11-11');
    expect(day.tracked).toBe(true);
    expect(day.completed).toHaveLength(12);
    const s = summarizeRange(await getDayRecords(db), '2026-11-11', '2026-11-11');
    expect(s.averagePercent).toBe(75);
  });

  it('never creates duplicate rows for the same habit and date', async () => {
    await setHabitCompleted(db, '2026-11-11', 'steps', true);
    await setHabitCompleted(db, '2026-11-11', 'steps', false);
    await setHabitCompleted(db, '2026-11-11', 'steps', true);
    const rows = await db.getAllAsync('SELECT * FROM habit_completions WHERE date = ? AND habit_id = ?', ['2026-11-11', 'steps']);
    expect(rows).toHaveLength(1);
    await expect(
      db.runAsync("INSERT INTO habit_completions (date, habit_id, completed, updated_at) VALUES ('2026-11-11', 'steps', 1, 'x')"),
    ).rejects.toThrow(/UNIQUE|PRIMARY/);
  });

  it('distinguishes an unchecked (0%) day from a day with no record', async () => {
    await setHabitCompleted(db, '2026-11-10', 'steps', true);
    await setHabitCompleted(db, '2026-11-10', 'steps', false);
    expect(await getDay(db, '2026-11-10')).toEqual({ tracked: true, completed: [] });
    expect(await getDay(db, '2026-11-09')).toEqual({ tracked: false, completed: [] });
    const s = summarizeRange(await getDayRecords(db), '2026-11-09', '2026-11-10');
    expect(s.daily.map((d) => d.percent)).toEqual([null, 0]);
  });

  it('edits past dates independently and resets only the chosen day', async () => {
    await setHabitCompleted(db, '2026-11-01', 'sleep', true);
    await setHabitCompleted(db, '2026-11-02', 'sleep', true);
    await setHabitCompleted(db, '2026-11-03', 'sleep', true);
    expect(await resetDay(db, '2026-11-02')).toBe(1);
    const records = await getDayRecords(db);
    expect(records.map((r) => r.date)).toEqual(['2026-11-01', '2026-11-03']);
    expect(await getFirstTrackedDate(db)).toBe('2026-11-01');
  });

  it('rejects unknown habits and invalid dates', async () => {
    await expect(setHabitCompleted(db, '2026-11-11', 'nope', true)).rejects.toThrow();
    await expect(setHabitCompleted(db, '2026-02-30', 'steps', true)).rejects.toThrow();
  });

  it('feeds streaks from stored data', async () => {
    for (const date of ['2026-11-09', '2026-11-10']) for (const id of HABIT_IDS.slice(0, 13)) await setHabitCompleted(db, date, id, true);
    await setHabitCompleted(db, '2026-11-11', 'steps', true); // today in progress
    expect(currentStreak(toCountMap(await getDayRecords(db)), '2026-11-11')).toBe(2);
  });

  it('validates habit targets', async () => {
    await expect(setHabitTargets(db, 'water', [3, 2])).rejects.toThrow();
    await setHabitTargets(db, 'water', [2.5, 3]);
    expect((await getHabitTargets(db)).water).toEqual([2.5, 3]);
  });
});

describe('expenses', () => {
  it('adds multiple transactions per day and totals them in cents', async () => {
    await addExpense(db, { date: '2026-11-11', amountCents: 10, category: 'Food', description: 'gum' });
    await addExpense(db, { date: '2026-11-11', amountCents: 20, category: 'Food', description: 'mint' });
    await addExpense(db, { date: '2026-11-10', amountCents: 4599, category: 'Bills', description: '' });
    expect(await getDaySpendingCents(db, '2026-11-11')).toBe(30);
    const all = await getExpenses(db);
    expect(all).toHaveLength(3);
    expect(all[0].date).toBe('2026-11-11'); // newest first
    expect(sumCents(all)).toBe(4629);
  });

  it('edits and deletes transactions', async () => {
    const id = await addExpense(db, { date: '2026-11-11', amountCents: 1000, category: 'Food', description: 'lunch' });
    await updateExpense(db, id, { date: '2026-11-09', amountCents: 1500, category: 'Health', description: ' pharmacy ' });
    const e = await getExpense(db, id);
    expect(e).toMatchObject({ date: '2026-11-09', amountCents: 1500, category: 'Health', description: 'pharmacy' });
    expect(await getDaySpendingCents(db, '2026-11-11')).toBe(0);
    await deleteExpense(db, id);
    expect(await getExpense(db, id)).toBeNull();
    await expect(updateExpense(db, id, { date: '2026-11-09', amountCents: 1, category: 'Food', description: '' })).rejects.toThrow();
  });

  it('rejects invalid transactions', async () => {
    await expect(addExpense(db, { date: '2026-11-11', amountCents: 0, category: 'Food', description: '' })).rejects.toThrow();
    await expect(addExpense(db, { date: '2026-11-11', amountCents: 1.5, category: 'Food', description: '' })).rejects.toThrow();
    await expect(addExpense(db, { date: '2026-11-11', amountCents: 100, category: 'Crypto', description: '' })).rejects.toThrow();
    await expect(addExpense(db, { date: 'bad', amountCents: 100, category: 'Food', description: '' })).rejects.toThrow();
  });

  it('filters by date range', async () => {
    await addExpense(db, { date: '2026-10-31', amountCents: 100, category: 'Food', description: '' });
    await addExpense(db, { date: '2026-11-01', amountCents: 200, category: 'Food', description: '' });
    expect(sumCents(await getExpenses(db, '2026-11-01', '2026-11-30'))).toBe(200);
  });

  it('expense records do not affect habit completion', async () => {
    await addExpense(db, { date: '2026-11-11', amountCents: 100, category: 'Food', description: '' });
    expect(await getDay(db, '2026-11-11')).toEqual({ tracked: false, completed: [] });
  });
});

describe('weights', () => {
  it('records history ordered by date and refuses silent overwrite', async () => {
    await saveWeight(db, '2026-11-11', 78.04);
    await saveWeight(db, '2026-11-01', 80);
    expect((await getWeights(db)).map((w) => [w.date, w.weightKg])).toEqual([
      ['2026-11-01', 80],
      ['2026-11-11', 78],
    ]);
    await expect(saveWeight(db, '2026-11-11', 77)).rejects.toBeInstanceOf(WeightExistsError);
    await saveWeight(db, '2026-11-11', 77, true);
    const ws = await getWeights(db);
    expect(ws).toHaveLength(2);
    expect(ws[1].weightKg).toBe(77);
    await deleteWeight(db, ws[0].id);
    expect(await getWeights(db)).toHaveLength(1);
  });

  it('rejects implausible weights', async () => {
    await expect(saveWeight(db, '2026-11-11', 0)).rejects.toThrow();
    await expect(saveWeight(db, '2026-11-11', 1000)).rejects.toThrow();
  });
});

describe('settings, clearing and backup', () => {
  it('stores JSON settings', async () => {
    await setSetting(db, 'theme', 'dark');
    await setSetting(db, 'theme', 'light');
    expect(await getSetting(db, 'theme', 'system')).toBe('light');
  });

  async function seed() {
    await setHabitCompleted(db, '2026-11-10', 'steps', true);
    await setHabitCompleted(db, '2026-11-10', 'sleep', false);
    await addExpense(db, { date: '2026-11-10', amountCents: 1234, category: 'Food', description: 'Tacos, "al pastor"' });
    await saveWeight(db, '2026-11-10', 80.2);
    await setSetting(db, 'targetWeightKg', 75);
    await setHabitTargets(db, 'steps', [8000]);
  }

  it('clears scoped data only', async () => {
    await seed();
    await clearData(db, 'expenses');
    expect(await getExpenses(db)).toHaveLength(0);
    expect(await getDayRecords(db)).toHaveLength(1);
    expect(await getWeights(db)).toHaveLength(1);
    await clearData(db, 'all');
    expect(await getDayRecords(db)).toHaveLength(0);
    expect(await getWeights(db)).toHaveLength(0);
    expect((await getHabitTargets(db)).steps).toEqual([10000]);
  });

  it('round-trips a JSON backup', async () => {
    await seed();
    const backup = await buildBackup(db);
    const parsed = parseBackupJson(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    await clearData(db, 'all');
    if (!parsed.ok) throw new Error('invalid');
    await restoreBackup(db, parsed.data);
    expect(await getDay(db, '2026-11-10')).toEqual({ tracked: true, completed: ['steps'] });
    expect((await getExpenses(db))[0]).toMatchObject({ amountCents: 1234, description: 'Tacos, "al pastor"' });
    expect((await getWeights(db))[0].weightKg).toBe(80.2);
    expect(await getSetting(db, 'targetWeightKg', null)).toBe(75);
    expect((await getHabitTargets(db)).steps).toEqual([8000]);
  });

  it('rejects invalid backups without touching data', async () => {
    await seed();
    expect(parseBackupJson('not json').ok).toBe(false);
    expect(validateBackup({ format: 'other' }).ok).toBe(false);
    const good = await buildBackup(db);
    const bad = { ...good, expenses: [{ date: '2026-11-10', amountCents: -5, category: 'Food', description: '' }] };
    const r = validateBackup(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/amount/);
    const dup = { ...good, completions: [...good.completions, good.completions[0]] };
    expect(validateBackup(dup).ok).toBe(false);
    expect(await getExpenses(db)).toHaveLength(1);
  });

  it('rolls back a failing restore', async () => {
    await seed();
    const good = await buildBackup(db);
    // Bypass validation to force a constraint failure mid-restore.
    const broken = { ...good, weights: [{ date: '2026-11-01', weightKg: -1 }] };
    await expect(restoreBackup(db, broken)).rejects.toThrow();
    expect(await getExpenses(db)).toHaveLength(1);
    expect(await getWeights(db)).toHaveLength(1);
  });

  it('exports CSV with escaping', async () => {
    await seed();
    const habits = await buildHabitsCsv(db);
    const lines = habits.trim().split('\n');
    expect(lines[0]).toContain('"Walk 8,000 steps"');
    expect(lines[1].startsWith('2026-11-10,1,')).toBe(true);
    expect(lines[1].endsWith(',1,6')).toBe(true);
    const expenses = await buildExpensesCsv(db);
    expect(expenses).toBe('date,amount_usd,category,description\n2026-11-10,12.34,Food,"Tacos, ""al pastor"""\n');
  });
});
