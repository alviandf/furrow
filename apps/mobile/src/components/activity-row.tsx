import type { ActivityType, CreateActivityInput } from '@furrow/shared';
import { StyleSheet, View } from 'react-native';

import { formatClock, formatDuration, formatVolume } from '@/lib/format';
import { colors, radius, space, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; short: string; icon: IconName; color: ColorName; tint: ColorName }
> = {
  irrigation: {
    label: 'Watering',
    short: 'Water',
    icon: 'drop',
    color: 'skyText',
    tint: 'skyTint',
  },
  fertilizer: {
    label: 'Fertilizer',
    short: 'Feed',
    icon: 'flask',
    color: 'leafText',
    tint: 'leafTint',
  },
  pest: {
    label: 'Pest or disease',
    short: 'Pests',
    icon: 'bug',
    color: 'tomatoText',
    tint: 'tomatoTint',
  },
  note: { label: 'Note', short: 'Notes', icon: 'note', color: 'grapeText', tint: 'grapeTint' },
};

/** Type + details, kept as a discriminated union so `type` narrows `details`. */
type ActivityLike = {
  [K in ActivityType]: Pick<Extract<CreateActivityInput, { type: K }>, 'type' | 'details'>;
}[ActivityType];

export function activitySummary(activity: ActivityLike): string {
  switch (activity.type) {
    case 'irrigation': {
      const { durationMin, volumeL } = activity.details;
      return volumeL
        ? `${formatDuration(durationMin)} · ${formatVolume(volumeL)}`
        : formatDuration(durationMin);
    }
    case 'fertilizer':
      return `${activity.details.product} · ${activity.details.amount} ${activity.details.unit}`;
    case 'pest':
      return `${activity.details.name} · ${activity.details.severity} severity`;
    case 'note':
      return activity.details.text;
  }
}

export function ActivityRow({
  activity,
  plotName,
  timeZone,
  sync = 'synced',
}: {
  activity: ActivityLike & { occurredAt: string; note?: string | null };
  plotName: string;
  timeZone: string;
  sync?: 'synced' | 'pending' | 'failed';
}) {
  const meta = ACTIVITY_META[activity.type];
  const summary = activitySummary(activity);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${meta.label}, ${plotName}, ${formatClock(activity.occurredAt, timeZone)}. ${summary}.${
        sync === 'pending' ? ' Waiting to sync.' : sync === 'failed' ? ' Could not be saved.' : ''
      }`}>
      <View style={[styles.icon, { backgroundColor: colors[meta.tint] }]}>
        <Icon name={meta.icon} size={19} weight="fill" color={colors[meta.color]} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium" style={styles.title} numberOfLines={1}>
            {activity.type === 'note' ? 'Note' : summary}
          </Text>
          <Text variant="data" color="inkFaint">
            {formatClock(activity.occurredAt, timeZone)}
          </Text>
        </View>
        <Text variant="small" color="inkMuted" numberOfLines={activity.type === 'note' ? 3 : 1}>
          {plotName} · {activity.type === 'note' ? summary : meta.label}
        </Text>
        {activity.note ? (
          <Text variant="small" color="inkMuted" numberOfLines={2} style={styles.note}>
            “{activity.note}”
          </Text>
        ) : null}
        {sync !== 'synced' ? (
          <View
            style={[
              styles.sync,
              { backgroundColor: sync === 'failed' ? colors.dangerTint : colors.skyTint },
            ]}>
            <Icon
              name={sync === 'failed' ? 'warning' : 'sync'}
              size={12}
              weight="bold"
              color={sync === 'failed' ? colors.danger : colors.skyText}
            />
            <Text variant="smallMedium" color={sync === 'failed' ? 'danger' : 'skyText'}>
              {sync === 'failed' ? 'Not saved' : 'Waiting to sync'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  title: { flex: 1 },
  note: { fontStyle: 'italic' },
  sync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
