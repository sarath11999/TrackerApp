/**
 * App-wide state: the database adapter, a data "version" that bumps after
 * every write (so all screens re-query fresh data), theme preference, profile
 * name, habit targets, and the auto-updating local "today".
 */
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { getHabitTargets, getSetting, setSetting } from '@/db/repo';
import type { BindValue, Db } from '@/db/types';
import { todayKey, type DateKey } from '@/lib/date';
import { dark, light, type Palette } from '@/theme/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Wrap expo-sqlite so params are always passed as an array. */
export function adaptExpoDb(db: SQLiteDatabase): Db {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params: BindValue[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    getFirstAsync: <T,>(sql: string, params: BindValue[] = []) => db.getFirstAsync<T>(sql, params),
    getAllAsync: <T,>(sql: string, params: BindValue[] = []) => db.getAllAsync<T>(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

interface AppValue {
  db: Db;
  version: number;
  bump: () => void;
  today: DateKey;
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;
  colors: Palette;
  name: string;
  setName: (n: string) => void;
  targets: Record<string, number[]>;
}

const Ctx = createContext<AppValue | null>(null);

function useToday(): DateKey {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const refresh = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const timer = setInterval(refresh, 30_000); // catches midnight while open
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => adaptExpoDb(sqlite), [sqlite]);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const today = useToday();
  const system = useColorScheme();
  const [themePreference, setThemePref] = useState<ThemePreference>('system');
  const [name, setNameState] = useState('');
  const [targets, setTargets] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, n, tg] = await Promise.all([getSetting<ThemePreference>(db, 'theme', 'system'), getSetting(db, 'name', ''), getHabitTargets(db)]);
      if (!alive) return;
      setThemePref(t);
      setNameState(n);
      setTargets(tg);
    })();
    return () => {
      alive = false;
    };
  }, [db, version]);

  const setThemePreference = useCallback(
    (p: ThemePreference) => {
      setThemePref(p);
      setSetting(db, 'theme', p).catch(() => undefined);
    },
    [db],
  );
  const setName = useCallback(
    (n: string) => {
      setNameState(n);
      setSetting(db, 'name', n).catch(() => undefined);
    },
    [db],
  );

  const isDark = themePreference === 'system' ? system === 'dark' : themePreference === 'dark';
  const value = useMemo<AppValue>(
    () => ({ db, version, bump, today, themePreference, setThemePreference, colors: isDark ? dark : light, name, setName, targets }),
    [db, version, bump, today, themePreference, setThemePreference, isDark, name, setName, targets],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

export const useColors = () => useApp().colors;
