import { router } from 'expo-router';
import { Check, Pencil, RotateCcw, X } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';
import { getDay, getExpenses, resetDay } from '@/db/repo';
import type { Db } from '@/db/types';
import { useQuery } from '@/hooks/useQuery';
import { formatMedium, type DateKey } from '@/lib/date';
import { HABITS, renderHabitTitle, TOTAL_HABITS } from '@/lib/habits';
import { formatCents } from '@/lib/money';
import { completionPercent, statusForPercent, sumCents } from '@/lib/stats';
import { useApp, useColors } from '@/state/AppContext';
import { EXPENSE_COLORS, spacing } from '@/theme/theme';
import { Button, Card, Divider, haptic, T } from './ui';

export function confirmResetDay(db: Db, date: DateKey, onDone: () => void) {
  Alert.alert('Reset this day?', `All habit check marks for ${formatMedium(date)} will be removed. Other days and expenses are not affected.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Reset Day',
      style: 'destructive',
      onPress: async () => {
        try {
          await resetDay(db, date);
          haptic('warning');
          onDone();
        } catch (e) {
          Alert.alert('Could not reset', e instanceof Error ? e.message : String(e));
        }
      },
    },
  ]);
}

/** Read-only summary of a date: %, completed/missed habits and spending. */
export function DayDetails({ date }: { date: DateKey }) {
  const c = useColors();
  const { db, bump, targets } = useApp();
  const { data: day } = useQuery((d) => getDay(d, date), [date]);
  const { data: expenses } = useQuery((d) => getExpenses(d, date, date), [date]);
  if (!day) return null;

  const done = new Set(day.completed);
  const pct = completionPercent(done.size);
  const status = statusForPercent(day.tracked ? pct : null);
  const spent = sumCents(expenses ?? []);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="headline">{formatMedium(date)}</T>
          <T variant="footnote" secondary>
            {day.tracked ? `${done.size} of ${TOTAL_HABITS} habits completed` : 'No habits recorded for this day'}
          </T>
        </View>
        <View style={[styles.badge, { backgroundColor: day.tracked ? c.status[status] : c.fill }]}>
          <T variant="headline" color={day.tracked ? (status === 'yellow' ? '#000' : '#FFF') : c.textSecondary}>
            {day.tracked ? `${Math.round(pct)}%` : '—'}
          </T>
        </View>
      </View>

      {day.tracked ? (
        <>
          <Divider />
          <T variant="footnote" secondary style={styles.label}>
            COMPLETED ({done.size})
          </T>
          {done.size === 0 ? (
            <T variant="subhead" tertiary>
              None
            </T>
          ) : (
            HABITS.filter((h) => done.has(h.id)).map((h) => (
              <View key={h.id} style={styles.item}>
                <Check size={16} color={c.category[h.category]} strokeWidth={3} />
                <T variant="subhead" style={{ flex: 1 }}>
                  {renderHabitTitle(h, targets[h.id])}
                </T>
              </View>
            ))
          )}
          <T variant="footnote" secondary style={styles.label}>
            MISSED ({TOTAL_HABITS - done.size})
          </T>
          {HABITS.filter((h) => !done.has(h.id)).map((h) => (
            <View key={h.id} style={styles.item}>
              <X size={16} color={c.textTertiary} strokeWidth={3} />
              <T variant="subhead" secondary style={{ flex: 1 }}>
                {renderHabitTitle(h, targets[h.id])}
              </T>
            </View>
          ))}
        </>
      ) : null}

      <Divider />
      <View style={styles.head}>
        <T variant="footnote" secondary style={[styles.label, { flex: 1 }]}>
          SPENDING
        </T>
        <T variant="headline" color={c.money}>
          {formatCents(spent)}
        </T>
      </View>
      {(expenses ?? []).map((e) => (
        <View key={e.id} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: EXPENSE_COLORS[e.category] }]} />
          <T variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
            {e.description || e.category}
          </T>
          <T variant="subhead" secondary>
            {formatCents(e.amountCents)}
          </T>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
        <Button title={day.tracked ? 'Edit Habits' : 'Log Habits'} icon={Pencil} kind="secondary" onPress={() => router.push({ pathname: '/day/[date]', params: { date } })} style={{ flex: 1 }} />
        {day.tracked ? <Button title="Reset" icon={RotateCcw} kind="destructive" onPress={() => confirmResetDay(db, date, bump)} style={{ flex: 1 }} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { minWidth: 64, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  label: { fontWeight: '600', marginTop: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
