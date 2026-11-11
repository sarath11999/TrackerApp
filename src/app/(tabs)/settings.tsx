import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Bell,
  BedDouble,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Moon,
  Receipt,
  Scale,
  Sunrise,
  Target,
  Trash2,
  Upload,
  User,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Card, Divider, haptic, ListRow, Screen, SectionTitle, Segmented, T, type IconType } from '@/components/ui';
import { buildBackup, buildExpensesCsv, buildHabitsCsv, parseBackupJson, restoreBackup } from '@/db/backup';
import { clearData, getDay, getSetting, setSetting, type ClearScope } from '@/db/repo';
import { applyReminders, DEFAULT_REMINDERS, formatTime, normalizeReminders, REMINDER_INFO, requestPermission, type ReminderId, type Reminders } from '@/lib/notifications';
import { useApp, useColors, type ThemePreference } from '@/state/AppContext';
import { spacing } from '@/theme/theme';

const REMINDER_ICONS: Record<ReminderId, { icon: IconType; color: string }> = {
  morning: { icon: Sunrise, color: '#FF9500' },
  evening: { icon: Bell, color: '#5856D6' },
  bedtime: { icon: BedDouble, color: '#AF52DE' },
  expense: { icon: Receipt, color: '#34C759' },
};

async function shareText(filename: string, text: string, mimeType: string, uti: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Sharing unavailable', `The file was saved to the app cache:\n${file.uri}`);
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: filename });
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function SettingsScreen() {
  const c = useColors();
  const { db, bump, today, themePreference, setThemePreference, name, setName } = useApp();
  const [reminders, setReminders] = useState<Reminders>(DEFAULT_REMINDERS);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSetting(db, 'reminders', null).then((r) => setReminders(normalizeReminders(r)));
  }, [db]);

  const persistReminders = async (next: Reminders) => {
    setReminders(next);
    await setSetting(db, 'reminders', next);
    const day = await getDay(db, today);
    await applyReminders(next, today, day.completed.length).catch(() => undefined);
  };

  const toggleReminder = async (id: ReminderId, enabled: boolean) => {
    if (enabled) {
      const res = await requestPermission();
      if (res !== 'granted') {
        Alert.alert(
          'Notifications are off',
          res === 'unavailable'
            ? 'Notifications are not available on this device.'
            : 'TrackerApp does not have permission to send notifications. You can enable them in the iOS Settings app.',
          res === 'unavailable' ? [{ text: 'OK' }] : [{ text: 'Not Now', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
        );
        return;
      }
    }
    haptic();
    await persistReminders({ ...reminders, [id]: { ...reminders[id], enabled } });
  };

  const setTime = (id: ReminderId, d: Date) => persistReminders({ ...reminders, [id]: { ...reminders[id], hour: d.getHours(), minute: d.getMinutes() } });

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => run(async () => shareText(`trackerapp-backup-${stamp()}.json`, JSON.stringify(await buildBackup(db), null, 2), 'application/json', 'public.json'));
  const exportHabitsCsv = () => run(async () => shareText(`trackerapp-habits-${stamp()}.csv`, await buildHabitsCsv(db), 'text/csv', 'public.comma-separated-values-text'));
  const exportExpensesCsv = () => run(async () => shareText(`trackerapp-expenses-${stamp()}.csv`, await buildExpensesCsv(db), 'text/csv', 'public.comma-separated-values-text'));

  const importJson = () =>
    run(async () => {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const text = await new File(res.assets[0].uri).text();
      const parsed = parseBackupJson(text);
      if (!parsed.ok) {
        Alert.alert('Invalid backup', parsed.errors.join('\n'));
        return;
      }
      const d = parsed.data;
      const days = new Set(d.completions.map((x) => x.date)).size;
      Alert.alert(
        'Restore backup?',
        `This backup contains ${days} tracked days, ${d.expenses.length} expenses and ${d.weights.length} weight entries${d.exportedAt ? ` (exported ${d.exportedAt.slice(0, 10)})` : ''}.\n\nAll current data will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace & Restore',
            style: 'destructive',
            onPress: () =>
              run(async () => {
                await restoreBackup(db, d);
                haptic('success');
                bump();
                setReminders(normalizeReminders(d.settings.reminders));
                Alert.alert('Restored', 'Your data has been restored.');
              }),
          },
        ],
      );
    });

  const confirmClear = (scope: ClearScope, label: string) =>
    Alert.alert(`Delete ${label}?`, 'This permanently deletes the data from this device and cannot be undone. Consider exporting a backup first.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await clearData(db, scope);
            haptic('warning');
            if (scope === 'all') {
              setReminders(DEFAULT_REMINDERS);
              await applyReminders(DEFAULT_REMINDERS, today, 0).catch(() => undefined);
            }
            bump();
          }),
      },
    ]);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen title="Settings">
      <Card padded={false}>
        <View style={styles.nameRow}>
          <View style={[styles.icon, { backgroundColor: c.tint }]}>
            <User size={17} color="#FFF" strokeWidth={2.4} />
          </View>
          <TextInput
            value={nameDraft ?? name}
            onChangeText={setNameDraft}
            onEndEditing={() => {
              if (nameDraft !== null) setName(nameDraft.trim());
              setNameDraft(null);
            }}
            placeholder="Your name (for greetings)"
            placeholderTextColor={c.textTertiary}
            style={[styles.nameInput, { color: c.text }]}
            maxLength={30}
            returnKeyType="done"
            accessibilityLabel="Your name"
          />
        </View>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Moon size={18} color={c.textSecondary} />
          <T variant="body">Theme</T>
        </View>
        <Segmented<ThemePreference>
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={themePreference}
          onChange={setThemePreference}
        />
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card padded={false}>
        {(Object.keys(REMINDER_INFO) as ReminderId[]).map((id, i) => {
          const r = reminders[id];
          const { icon: Icon, color } = REMINDER_ICONS[id];
          const date = new Date(2000, 0, 1, r.hour, r.minute);
          return (
            <View key={id}>
              {i > 0 ? <Divider inset={58} /> : null}
              <View style={styles.reminderRow}>
                <View style={[styles.icon, { backgroundColor: color }]}>
                  <Icon size={17} color="#FFF" strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="body">{REMINDER_INFO[id].title}</T>
                  <T variant="footnote" secondary>
                    {REMINDER_INFO[id].description}
                  </T>
                </View>
                {r.enabled ? <TimeButton date={date} onChange={(d) => setTime(id, d)} /> : null}
                <Switch value={r.enabled} onValueChange={(v) => toggleReminder(id, v)} accessibilityLabel={`${REMINDER_INFO[id].title} reminder`} />
              </View>
            </View>
          );
        })}
      </Card>
      <T variant="caption" tertiary style={styles.footnote}>
        Permission is requested only when you turn a reminder on. Reminders are local to this iPhone.
      </T>

      <SectionTitle>Goals & Tracking</SectionTitle>
      <Card padded={false}>
        <ListRow icon={Target} iconBg="#FF2D55" title="Daily Goals" subtitle="Adjust habit targets" onPress={() => router.push('/goals')} right={<ChevronRight size={18} color={c.textTertiary} />} />
        <Divider inset={58} />
        <ListRow icon={Scale} iconBg={c.weight} title="Weight Tracking" onPress={() => router.push('/weight')} right={<ChevronRight size={18} color={c.textTertiary} />} />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card padded={false}>
        <ListRow icon={FileJson} iconBg="#007AFF" title="Export Backup (JSON)" subtitle="Full backup you can restore later" onPress={exportJson} right={<Download size={18} color={c.textTertiary} />} />
        <Divider inset={58} />
        <ListRow icon={FileSpreadsheet} iconBg="#34C759" title="Export Habits (CSV)" onPress={exportHabitsCsv} right={<Download size={18} color={c.textTertiary} />} />
        <Divider inset={58} />
        <ListRow icon={FileSpreadsheet} iconBg="#FF9500" title="Export Expenses (CSV)" onPress={exportExpensesCsv} right={<Download size={18} color={c.textTertiary} />} />
        <Divider inset={58} />
        <ListRow icon={Upload} iconBg="#5856D6" title="Import Backup (JSON)" subtitle="Validated before anything is replaced" onPress={importJson} right={<ChevronRight size={18} color={c.textTertiary} />} />
      </Card>

      <SectionTitle>Danger Zone</SectionTitle>
      <Card padded={false}>
        <ListRow icon={Trash2} iconBg={c.danger} title="Clear Habit Records" destructive onPress={() => confirmClear('habits', 'all habit records')} />
        <Divider inset={58} />
        <ListRow icon={Trash2} iconBg={c.danger} title="Clear Expenses" destructive onPress={() => confirmClear('expenses', 'all expenses')} />
        <Divider inset={58} />
        <ListRow icon={Trash2} iconBg={c.danger} title="Clear Weight History" destructive onPress={() => confirmClear('weights', 'all weight entries')} />
        <Divider inset={58} />
        <ListRow icon={Trash2} iconBg={c.danger} title="Erase All Data" destructive onPress={() => confirmClear('all', 'ALL data and settings')} />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card padded={false}>
        <ListRow icon={Info} iconBg="#8E8E93" title="TrackerApp" value={`Version ${version}`} />
      </Card>
      <T variant="caption" tertiary style={styles.footnote}>
        All data is stored privately on this device in SQLite. No account or internet connection required.
      </T>
    </Screen>
  );
}

function TimeButton({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={date}
        mode="time"
        display="compact"
        themeVariant={c.dark ? 'dark' : 'light'}
        accentColor={c.tint}
        onChange={(_: DateTimePickerEvent, d?: Date) => d && onChange(d)}
      />
    );
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.timeChip, { backgroundColor: c.fill }]} accessibilityRole="button">
        <T variant="subhead">{formatTime(date.getHours(), date.getMinutes())}</T>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="time"
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setOpen(false);
            if (e.type === 'set' && d) onChange(d);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
  nameInput: { flex: 1, fontSize: 17, minHeight: 44 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10, minHeight: 60 },
  footnote: { marginTop: spacing.sm, marginHorizontal: spacing.lg },
  timeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
});
