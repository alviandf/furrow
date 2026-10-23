import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, HIT, radius, space } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';

/** Big −/+ control for gloved hands; also adjustable with screen-reader swipes. */
export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  format: (value: number) => string;
  label: string;
}) {
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next / step) * step));
    if (clamped !== value) {
      void Haptics.selectionAsync();
      onChange(clamped);
    }
  };

  const button = (icon: 'minus' | 'plus', disabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      importantForAccessibility="no"
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Icon name={icon} size={22} weight="bold" />
    </Pressable>
  );

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        set(value + (event.nativeEvent.actionName === 'increment' ? step : -step))
      }>
      {button('minus', value <= min, () => set(value - step))}
      <Text variant="readoutSmall" align="center" style={styles.value}>
        {format(value)}
      </Text>
      {button('plus', value >= max, () => set(value + step))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.skyTint,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  button: {
    width: HIT + 8,
    height: HIT + 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#BFE3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { borderBottomWidth: 2, marginTop: 3 },
  disabled: { opacity: 0.4 },
  value: { flex: 1, color: colors.skyText },
});
