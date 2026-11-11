import { router } from 'expo-router';
import { BarChart3, ChevronRight, Flame, Quote, Wallet } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DateSwitcher } from '@/components/DatePickers';
import { DayProgress } from '@/components/DayProgress';
import { HabitChecklist } from '@/components/HabitChecklist';
import { Card, SectionTitle, Screen, T, Tap } from '@/components/ui';
import { getDayRecords, getDaySpendingCents, getSetting } from '@/db/repo';
import { useDayHabits } from '@/hooks/useDayHabits';
import { useQuery } from '@/hooks/useQuery';
import { formatLong } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { greeting, motivationFor } from '@/lib/motivation';
import { currentStreak, toCountMap } from '@/lib/stats';
import { useApp, useColors } from '@/state/AppContext';
import { radius, spacing } from '@/theme/theme';

export default function TodayScreen() {
  const c = useColors();
  const { today, name } = useApp();
  const [date, setDate] = useState(today);

  // Follow the calendar day forward at midnight if the user was viewing "today".
  const prevToday = useRef(today);
  useEffect(() => {
    if (date === prevToday.current) setDate(today);
    prevToday.current = today;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const { completed, tracked, toggle } = useDayHabits(date);
  const { data: records } = useQuery((db) => getDayRecords(db), []);
  const { data: spent } = useQuery((db) => getDaySpendingCents(db, date), [date]);
  const { data: calorieTarget } = useQuery((db) => getSetting<number | null>(db, 'calorieTarget', null), []);
  const streak = records ? currentStreak(toCountMap(records), today) : 0;
  const isToday = date === today;

  return (
    <Screen title={`${greeting()}${name ? `, ${name}` : ''}`} subtitle={formatLong(today)}>
      <Card style={styles.quote}>
        <Quote size={16} color={c.tint} />
        <T variant="subhead" secondary style={{ flex: 1, fontStyle: 'italic' }}>
          {motivationFor(today)}
        </T>
      </Card>

      <DateSwitcher date={date} onChange={setDate} />

      <DayProgress completed={completed} tracked={tracked} />

      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <View style={[styles.tileIcon, { backgroundColor: '#FF950022' }]}>
            <Flame size={18} color="#FF9500" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="footnote" secondary>
              Current streak
            </T>
            <T variant="headline">
              {streak} day{streak === 1 ? '' : 's'}
            </T>
          </View>
        </Card>
        <Tap style={[styles.tile, { backgroundColor: c.card }]} onPress={() => router.navigate('/money')} accessibilityRole="button" accessibilityLabel={`Spending ${isToday ? 'today' : 'this day'} ${formatCents(spent ?? 0)}. Open Money`}>
          <View style={[styles.tileIcon, { backgroundColor: c.money + '22' }]}>
            <Wallet size={18} color={c.money} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="footnote" secondary>
              {isToday ? "Today's spending" : 'Spending'}
            </T>
            <T variant="headline" numberOfLines={1} adjustsFontSizeToFit>
              {formatCents(spent ?? 0)}
            </T>
          </View>
        </Tap>
      </View>

      <Tap style={[styles.statsLink, { backgroundColor: c.card }]} onPress={() => router.navigate('/stats')} accessibilityRole="button" accessibilityLabel="Open statistics">
        <View style={[styles.tileIcon, { backgroundColor: c.tint + '22' }]}>
          <BarChart3 size={18} color={c.tint} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="headline">Statistics</T>
          <T variant="footnote" secondary>
            Trends, streaks and habit consistency
          </T>
        </View>
        <ChevronRight size={20} color={c.textTertiary} />
      </Tap>

      <SectionTitle>Habits</SectionTitle>
      <HabitChecklist completed={completed} onToggle={toggle} calorieTarget={calorieTarget ?? null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  quote: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md + 2, borderRadius: radius.lg, minHeight: 64 },
  tileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statsLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md + 2, borderRadius: radius.lg, marginTop: spacing.md, minHeight: 64 },
});
