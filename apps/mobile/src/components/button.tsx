import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, EDGE, HIT, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type ButtonTone = 'primary' | 'urgent' | 'water' | 'secondary';

const TONES: Record<ButtonTone, { face: string; edge: string; ink: string; border?: string }> = {
  primary: { face: colors.leaf, edge: colors.leafDeep, ink: colors.primaryInk },
  urgent: { face: colors.tomato, edge: colors.tomatoDeep, ink: colors.primaryInk },
  water: { face: colors.sky, edge: colors.skyDeep, ink: colors.primaryInk },
  secondary: {
    face: colors.surface,
    edge: colors.lineStrong,
    ink: colors.ink,
    border: colors.lineStrong,
  },
};

/** Chunky press: the face slides down over its darker edge, like a real button. */
function usePressDepth() {
  const pressed = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.get() * EDGE }] }));
  return {
    faceStyle,
    onPressIn: () => pressed.set(withTiming(1, { duration: 60 })),
    onPressOut: () => pressed.set(withTiming(0, { duration: 140 })),
  };
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  icon,
  loading = false,
  disabled = false,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  const press = usePressDepth();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.edge, { backgroundColor: t.edge, opacity: disabled ? 0.5 : 1 }, style]}>
      <Animated.View
        style={[
          styles.face,
          { backgroundColor: t.face, borderColor: t.border ?? t.face },
          press.faceStyle,
        ]}>
        {loading ? (
          <ActivityIndicator color={t.ink} />
        ) : (
          <View style={styles.row}>
            {icon ? <Icon name={icon} size={19} color={t.ink} weight="bold" /> : null}
            <Text variant="bodyMedium" style={{ color: t.ink, fontSize: 16 }}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Round icon-only chunky button with a 48 dp hit area. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'secondary',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
}) {
  const t = TONES[tone];
  const press = usePressDepth();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[styles.iconEdge, { backgroundColor: t.edge }]}>
      <Animated.View
        style={[
          styles.iconFace,
          { backgroundColor: t.face, borderColor: t.border ?? t.face },
          press.faceStyle,
        ]}>
        <Icon name={icon} size={21} weight="bold" color={t.ink} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { borderRadius: radius.md + 2 },
  face: {
    minHeight: HIT + 4,
    marginBottom: EDGE,
    borderRadius: radius.md + 2,
    borderWidth: 2,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconEdge: { width: 46, height: 46 + EDGE, borderRadius: radius.pill },
  iconFace: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
