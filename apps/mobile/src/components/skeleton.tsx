import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, space } from '@/theme/tokens';

import { Card } from './card';

/** A softly pulsing placeholder block (static with Reduce Motion). */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!reducedMotion) pulse.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * pulse.get() }));
  return <Animated.View style={[styles.block, style, animatedStyle]} />;
}

export function PlotCardSkeleton() {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Skeleton style={{ width: 52, height: 52, borderRadius: radius.md }} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton style={{ width: 96, height: 18 }} />
          <Skeleton style={{ width: 150, height: 12 }} />
        </View>
      </View>
      <Skeleton style={{ height: 12, borderRadius: radius.pill }} />
      <Skeleton style={{ height: 44, borderRadius: radius.md }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#F3E9D6', borderRadius: radius.sm, height: 14 },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
