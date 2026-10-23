import type { PlotSummaryDto } from '@furrow/shared';
import { StyleSheet, View } from 'react-native';

import { formatClock, formatDuration, formatPercent, formatStage } from '@/lib/format';
import { ACTION_TONE, STATUS, actionCopy, cropKind } from '@/lib/semantics';
import { colors, radius, space } from '@/theme/tokens';

import { Button } from './button';
import { Card } from './card';
import { Icon } from './icon';
import { CropMascot } from './mascot';
import { PressableScale } from './pressable-scale';
import { Text } from './text';
import { WaterMeter } from './water-meter';

export function PlotCard({
  plot,
  timeZone,
  now,
  onPress,
  onLogWatering,
}: {
  plot: PlotSummaryDto;
  timeZone: string;
  now: number;
  onPress: () => void;
  onLogWatering: (durationMin: number) => void;
}) {
  const r = plot.recommendation;
  const status = STATUS[plot.status];
  const tone = ACTION_TONE[r.action];
  const copy = actionCopy(plot, timeZone, now);
  const water =
    (r.action === 'IRRIGATE_NOW' || r.action === 'IRRIGATE_TONIGHT') && r.durationMin !== null;
  const buttonLabel =
    r.action === 'IRRIGATE_NOW'
      ? `Water now · ${formatDuration(r.durationMin ?? 0)}`
      : `Tonight ${r.startAt ? formatClock(r.startAt, timeZone) : ''} · ${formatDuration(r.durationMin ?? 0)}`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${plot.name}, ${plot.crop.name}. Status ${status.formal}. ${
        plot.latest ? `Moisture ${formatPercent(plot.latest.vwc)}. ` : ''
      }${copy.title}${copy.detail ? `, ${copy.detail}` : ''}.`}
      accessibilityHint="Opens plot details">
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors[status.tint] }]}>
            <CropMascot crop={cropKind(plot.crop.id)} mood={status.mood} size={46} />
          </View>
          <View style={styles.titles}>
            <Text variant="heading">{plot.name}</Text>
            <Text variant="small" color="inkMuted" numberOfLines={1}>
              {plot.crop.name} · {formatStage(plot.growthStage, plot.dayOfSeason, null)}
            </Text>
          </View>
          <View style={styles.reading}>
            <Text variant="readoutSmall" color={plot.status === 'OFFLINE' ? 'inkFaint' : 'ink'}>
              {plot.latest ? (plot.latest.vwc * 100).toFixed(1) : '—'}
              <Text variant="smallMedium" color="inkFaint">
                {plot.latest ? '%' : ''}
              </Text>
            </Text>
            <Text variant="smallMedium" color={status.color}>
              {status.label}
            </Text>
          </View>
        </View>

        <WaterMeter
          value={plot.latest?.vwc ?? null}
          refillPoint={plot.target.refillPoint}
          fieldCapacity={plot.target.fieldCapacity}
          wiltingPoint={plot.recommendation.inputs.wiltingPoint}
          status={plot.status}
          height={10}
        />

        {water ? (
          <Button
            label={buttonLabel}
            tone={tone.button}
            icon="drop"
            onPress={() => onLogWatering(r.durationMin ?? 60)}
            accessibilityHint="Opens the log form with this run time filled in"
          />
        ) : (
          <View style={[styles.info, { backgroundColor: colors[tone.tint] }]}>
            <Icon name={tone.icon} size={17} weight="fill" color={colors[tone.color]} />
            <Text
              variant="smallMedium"
              color={tone.color}
              style={styles.infoText}
              numberOfLines={1}>
              {copy.title}
              {copy.detail ? (
                <Text variant="small" color="inkMuted">
                  {'  ·  '}
                  {copy.detail}
                </Text>
              ) : null}
            </Text>
            <Icon name="chevronRight" size={16} weight="bold" color={colors.inkFaint} />
          </View>
        )}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 1 },
  reading: { alignItems: 'flex-end' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md - 2,
    borderRadius: radius.md,
  },
  infoText: { flex: 1 },
});
