/** Thin, themed wrappers around react-native-gifted-charts. All data comes from SQLite. */
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { Platform, useWindowDimensions, View } from 'react-native';
import { useColors } from '@/state/AppContext';
import { spacing } from '@/theme/theme';
import { T } from './ui';

// gifted-charts' bar/line grow animations rely on native animation; on the web preview they leave bars at zero height.
const ANIMATE = Platform.OS !== 'web';

const Y_LABEL_WIDTH = 34;

/** Width available to a chart inside a padded Card on a padded Screen. */
function useChartWidth(extraInset = 0) {
  const { width } = useWindowDimensions();
  return Math.max(200, width - spacing.lg * 4 - Y_LABEL_WIDTH - extraInset);
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function Bars({
  data,
  maxValue,
  color,
  height = 170,
  formatY,
  sections = 4,
  showValues = false,
  formatValue,
}: {
  data: BarDatum[];
  maxValue?: number;
  color: string;
  height?: number;
  formatY?: (v: string) => string;
  sections?: number;
  showValues?: boolean;
  formatValue?: (v: number) => string;
}) {
  const c = useColors();
  const width = useChartWidth();
  const n = Math.max(1, data.length);
  const slot = (width - 12) / n; // keep room so the last x-axis label isn't clipped
  const barWidth = Math.max(4, Math.min(28, slot * 0.6));
  const gap = Math.max(2, slot - barWidth);
  const dataMax = Math.max(0, ...data.map((d) => d.value));
  const max = maxValue ?? niceMax(dataMax);
  return (
    <BarChart
      data={data.map((d) => ({
        value: d.value,
        label: d.label,
        frontColor: d.color ?? color,
        topLabelComponent: showValues && d.value > 0 ? () => <T variant="caption2" secondary style={{ marginBottom: 2 }} numberOfLines={1}>{formatValue ? formatValue(d.value) : String(Math.round(d.value))}</T> : undefined,
      }))}
      width={width}
      height={height}
      barWidth={barWidth}
      spacing={gap}
      initialSpacing={gap / 2}
      endSpacing={gap / 2 + 6}
      maxValue={max || 1}
      noOfSections={sections}
      roundedTop
      barBorderRadius={Math.min(6, barWidth / 2)}
      isAnimated={ANIMATE}
      disableScroll
      yAxisThickness={0}
      xAxisThickness={1}
      xAxisColor={c.separator}
      rulesColor={c.chartGrid}
      rulesType="solid"
      yAxisLabelWidth={Y_LABEL_WIDTH}
      yAxisTextStyle={{ color: c.textTertiary, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}
      labelWidth={slot}
      labelsDistanceFromXaxis={2}
      formatYLabel={formatY}
    />
  );
}

export interface LinePoint {
  label?: string;
  value: number;
}

export function Line({
  data,
  color,
  height = 170,
  maxValue,
  minValue,
  formatY,
  sections = 4,
}: {
  data: LinePoint[];
  color: string;
  height?: number;
  maxValue?: number;
  minValue?: number;
  formatY?: (v: string) => string;
  sections?: number;
}) {
  const c = useColors();
  const width = useChartWidth();
  const n = Math.max(2, data.length);
  const step = (width - 16) / (n - 1);
  // Offset the axis so weight charts don't start at zero.
  const offset = minValue ?? 0;
  const dataMax = Math.max(offset + 1, ...data.map((d) => d.value));
  const max = maxValue ?? niceMax(dataMax - offset) + offset;
  const showLabelEvery = Math.ceil(data.length / 6);
  return (
    <LineChart
      data={data.map((d, i) => ({ value: d.value, label: i % showLabelEvery === 0 ? d.label : '' }))}
      width={width}
      height={height}
      spacing={step}
      initialSpacing={8}
      endSpacing={8}
      maxValue={max - offset}
      yAxisOffset={offset}
      noOfSections={sections}
      color={color}
      thickness={3}
      curved
      areaChart
      startFillColor={color}
      endFillColor={color}
      startOpacity={0.28}
      endOpacity={0.02}
      hideDataPoints={data.length > 20}
      dataPointsColor={color}
      dataPointsRadius={3.5}
      isAnimated={ANIMATE}
      disableScroll
      yAxisThickness={0}
      xAxisThickness={1}
      xAxisColor={c.separator}
      rulesColor={c.chartGrid}
      rulesType="solid"
      yAxisLabelWidth={Y_LABEL_WIDTH}
      yAxisTextStyle={{ color: c.textTertiary, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: c.textSecondary, fontSize: 10, width: 44, marginLeft: -14, textAlign: 'center' }}
      formatYLabel={formatY}
    />
  );
}

export function Donut({
  data,
  center,
  centerSub,
  radius = 90,
}: {
  data: { value: number; color: string }[];
  center: string;
  centerSub?: string;
  radius?: number;
}) {
  const c = useColors();
  return (
    <PieChart
      data={data.length ? data : [{ value: 1, color: c.fill }]}
      donut
      radius={radius}
      innerRadius={radius * 0.68}
      innerCircleColor={c.card}
      strokeWidth={data.length > 1 ? 2 : 0}
      strokeColor={c.card}
      isAnimated={ANIMATE}
      centerLabelComponent={() => (
        <View style={{ alignItems: 'center' }}>
          <T variant="headline" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: radius * 1.2 }}>
            {center}
          </T>
          {centerSub ? (
            <T variant="caption" secondary>
              {centerSub}
            </T>
          ) : null}
        </View>
      )}
    />
  );
}

/** Round a max value up to a pleasant axis maximum. */
export function niceMax(v: number): number {
  if (v <= 0) return 0;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}
