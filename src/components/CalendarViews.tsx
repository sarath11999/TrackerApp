import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, daysInMonth, parseDateKey, startOfMonth, startOfWeek, type DateKey } from '@/lib/date';
import { statusForPercent, type DayStatus } from '@/lib/stats';
import { useColors } from '@/state/AppContext';
import { T } from './ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid colored by completion. `percents` holds only tracked days. */
export const MonthCalendar = memo(function MonthCalendar({
  month,
  percents,
  selected,
  today,
  onSelect,
}: {
  month: DateKey; // any day in the month
  percents: Map<DateKey, number>;
  selected: DateKey | null;
  today: DateKey;
  onSelect: (d: DateKey) => void;
}) {
  const c = useColors();
  const first = startOfMonth(month);
  const d0 = parseDateKey(first);
  const lead = d0.getDay();
  const count = daysInMonth(d0.getFullYear(), d0.getMonth());
  const cells: (DateKey | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const weeks: (DateKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const fill = (s: DayStatus) => (s === 'none' ? 'transparent' : c.status[s]);

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={styles.cell}>
            <T variant="caption2" tertiary>
              {w}
            </T>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={styles.cell} />;
            const future = d > today;
            const pct = percents.get(d);
            const status = statusForPercent(pct);
            const isSel = d === selected;
            const isToday = d === today;
            const tracked = pct !== undefined;
            const textColor = tracked && status !== 'yellow' ? '#FFFFFF' : tracked ? '#000000' : future ? c.textTertiary : c.text;
            return (
              <Pressable
                key={di}
                style={styles.cell}
                disabled={future}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: future }}
                accessibilityLabel={`${parseDateKey(d).toDateString()}, ${tracked ? `${Math.round(pct!)} percent` : 'no record'}`}
              >
                <View
                  style={[
                    styles.day,
                    { backgroundColor: fill(status) },
                    !tracked && !future && { borderWidth: 1.5, borderColor: c.status.none, borderStyle: 'dashed' },
                    isSel && { borderWidth: 2.5, borderColor: c.text, borderStyle: 'solid' },
                  ]}
                >
                  <T variant="subhead" color={textColor} style={{ fontWeight: isToday ? '800' : '500', fontVariant: ['tabular-nums'] }}>
                    {Number(d.slice(8))}
                  </T>
                </View>
                {isToday ? <View style={[styles.todayDot, { backgroundColor: c.tint }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

export function StatusLegend() {
  const c = useColors();
  const items: { label: string; color: string; dashed?: boolean }[] = [
    { label: '80–100%', color: c.status.green },
    { label: '50–79%', color: c.status.yellow },
    { label: '<50%', color: c.status.red },
    { label: 'No record', color: 'transparent', dashed: true },
  ];
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: i.color }, i.dashed && { borderWidth: 1.5, borderColor: c.status.none, borderStyle: 'dashed' }]} />
          <T variant="caption" secondary>
            {i.label}
          </T>
        </View>
      ))}
    </View>
  );
}

/** GitHub-style heatmap: columns are weeks (Sun→Sat), ending at `end`. */
export function Heatmap({ end, weeks, percents, cell = 13, gap = 3 }: { end: DateKey; weeks: number; percents: Map<DateKey, number>; cell?: number; gap?: number }) {
  const c = useColors();
  const start = addDays(startOfWeek(end), -(weeks - 1) * 7);
  const cols: DateKey[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const shade = (p: number | undefined) => {
    if (p === undefined) return c.status.none;
    if (p >= 80) return c.status.green;
    if (p >= 50) return c.status.yellow;
    return c.status.red;
  };
  return (
    <View style={{ flexDirection: 'row', gap }} accessible accessibilityLabel={`Completion heatmap for the last ${weeks} weeks`}>
      {cols.map((col, i) => (
        <View key={i} style={{ gap }}>
          {col.map((d) => (
            <View
              key={d}
              style={{
                width: cell,
                height: cell,
                borderRadius: 3,
                backgroundColor: d > end ? 'transparent' : shade(percents.get(d)),
                opacity: percents.get(d) === undefined ? 0.6 : 1,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  day: { width: '88%', height: '88%', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  todayDot: { position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
});
