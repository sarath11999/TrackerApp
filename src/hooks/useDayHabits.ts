import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getDay, setHabitCompleted } from '@/db/repo';
import type { DateKey } from '@/lib/date';
import { useApp } from '@/state/AppContext';

interface DayState {
  date: DateKey;
  completed: Set<string>;
  tracked: boolean;
}

const EMPTY = new Set<string>();

/**
 * Habit state for one date with optimistic toggles. Each toggle is written to
 * SQLite immediately; the global version bump then refreshes every screen.
 * While writes are in flight, refetches are skipped so rapid taps never flicker.
 */
export function useDayHabits(date: DateKey) {
  const { db, bump, version } = useApp();
  const [state, setState] = useState<DayState | null>(null);
  const pending = useRef(0);

  useEffect(() => {
    if (pending.current > 0) return;
    let alive = true;
    getDay(db, date)
      .then((d) => {
        if (alive && pending.current === 0) setState({ date, completed: new Set(d.completed), tracked: d.tracked });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [db, date, version]);

  const apply = useCallback(
    (habitId: string, checked: boolean) =>
      setState((s) => {
        const base = s && s.date === date ? s.completed : EMPTY;
        const next = new Set(base);
        if (checked) next.add(habitId);
        else next.delete(habitId);
        return { date, completed: next, tracked: true };
      }),
    [date],
  );

  /** Set a habit's status; `checked` is the new value. */
  const toggle = useCallback(
    async (habitId: string, checked: boolean) => {
      apply(habitId, checked);
      pending.current++;
      try {
        await setHabitCompleted(db, date, habitId, checked);
      } catch (e) {
        apply(habitId, !checked);
        Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      } finally {
        pending.current--;
        bump();
      }
    },
    [db, date, bump, apply],
  );

  const current = state && state.date === date ? state : null;
  return { completed: current?.completed ?? EMPTY, tracked: current?.tracked ?? false, toggle, loading: current === null };
}
