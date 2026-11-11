import { Scale, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Line } from '@/components/Charts';
import { DateField } from '@/components/DatePickers';
import { Button, Card, Divider, EmptyState, Grid, haptic, ProgressBar, Screen, SectionTitle, StatTile, T } from '@/components/ui';
import { deleteWeight, getSetting, getWeights, saveWeight, setSetting, validateWeight, WeightExistsError, type WeightEntry } from '@/db/repo';
import { useQuery } from '@/hooks/useQuery';
import { formatMedium, formatShort } from '@/lib/date';
import { round1, weightChangeOver, weightProgress } from '@/lib/stats';
import { useApp, useColors } from '@/state/AppContext';
import { spacing } from '@/theme/theme';

const kg = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${round1(n).toFixed(1)} kg`);
const signedKg = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)} kg`);

export default function WeightScreen() {
  const c = useColors();
  const { db, bump, today } = useApp();
  const { data: entries } = useQuery((d) => getWeights(d), []);
  const { data: target } = useQuery((d) => getSetting<number | null>(d, 'targetWeightKg', null), []);
  const [input, setInput] = useState('');
  const [date, setDate] = useState(today);
  const [targetInput, setTargetInput] = useState<string | null>(null);

  const list = entries ?? [];
  const progress = weightProgress(list, target ?? null);
  const week = weightChangeOver(list, 7, today);
  const month = weightChangeOver(list, 30, today);

  const parse = (s: string) => Number(s.replace(',', '.'));

  const add = async (replace = false) => {
    const w = parse(input);
    const err = validateWeight(date, w);
    if (!input || err) {
      Alert.alert('Invalid weight', err ?? 'Enter your weight in kg.');
      return;
    }
    try {
      await saveWeight(db, date, w, replace);
      haptic('success');
      setInput('');
      bump();
    } catch (e) {
      if (e instanceof WeightExistsError) {
        Alert.alert('Replace entry?', `You already logged ${kg(e.existing.weightKg)} on ${formatMedium(date)}. Replace it with ${kg(w)}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => add(true) },
        ]);
      } else Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  const saveTarget = async () => {
    if (targetInput === null) return;
    if (targetInput.trim() === '') {
      await setSetting(db, 'targetWeightKg', null);
    } else {
      const v = parse(targetInput);
      if (validateWeight(today, v)) {
        Alert.alert('Invalid target', 'Enter a target between 20 and 400 kg.');
        return;
      }
      await setSetting(db, 'targetWeightKg', round1(v));
    }
    setTargetInput(null);
    bump();
  };

  const remove = (e: WeightEntry) =>
    Alert.alert('Delete entry?', `${kg(e.weightKg)} on ${formatMedium(e.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWeight(db, e.id);
          bump();
        },
      },
    ]);

  const values = list.map((e) => e.weightKg);
  const minV = values.length ? Math.floor(Math.min(...values, target ?? Infinity) - 2) : 0;
  const maxV = values.length ? Math.ceil(Math.max(...values, target ?? -Infinity) + 2) : 100;

  return (
    <Screen noTopInset>
      <Card padded={false}>
        <View style={styles.inputRow}>
          <Scale size={20} color={c.weight} />
          <TextInput
            value={input}
            onChangeText={(t) => setInput(t.replace(/[^0-9.,]/g, ''))}
            placeholder="Current weight"
            placeholderTextColor={c.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.input, { color: c.text }]}
            accessibilityLabel="Weight in kilograms"
            maxLength={6}
          />
          <T variant="body" secondary>
            kg
          </T>
        </View>
        <Divider inset={spacing.lg} />
        <DateField label="Date" value={date} onChange={setDate} maxDate={today} />
        <View style={{ padding: spacing.lg, paddingTop: spacing.sm }}>
          <Button title="Log Weight" onPress={() => add()} color={c.weight} />
        </View>
      </Card>

      {list.length === 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <EmptyState icon={Scale} title="No weight entries" message="Log your weight to see history, trends and progress toward your target." />
        </Card>
      ) : (
        <>
          <SectionTitle>Overview</SectionTitle>
          <Grid columns={2}>
            <StatTile label="Current" value={kg(progress.current?.weightKg)} icon={Scale} color={c.weight} sub={progress.current ? formatMedium(progress.current.date) : undefined} />
            <StatTile label="Total change" value={signedKg(progress.changeKg)} icon={progress.changeKg !== null && progress.changeKg > 0 ? TrendingUp : TrendingDown} sub={progress.start ? `Since ${formatShort(progress.start.date)}` : undefined} />
            <StatTile label="Last 7 days" value={signedKg(week)} sub={week === null ? 'Need an entry 7+ days ago' : undefined} />
            <StatTile label="Last 30 days" value={signedKg(month)} sub={month === null ? 'Need an entry 30+ days ago' : undefined} />
          </Grid>
        </>
      )}

      <SectionTitle>Target</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Target size={18} color={c.weight} />
            <T variant="headline">Target weight</T>
          </View>
          {targetInput === null ? (
            <Pressable onPress={() => setTargetInput(target ? String(target) : '')} accessibilityRole="button" hitSlop={10}>
              <T variant="body" color={c.tint}>
                {target ? kg(target) : 'Set'}
              </T>
            </Pressable>
          ) : null}
        </View>
        {targetInput !== null ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <TextInput
              value={targetInput}
              onChangeText={(t) => setTargetInput(t.replace(/[^0-9.,]/g, ''))}
              placeholder="e.g. 72.5 (empty to clear)"
              placeholderTextColor={c.textTertiary}
              keyboardType="decimal-pad"
              autoFocus
              style={[styles.targetInput, { color: c.text, backgroundColor: c.fill }]}
              accessibilityLabel="Target weight in kilograms"
            />
            <Button title="Save" onPress={saveTarget} style={{ minHeight: 44 }} />
          </View>
        ) : null}
        {target && progress.current ? (
          <>
            <ProgressBar value={progress.progressPercent ?? 0} color={c.weight} height={10} />
            <View style={styles.rowBetween}>
              <T variant="footnote" secondary>
                Start {kg(progress.start?.weightKg)}
              </T>
              <T variant="footnote" style={{ fontWeight: '600' }}>
                {Math.round(progress.progressPercent ?? 0)}%
              </T>
              <T variant="footnote" secondary>
                Goal {kg(target)}
              </T>
            </View>
            <T variant="subhead" secondary>
              {progress.remainingKg === 0
                ? 'Target reached! 🎉'
                : progress.remainingKg! > 0
                  ? `${progress.remainingKg!.toFixed(1)} kg to lose`
                  : `${Math.abs(progress.remainingKg!).toFixed(1)} kg to gain`}
            </T>
          </>
        ) : (
          <T variant="footnote" tertiary>
            {target ? 'Log a weight to see progress.' : 'Set a target to track progress.'}
          </T>
        )}
      </Card>

      {list.length >= 2 ? (
        <>
          <SectionTitle>Weight Over Time</SectionTitle>
          <Card>
            <Line data={list.map((e) => ({ value: e.weightKg, label: formatShort(e.date) }))} color={c.weight} minValue={minV} maxValue={maxV} formatY={(v) => `${Math.round(Number(v))}`} />
          </Card>
        </>
      ) : null}

      {list.length > 0 ? (
        <>
          <SectionTitle>History</SectionTitle>
          <Card padded={false}>
            {[...list].reverse().map((e, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? round1(e.weightKg - prev.weightKg) : null;
              return (
                <View key={e.id}>
                  {i > 0 ? <Divider inset={spacing.lg} /> : null}
                  <View style={styles.histRow}>
                    <T variant="body" style={{ flex: 1 }}>
                      {formatMedium(e.date)}
                    </T>
                    {delta !== null ? (
                      <T variant="footnote" color={delta > 0 ? c.danger : delta < 0 ? c.success : c.textSecondary}>
                        {signedKg(delta)}
                      </T>
                    ) : null}
                    <T variant="headline" style={{ width: 84, textAlign: 'right' }}>
                      {kg(e.weightKg)}
                    </T>
                    <Pressable onPress={() => remove(e)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete weight on ${formatMedium(e.date)}`} style={{ padding: 6 }}>
                      <Trash2 size={18} color={c.textTertiary} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 60 },
  input: { flex: 1, fontSize: 22, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetInput: { flex: 1, fontSize: 17, borderRadius: 10, paddingHorizontal: 12, minHeight: 44 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.sm, minHeight: 52 },
});
