import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MonthCalendar, StatusLegend } from '@/components/CalendarViews';
import { DayDetails } from '@/components/DayDetails';
import { Card, haptic, IconButton, Screen, StatTile, T } from '@/components/ui';
import { getDayRecords } from '@/db/repo';
import { useQuery } from '@/hooks/useQuery';
import { addMonths, endOfMonth, formatMonthYear, monthKey, startOfMonth } from '@/lib/date';
import { TOTAL_HABITS } from '@/lib/habits';
import { completionPercent, summarizeRange } from '@/lib/stats';
import { useApp, useColors } from '@/state/AppContext';
import { spacing } from '@/theme/theme';

export default function CalendarScreen() {
  const c = useColors();
  const { today } = useApp();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const { data: records } = useQuery((db) => getDayRecords(db, start, end), [start, end]);

  const percents = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records ?? []) m.set(r.date, completionPercent(r.completed.length));
    return m;
  }, [records]);
  const summary = useMemo(() => summarizeRange(records ?? [], start, end > today ? today : end), [records, start, end, today]);

  const canNext = monthKey(month) < monthKey(today);
  const shift = (n: number) => {
    haptic();
    setMonth(addMonths(month, n));
  };

  return (
    <Screen title="Calendar">
      <Card>
        <View style={styles.nav}>
          <IconButton icon={ChevronLeft} label="Previous month" onPress={() => shift(-1)} />
          <T variant="headline" accessibilityRole="header">
            {formatMonthYear(month)}
          </T>
          <View style={{ opacity: canNext ? 1 : 0.3 }}>
            <IconButton icon={ChevronRight} label="Next month" onPress={() => canNext && shift(1)} />
          </View>
        </View>
        <MonthCalendar month={month} percents={percents} selected={selected} today={today} onSelect={(d) => { haptic(); setSelected(d); }} />
        <View style={{ marginTop: spacing.md }}>
          <StatusLegend />
        </View>
      </Card>

      <View style={styles.tiles}>
        <StatTile label="Month avg" value={summary.averagePercent === null ? '—' : `${Math.round(summary.averagePercent)}%`} />
        <StatTile label="Days tracked" value={String(summary.trackedDays)} />
        <StatTile label="Perfect days" value={String(summary.perfectDays)} sub={`${TOTAL_HABITS}/${TOTAL_HABITS}`} color={c.status.green} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <DayDetails date={selected} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
