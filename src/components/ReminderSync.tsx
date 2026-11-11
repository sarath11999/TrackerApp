import { useEffect } from 'react';
import { getDay, getSetting } from '@/db/repo';
import { applyReminders, normalizeReminders } from '@/lib/notifications';
import { useApp } from '@/state/AppContext';

/** Keeps scheduled reminders in sync with settings and today's progress (debounced). */
export function ReminderSync() {
  const { db, version, today } = useApp();
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const reminders = normalizeReminders(await getSetting(db, 'reminders', null));
        if (!Object.values(reminders).some((r) => r.enabled)) return;
        const day = await getDay(db, today);
        await applyReminders(reminders, today, day.completed.length);
      } catch {
        /* reminders are best-effort */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [db, version, today]);
  return null;
}
