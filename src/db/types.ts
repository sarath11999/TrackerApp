/**
 * Minimal async database interface. The app adapts expo-sqlite to it and the
 * unit tests adapt better-sqlite3, so the same SQL runs in both places.
 */
export type BindValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: BindValue[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, params?: BindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: BindValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
