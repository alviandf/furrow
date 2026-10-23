import { HOUR_MS, startOfZonedDay, zonedParts, zonedTimeToEpoch } from '@furrow/shared';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { nearestIndex, passesTick } from '@/lib/chart-scrub';
import { formatClock, formatWeekday } from '@/lib/format';
import { colors, withAlpha } from '@/theme/tokens';

import { Text } from './text';

export interface ChartPoint {
  t: number;
  v: number;
}

export interface ChartMarker {
  t: number;
  type: 'irrigation' | 'rain';
}

const PAD = { left: 40, right: 12, top: 22, bottom: 26 };
/** Readings further apart than this are not joined (e.g. a sensor outage). */
const GAP_MS = 75 * 60_000;
const EMPTY: number[] = [];
const DROP = 'M0 0 C3 5 3.6 8 0 9.8 C-3.6 8 -3 5 0 0 Z';

interface Geometry {
  innerW: number;
  line: SkPath;
  area: SkPath;
  xs: number[];
  ys: number[];
  vs: number[];
  last: { x: number; y: number } | null;
  ticks: Array<{ value: number; y: number; label: string }>;
  dayLines: number[];
  xLabels: Array<{ x: number; text: string }>;
  markers: Array<{ x: number; type: ChartMarker['type'] }>;
  /** Point index nearest to each irrigation marker, for haptic ticks. */
  markerIndices: number[];
  bandTop: number;
  bandBottom: number;
}

function niceStep(span: number): number {
  for (const step of [0.005, 0.01, 0.02, 0.05]) if (span / step <= 5) return step;
  return 0.1;
}

function buildGeometry(input: {
  points: ChartPoint[];
  markers: ChartMarker[];
  target: { refillPoint: number; fieldCapacity: number };
  from: number;
  to: number;
  range: '24h' | '7d';
  timeZone: string;
  width: number;
  height: number;
}): Geometry {
  const { points, target, from, to, timeZone, width, height } = input;
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const bottom = height - PAD.bottom;
  const values = points.map((p) => p.v);

  const lo = Math.min(target.refillPoint, ...values);
  const hi = Math.max(target.fieldCapacity, ...values);
  const step = niceStep(hi - lo);
  const yMin = Math.floor((lo - step * 0.4) / step) * step;
  const yMax = Math.ceil((hi + step * 0.4) / step) * step;

  const x = (t: number) => PAD.left + ((t - from) / (to - from)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (bottom - PAD.top);

  const line = Skia.PathBuilder.Make();
  const area = Skia.PathBuilder.Make();
  let segmentStart = 0;
  const closeArea = (end: number) => {
    if (end <= segmentStart) return;
    area.moveTo(x(points[segmentStart]!.t), bottom);
    for (let i = segmentStart; i <= end; i++) area.lineTo(x(points[i]!.t), y(points[i]!.v));
    area.lineTo(x(points[end]!.t), bottom);
    area.close();
  };
  points.forEach((p, i) => {
    const gap = i > 0 && p.t - points[i - 1]!.t > GAP_MS;
    if (i === 0 || gap) {
      if (gap) closeArea(i - 1);
      segmentStart = i;
      line.moveTo(x(p.t), y(p.v));
    } else {
      line.lineTo(x(p.t), y(p.v));
    }
  });
  closeArea(points.length - 1);

  const ticks: Geometry['ticks'] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) {
    ticks.push({ value: v, y: y(v), label: `${(v * 100).toFixed(step < 0.01 ? 1 : 0)}%` });
  }

  const dayLines: number[] = [];
  const xLabels: Geometry['xLabels'] = [];
  if (input.range === '7d') {
    let day = startOfZonedDay(from, timeZone);
    while (day < to) {
      const p = zonedParts(day, timeZone);
      const next = zonedTimeToEpoch(p.year, p.month, p.day + 1, 0, 0, timeZone);
      if (day > from) dayLines.push(x(day));
      const noon = day + 12 * HOUR_MS;
      if (noon > from + 3 * HOUR_MS && noon < to - 3 * HOUR_MS) {
        xLabels.push({ x: x(noon), text: formatWeekday(noon, timeZone) });
      }
      day = next;
    }
  } else {
    for (let t = Math.ceil(from / HOUR_MS) * HOUR_MS; t <= to; t += HOUR_MS) {
      if (zonedParts(t, timeZone).hour % 6 === 0 && t - from > HOUR_MS && to - t > HOUR_MS) {
        xLabels.push({ x: x(t), text: formatClock(t, timeZone) });
      }
    }
  }

  const xs = points.map((p) => x(p.t));
  const nearestIndex = (t: number) => {
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i]!.t - t) < Math.abs(points[best]!.t - t)) best = i;
    }
    return best;
  };
  const visibleMarkers = input.markers.filter((m) => m.t >= from && m.t <= to);
  const lastPoint = points.at(-1);

  return {
    innerW,
    line: line.detach(),
    area: area.detach(),
    xs,
    ys: points.map((p) => y(p.v)),
    vs: values,
    last: lastPoint ? { x: x(lastPoint.t), y: y(lastPoint.v) } : null,
    ticks,
    dayLines,
    xLabels,
    markers: visibleMarkers.map((m) => ({ x: x(m.t), type: m.type })),
    markerIndices: visibleMarkers
      .filter((m) => m.type === 'irrigation')
      .map((m) => nearestIndex(m.t)),
    bandTop: y(target.fieldCapacity),
    bandBottom: y(target.refillPoint),
  };
}

