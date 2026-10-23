import type { IrrigationMethod, PlotDetailDto, ReadingsRange } from '@furrow/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFarm, useForecast, usePlot, useReadings } from '@/api/hooks';
import { ActivityRow } from '@/components/activity-row';
import { IconButton } from '@/components/button';
import { Card, Divider, SectionHeader } from '@/components/card';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { ForecastCard } from '@/components/forecast-card';
import { CropMascot } from '@/components/mascot';
import { MoistureChart, type ChartMarker, type ChartPoint } from '@/components/moisture-chart';
import { RecommendationCard } from '@/components/recommendation-card';
import { ScreenScroll } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { Text } from '@/components/text';
import { WaterMeter } from '@/components/water-meter';
import {
  formatAgo,
  formatCalendarDate,
  formatClock,
  formatNumber,
  formatPercent,
  formatRelativeDay,
  formatStage,
} from '@/lib/format';
import { STATUS, cropKind } from '@/lib/semantics';
import { useNow } from '@/lib/use-now';
import { colors, radius, space } from '@/theme/tokens';

const FALLBACK_TZ = 'Asia/Dubai';
const CHART_HEIGHT = 210;

const METHOD_LABEL: Record<IrrigationMethod, string> = {
  drip: 'Drip',
  bubbler: 'Bubbler',
  sprinkler: 'Sprinkler',
};

/** A short, friendly line about how the crop is doing. */
function moodLine(plot: PlotDetailDto): string {
  switch (plot.status) {
    case 'NEEDS_WATER':
      return 'Really thirsty';
    case 'OVERWATERED':
      return 'Had too much to drink';
    case 'OFFLINE':
      return 'Sensor is asleep';
    case 'OPTIMAL':
      return plot.recommendation.action === 'NO_ACTION' ? 'Happy and hydrated' : 'Happy for now';
  }
}

function TopBar({ onBack, onLog }: { onBack: () => void; onLog: () => void }) {
  return (
    <View style={styles.topBar}>
      <IconButton icon="back" label="Back to farm" onPress={onBack} />
      <IconButton icon="plus" label="Log activity for this plot" tone="primary" onPress={onLog} />
    </View>
  );
}

function Legend() {
  return (
    <View
      style={styles.legend}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.legendItem}>
        <View style={styles.legendBand} />
        <Text variant="small" color="inkMuted">
          Happy zone
        </Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.skyBright }]} />
        <Text variant="small" color="inkMuted">
          Watering
        </Text>
      </View>
      <View style={styles.legendItem}>
        <View
          style={[
            styles.legendDot,
            { backgroundColor: colors.sky, opacity: 0.6, width: 7, height: 7 },
          ]}
        />
        <Text variant="small" color="inkMuted">
          Rain
        </Text>
      </View>
    </View>
  );
}

