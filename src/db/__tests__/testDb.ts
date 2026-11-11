/** Adapts better-sqlite3 (Node) to the app's Db interface so repo SQL is tested for real. */
import Database from 'better-sqlite3';
import { migrate } from '../schema';
import type { BindValue, Db } from '../types';

export function createRawTestDb(): Db & { close(): void } {
  const sqlite = new Database(':memory:');
  let inTx = false;
  const db: Db & { close(): void } = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params: BindValue[] = []) {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, params: BindValue[] = []) {
      const stmt = sqlite.prepare(sql);
      return ((stmt.reader ? stmt.get(...params) : (stmt.run(...params), undefined)) ?? null) as T | null;
    },
    async getAllAsync<T>(sql: string, params: BindValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async withTransactionAsync(task) {
      if (inTx) throw new Error('nested transaction');
      inTx = true;
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      } finally {
        inTx = false;
      }
    },
    close: () => sqlite.close(),
  };
  return db;
}

export async function createTestDb() {
  const db = createRawTestDb();
  await migrate(db);
  return db;
}
