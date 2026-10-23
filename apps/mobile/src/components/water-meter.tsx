import type { PlotStatus } from '@furrow/shared';
import { StyleSheet, View } from 'react-native';

import { formatPercent } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

import { Text } from './text';

const FILL: Record<PlotStatus, string> = {
  OPTIMAL: colors.skyBright,
  NEEDS_WATER: colors.tomatoBright,
  OVERWATERED: colors.sky,
  OFFLINE: '#B9AEEB',
};

/**
 * A "water meter": how full the root zone is, with the happy zone
 * (refill point → field capacity) highlighted behind it.
 */
export function WaterMeter({
  value,
  refillPoint,
  fieldCapacity,
  wiltingPoint,
  status,
  height = 12,
  showLabels = false,
}: {
  value: number | null;
  refillPoint: number;
  fieldCapacity: number;
  wiltingPoint: number;
  status: PlotStatus;
  height?: number;
  showLabels?: boolean;
}) {
  const min = Math.max(0, wiltingPoint - 0.01);
  const max = fieldCapacity + 0.08;
  const frac = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const pct = (v: number) => `${frac(v) * 100}%` as const;
  const zoneWidth = `${(frac(fieldCapacity) - frac(refillPoint)) * 100}%` as const;

  return (
    <View
      accessible
      accessibilityLabel={`Happy zone ${formatPercent(refillPoint)} to ${formatPercent(fieldCapacity)}${
        value === null ? '' : `, now ${formatPercent(value)}`
      }`}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View style={[styles.zone, { left: pct(refillPoint), width: zoneWidth }]} />
        {value !== null ? (
          <View
            style={[
              styles.fill,
              { width: pct(value), backgroundColor: FILL[status], borderRadius: height / 2 },
            ]}
          />
        ) : null}
        <View style={[styles.edge, { left: pct(refillPoint) }]} />
        <View style={[styles.edge, { left: pct(fieldCapacity) }]} />
      </View>
      {showLabels ? (
        <View style={styles.labels}>
          <Text variant="data" color="inkFaint">
            Wilting {formatPercent(wiltingPoint, 0)}
          </Text>
          <Text variant="data" color="leafText">
            Happy zone {formatPercent(refillPoint)}–{formatPercent(fieldCapacity)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfaceAlt, overflow: 'hidden', justifyContent: 'center' },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.leafTint },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  edge: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 2,
    marginLeft: -1,
    borderRadius: radius.pill,
    backgroundColor: colors.bandEdge,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
});
