import { startOfZonedDay, type ActivityDto, type ActivityType } from '@furrow/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useActivities,
  useFarm,
  usePendingActivities,
  usePlots,
  type PendingActivity,
} from '@/api/hooks';
import { ACTIVITY_META, ActivityRow } from '@/components/activity-row';
import { IconButton } from '@/components/button';
import { Divider } from '@/components/card';
import { Chip } from '@/components/chip';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { StatusBarBackdrop } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { Text } from '@/components/text';
import { formatRelativeDay } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { colors, radius, space } from '@/theme/tokens';

const FALLBACK_TZ = 'Asia/Dubai';
const FILTERS: Array<ActivityType | 'all'> = ['all', 'irrigation', 'fertilizer', 'pest', 'note'];

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'pending'; key: string; item: PendingActivity }
  | { kind: 'activity'; key: string; item: ActivityDto; first: boolean; last: boolean };

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const farm = useFarm();
  const plots = usePlots();
  const activities = useActivities(filter === 'all' ? {} : { type: filter });
  const pending = usePendingActivities();
  const tz = farm.data?.farm.timezone ?? FALLBACK_TZ;

  const plotName = (id: string) => plots.data?.plots.find((p) => p.id === id)?.name ?? 'Plot';

  const rows = useMemo<Row[]>(() => {
    const items = activities.data?.pages.flatMap((page) => page.items) ?? [];
    const serverIds = new Set(items.map((a) => a.id));
    const waiting = pending.filter(
      (p) => !serverIds.has(p.input.id) && (filter === 'all' || p.input.type === filter),
    );

    const out: Row[] = [];
    if (waiting.length > 0) {
      out.push({ kind: 'header', key: 'h-pending', label: 'Waiting to sync' });
      for (const item of waiting) out.push({ kind: 'pending', key: `p-${item.input.id}`, item });
    }
    let currentDay: number | null = null;
    items.forEach((item, index) => {
      const day = startOfZonedDay(Date.parse(item.occurredAt), tz);
      const first = day !== currentDay;
      if (first) {
        currentDay = day;
        out.push({ kind: 'header', key: `h-${day}`, label: formatRelativeDay(day, tz, now) });
      }
      const next = items[index + 1];
      const last = !next || startOfZonedDay(Date.parse(next.occurredAt), tz) !== day;
      out.push({ kind: 'activity', key: item.id, item, first, last });
    });
    return out;
  }, [activities.data, pending, filter, tz, now]);

  const refresh = async () => {
    setRefreshing(true);
    await activities.refetch();
    setRefreshing(false);
  };

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="smallMedium" color="inkMuted">
            Everything logged on the farm
          </Text>
          <Text variant="display" accessibilityRole="header">
            Activity
          </Text>
        </View>
        <IconButton
          icon="plus"
          label="Log activity"
          tone="primary"
          onPress={() => router.push('/log')}
        />
      </View>
      <View style={styles.filters}>
        {FILTERS.map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? 'All' : ACTIVITY_META[value].short}
            icon={value === 'all' ? undefined : ACTIVITY_META[value].icon}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      <ConnectivityBanner dataUpdatedAt={activities.dataUpdatedAt || undefined} now={now} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: Platform.OS === 'ios' ? space.sm : insets.top + space.md,
          paddingBottom: Platform.OS === 'ios' ? space.xxxl : insets.bottom + 96,
        }}
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        ListEmptyComponent={
          activities.isPending ? (
            <View style={{ gap: space.md }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 64, borderRadius: radius.md }} />
              ))}
            </View>
          ) : activities.isError ? (
            <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />
          ) : (
            <EmptyState
              title="Nothing logged yet"
              message="Waterings, fertilizer and pest reports show up here."
            />
          )
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return (
              <Text
                variant="eyebrow"
                color="inkMuted"
                style={styles.dayHeader}
                accessibilityRole="header">
                {row.label}
              </Text>
            );
          }
          if (row.kind === 'pending') {
            return (
              <View style={[styles.card, styles.cardSingle]}>
                <ActivityRow
                  activity={{ ...row.item.input, note: row.item.input.note ?? null }}
                  plotName={plotName(row.item.input.plotId)}
                  timeZone={tz}
                  sync={row.item.failed ? 'failed' : 'pending'}
                />
              </View>
            );
          }
          return (
            <View style={[styles.card, row.first && styles.cardFirst, row.last && styles.cardLast]}>
              {row.first ? null : <Divider />}
              <ActivityRow activity={row.item} plotName={row.item.plotName} timeZone={tz} />
            </View>
          );
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (activities.hasNextPage && !activities.isFetchingNextPage)
            void activities.fetchNextPage();
        }}
        ListFooterComponent={
          activities.isFetchingNextPage ? (
            <ActivityIndicator color={colors.inkMuted} style={{ marginTop: space.lg }} />
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.inkMuted}
            colors={[colors.leaf]}
          />
        }
      />
      <StatusBarBackdrop />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: space.lg, marginBottom: space.sm },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.sm },
  headerText: { flex: 1, gap: space.xs },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dayHeader: { marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    borderColor: colors.line,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  cardSingle: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    marginBottom: space.sm,
  },
  cardFirst: {
    borderTopWidth: 2,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  cardLast: {
    borderBottomWidth: 4,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
});
