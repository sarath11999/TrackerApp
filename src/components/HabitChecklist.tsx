import { Apple, BookOpen, Check, ChevronDown, Dumbbell, MoonStar } from 'lucide-react-native';
import { memo, useEffect, useState } from 'react';
import { Animated, LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { CATEGORIES, habitsInCategory, renderHabitTitle, type CategoryId, type HabitDefinition } from '@/lib/habits';
import { useApp, useColors } from '@/state/AppContext';
import { radius, spacing } from '@/theme/theme';
import { Card, Divider, haptic, ProgressBar, T, type IconType } from './ui';

export const CATEGORY_ICONS: Record<CategoryId, IconType> = {
  fitness: Dumbbell,
  nutrition: Apple,
  study: BookOpen,
  selfcare: MoonStar,
};

function Checkbox({ checked, color }: { checked: boolean; color: string }) {
  const c = useColors();
  const [scale] = useState(() => new Animated.Value(checked ? 1 : 0));
  useEffect(() => {
    Animated.spring(scale, { toValue: checked ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 12 }).start();
  }, [checked, scale]);
  return (
    <View style={[styles.checkbox, { borderColor: checked ? color : c.textTertiary }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.checkFill, { backgroundColor: color, transform: [{ scale }], opacity: scale }]}>
        <Check size={16} color="#FFFFFF" strokeWidth={3.5} />
      </Animated.View>
    </View>
  );
}

const HabitRow = memo(function HabitRow({
  def,
  checked,
  color,
  title,
  subtitle,
  onToggle,
}: {
  def: HabitDefinition;
  checked: boolean;
  color: string;
  title: string;
  subtitle?: string;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        haptic(checked ? 'light' : 'medium');
        onToggle(def.id, !checked);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.fill }]}
    >
      <Checkbox checked={checked} color={color} />
      <View style={{ flex: 1 }}>
        <T variant="body" color={checked ? c.textSecondary : c.text} style={checked ? styles.done : undefined}>
          {title}
        </T>
        {subtitle ? (
          <T variant="footnote" tertiary>
            {subtitle}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
});

function Section({
  category,
  completed,
  onToggle,
  calorieTarget,
}: {
  category: (typeof CATEGORIES)[number];
  completed: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  calorieTarget: number | null;
}) {
  const c = useColors();
  const { targets } = useApp();
  const [open, setOpen] = useState(true);
  const [rot] = useState(() => new Animated.Value(1));
  const habits = habitsInCategory(category.id);
  const done = habits.filter((h) => completed.has(h.id)).length;
  const color = c.category[category.id];
  const Icon = CATEGORY_ICONS[category.id];

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    Animated.timing(rot, { toValue: open ? 0 : 1, duration: 220, useNativeDriver: true }).start();
    setOpen(!open);
  };

  return (
    <Card padded={false} style={{ marginBottom: spacing.md, overflow: 'hidden' }}>
      <Pressable onPress={toggleOpen} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${category.title}, ${done} of ${habits.length} complete`} style={styles.sectionHead}>
        <View style={[styles.catIcon, { backgroundColor: color + '22' }]}>
          <Icon size={18} color={color} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T variant="headline">{category.title}</T>
            <T variant="subhead" color={done === habits.length ? color : c.textSecondary} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {done}/{habits.length}
            </T>
          </View>
          <ProgressBar value={(done / habits.length) * 100} color={color} height={5} />
        </View>
        <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] }}>
          <ChevronDown size={20} color={c.textTertiary} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View>
          {habits.map((h) => (
            <View key={h.id}>
              <Divider inset={spacing.lg + 40} />
              <HabitRow
                def={h}
                checked={completed.has(h.id)}
                color={color}
                title={renderHabitTitle(h, targets[h.id])}
                subtitle={h.id === 'calories' ? (calorieTarget ? `Target: ${calorieTarget.toLocaleString('en-US')} kcal` : 'Set a calorie target in Settings → Daily Goals') : undefined}
                onToggle={onToggle}
              />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function HabitChecklist({ completed, onToggle, calorieTarget }: { completed: Set<string>; onToggle: (id: string, checked: boolean) => void; calorieTarget: number | null }) {
  return (
    <View>
      {CATEGORIES.map((cat) => (
        <Section key={cat.id} category={cat} completed={completed} onToggle={onToggle} calorieTarget={calorieTarget} />
      ))}
    </View>
  );
}

/** Compact per-category counts (e.g. "Fitness 3/4"). */
export function CategorySummary({ completed }: { completed: Set<string> }) {
  const c = useColors();
  return (
    <View style={styles.summary}>
      {CATEGORIES.map((cat) => {
        const hs = habitsInCategory(cat.id);
        const done = hs.filter((h) => completed.has(h.id)).length;
        const color = c.category[cat.id];
        const Icon = CATEGORY_ICONS[cat.id];
        return (
          <View key={cat.id} style={styles.summaryItem} accessible accessibilityLabel={`${cat.shortTitle} ${done} of ${hs.length}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon size={12} color={color} strokeWidth={2.6} />
              <T variant="caption" secondary numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1 }}>
                {cat.shortTitle}
              </T>
            </View>
            <T variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
              {done}
              <T variant="footnote" tertiary>
                /{hs.length}
              </T>
            </T>
            <ProgressBar value={(done / hs.length) * 100} color={color} height={4} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, minHeight: 52 },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, overflow: 'hidden' },
  checkFill: { alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  done: { textDecorationLine: 'line-through' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 64 },
  catIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', gap: spacing.sm },
  summaryItem: { flex: 1, gap: 4 },
});
