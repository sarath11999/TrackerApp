import type { CategoryId } from '@/lib/habits';
import type { DayStatus } from '@/lib/stats';

export interface Palette {
  dark: boolean;
  background: string;
  card: string;
  cardElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  fill: string; // subtle control fill
  tint: string;
  danger: string;
  success: string;
  warning: string;
  money: string;
  weight: string;
  ringTrack: string;
  category: Record<CategoryId, string>;
  status: Record<DayStatus, string>;
  chartGrid: string;
}

export const light: Palette = {
  dark: false,
  background: '#F2F2F7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  text: '#000000',
  textSecondary: '#6C6C70',
  textTertiary: '#AEAEB2',
  separator: '#E5E5EA',
  fill: '#EFEFF4',
  tint: '#007AFF',
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FFCC00',
  money: '#FF9500',
  weight: '#0A9FD8',
  ringTrack: '#E9E9EE',
  category: { fitness: '#FF2D55', nutrition: '#34C759', study: '#007AFF', selfcare: '#AF52DE' },
  status: { green: '#34C759', yellow: '#FFCC00', red: '#FF3B30', none: '#E5E5EA' },
  chartGrid: '#E5E5EA',
};

export const dark: Palette = {
  dark: true,
  background: '#000000',
  card: '#1C1C1E',
  cardElevated: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#98989F',
  textTertiary: '#636366',
  separator: '#38383A',
  fill: '#2C2C2E',
  tint: '#0A84FF',
  danger: '#FF453A',
  success: '#30D158',
  warning: '#FFD60A',
  money: '#FF9F0A',
  weight: '#64D2FF',
  ringTrack: '#2C2C2E',
  category: { fitness: '#FF375F', nutrition: '#30D158', study: '#0A84FF', selfcare: '#BF5AF2' },
  status: { green: '#30D158', yellow: '#FFD60A', red: '#FF453A', none: '#3A3A3C' },
  chartGrid: '#2C2C2E',
};

export const EXPENSE_COLORS: Record<string, string> = {
  Food: '#FF9500',
  Groceries: '#34C759',
  'Gas / Transportation': '#5856D6',
  Shopping: '#FF2D55',
  Entertainment: '#AF52DE',
  Bills: '#007AFF',
  Education: '#5AC8FA',
  Health: '#FF3B30',
  Other: '#8E8E93',
};

/** Max content width so layouts stay phone-shaped on wide screens (web preview, iPad). */
export const MAX_CONTENT_WIDTH = 600;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  caption2: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.07 },
};
