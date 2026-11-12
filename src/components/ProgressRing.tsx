import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useColors } from '@/state/AppContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// On web, Animated injects `collapsable={false}` into the raw <circle> element (React DOM warning), so draw it statically there.
const IS_WEB = Platform.OS === 'web';

let gradientSeq = 0;

/** Animated circular progress ring (0–100) with optional gradient and center content. */
export function ProgressRing({
  value,
  size = 180,
  stroke = 18,
  color,
  colorEnd,
  track,
  children,
  accessibilityLabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  colorEnd?: string;
  track?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const [id] = useState(() => `ring${gradientSeq++}`);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const [anim] = useState(() => new Animated.Value(clamped));

  useEffect(() => {
    if (IS_WEB) return;
    Animated.timing(anim, { toValue: clamped, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [clamped, anim]);

  const dashoffset = anim.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} />
            <Stop offset="1" stopColor={colorEnd ?? color} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.ringTrack} strokeWidth={stroke} fill="none" />
        {IS_WEB ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped / 100)}
            opacity={clamped === 0 ? 0 : 1}
          />
        ) : (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashoffset}
            opacity={clamped === 0 ? 0 : 1}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}