function Facts({ plot }: { plot: PlotDetailDto }) {
  const rows: Array<[string, string]> = [
    ['Area', `${formatNumber(plot.areaM2)} m²`],
    [
      'Watering',
      `${METHOD_LABEL[plot.irrigationMethod]} · ${Math.round(plot.efficiency * 100)}% efficient`,
    ],
    [
      'Flow rate',
      `${formatNumber(plot.flowRateLph / 1000, 1)} m³/h · ${formatNumber(plot.flowRateLph / plot.areaM2, 1)} mm/h`,
    ],
    ['Root depth', `${plot.rootDepthM.toFixed(2)} m`],
    [
      'Soil',
      `${plot.soil.name} · FC ${formatPercent(plot.soilParams.fieldCapacity, 0)} · WP ${formatPercent(plot.soilParams.wiltingPoint, 0)}`,
    ],
  ];
  if (plot.plantedOn) rows.push(['Planted', formatCalendarDate(plot.plantedOn)]);
  return (
    <Card style={styles.facts}>
      <Text variant="heading">About this plot</Text>
      {rows.map(([label, value], index) => (
        <View key={label}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.factRow}>
            <Text variant="small" color="inkMuted">
              {label}
            </Text>
            <Text variant="data" style={styles.factValue}>
              {value}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

export default function PlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const farm = useFarm();
  const plot = usePlot(id);
  const forecast = useForecast();
  const [range, setRange] = useState<ReadingsRange>('7d');
  const readings = useReadings(id, range);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const tz = farm.data?.farm.timezone ?? FALLBACK_TZ;

  const points = useMemo<ChartPoint[]>(
    () => readings.data?.points.map((p) => ({ t: Date.parse(p.t), v: p.vwc })) ?? [],
    [readings.data],
  );
  const markers = useMemo<ChartMarker[]>(
    () => readings.data?.events.map((e) => ({ t: Date.parse(e.t), type: e.type })) ?? [],
    [readings.data],
  );
  const target = useMemo(
    () => readings.data?.target ?? plot.data?.target ?? { refillPoint: 0, fieldCapacity: 0 },
    [readings.data, plot.data],
  );

  const openLog = (params: Record<string, string> = {}) =>
    router.push({ pathname: '/log', params: { plotId: id, ...params } });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([plot.refetch(), readings.refetch(), forecast.refetch()]);
    setRefreshing(false);
  };

  if (!plot.data) {
    return (
      <ScreenScroll>
        <TopBar onBack={router.back} onLog={() => openLog()} />
        {plot.isError ? (
          <ErrorState error={plot.error} onRetry={() => void plot.refetch()} />
        ) : (
          <>
            <Skeleton style={{ height: 220, borderRadius: radius.xl }} />
            <Skeleton style={{ height: 360, borderRadius: radius.lg }} />
          </>
        )}
      </ScreenScroll>
    );
  }

  const p = plot.data;
  const status = STATUS[p.status];
  const scrubbed = scrubIndex === null ? null : (points[scrubIndex] ?? null);
  const shown = scrubbed?.v ?? p.latest?.vwc ?? null;
  const caption = scrubbed
    ? `${formatRelativeDay(scrubbed.t, tz, now)} · ${formatClock(scrubbed.t, tz)}`
    : p.latest
      ? `Latest · updated ${formatAgo(Date.parse(p.latest.recordedAt), now)}`
      : 'No readings yet';
  const chartLabel = `Soil moisture over the last ${range === '7d' ? '7 days' : '24 hours'}. ${
    p.latest ? `Latest ${formatPercent(p.latest.vwc)}. ` : ''
  }Happy zone ${formatPercent(target.refillPoint)} to ${formatPercent(target.fieldCapacity)}. ${
    markers.filter((m) => m.type === 'irrigation').length
  } waterings shown. Drag across the chart to read past values.`;

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={refresh}>
      <TopBar onBack={router.back} onLog={() => openLog()} />

      <Card tint={colors[status.tint]} style={styles.hero}>
        <CropMascot crop={cropKind(p.crop.id)} mood={status.mood} size={112} />
        <Text variant="display" accessibilityRole="header" align="center">
          {p.name}
        </Text>
        <Text variant="smallMedium" color={status.color} align="center">
          {p.crop.name} · {moodLine(p)}
        </Text>
        <Text variant="small" color="inkMuted" align="center">
          {formatStage(p.growthStage, p.dayOfSeason, p.seasonLength)} · {p.soil.name} ·{' '}
          {METHOD_LABEL[p.irrigationMethod]}
        </Text>
      </Card>

      <ConnectivityBanner dataUpdatedAt={plot.dataUpdatedAt || undefined} now={now} />

      <Card style={styles.moisture}>
        <View
          accessible
          accessibilityLabel={`Soil moisture ${shown === null ? 'unknown' : formatPercent(shown)}. ${caption}`}>
          <Text variant="readout" color={p.status === 'OFFLINE' && !scrubbed ? 'inkFaint' : 'ink'}>
            {shown === null ? '—' : (shown * 100).toFixed(1)}
            <Text variant="title" color="inkFaint">
              {shown === null ? '' : '%'}
            </Text>
          </Text>
          <Text variant="smallMedium" color={scrubbed ? 'skyText' : 'inkMuted'}>
            {caption}
          </Text>
        </View>

        <WaterMeter
          value={shown}
          refillPoint={target.refillPoint}
          fieldCapacity={target.fieldCapacity}
          wiltingPoint={p.soilParams.wiltingPoint}
          status={p.status}
          showLabels
        />

        <View style={styles.chartHeader}>
          <Text variant="heading">History</Text>
          <Segmented
            accessibilityLabel="Chart range"
            value={range}
            onChange={(value) => {
              setScrubIndex(null);
              setRange(value);
            }}
            options={[
              { value: '24h', label: '24H' },
              { value: '7d', label: '7D' },
            ]}
          />
        </View>

        {points.length > 1 && readings.data ? (
          <MoistureChart
            points={points}
            markers={markers}
            target={target}
            from={Date.parse(readings.data.from)}
            to={Date.parse(readings.data.to)}
            range={readings.data.range}
            timeZone={tz}
            height={CHART_HEIGHT}
            accessibilityLabel={chartLabel}
            onScrub={setScrubIndex}
          />
        ) : readings.isPending ? (
          <Skeleton style={{ height: CHART_HEIGHT, borderRadius: radius.md }} />
        ) : (
          <EmptyState
            crop="date-palm"
            mood="sleepy"
            title="No readings here"
            message="The sensor hasn't reported in this range."
          />
        )}
        <Legend />
      </Card>

      <RecommendationCard
        plot={p}
        timeZone={tz}
        now={now}
        onLogIrrigation={() =>
          openLog({ type: 'irrigation', durationMin: String(p.recommendation.durationMin ?? 60) })
        }
      />

      {forecast.data ? (
        <ForecastCard
          days={forecast.data.days}
          weather={forecast.data.weather}
          timeZone={tz}
          now={now}
        />
      ) : null}

      <Facts plot={p} />

      <SectionHeader title="Recent activity" />
      <Card style={styles.activity}>
        {p.recentActivities.length === 0 ? (
          <Text variant="small" color="inkMuted">
            Nothing logged for this plot yet.
          </Text>
        ) : (
          p.recentActivities.map((activity, index) => (
            <View key={activity.id}>
              {index > 0 ? <Divider /> : null}
              <ActivityRow
                activity={activity}
                plotName={formatRelativeDay(activity.occurredAt, tz, now)}
                timeZone={tz}
              />
            </View>
          ))
        )}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.xl, borderRadius: radius.xl },
  moisture: { gap: space.lg },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xs,
  },
  legend: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  legendBand: {
    width: 18,
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.leafTint,
    borderWidth: 1.5,
    borderColor: colors.bandEdge,
  },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  facts: { gap: space.sm },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.sm,
  },
  factValue: { flexShrink: 1, textAlign: 'right' },
  activity: { paddingVertical: space.xs },
});
