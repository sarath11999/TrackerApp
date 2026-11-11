import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Divider, haptic, Screen, SectionTitle, T } from '@/components/ui';
import { getSetting, setHabitTargets, setSetting } from '@/db/repo';
import { CATEGORIES, HABITS, renderHabitTitle, validateTargets } from '@/lib/habits';
import { goBack } from '@/lib/nav';
import { useApp, useColors } from '@/state/AppContext';
import { spacing } from '@/theme/theme';

/** Adjust numeric targets of the 16 fixed habits (habits themselves can't be renamed or removed). */
export default function GoalsScreen() {
  const c = useColors();
  const { db, bump, targets } = useApp();
  // Unsaved edits only; untouched habits show their stored targets.
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [calories, setCalories] = useState('');
  const stored = (id: string) => {
    const h = HABITS.find((x) => x.id === id)!;
    return (targets[id]?.length === h.defaultTargets.length ? targets[id] : h.defaultTargets).map(String);
  };
  const draft: Record<string, string[]> = Object.fromEntries(HABITS.map((h) => [h.id, edits[h.id] ?? stored(h.id)]));
  const setDraft = (fn: (d: Record<string, string[]>) => Record<string, string[]>) => setEdits(fn(draft));
  useEffect(() => {
    getSetting<number | null>(db, 'calorieTarget', null).then((v) => setCalories(v ? String(v) : ''));
  }, [db]);

  const save = async () => {
    const errors: string[] = [];
    const parsed: Record<string, number[]> = {};
    for (const h of HABITS) {
      if (!h.targetSpecs.length) continue;
      const vals = (draft[h.id] ?? []).map((s) => Number(s.replace(',', '.')));
      const err = validateTargets(h, vals);
      if (err) errors.push(`${renderHabitTitle(h)}: ${err}`);
      else parsed[h.id] = vals;
    }
    let cal: number | null = null;
    if (calories.trim()) {
      cal = Number(calories);
      if (!Number.isInteger(cal) || cal < 800 || cal > 8000) errors.push('Calorie target must be a whole number between 800 and 8000.');
    }
    if (errors.length) {
      Alert.alert('Check your goals', errors.join('\n'));
      return;
    }
    for (const [id, vals] of Object.entries(parsed)) await setHabitTargets(db, id, vals);
    await setSetting(db, 'calorieTarget', cal);
    haptic('success');
    bump();
    goBack('/settings');
  };

  const reset = () =>
    Alert.alert('Restore defaults?', 'All numeric targets return to the original values. Your history is not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          setEdits(Object.fromEntries(HABITS.map((h) => [h.id, h.defaultTargets.map(String)])));
        },
      },
    ]);

  return (
    <Screen noTopInset>
      <T variant="footnote" secondary style={{ marginHorizontal: spacing.sm }}>
        The 16 habits are fixed. You can tune their numeric targets here; past records keep their check marks.
      </T>

      {CATEGORIES.map((cat) => (
        <View key={cat.id}>
          <SectionTitle>{cat.title}</SectionTitle>
          <Card padded={false}>
            {HABITS.filter((h) => h.category === cat.id).map((h, i) => {
              const vals = draft[h.id] ?? [];
              const preview = renderHabitTitle(h, vals.map(Number).every(Number.isFinite) ? vals.map(Number) : undefined);
              return (
                <View key={h.id}>
                  {i > 0 ? <Divider inset={spacing.lg} /> : null}
                  <View style={styles.row}>
                    <T variant="body" style={{ flex: 1 }} color={h.targetSpecs.length || h.id === 'calories' ? c.text : c.textSecondary}>
                      {preview}
                    </T>
                    {h.targetSpecs.map((spec, k) => (
                      <View key={k} style={styles.field}>
                        <TextInput
                          value={vals[k] ?? ''}
                          onChangeText={(t) => setDraft((d) => ({ ...d, [h.id]: Object.assign([...(d[h.id] ?? [])], { [k]: t.replace(/[^0-9.,]/g, '') }) }))}
                          keyboardType="decimal-pad"
                          style={[styles.input, { color: c.text, backgroundColor: c.fill }]}
                          accessibilityLabel={spec.label}
                          maxLength={6}
                        />
                        {spec.unit ? (
                          <T variant="caption" tertiary>
                            {spec.unit}
                          </T>
                        ) : null}
                      </View>
                    ))}
                    {h.id === 'calories' ? (
                      <View style={styles.field}>
                        <TextInput
                          value={calories}
                          onChangeText={(t) => setCalories(t.replace(/[^0-9]/g, ''))}
                          placeholder="kcal"
                          placeholderTextColor={c.textTertiary}
                          keyboardType="number-pad"
                          style={[styles.input, { color: c.text, backgroundColor: c.fill, width: 70 }]}
                          accessibilityLabel="Daily calorie target in kcal"
                          maxLength={4}
                        />
                        <T variant="caption" tertiary>
                          kcal
                        </T>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
        <Button title="Save Goals" onPress={save} />
        <Button title="Restore Defaults" kind="secondary" onPress={reset} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10, minHeight: 52 },
  field: { alignItems: 'center', gap: 2 },
  input: { width: 62, minHeight: 36, borderRadius: 8, textAlign: 'center', fontSize: 16, fontVariant: ['tabular-nums'] },
});
