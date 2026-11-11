import { Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { DateField } from '@/components/DatePickers';
import { goBack } from '@/lib/nav';
import { Button, Card, Divider, haptic, T } from '@/components/ui';
import { addExpense, deleteExpense, getExpense, updateExpense, validateExpense } from '@/db/repo';
import { centsToInput, EXPENSE_CATEGORIES, parseDollarsToCents, type ExpenseCategory } from '@/lib/money';
import { useApp, useColors } from '@/state/AppContext';
import { EXPENSE_COLORS, radius, spacing } from '@/theme/theme';

/** Add or edit an expense (modal). */
export default function ExpenseScreen() {
  const c = useColors();
  const { db, bump, today } = useApp();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = idParam ? Number(idParam) : null;
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [loaded, setLoaded] = useState(id === null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id === null) return;
    getExpense(db, id).then((e) => {
      if (!e) {
        Alert.alert('Not found', 'This transaction no longer exists.');
        goBack('/money');
        return;
      }
      setAmount(centsToInput(e.amountCents));
      setCategory(e.category);
      setDescription(e.description);
      setDate(e.date);
      setLoaded(true);
    });
  }, [db, id]);

  const save = async () => {
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      Alert.alert('Invalid amount', 'Enter a dollar amount like 12.50 (up to 2 decimal places).');
      return;
    }
    const input = { date, amountCents: cents, category, description };
    const err = validateExpense(input);
    if (err) {
      Alert.alert('Check the details', err);
      return;
    }
    setSaving(true);
    try {
      if (id === null) await addExpense(db, input);
      else await updateExpense(db, id, input);
      haptic('success');
      bump();
      goBack('/money');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (id === null) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(db, id);
          haptic('warning');
          bump();
          goBack('/money');
        },
      },
    ]);
  };

  const preview = parseDollarsToCents(amount);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: id === null ? 'New Expense' : 'Edit Expense',
          headerStyle: { backgroundColor: c.background },
          headerLeft: () => (
            <Pressable onPress={() => goBack('/money')} hitSlop={10} accessibilityRole="button">
              <T variant="body" color={c.tint}>
                Cancel
              </T>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} disabled={saving || !loaded} hitSlop={10} accessibilityRole="button">
              <T variant="headline" color={c.tint}>
                Save
              </T>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
          <T variant="footnote" secondary style={{ fontWeight: '600' }}>
            AMOUNT (USD)
          </T>
          <View style={styles.amountRow}>
            <T variant="largeTitle" color={c.textSecondary}>
              $
            </T>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={c.textTertiary}
              keyboardType="decimal-pad"
              autoFocus={id === null}
              style={[styles.amountInput, { color: c.text, width: Math.max(130, (amount.length || 4) * 30) }]}
              accessibilityLabel="Amount in US dollars"
              maxLength={12}
            />
          </View>
          {amount && preview === null ? (
            <T variant="footnote" color={c.danger}>
              Use up to 2 decimal places
            </T>
          ) : null}
        </Card>

        <View>
          <T variant="footnote" secondary style={styles.label}>
            CATEGORY
          </T>
          <View style={styles.chips}>
            {EXPENSE_CATEGORIES.map((cat) => {
              const active = cat === category;
              const color = EXPENSE_COLORS[cat];
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    haptic();
                    setCategory(cat);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, { backgroundColor: active ? color : c.card, borderColor: active ? color : c.separator }]}
                >
                  <T variant="subhead" color={active ? '#FFFFFF' : c.text} style={{ fontWeight: active ? '600' : '400' }}>
                    {cat}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card padded={false}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={c.textTertiary}
            style={[styles.input, { color: c.text }]}
            maxLength={200}
            accessibilityLabel="Description"
            returnKeyType="done"
          />
          <Divider inset={spacing.lg} />
          <DateField label="Date" value={date} onChange={setDate} maxDate={today} />
        </Card>

        <Button title={id === null ? 'Add Expense' : 'Save Changes'} onPress={save} disabled={saving || !loaded} color={c.money} />
        {id !== null ? <Button title="Delete Transaction" icon={Trash2} kind="destructive" onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  amountInput: { fontSize: 48, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  label: { fontWeight: '600', marginBottom: spacing.sm, marginLeft: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1 },
  input: { fontSize: 17, paddingHorizontal: spacing.lg, minHeight: 52 },
});
