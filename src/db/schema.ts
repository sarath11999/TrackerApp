/**
 * Versioned migrations tracked with `PRAGMA user_version`.
 * Add new migrations to the end of MIGRATIONS; never edit a shipped one.
 */
import { HABITS } from '@/lib/habits';
import type { Db } from './types';

export const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    template TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    targets TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS habit_completions (
    date TEXT NOT NULL,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (date, habit_id)
  );
  CREATE INDEX IF NOT EXISTS idx_completions_habit ON habit_completions (habit_id, date);

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);

  CREATE TABLE IF NOT EXISTS weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    weight_kg REAL NOT NULL CHECK (weight_kg > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const DB_VERSION = MIGRATIONS.length;

/** Insert any missing habit definitions and refresh template/category/order; user targets are preserved. */
export async function seedHabits(db: Db): Promise<void> {
  for (const h of HABITS) {
    await db.runAsync(
      `INSERT INTO habits (id, category, template, sort_order, targets) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET category = excluded.category, template = excluded.template, sort_order = excluded.sort_order`,
      [h.id, h.category, h.template, h.sortOrder, JSON.stringify(h.defaultTargets)],
    );
  }
}

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version === 0) {
    await db.execAsync("PRAGMA journal_mode = 'wal';").catch(() => undefined);
  }
  while (version < DB_VERSION) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  await seedHabits(db);
}