/**
 * Soil-moisture chart. Drag horizontally to scrub: the cursor follows the
 * finger on the UI thread, and a haptic tick marks each irrigation and each
 * crossing of the refill line.
 */
export function MoistureChart({
  points,
  markers,
  target,
  from,
  to,
  range,
  timeZone,
  height = 210,
  accessibilityLabel,
  onScrub,
}: {
  points: ChartPoint[];
  markers: ChartMarker[];
  target: { refillPoint: number; fieldCapacity: number };
  from: number;
  to: number;
  range: '24h' | '7d';
  timeZone: string;
  height?: number;
  accessibilityLabel: string;
  onScrub: (index: number | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const geometry = useMemo(
    () =>
      width > 0 && points.length > 1
        ? buildGeometry({ points, markers, target, from, to, range, timeZone, width, height })
        : null,
    [points, markers, target, from, to, range, timeZone, width, height],
  );

  const activeIndex = useSharedValue(-1);
  const visible = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  /**
   * 0→1: the line draws itself in when the chart first appears or the range
   * changes. Background refreshes (every few minutes, or after logging a
   * watering) update the line in place instead of replaying the animation.
   */
  const draw = useSharedValue(reducedMotion ? 1 : 0);
  const ready = geometry !== null;

  useEffect(() => {
    if (!ready) return;
    if (reducedMotion) {
      draw.set(1);
      return;
    }
    draw.set(0);
    draw.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [ready, range, reducedMotion, draw]);

  const xs = geometry?.xs ?? EMPTY;
  const ys = geometry?.ys ?? EMPTY;
  const vs = geometry?.vs ?? EMPTY;
  const markerIndices = geometry?.markerIndices ?? EMPTY;
  const refill = target.refillPoint;
  const bottom = height - PAD.bottom;

  const report = (index: number, tick: boolean) => {
    onScrub(index < 0 ? null : index);
    if (tick) void Haptics.selectionAsync();
  };

  const select = (fingerX: number) => {
    'worklet';
    const index = nearestIndex(xs, fingerX);
    const previous = activeIndex.get();
    if (index < 0 || index === previous) return;
    const tick = passesTick(previous, index, vs, markerIndices, refill);
    activeIndex.set(index);
    scheduleOnRN(report, index, tick);
  };

  const pan = usePanGesture({
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (event) => {
      'worklet';
      visible.set(withTiming(1, { duration: 120 }));
      select(event.x);
    },
    onUpdate: (event) => {
      'worklet';
      select(event.x);
    },
    onFinalize: () => {
      'worklet';
      visible.set(withTiming(0, { duration: 220 }));
      activeIndex.set(-1);
      scheduleOnRN(report, -1, false);
    },
  });

  const cursorTop = useDerivedValue(() => vec(xs[activeIndex.get()] ?? -50, PAD.top));
  const cursorBottom = useDerivedValue(() => vec(xs[activeIndex.get()] ?? -50, bottom));
  const dotX = useDerivedValue(() => xs[activeIndex.get()] ?? -50);
  const dotY = useDerivedValue(() => ys[activeIndex.get()] ?? -50);
  const restingOpacity = useDerivedValue(() => 1 - visible.get());

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(Math.round(event.nativeEvent.layout.width));

  return (
    <View
      onLayout={onLayout}
      style={{ height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      {geometry ? (
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill}>
            <Canvas style={StyleSheet.absoluteFill}>
              {geometry.ticks.map((tick) => (
                <Line
                  key={`tick-${tick.label}`}
                  p1={vec(PAD.left, tick.y)}
                  p2={vec(width - PAD.right, tick.y)}
                  color={colors.chartGrid}
                  strokeWidth={1}
                />
              ))}
              {geometry.dayLines.map((dayX) => (
                <Line
                  key={`day-${dayX}`}
                  p1={vec(dayX, PAD.top)}
                  p2={vec(dayX, bottom)}
                  color={colors.chartGrid}
                  strokeWidth={1}
                />
              ))}

              <Rect
                x={PAD.left}
                y={geometry.bandTop}
                width={geometry.innerW}
                height={geometry.bandBottom - geometry.bandTop}
                color={colors.band}
              />
              {[geometry.bandTop, geometry.bandBottom].map((edge) => (
                <Line
                  key={`edge-${edge}`}
                  p1={vec(PAD.left, edge)}
                  p2={vec(PAD.left + geometry.innerW, edge)}
                  color={colors.bandEdge}
                  strokeWidth={1}>
                  <DashPathEffect intervals={[4, 4]} />
                </Line>
              ))}

              {geometry.markers.map((marker, i) =>
                marker.type === 'irrigation' ? (
                  <Group key={`marker-${i}`}>
                    <Line
                      p1={vec(marker.x, PAD.top)}
                      p2={vec(marker.x, bottom)}
                      color={withAlpha(colors.skyBright, 0.55)}
                      strokeWidth={2}
                    />
                    <Path
                      path={DROP}
                      color={colors.skyBright}
                      transform={[{ translateX: marker.x }, { translateY: PAD.top - 17 }]}
                    />
                  </Group>
                ) : (
                  <Circle
                    key={`marker-${i}`}
                    cx={marker.x}
                    cy={PAD.top - 9}
                    r={3}
                    color={withAlpha(colors.sky, 0.6)}
                  />
                ),
              )}

              <Path path={geometry.area} style="fill" opacity={draw}>
                <LinearGradient
                  start={vec(0, PAD.top)}
                  end={vec(0, bottom)}
                  colors={[withAlpha(colors.skyBright, 0.3), withAlpha(colors.skyBright, 0)]}
                />
              </Path>
              <Path
                path={geometry.line}
                style="stroke"
                strokeWidth={2.5}
                color={colors.ink}
                strokeJoin="round"
                strokeCap="round"
                end={draw}
              />

              {geometry.last ? (
                <Group opacity={restingOpacity}>
                  <Circle
                    cx={geometry.last.x}
                    cy={geometry.last.y}
                    r={7}
                    color={withAlpha(colors.ink, 0.12)}
                  />
                  <Circle cx={geometry.last.x} cy={geometry.last.y} r={3.5} color={colors.ink} />
                </Group>
              ) : null}

              <Group opacity={visible}>
                <Line p1={cursorTop} p2={cursorBottom} color={colors.inkMuted} strokeWidth={1} />
                <Circle cx={dotX} cy={dotY} r={6} color={colors.surface} />
                <Circle
                  cx={dotX}
                  cy={dotY}
                  r={6}
                  color={colors.ink}
                  style="stroke"
                  strokeWidth={2.25}
                />
              </Group>
            </Canvas>

            {geometry.ticks.map((tick) => (
              <Text
                key={`y-${tick.label}`}
                variant="data"
                color="inkFaint"
                style={[styles.axis, styles.yLabel, { top: tick.y - 8 }]}>
                {tick.label}
              </Text>
            ))}
            {geometry.xLabels.map((label) => (
              <Text
                key={`x-${label.x}`}
                variant="data"
                color="inkFaint"
                style={[styles.axis, styles.xLabel, { left: label.x - 26, top: bottom + 6 }]}>
                {label.text}
              </Text>
            ))}
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { position: 'absolute', fontSize: 11, lineHeight: 15 },
  yLabel: { left: 0, width: PAD.left - 8, textAlign: 'right' },
  xLabel: { width: 52, textAlign: 'center' },
});
