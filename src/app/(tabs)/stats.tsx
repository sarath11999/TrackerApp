import { router } from 'expo-router';
import { Award, CalendarCheck, ChevronRight, Flame, Scale, Sparkles, Star, Target, TrendingDown, TrendingUp, Trophy } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Heatmap, StatusLegend } from '@/components/CalendarViews';
import { Bars, Line } from '@/components/Charts';
import { CATEGORY_ICONS } from '@/components/HabitChecklist';
import { Card, EmptyState, Grid, ProgressBar, Screen, SectionTitle, Segmented, StatTile, T, Tap } from '@/components/ui';
import { getDayRecords } from '@/db/repo';
import { useQuery } from '@/hooks/useQuery';
import { addDays, formatShort, startOfMonth, startOfYear, weekdayInitial, type DateKey } from '@/lib/date';
import { CATEGORIES, HABIT_BY_ID, renderHabitTitle } from '@/lib/habits';
import {
  averageCompletion,
  completionPercent,
  currentStreak,
  longestStreak,
  summarizeRange,
  toCountMap,
  weeklyAverages,
} from '@/lib/stats';
import { useApp, useColors } from '@/state/AppContext';
import { radius, spacing } from '@/theme/theme';

type Range = '7' | '30' | '90' | 'year' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);

