import { StyleSheet, View } from 'react-native';
import { TOTAL_HABITS } from '@/lib/habits';
import { completionPercent, statusForPercent } from '@/lib/stats';
import { useColors } from '@/state/AppContext';
import { spacing } from '@/theme/theme';
import { CategorySummary } from './HabitChecklist';
import { ProgressRing } from './ProgressRing';
import { Card, T } from './ui';

/** Hero card: big ring with %, completed count, and per-category indicators. */
export function DayProgress({ completed, tracked, aside }: { completed: Set<string>; tracked: boolean; aside?: React.ReactNode }) {
  const c = useColors();
  const count = completed.size;
  const pct = completionPercent(count);
  const status = statusForPercent(pct);
  const ringColor = status === 'green' ? c.status.green : c.tint;
  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={styles.top}>
        <ProgressRing value={pct} size={150} stroke={16} color={ringColor} colorEnd={status === 'green' ? '#A8F06C' : '#5AC8FA'} accessibilityLabel={`Daily progress ${Math.round(pct)} percent`}>
          <T variant="title1" style={{ fontVariant: ['tabular-nums'] }}>
            {Math.round(pct)}%
          </T>
          <T variant="caption" secondary>
            {count} / {TOTAL_HABITS} habits
          </T>
        </ProgressRing>
        <View style={styles.aside}>
          <T variant="footnote" secondary style={{ fontWeight: '600' }}>
            DAILY PROGRESS
          </T>
          <T variant="title2" style={{ fontVariant: ['tabular-nums'] }}>
            {count} / {TOTAL_HABITS}
          </T>
          <T variant="footnote" secondary>
            {!tracked ? 'Nothing logged yet' : count === TOTAL_HABITS ? 'Perfect day! 🎉' : count >= 13 ? 'Streak day secured' : `${13 - count} more for a streak day`}
          </T>
          {aside}
        </View>
      </View>
      <CategorySummary completed={completed} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  aside: { flex: 1, gap: 4 },
});
