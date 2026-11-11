/**
 * Local reminders. Permission is requested only when the user turns a reminder
 * on. Morning, bedtime and expense reminders repeat daily; the evening
 * "incomplete habits" reminder is scheduled as one-off notifications for the
 * next 7 days so today's can show how many habits are left (or be skipped
 * entirely once all 16 are done).
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, parseDateKey, type DateKey } from './date';
import { TOTAL_HABITS } from './habits';

export type ReminderId = 'morning' | 'evening' | 'bedtime' | 'expense';

export interface ReminderSetting {
  enabled: boolean;
  hour: number;
  minute: number;
}

export type Reminders = Record<ReminderId, ReminderSetting>;

export const DEFAULT_REMINDERS: Reminders = {
  morning: { enabled: false, hour: 8, minute: 0 },
  evening: { enabled: false, hour: 20, minute: 0 },
  bedtime: { enabled: false, hour: 22, minute: 0 },
  expense: { enabled: false, hour: 21, minute: 0 },
};

export const REMINDER_INFO: Record<ReminderId, { title: string; description: string; body: string }> = {
  morning: { title: 'Morning checklist', description: 'Start the day with your habits', body: 'Good morning! Review your 16 habits and plan today.' },
  evening: { title: 'Evening check-in', description: 'Only if habits are still open', body: "Check off what you've finished today." },
  bedtime: { title: 'Bedtime', description: 'Wind down and put the phone away', body: 'Time to wind down — phone away for a better night of sleep.' },
  expense: { title: 'Log expenses', description: "Record today's spending", body: 'Did you spend anything today? Log it in TrackerApp.' },
};

const EVENING_PREFIX = 'reminder-evening-';
const EVENING_DAYS = 7;
const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function normalizeReminders(raw: unknown): Reminders {
  const out: Reminders = JSON.parse(JSON.stringify(DEFAULT_REMINDERS));
  if (raw && typeof raw === 'object') {
    for (const id of Object.keys(DEFAULT_REMINDERS) as ReminderId[]) {
      const r = (raw as Record<string, unknown>)[id] as Partial<ReminderSetting> | undefined;
      if (!r) continue;
      if (typeof r.enabled === 'boolean') out[id].enabled = r.enabled;
      if (Number.isInteger(r.hour) && r.hour! >= 0 && r.hour! < 24) out[id].hour = r.hour!;
      if (Number.isInteger(r.minute) && r.minute! >= 0 && r.minute! < 60) out[id].minute = r.minute!;
    }
  }
  return out;
}

export type PermissionResult = 'granted' | 'denied' | 'unavailable';

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: 'Reminders', importance: AndroidImportance.DEFAULT });
  }
}

function isGranted(p: Notifications.NotificationPermissionsStatus): boolean {
  if (p.granted) return true;
  const s = p.ios?.status;
  return s === IosAuthorizationStatus.AUTHORIZED || s === IosAuthorizationStatus.PROVISIONAL || s === IosAuthorizationStatus.EPHEMERAL;
}

/** Check, and if allowed by the OS, request notification permission. */
export async function requestPermission(): Promise<PermissionResult> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (isGranted(current)) return 'granted';
    if (!current.canAskAgain) return 'denied';
    const next = await Notifications.requestPermissionsAsync();
    return isGranted(next) ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function hasPermission(): Promise<boolean> {
  try {
    return isGranted(await Notifications.getPermissionsAsync());
  } catch {
    return false;
  }
}

/** Re-create all scheduled reminders from settings. Safe to call often. */
export async function applyReminders(reminders: Reminders, today: DateKey, completedToday: number): Promise<void> {
  if (!(await hasPermission())) return;
  await ensureChannel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith('reminder-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  for (const id of ['morning', 'bedtime', 'expense'] as const) {
    const r = reminders[id];
    if (!r.enabled) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${id}`,
      content: { title: 'TrackerApp', body: REMINDER_INFO[id].body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL_ID },
    });
  }

  const ev = reminders.evening;
  if (ev.enabled) {
    const now = Date.now();
    for (let i = 0; i < EVENING_DAYS; i++) {
      const day = addDays(today, i);
      const when = parseDateKey(day);
      when.setHours(ev.hour, ev.minute, 0, 0);
      if (when.getTime() <= now) continue;
      let body = REMINDER_INFO.evening.body;
      if (i === 0) {
        const left = TOTAL_HABITS - completedToday;
        if (left <= 0) continue; // all done — no nagging
        body = `You have ${left} habit${left === 1 ? '' : 's'} left today. You've got this!`;
      }
      await Notifications.scheduleNotificationAsync({
        identifier: `${EVENING_PREFIX}${day}`,
        content: { title: 'Evening check-in', body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
      });
    }
  }
}

export function formatTime(hour: number, minute: number): string {
  const d = new Date(2000, 0, 1, hour, minute);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