export default function StatsScreen() {
  const c = useColors();
  const { today, targets } = useApp();
  const [range, setRange] = useState<Range>('30');
  const { data: records } = useQuery((db) => getDayRecords(db), []);
  const all = useMemo(() => records ?? [], [records]);
  const counts = useMemo(() => toCountMap(all), [all]);
  const firstDate: DateKey = all[0]?.date ?? today;

  const start = useMemo(() => {
    switch (range) {
      case '7':
        return addDays(today, -6);
      case '30':
        return addDays(today, -29);
      case '90':
        return addDays(today, -89);
      case 'year':
        return startOfYear(today);
      case 'all':
        return firstDate < today ? firstDate : today;
    }
  }, [range, today, firstDate]);

  const summary = useMemo(() => summarizeRange(all, start, today), [all, start, today]);
  const week = useMemo(() => summarizeRange(all, addDays(today, -6), today), [all, today]);

  const todayPct = counts.has(today) ? completionPercent(counts.get(today)!) : null;
  const weeklyAvg = averageCompletion(counts, addDays(today, -6), today);
  const monthlyAvg = averageCompletion(counts, startOfMonth(today), today);
  const yearlyAvg = averageCompletion(counts, startOfYear(today), today);
  const streak = currentStreak(counts, today);
  const longest = longestStreak(counts);

  const trend = (() => {
    const tracked = summary.daily.filter((d) => d.percent !== null);
    if (summary.daily.length > 92) {
      return weeklyAverages(summary.daily)
        .filter((w) => w.percent !== null)
        .map((w) => ({ value: w.percent!, label: formatShort(w.weekStart) }));
    }
    return tracked.map((d) => ({ value: d.percent!, label: formatShort(d.date) }));
  })();

  const percentsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const [d, n] of counts) m.set(d, completionPercent(n));
    return m;
  }, [counts]);

  const heatWeeks = range === '7' ? 4 : range === '30' ? 8 : range === '90' ? 14 : 20;
  const sortedRates = [...summary.habitRates].sort((a, b) => b.rate - a.rate);

  return (
    <Screen
      title="Statistics"
      right={
        <Tap onPress={() => router.push('/weight')} style={[styles.weightBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel="Open weight tracking">
          <Scale size={18} color={c.weight} />
          <T variant="subhead" style={{ fontWeight: '600' }}>
            Weight
          </T>
        </Tap>
      }
    >
      <Grid columns={2}>
        <StatTile label="Today" value={pct(todayPct)} icon={Target} color={c.tint} sub={todayPct === null ? 'No record yet' : `${counts.get(today)}/16 habits`} />
        <StatTile label="Current streak" value={`${streak}d`} icon={Flame} color="#FF9500" sub={`Longest: ${longest} day${longest === 1 ? '' : 's'}`} />
        <StatTile label="Weekly average" value={pct(weeklyAvg)} icon={TrendingUp} sub="Last 7 days" />
        <StatTile label="Monthly average" value={pct(monthlyAvg)} icon={CalendarCheck} sub="This month" />
        <StatTile label="Yearly completion" value={pct(yearlyAvg)} icon={Trophy} sub={`Since Jan 1, ${today.slice(0, 4)}`} />
        <StatTile label="Total days tracked" value={String(all.length)} icon={Award} sub={`Perfect days: ${toCountMapPerfect(counts)}`} />
      </Grid>

      <SectionTitle>This Week</SectionTitle>
      <Card>
        <T variant="footnote" secondary style={{ marginBottom: spacing.md }}>
          Daily completion · last 7 days
        </T>
        <Bars
          data={week.daily.map((d) => ({
            label: weekdayInitial(d.date),
            value: d.percent ?? 0,
            color: d.percent === null ? c.status.none : d.percent >= 80 ? c.status.green : d.percent >= 50 ? c.status.yellow : c.status.red,
          }))}
          maxValue={100}
          color={c.tint}
          formatY={(v) => `${v}%`}
          showValues
          formatValue={(v) => `${Math.round(v)}`}
        />
      </Card>

      <Segmented options={RANGES} value={range} onChange={setRange} style={{ marginTop: spacing.xxl }} />

      {summary.trackedDays === 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <EmptyState icon={Sparkles} title="No data for this period" message="Check off habits on the Today tab and your statistics will appear here." />
        </Card>
      ) : (
        <>
          <View style={styles.tilesRow}>
            <StatTile label="Average" value={pct(summary.averagePercent)} />
            <StatTile label="Tracked" value={`${summary.trackedDays}`} sub={`of ${summary.daily.length} days`} />
            <StatTile label="Perfect" value={`${summary.perfectDays}`} color={c.status.green} />
          </View>

          <SectionTitle>Completion Trend</SectionTitle>
          <Card>
            <T variant="footnote" secondary style={{ marginBottom: spacing.md }}>
              {summary.daily.length > 92 ? 'Weekly average of tracked days' : 'Each tracked day'}
            </T>
            {trend.length >= 2 ? (
              <Line data={trend} color={c.tint} maxValue={100} formatY={(v) => `${Math.round(Number(v))}%`} />
            ) : (
              <T variant="subhead" tertiary>
                Track at least two days to see a trend.
              </T>
            )}
          </Card>

          <SectionTitle>Heatmap</SectionTitle>
          <Card style={{ alignItems: 'center', gap: spacing.md }}>
            <Heatmap end={today} weeks={heatWeeks} percents={percentsMap} cell={heatWeeks > 14 ? 11 : 14} gap={3} />
            <StatusLegend />
          </Card>

          <SectionTitle>Categories</SectionTitle>
          <Card>
            <Bars
              data={summary.categoryRates.map((r) => ({
                label: CATEGORIES.find((x) => x.id === r.category)!.shortTitle,
                value: r.rate,
                color: c.category[r.category],
              }))}
              maxValue={100}
              color={c.tint}
              formatY={(v) => `${v}%`}
              showValues
              formatValue={(v) => `${Math.round(v)}%`}
            />
            <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
              {summary.categoryRates.map((r) => {
                const cat = CATEGORIES.find((x) => x.id === r.category)!;
                const Icon = CATEGORY_ICONS[r.category];
                return (
                  <View key={r.category} style={{ gap: 6 }}>
                    <View style={styles.rowBetween}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon size={15} color={c.category[r.category]} />
                        <T variant="subhead">{cat.shortTitle} consistency</T>
                      </View>
                      <T variant="subhead" style={{ fontWeight: '600' }}>
                        {Math.round(r.rate)}%
                      </T>
                    </View>
                    <ProgressBar value={r.rate} color={c.category[r.category]} />
                  </View>
                );
              })}
            </View>
          </Card>

          <SectionTitle>Highlights</SectionTitle>
          <Grid columns={2}>
            <StatTile
              label="Most consistent"
              icon={Star}
              color={c.status.green}
              value={`${Math.round(summary.mostConsistent!.rate)}%`}
              sub={renderHabitTitle(HABIT_BY_ID[summary.mostConsistent!.habitId], targets[summary.mostConsistent!.habitId])}
            />
            <StatTile
              label="Least consistent"
              icon={TrendingDown}
              color={c.status.red}
              value={`${Math.round(summary.leastConsistent!.rate)}%`}
              sub={renderHabitTitle(HABIT_BY_ID[summary.leastConsistent!.habitId], targets[summary.leastConsistent!.habitId])}
            />
          </Grid>

          <SectionTitle>Habit Completion Rates</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            {sortedRates.map((r) => {
              const def = HABIT_BY_ID[r.habitId];
              const color = c.category[def.category];
              return (
                <View key={r.habitId} style={{ gap: 5 }} accessible accessibilityLabel={`${renderHabitTitle(def, targets[def.id])}: ${Math.round(r.rate)} percent`}>
                  <View style={styles.rowBetween}>
                    <T variant="footnote" style={{ flex: 1 }} numberOfLines={1}>
                      {renderHabitTitle(def, targets[def.id])}
                    </T>
                    <T variant="footnote" secondary style={{ fontVariant: ['tabular-nums'] }}>
                      {r.completedDays}/{summary.trackedDays} · {Math.round(r.rate)}%
                    </T>
                  </View>
                  <ProgressBar value={r.rate} color={color} height={7} />
                </View>
              );
            })}
          </Card>
        </>
      )}

      <Tap onPress={() => router.push('/weight')} style={[styles.weightCard, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel="Open weight tracking">
        <View style={[styles.weightIcon, { backgroundColor: c.weight + '22' }]}>
          <Scale size={20} color={c.weight} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="headline">Weight Tracking</T>
          <T variant="footnote" secondary>
            History, target and trends
          </T>
        </View>
        <ChevronRight size={20} color={c.textTertiary} />
      </Tap>
    </Screen>
  );
}

function toCountMapPerfect(counts: Map<string, number>): number {
  let n = 0;
  for (const v of counts.values()) if (v === 16) n++;
  return n;
}

const styles = StyleSheet.create({
  weightBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, marginBottom: 6 },
  tilesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  weightCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.xxl },
  weightIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
