import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, EDGE, radius, space } from '@/theme/tokens';

import { Text } from './text';

/**
 * White "sticker" card with a soft chunky edge. Pass `tint` for a flat,
 * colored card instead (no border).
 */
export function Card({
  children,
  style,
  tint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
}) {
  return (
    <View style={[tint ? [styles.tinted, { backgroundColor: tint }] : styles.raised, style]}>
      {children}
    </View>
  );
}

/** Friendly section title with optional trailing content. */
export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <View style={styles.section} accessibilityRole="header">
      <Text variant="heading">{title}</Text>
      {typeof aside === 'string' ? (
        <Text variant="small" color="inkFaint">
          {aside}
        </Text>
      ) : (
        aside
      )}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  raised: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 2 + EDGE,
    borderColor: colors.line,
    padding: space.lg,
  },
  tinted: {
    borderRadius: radius.lg,
    padding: space.lg,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    marginTop: space.sm,
  },
  divider: { height: 2, borderRadius: 1, backgroundColor: colors.line },
});
