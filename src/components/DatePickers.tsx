import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { addDays, parseDateKey, relativeLabel, toDateKey, type DateKey } from '@/lib/date';
import { useApp, useColors } from '@/state/AppContext';
import { radius, spacing } from '@/theme/theme';
import { Button, haptic, IconButton, T } from './ui';

/** Modal calendar for picking a date (no future dates by default). */
export function DatePickerModal({
  visible,
  value,
  onChange,
  onClose,
  maxDate,
}: {
  visible: boolean;
  value: DateKey;
  onChange: (d: DateKey) => void;
  onClose: () => void;
  maxDate?: DateKey;
}) {
  if (!visible) return null;
  return <DatePickerSheet value={value} onChange={onChange} onClose={onClose} maxDate={maxDate} />;
}

/** Mounted only while open, so the draft always starts from the current value. */
function DatePickerSheet({ value, onChange, onClose, maxDate }: { value: DateKey; onChange: (d: DateKey) => void; onClose: () => void; maxDate?: DateKey }) {
  const c = useColors();
  const [draft, setDraft] = useState(value);

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={parseDateKey(value)}
        mode="date"
        maximumDate={maxDate ? parseDateKey(maxDate) : undefined}
        onChange={(e: DateTimePickerEvent, d?: Date) => {
          onClose();
          if (e.type === 'set' && d) onChange(toDateKey(d));
        }}
      />
    );
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close date picker">
        <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={() => undefined}>
          <DateTimePicker
            value={parseDateKey(draft)}
            mode="date"
            display="inline"
            themeVariant={c.dark ? 'dark' : 'light'}
            accentColor={c.tint}
            maximumDate={maxDate ? parseDateKey(maxDate) : undefined}
            onChange={(_: DateTimePickerEvent, d?: Date) => d && setDraft(toDateKey(d))}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Cancel" kind="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Done"
              onPress={() => {
                onChange(draft);
                onClose();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** ‹ Today › control for moving between days. */
export function DateSwitcher({ date, onChange }: { date: DateKey; onChange: (d: DateKey) => void }) {
  const c = useColors();
  const { today } = useApp();
  const [picking, setPicking] = useState(false);
  const isToday = date === today;
  const go = (n: number) => {
    const next = addDays(date, n);
    if (next > today) return;
    haptic();
    onChange(next);
  };
  return (
    <View style={[styles.switcher, { backgroundColor: c.card }]}>
      <IconButton icon={ChevronLeft} label="Previous day" onPress={() => go(-1)} />
      <Pressable onPress={() => setPicking(true)} style={styles.center} accessibilityRole="button" accessibilityLabel={`Selected date ${relativeLabel(date, today)}. Tap to choose a date`}>
        <CalendarDays size={16} color={c.tint} />
        <T variant="headline" numberOfLines={1}>
          {relativeLabel(date, today)}
        </T>
      </Pressable>
      {!isToday ? (
        <Pressable onPress={() => onChange(today)} style={[styles.todayChip, { backgroundColor: c.tint + '1F' }]} accessibilityRole="button" accessibilityLabel="Jump to today">
          <T variant="footnote" color={c.tint} style={{ fontWeight: '600' }}>
            Today
          </T>
        </Pressable>
      ) : null}
      <View style={{ opacity: isToday ? 0.3 : 1 }}>
        <IconButton icon={ChevronRight} label="Next day" onPress={() => go(1)} />
      </View>
      <DatePickerModal visible={picking} value={date} maxDate={today} onChange={onChange} onClose={() => setPicking(false)} />
    </View>
  );
}

/** Form row that shows a date and opens the picker. */
export function DateField({ label, value, onChange, maxDate }: { label: string; value: DateKey; onChange: (d: DateKey) => void; maxDate?: DateKey }) {
  const c = useColors();
  const { today } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.field} accessibilityRole="button" accessibilityLabel={`${label}: ${relativeLabel(value, today)}`}>
        <T variant="body">{label}</T>
        <View style={[styles.fieldValue, { backgroundColor: c.fill }]}>
          <T variant="body" color={c.tint}>
            {relativeLabel(value, today)}
          </T>
        </View>
      </Pressable>
      <DatePickerModal visible={open} value={value} onChange={onChange} onClose={() => setOpen(false)} maxDate={maxDate} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  switcher: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingHorizontal: 4, minHeight: 52, marginBottom: spacing.lg },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  todayChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: spacing.lg },
  fieldValue: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
});
