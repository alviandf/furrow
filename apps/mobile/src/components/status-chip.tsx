import type { PlotStatus } from '@furrow/shared';
import { StyleSheet, View } from 'react-native';

import { STATUS } from '@/lib/semantics';
import { colors, radius, space } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';

/** Status is shown with icon + label + color, never color alone. */
export function StatusChip({ status }: { status: PlotStatus }) {
  const s = STATUS[status];
  return (
    <View
      style={[styles.chip, { backgroundColor: colors[s.tint] }]}
      accessible
      accessibilityLabel={`Status: ${s.formal}`}>
      <Icon name={s.icon} size={14} weight="fill" color={colors[s.color]} />
      <Text variant="smallMedium" color={s.color}>
        {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
