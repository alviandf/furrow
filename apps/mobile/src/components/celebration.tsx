/**
 * Watering celebration: a few drops fall, then confetti bursts outward.
 * Plays once on mount; with Reduce Motion nothing animates.
 */

import { Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

const DROP = 'M0 0 C3.5 6 4.2 9.5 0 11.5 C-4.2 9.5 -3.5 6 0 0 Z';
const CONFETTI_COLORS = [
  colors.tomatoBright,
  colors.sun,
  colors.grape,
  colors.leafBright,
  colors.skyBright,
];

interface Piece {
  angle: number;
  distance: number;
  color: string;
  size: number;
  round: boolean;
  spin: number;
}

const PIECES: Piece[] = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 + (i % 3) * 0.17,
  distance: 70 + ((i * 37) % 55),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
  size: 6 + (i % 3) * 1.5,
  round: i % 2 === 0,
  spin: (i % 2 === 0 ? 1 : -1) * (3 + (i % 4)),
}));

function ConfettiPiece({
  piece,
  burst,
  cx,
  cy,
}: {
  piece: Piece;
  burst: SharedValue<number>;
  cx: number;
  cy: number;
}) {
  const transform = useDerivedValue(() => {
    const b = burst.get();
    return [
      { translateX: cx + Math.cos(piece.angle) * piece.distance * b },
      { translateY: cy + Math.sin(piece.angle) * piece.distance * b + 40 * b * b },
      { rotate: piece.spin * b },
    ];
  });
  const opacity = useDerivedValue(() => {
    const b = burst.get();
    return b <= 0 ? 0 : b < 0.7 ? 1 : 1 - (b - 0.7) / 0.3;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      {piece.round ? (
        <Circle cx={0} cy={0} r={piece.size / 2} color={piece.color} />
      ) : (
        <RoundedRect
          x={-piece.size / 2}
          y={-piece.size / 2}
          width={piece.size}
          height={piece.size}
          r={2}
          color={piece.color}
        />
      )}
    </Group>
  );
}

function FallingDrop({
  rain,
  x,
  offset,
  top,
}: {
  rain: SharedValue<number>;
  x: number;
  offset: number;
  top: number;
}) {
  const transform = useDerivedValue(() => {
    const r = (rain.get() + offset) % 1;
    return [{ translateX: x }, { translateY: top + r * 56 }];
  });
  const opacity = useDerivedValue(() => {
    const r = (rain.get() + offset) % 1;
    return rain.get() >= 0.999 ? 0 : r < 0.2 ? r / 0.2 : 1 - (r - 0.2) / 0.8;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={DROP} color={colors.skyBright} />
    </Group>
  );
}

export function Celebration({
  width,
  height,
  drops = true,
  centerY,
}: {
  width: number;
  height: number;
  drops?: boolean;
  /** Where the confetti bursts from (defaults to the vertical middle). */
  centerY?: number;
}) {
  const reducedMotion = useReducedMotion();
  const rain = useSharedValue(0);
  const burst = useSharedValue(0);
  const cx = width / 2;
  const cy = centerY ?? height / 2;

  useEffect(() => {
    if (reducedMotion) return;
    if (drops)
      rain.set(
        withRepeat(withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) }), 3, false),
      );
    burst.set(
      withDelay(
        drops ? 1500 : 150,
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [drops, reducedMotion, rain, burst]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {drops ? (
        <Group>
          <FallingDrop rain={rain} x={cx - 34} offset={0} top={cy - 110} />
          <FallingDrop rain={rain} x={cx} offset={0.35} top={cy - 124} />
          <FallingDrop rain={rain} x={cx + 32} offset={0.7} top={cy - 108} />
        </Group>
      ) : null}
      {PIECES.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} burst={burst} cx={cx} cy={cy} />
      ))}
    </Canvas>
  );
}
