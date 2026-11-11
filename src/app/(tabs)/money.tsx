import { router } from 'expo-router';
import { CalendarRange, Crown, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Bars, Donut } from '@/components/Charts';
import { Card, Divider, EmptyState, Grid, haptic, IconButton, Screen, SectionTitle, Segmented, StatTile, T, Button } from '@/components/ui';
import { deleteExpense, getExpenses, type Expense } from '@/db/repo';
import { useQuery } from '@/hooks/useQuery';
import { dateRange, diffDays, formatMedium, monthKey, parseDateKey, relativeLabel, startOfMonth, startOfWeek, startOfYear, weekdayInitial } from '@/lib/date';
import { formatCents, formatCentsCompact } from '@/lib/money';
import { dailyAverageCents, highestSpendingDay, monthlyTotals, sumCents, totalsByCategory, totalsByDay } from '@/lib/stats';
import { useApp, useColors } from '@/state/AppContext';
import { EXPENSE_COLORS, spacing } from '@/theme/theme';

type Range = 'week' | 'month' | 'year' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

const axisDollars = (v: string) => {
  const n = Number(v) / 100;
  return n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
};

export default function MoneyScreen() {
  const c = useColors();
  const { db, bump, today } = useApp();
  const [range, setRange] = useState<Range>('month');
  const { data } = useQuery((d) => getExpenses(d), []);
  const all = useMemo(() => data ?? [], [data]);

  const firstDate = all.length ? all[all.length - 1].date : today;
  const start = range === 'week' ? startOfWeek(today) : range === 'month' ? startOfMonth(today) : range === 'year' ? startOfYear(today) : firstDate < today ? firstDate : today;
  const inRange = useMemo(() => all.filter((e) => e.date >= start && e.date <= today), [all, start, today]);
  const total = sumCents(inRange);
  const byCategory = totalsByCategory(inRange);
  const highest = highestSpendingDay(inRange);
  const avg = dailyAverageCents(all, start, today);

  const bars = useMemo(() => {
    if (range === 'week' || range === 'month') {
      const byDay = totalsByDay(inRange);
      return dateRange(start, today).map((d) => ({ label: range === 'week' ? weekdayInitial(d) : Number(d.slice(8)) % 5 === 1 ? String(Number(d.slice(8))) : '', value: byDay.get(d) ?? 0 }));
    }
    const months = range === 'year' ? Number(today.slice(5, 7)) : Math.min(24, Math.max(1, monthsBetween(start, today)));
    return monthlyTotals(inRange, monthKey(today), months).map((m) => ({ label: parseDateKey(`${m.month}-01`).toLocaleDateString(undefined, { month: 'narrow' }), value: m.cents }));
  }, [range, inRange, start, today]);

  const trend = monthlyTotals(all, monthKey(today), 6);
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of inRange) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    return [...m.entries()];
  }, [inRange]);

  const confirmDelete = (e: Expense) => {
    Alert.alert('Delete transaction?', `${formatCents(e.amountCents)} · ${e.category}${e.description ? ` · ${e.description}` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(db, e.id);
          haptic('warning');
          bump();
        },
      },
    ]);
  };

  return (
    <Screen title="Money" right={<IconButton icon={Plus} label="Add expense" onPress={() => router.push('/expense')} filled />}>
      <Grid columns={2}>
        <StatTile label="Today" value={formatCents(sumCents(all, today, today))} icon={Wallet} color={c.money} />
        <StatTile label="This week" value={formatCentsCompact(sumCents(all, startOfWeek(today), today))} icon={CalendarRange} />
        <StatTile label="This month" value={formatCentsCompact(sumCents(all, startOfMonth(today), today))} icon={CalendarRange} />
        <StatTile label="This year" value={formatCentsCompact(sumCents(all, startOfYear(today), today))} icon={TrendingUp} />
      </Grid>

      <Segmented options={RANGES} value={range} onChange={setRange} style={{ marginTop: spacing.xxl }} />

      {all.length === 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <EmptyState icon={Receipt} title="No expenses yet" message="Log what you spend to see totals, categories and trends." action={<Button title="Add Expense" icon={Plus} onPress={() => router.push('/expense')} style={{ marginTop: spacing.sm }} />} />
        </Card>
      ) : (
        <>
          <View style={styles.tilesRow}>
            <StatTile label="Total" value={formatCentsCompact(total)} color={c.money} />
            <StatTile label="Daily avg" value={formatCentsCompact(avg)} sub={`${diffDays(start, today) + 1} days`} />
          </View>
          <View style={styles.tilesRow}>
            <StatTile label="Highest spending day" icon={Crown} color={c.money} value={highest ? formatCents(highest.cents) : '—'} sub={highest ? formatMedium(highest.date) : 'No spending in this period'} />
          </View>

          <SectionTitle>By Category</SectionTitle>
          <Card style={{ alignItems: 'center', gap: spacing.lg }}>
            <Donut data={byCategory.map((b) => ({ value: b.cents, color: EXPENSE_COLORS[b.category] ?? c.textTertiary }))} center={formatCentsCompact(total)} centerSub={RANGES.find((r) => r.value === range)!.label} />
            <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
              {byCategory.length === 0 ? (
                <T variant="subhead" tertiary style={{ textAlign: 'center' }}>
                  No spending in this period
                </T>
              ) : (
                byCategory.map((b) => (
                  <View key={b.category} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: EXPENSE_COLORS[b.category] }]} />
                    <T variant="subhead" style={{ flex: 1 }}>
                      {b.category}
                    </T>
                    <T variant="subhead" secondary style={{ fontVariant: ['tabular-nums'] }}>
                      {total ? Math.round((b.cents / total) * 100) : 0}%
                    </T>
                    <T variant="subhead" style={{ width: 96, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                      {formatCents(b.cents)}
                    </T>
                  </View>
                ))
              )}
            </View>
          </Card>

          <SectionTitle>{range === 'week' || range === 'month' ? 'Daily Spending' : 'Monthly Spending'}</SectionTitle>
          <Card>
            <Bars data={bars} color={c.money} formatY={axisDollars} />
          </Card>

          <SectionTitle>6-Month Trend</SectionTitle>
          <Card>
            <Bars data={trend.map((m) => ({ label: parseDateKey(`${m.month}-01`).toLocaleDateString(undefined, { month: 'short' }), value: m.cents }))} color={c.money} formatY={axisDollars} showValues formatValue={(v) => axisDollars(String(v))} />
          </Card>

          <SectionTitle>Transactions</SectionTitle>
          {groups.length === 0 ? (
            <Card>
              <T variant="subhead" tertiary style={{ textAlign: 'center' }}>
                No transactions in this period
              </T>
            </Card>
          ) : (
            groups.map(([date, items]) => (
              <View key={date} style={{ marginBottom: spacing.md }}>
                <View style={styles.groupHead}>
                  <T variant="footnote" secondary style={{ fontWeight: '600' }}>
                    {relativeLabel(date, today).toUpperCase()}
                  </T>
                  <T variant="footnote" secondary style={{ fontWeight: '600' }}>
                    {formatCents(sumCents(items))}
                  </T>
                </View>
                <Card padded={false}>
                  {items.map((e, i) => (
                    <View key={e.id}>
                      {i > 0 ? <Divider inset={60} /> : null}
                      <Pressable
                        onPress={() => router.push({ pathname: '/expense', params: { id: String(e.id) } })}
                        onLongPress={() => confirmDelete(e)}
                        accessibilityRole="button"
                        accessibilityLabel={`${e.category} ${formatCents(e.amountCents)} ${e.description}`}
                        accessibilityHint="Tap to edit, long-press to delete"
                        style={({ pressed }) => [styles.txn, pressed && { backgroundColor: c.fill }]}
                      >
                        <View style={[styles.txnIcon, { backgroundColor: (EXPENSE_COLORS[e.category] ?? '#8E8E93') + '26' }]}>
                          <View style={[styles.dot, { backgroundColor: EXPENSE_COLORS[e.category], width: 10, height: 10 }]} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <T variant="body" numberOfLines={1}>
                            {e.description || e.category}
                          </T>
                          <T variant="footnote" secondary>
                            {e.category}
                          </T>
                        </View>
                        <T variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
                          {formatCents(e.amountCents)}
                        </T>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ))
          )}
          <T variant="caption" tertiary style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Tap a transaction to edit · long-press to delete
          </T>
        </>
      )}
    </Screen>
  );
}

function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;
}

const styles = StyleSheet.create({
  tilesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: 6 },
  txn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10, minHeight: 60 },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
