import type { PlotSummaryDto } from '@furrow/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  formatDuration,
  formatMm,
  formatNumber,
  formatPercent,
  formatVolume,
  STAGE_LABEL,
} from '@/lib/format';
import { ACTION_TONE, actionCopy } from '@/lib/semantics';
import { colors, radius, space } from '@/theme/tokens';

import { Button } from './button';
import { Card } from './card';
import { Icon } from './icon';
import { Text } from './text';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="eyebrow" color="inkFaint">
        {label}
      </Text>
      <Text variant="dataMedium">{value}</Text>
    </View>
  );
}

interface Row {
  label: string;
  math: string;
  value: string;
}

/** The recommendation's inputs and math, in the order the model uses them. */
function WhyBreakdown({ plot }: { plot: PlotSummaryDto }) {
  const r = plot.recommendation;
  const i = r.inputs;
  const kc = i.kc.toFixed(2);

  const rows: Row[] = [
    {
      label: 'Soil now',
      math:
        i.vwc === null
          ? 'No current reading'
          : `${formatPercent(i.vwc)} vs field capacity ${formatPercent(i.fieldCapacity)}`,
      value: i.depletionMm === null ? '—' : `${formatMm(i.depletionMm)} short`,
    },
    {
      label: 'Crop coefficient',
      math: `${plot.crop.name}, ${STAGE_LABEL[i.growthStage].toLowerCase()}`,
      value: `Kc ${kc}`,
    },
    {
      label: 'What it drinks in 24 h',
      math: `ET₀ ${formatMm(i.et0Next24hMm)} × Kc ${kc}`,
      value: formatMm(i.etcNext24hMm),
    },
    {
      label: 'Stress threshold (RAW)',
      math: `p ${i.p.toFixed(2)} × available water ${formatMm(i.tawMm, 0)}`,
      value: formatMm(i.rawMm),
    },
  ];
  if (i.depletionAtStartMm !== null && i.depletionAfter24hMm !== null) {
    rows.push({
      label: 'Projected shortfall',
      math:
        i.etcBeforeStartMm > 0.05
          ? `${formatMm(i.depletionAtStartMm)} by the window → 24 h later`
          : `${formatMm(i.depletionAtStartMm)} now → 24 h later`,
      value: formatMm(i.depletionAfter24hMm),
    });
  }
  if (i.effectiveRainMm > 0) {
    rows.push({
      label: 'Effective rain',
      math: 'Forecast, next 24 h',
      value: `−${formatMm(i.effectiveRainMm)}`,
    });
  }
  if (r.netDepthMm !== null && r.volumeL !== null && r.durationMin !== null) {
    rows.push({
      label: 'Amount',
      math: `${formatMm(r.netDepthMm)} ÷ ${Math.round(i.efficiency * 100)}% efficiency = ${formatVolume(r.volumeL)} at ${formatNumber(i.flowRateLph / 1000, 1)} m³/h`,
      value: formatDuration(r.durationMin),
    });
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(150)}
      style={styles.why}>
      {rows.map((row, index) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.step}>
            <Text variant="smallMedium" color="skyText">
              {index + 1}
            </Text>
          </View>
          <View style={styles.rowText}>
            <Text variant="smallMedium">{row.label}</Text>
            <Text variant="data" color="inkMuted">
              {row.math}
            </Text>
          </View>
          <Text variant="dataMedium" style={styles.rowValue}>
            {row.value}
          </Text>
        </View>
      ))}
      <Text variant="small" color="inkFaint">
        FAO-56 single crop coefficient method. Rain counts only above 0.2 × ET₀ with at least 50%
        chance.
      </Text>
    </Animated.View>
  );
}

export function RecommendationCard({
  plot,
  timeZone,
  now,
  onLogIrrigation,
}: {
  plot: PlotSummaryDto;
  timeZone: string;
  now: number;
  onLogIrrigation: () => void;
}) {
  const [open, setOpen] = useState(false);
  const r = plot.recommendation;
  const tone = ACTION_TONE[r.action];
  const copy = actionCopy(plot, timeZone, now);
  const irrigate = r.action === 'IRRIGATE_NOW' || r.action === 'IRRIGATE_TONIGHT';

  return (
    <Animated.View layout={LinearTransition.duration(220)}>
      <Card tint={colors[tone.tint]} style={styles.card}>
        <View style={styles.top}>
          <View style={styles.badge}>
            <Icon name={tone.icon} size={24} weight="fill" color={colors[tone.color]} />
          </View>
          <View style={styles.titles}>
            <Text variant="eyebrow" color={tone.color}>
              Today&apos;s plan
            </Text>
            <Text variant="title">{copy.title}</Text>
          </View>
        </View>

        <Text variant="body" color="inkMuted">
          {copy.reason}
        </Text>

        {r.durationMin !== null && r.volumeL !== null && r.netDepthMm !== null ? (
          <View style={styles.stats}>
            <Stat label="Run time" value={formatDuration(r.durationMin)} />
            <Stat label="Water" value={formatVolume(r.volumeL)} />
            <Stat label="Net depth" value={formatMm(r.netDepthMm)} />
          </View>
        ) : copy.detail ? (
          <View style={styles.detailPill}>
            <Text variant="smallMedium" color={tone.color}>
              {copy.detail}
            </Text>
          </View>
        ) : null}

        {irrigate ? (
          <Button
            label="Log watering"
            tone={tone.button}
            icon="drop"
            onPress={onLogIrrigation}
            accessibilityHint="Opens the log form with this run time filled in"
          />
        ) : null}

        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          style={styles.toggle}>
          <Text variant="smallMedium" color={tone.color}>
            {open ? 'Hide the math' : 'Why? Show the math'}
          </Text>
          <Icon
            name={open ? 'chevronUp' : 'chevronDown'}
            size={16}
            weight="bold"
            color={colors[tone.color]}
          />
        </Pressable>

        {open ? <WhyBreakdown plot={plot} /> : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md + 2,
  },
  stat: { gap: 2 },
  detailPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
  },
  why: {
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md + 2,
  },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  step: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.skyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowValue: { textAlign: 'right' },
});
