import { useEffect, useEffectEvent, useState } from 'react';
import type { Db } from '@/db/types';
import { useApp } from '@/state/AppContext';

/**
 * Run an async DB query and re-run it whenever data changes anywhere in the
 * app (the global version bumps after each write) or any dependency changes.
 * `deps` must be primitives (strings/numbers/booleans/null).
 */
export function useQuery<T>(fn: (db: Db) => Promise<T>, deps: (string | number | boolean | null | undefined)[]): { data: T | undefined; loading: boolean; error: Error | null } {
  const { db, version } = useApp();
  const key = JSON.stringify([version, ...deps]);
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: Error | null }>({ key: null, data: undefined, error: null });
  const run = useEffectEvent((d: Db) => fn(d));

  useEffect(() => {
    let alive = true;
    run(db)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: unknown) => alive && setState((s) => ({ key, data: s.data, error: e instanceof Error ? e : new Error(String(e)) })));
    return () => {
      alive = false;
    };
  }, [db, key]);

  return { data: state.data, loading: state.key !== key, error: state.error };
}
