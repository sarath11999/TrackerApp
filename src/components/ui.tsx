/** Small themed building blocks shared by every screen. */
import * as Haptics from 'expo-haptics';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/state/AppContext';
import { radius, spacing, type } from '@/theme/theme';

export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* haptics unavailable */
  }
}

type Variant = keyof typeof type;

export function T({
  variant = 'body',
  color,
  secondary,
  tertiary,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; secondary?: boolean; tertiary?: boolean }) {
  const c = useColors();
  const fg = color ?? (tertiary ? c.textTertiary : secondary ? c.textSecondary : c.text);
  return <Text {...rest} style={[type[variant], { color: fg }, style]} />;
}

/** Scrollable screen with an iOS large title header. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  contentStyle,
  noTopInset,
  ...rest
}: {
  noTopInset?: boolean;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
} & ScrollViewProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const top = noTopInset ? spacing.md : insets.top + spacing.sm;
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <T variant="footnote" secondary style={styles.subtitle}>
            {subtitle.toUpperCase()}
          </T>
        ) : null}
        <T variant="largeTitle" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </T>
      </View>
      {right}
    </View>
  ) : null;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.background, paddingTop: top }, contentStyle]}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[{ paddingTop: top, paddingBottom: spacing.xxl * 2, paddingHorizontal: spacing.lg }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {header}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card }, padded && { padding: spacing.lg }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T variant="title3" accessibilityRole="header">
        {children}
      </T>
      {right}
    </View>
  );
}

/** Pressable with a gentle scale-down animation. */
export function Tap({ children, style, onPressIn, onPressOut, scaleTo = 0.97, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const [scale] = useState(() => new Animated.Value(1));
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <Pressable
      {...rest}
      // Outer layout props must live on the Pressable so the scaled view sizes correctly in rows.
      style={{ flex: flat.flex, alignSelf: flat.alignSelf }}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children as ReactNode}</Animated.View>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon: Icon,
  disabled,
  style,
  color,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'destructive' | 'plain';
  icon?: IconType;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const c = useColors();
  const accent = color ?? (kind === 'destructive' ? c.danger : c.tint);
  const bg = kind === 'primary' ? accent : kind === 'plain' ? 'transparent' : c.fill;
  const fg = kind === 'primary' ? '#FFFFFF' : accent;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {Icon ? <Icon size={18} color={fg} strokeWidth={2.4} /> : null}
      <T variant="headline" color={fg}>
        {title}
      </T>
    </Tap>
  );
}

export function IconButton({ icon: Icon, onPress, label, color, size = 22, filled }: { icon: IconType; onPress: () => void; label: string; color?: string; size?: number; filled?: boolean }) {
  const c = useColors();
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.iconButton, { backgroundColor: filled ? c.fill : 'transparent' }]}
    >
      <Icon size={size} color={color ?? c.tint} strokeWidth={2.2} />
    </Tap>
  );
}

export function Segmented<T extends string>({ options, value, onChange, style }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.fill }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) haptic();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: c.dark ? '#636366' : '#FFFFFF', ...styles.segmentActive }]}
          >
            <T variant="footnote" style={{ fontWeight: active ? '600' : '500' }} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({ label, value, sub, color, icon: Icon, style }: { label: string; value: string; sub?: string; color?: string; icon?: IconType; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Card style={[styles.tile, style]}>
      <View style={styles.tileHead}>
        {Icon ? <Icon size={15} color={color ?? c.textSecondary} strokeWidth={2.4} /> : null}
        <T variant="footnote" secondary numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </T>
      </View>
      <T variant="title2" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {sub ? (
        <T variant="caption" tertiary numberOfLines={2}>
          {sub}
        </T>
      ) : null}
    </Card>
  );
}

export function Grid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const rows: ReactNode[][] = [];
  items.forEach((child, i) => {
    if (i % columns === 0) rows.push([]);
    rows[rows.length - 1].push(child);
  });
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
          {row.map((child, j) => (
            <View key={j} style={{ flex: 1 }}>
              {child}
            </View>
          ))}
          {row.length < columns ? Array.from({ length: columns - row.length }).map((_, k) => <View key={`f${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: IconType; title: string; message?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.fill }]}>
        <Icon size={26} color={c.textSecondary} />
      </View>
      <T variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {message ? (
        <T variant="subhead" secondary style={{ textAlign: 'center' }}>
          {message}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: inset }} />;
}

/** Settings-style list row. */
export function ListRow({
  icon: Icon,
  iconBg,
  title,
  value,
  onPress,
  right,
  destructive,
  subtitle,
  titleStyle,
}: {
  icon?: IconType;
  iconBg?: string;
  title: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  subtitle?: string;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const c = useColors();
  const content = (
    <View style={styles.listRow}>
      {Icon ? (
        <View style={[styles.listIcon, { backgroundColor: iconBg ?? c.tint }]}>
          <Icon size={17} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T variant="body" color={destructive ? c.danger : undefined} style={titleStyle}>
          {title}
        </T>
        {subtitle ? (
          <T variant="footnote" secondary>
            {subtitle}
          </T>
        ) : null}
      </View>
      {value ? (
        <T variant="body" secondary numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </T>
      ) : null}
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => ({ backgroundColor: pressed ? c.fill : 'transparent' })}>
      {content}
    </Pressable>
  );
}

export function ProgressBar({ value, color, height = 8, track }: { value: number; color: string; height?: number; track?: string }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track ?? c.ringTrack, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg, gap: spacing.sm },
  subtitle: { fontWeight: '600', marginBottom: 2 },
  card: { borderRadius: radius.lg, borderCurve: 'continuous' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md },
  button: { minHeight: 50, borderRadius: radius.md, borderCurve: 'continuous', paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  segment: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingHorizontal: 4 },
  segmentActive: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tile: { gap: 4, padding: spacing.md + 2, flex: 1 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: 10, gap: spacing.md },
  listIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
