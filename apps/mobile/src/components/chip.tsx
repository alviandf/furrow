import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed ? { transform: [{ scale: 0.96 }] } : null,
      ]}>
      {icon ? (
        <Icon
          name={icon}
          size={15}
          weight="bold"
          color={selected ? colors.primaryInk : colors.inkMuted}
        />
      ) : null}
      <Text variant="smallMedium" color={selected ? 'primaryInk' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: 42,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.line },
  selected: { backgroundColor: colors.leaf, borderColor: colors.leafDeep },
});
