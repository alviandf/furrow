import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, withAlpha } from '@/theme/tokens';

/** Keeps scrolled content from running under the status bar. */
export function StatusBarBackdrop() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.backdrop, { height: insets.top }]} />;
}

/**
 * Scrolling screen body. On iOS the system adjusts insets for the status bar
 * and the native tab bar; Android gets explicit padding.
 */
export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          {
            paddingHorizontal: space.lg,
            paddingTop: ios ? space.sm : insets.top + space.md,
            paddingBottom: ios ? space.xxxl : insets.bottom + 96,
            gap: space.lg,
          },
          contentStyle,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors.inkMuted}
              colors={[colors.leaf]}
            />
          ) : undefined
        }>
        {children}
      </ScrollView>
      <StatusBarBackdrop />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: withAlpha(colors.bg, 0.96),
  },
});
