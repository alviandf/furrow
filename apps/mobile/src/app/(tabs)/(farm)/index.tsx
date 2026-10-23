import type { FarmResponse, PlotSummaryDto } from '@furrow/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFarm, usePlots } from '@/api/hooks';
import { WeatherAttribution } from '@/components/attribution';
import { IconButton } from '@/components/button';
import { Card, SectionHeader } from '@/components/card';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { Icon } from '@/components/icon';
import { PlotCard } from '@/components/plot-card';
import { ScreenScroll } from '@/components/screen';
import { PlotCardSkeleton, Skeleton } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { SunBadge } from '@/components/sun-badge';
import { Text } from '@/components/text';
import { formatAgo, formatNumber, greeting } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { colors, radius, space } from '@/theme/tokens';

const FALLBACK_TZ = 'Asia/Dubai';
const ATTENTION_ACTIONS = new Set(['IRRIGATE_NOW', 'SENSOR_OFFLINE', 'PAUSE']);

function headline(plots: PlotSummaryDto[] | undefined): string {
  if (!plots) return 'Checking your plots…';
  const n = plots.filter((p) => ATTENTION_ACTIONS.has(p.recommendation.action)).length;
  if (n === 0) return 'All plots are happy';
  return n === 1 ? '1 plot needs you today' : `${n} plots need you today`;
}

function weatherMood(today: NonNullable<FarmResponse['today']>): string {
  if ((today.rainProbability ?? 0) >= 50 || today.rainMm >= 1) return 'Rain on the way';
  if (today.et0Mm >= 6 || today.maxTempC >= 35) return 'Hot and dry';
  if (today.et0Mm >= 4) return 'Warm and sunny';
  return 'Mild and easy';
}

function TodayCards({ data }: { data: FarmResponse }) {
  const { waterUsedTodayL, waterPlannedL } = data.summary;
  const total = waterUsedTodayL + waterPlannedL;
  const done = total > 0 ? waterUsedTodayL / total : 0;
  const today = data.today;
  return (
    <View style={styles.today}>
      {today ? (
        <Card tint={colors.sunTint} style={styles.todayCard}>
          <SunBadge size={40} />
          <Text variant="readoutSmall" style={{ color: colors.sunText }}>
            {Math.round(today.maxTempC)}°
            <Text variant="smallMedium" style={{ color: colors.sunText }}>
              {'  '}/ {Math.round(today.minTempC)}°
            </Text>
          </Text>
          <Text variant="smallMedium" style={{ color: colors.sunText }}>
            {weatherMood(today)}
          </Text>
          <Text variant="small" style={{ color: colors.sunText }}>
            Crops drink {today.et0Mm.toFixed(1)} mm
          </Text>
        </Card>
      ) : null}
      <Card tint={colors.skyTint} style={styles.todayCard}>
        <View style={styles.dropBadge}>
          <Icon name="drop" size={22} weight="fill" color={colors.skyBright} />
        </View>
        <Text variant="readoutSmall" color="skyText">
          {formatNumber(waterPlannedL / 1000, 1)}
          <Text variant="smallMedium" color="skyText">
            {'  '}m³
          </Text>
        </Text>
        <Text variant="smallMedium" color="skyText">
          Water to give today
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityLabel={`${formatNumber(waterUsedTodayL / 1000, 1)} cubic metres given today`}>
          <View style={[styles.progress, { width: `${Math.max(4, Math.round(done * 100))}%` }]} />
        </View>
        <Text variant="small" color="skyText">
          {formatNumber(waterUsedTodayL / 1000, 1)} m³ given so far
        </Text>
      </Card>
    </View>
  );
}

export default function FarmScreen() {
  const router = useRouter();
  const now = useNow();
  const farm = useFarm();
  const plots = usePlots();
  const [refreshing, setRefreshing] = useState(false);
  const tz = farm.data?.farm.timezone ?? FALLBACK_TZ;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([farm.refetch(), plots.refetch()]);
    setRefreshing(false);
  };

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="smallMedium" color="inkMuted">
            {greeting(now, tz)}
            {farm.data ? ` · ${farm.data.farm.name}` : ''}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {headline(plots.data?.plots)}
          </Text>
        </View>
        <IconButton
          icon="plus"
          label="Log activity"
          tone="primary"
          onPress={() => router.push('/log')}
        />
      </View>

      <ConnectivityBanner dataUpdatedAt={plots.dataUpdatedAt || undefined} now={now} />

      {farm.data ? (
        <View style={styles.todayBlock}>
          <TodayCards data={farm.data} />
          <WeatherAttribution weather={farm.data.weather} />
        </View>
      ) : farm.isError ? null : (
        <View style={styles.today}>
          <Skeleton style={{ flex: 1, height: 150, borderRadius: radius.lg }} />
          <Skeleton style={{ flex: 1, height: 150, borderRadius: radius.lg }} />
        </View>
      )}

      <SectionHeader title="Your plots" aside="Most urgent first" />

      {plots.data ? (
        plots.data.plots.map((plot) => (
          <PlotCard
            key={plot.id}
            plot={plot}
            timeZone={tz}
            now={now}
            onPress={() => router.push({ pathname: '/plot/[id]', params: { id: plot.id } })}
            onLogWatering={(durationMin) =>
              router.push({
                pathname: '/log',
                params: { plotId: plot.id, type: 'irrigation', durationMin: String(durationMin) },
              })
            }
          />
        ))
      ) : plots.isError ? (
        <ErrorState error={plots.error} onRetry={() => void refresh()} />
      ) : (
        [0, 1, 2].map((i) => <PlotCardSkeleton key={i} />)
      )}

      {plots.dataUpdatedAt ? (
        <Text variant="small" color="inkFaint" align="center">
          Updated {formatAgo(plots.dataUpdatedAt, now)} · pull to refresh
        </Text>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.sm },
  headerText: { flex: 1, gap: space.xs },
  todayBlock: { gap: space.sm },
  today: { flexDirection: 'row', gap: space.md },
  todayCard: { flex: 1, gap: 2 },
  dropBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginVertical: space.xs,
  },
  progress: { height: 8, borderRadius: radius.pill, backgroundColor: colors.skyBright },
});
