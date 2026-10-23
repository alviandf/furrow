import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

const RAYS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

/** A little sun whose rays turn slowly (still with Reduce Motion). */
export function SunBadge({ size = 44 }: { size?: number }) {
  const reducedMotion = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    spin.set(
      withRepeat(withTiming(Math.PI * 2, { duration: 16000, easing: Easing.linear }), -1, false),
    );
  }, [reducedMotion, spin]);

  const rays = useDerivedValue(() => [{ rotate: spin.get() }]);
  const c = size / 2;

  return (
    <Canvas style={{ width: size, height: size }} accessibilityElementsHidden>
      <Group transform={rays} origin={vec(c, c)}>
        {RAYS.map((angle) => (
          <Line
            key={angle}
            p1={vec(c + Math.cos(angle) * size * 0.32, c + Math.sin(angle) * size * 0.32)}
            p2={vec(c + Math.cos(angle) * size * 0.45, c + Math.sin(angle) * size * 0.45)}
            color={colors.sunDeep}
            strokeWidth={size * 0.07}
            strokeCap="round"
          />
        ))}
      </Group>
      <Circle cx={c} cy={c} r={size * 0.22} color={colors.sunDeep} />
    </Canvas>
  );
}
