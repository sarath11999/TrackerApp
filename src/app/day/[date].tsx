import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarX, RotateCcw } from 'lucide-react-native';
import { View } from 'react-native';
import { DateSwitcher } from '@/components/DatePickers';
import { confirmResetDay } from '@/components/DayDetails';
import { DayProgress } from '@/components/DayProgress';
import { HabitChecklist } from '@/components/HabitChecklist';
import { Button, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { getSetting } from '@/db/repo';
import { useDayHabits } from '@/hooks/useDayHabits';
import { useQuery } from '@/hooks/useQuery';
import { formatMedium, isValidDateKey } from '@/lib/date';
import { useApp } from '@/state/AppContext';

/** Edit any past day's habits. */
export default function DayScreen() {
  const { date: param } = useLocalSearchParams<{ date: string }>();
  const { db, bump, today } = useApp();
  const valid = isValidDateKey(param) && param <= today;
  const date = valid ? param : today;
  const { completed, tracked, toggle } = useDayHabits(date);
  const { data: calorieTarget } = useQuery((d) => getSetting<number | null>(d, 'calorieTarget', null), []);

  if (!valid) {
    return (
      <Screen noTopInset>
        <EmptyState icon={CalendarX} title="Invalid date" message="This day can't be edited." />
      </Screen>
    );
  }

  return (
    <Screen noTopInset>
      <Stack.Screen options={{ title: formatMedium(date) }} />
      <DateSwitcher date={date} onChange={(d) => router.setParams({ date: d })} />
      <DayProgress completed={completed} tracked={tracked} />
      <SectionTitle>Habits</SectionTitle>
      <HabitChecklist completed={completed} onToggle={toggle} calorieTarget={calorieTarget ?? null} />
      {tracked ? (
        <View style={{ marginTop: 8 }}>
          <Button title="Reset This Day" icon={RotateCcw} kind="destructive" onPress={() => confirmResetDay(db, date, bump)} />
        </View>
      ) : null}
    </Screen>
  );
}
