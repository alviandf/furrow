import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useDismissFailedActivities, useIsOnline, usePendingActivities } from '@/api/hooks';
import { formatAgo } from '@/lib/format';
import { colors, radius, space, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * One line that explains what the user is looking at when things aren't live:
 * offline with cached data, entries waiting to sync, or entries the server rejected.
 */
export function ConnectivityBanner({
  dataUpdatedAt,
  now,
}: {
  dataUpdatedAt?: number;
  now: number;
}) {
  const online = useIsOnline();
  const pending = usePendingActivities();
  const dismissFailed = useDismissFailedActivities();

  const failed = pending.filter((p) => p.failed);
  const waiting = pending.length - failed.length;
  const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

  let content: {
    icon: IconName;
    title: string;
    detail?: string;
    fg: ColorName;
    bg: string;
  } | null = null;
  if (failed.length > 0) {
    content = {
      icon: 'warning',
      fg: 'danger',
      bg: colors.dangerTint,
      title: `${entries(failed.length)} couldn't be saved`,
      detail: failed[0]?.error ?? undefined,
    };
  } else if (!online) {
    content = {
      icon: 'cloudOff',
      fg: 'grapeText',
      bg: colors.grapeTint,
      title: "You're offline",
      detail: [
        dataUpdatedAt ? `Showing data from ${formatAgo(dataUpdatedAt, now)}` : null,
        waiting > 0 ? `${entries(waiting)} waiting to sync` : 'Logging still works',
      ]
        .filter(Boolean)
        .join(' · '),
    };
  } else if (waiting > 0) {
    content = {
      icon: 'sync',
      fg: 'skyText',
      bg: colors.skyTint,
      title: `Syncing ${entries(waiting)}…`,
    };
  }

  if (!content) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <View
        style={[styles.banner, { backgroundColor: content.bg }]}
        accessibilityLiveRegion="polite"
        accessible>
        <View style={styles.icon}>
          <Icon name={content.icon} size={18} weight="bold" color={colors[content.fg]} />
        </View>
        <View style={styles.text}>
          <Text variant="smallMedium" color={content.fg}>
            {content.title}
          </Text>
          {content.detail ? (
            <Text variant="small" color="inkMuted" numberOfLines={2}>
              {content.detail}
            </Text>
          ) : null}
        </View>
        {failed.length > 0 ? (
          <PressableScale onPress={dismissFailed} accessibilityRole="button" hitSlop={10}>
            <Text variant="smallMedium" color="danger">
              Dismiss
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
});
