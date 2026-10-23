/**
 * Crop mascots. The face mirrors the plot's status (always paired with a text
 * label elsewhere), and a small idle animation gives each one some life.
 * Drawn in a 48×48 design grid with Skia; animations run on the UI thread and
 * stop with Reduce Motion.
 */

import { Canvas, Circle, Group, Oval, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

export type CropKind = 'tomato' | 'cucumber' | 'lettuce' | 'date-palm';
export type Mood = 'happy' | 'thirsty' | 'soggy' | 'sleepy' | 'cheer';

const INK = colors.ink;
const CHEEK = '#FFB4A6';

/** Vertical center of the face for each crop. */
const FACE_Y: Record<CropKind, number> = {
  tomato: 27.5,
  cucumber: 24,
  lettuce: 27,
  'date-palm': 28,
};

const LETTUCE_RUFFLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return { cx: 24 + Math.cos(angle) * 10, cy: 28 + Math.sin(angle) * 9.5 };
});

function Body({ crop }: { crop: CropKind }) {
  switch (crop) {
    case 'tomato':
      return (
        <Group>
          <Circle cx={24} cy={28} r={16} color={colors.tomatoBright} />
          <Circle cx={17} cy={21} r={3} color="#FF8F7E" />
          <Path
            path="M24 5 L27 11 L33 9 L29 14 L32 19 L24 16 L16 19 L19 14 L15 9 L21 11 Z"
            color={colors.leafBright}
          />
        </Group>
      );
    case 'cucumber':
      return (
        <Group>
          <RoundedRect x={13} y={7} width={22} height={36} r={11} color="#6CC24A" />
          <Circle cx={18} cy={14} r={1.7} color="#A7E27E" />
          <Circle cx={31} cy={13} r={1.2} color="#A7E27E" />
          <Circle cx={30} cy={37} r={1.7} color="#A7E27E" />
          <Circle cx={17} cy={36} r={1.2} color="#A7E27E" />
        </Group>
      );
    case 'lettuce':
      return (
        <Group>
          {LETTUCE_RUFFLES.map((r) => (
            <Circle key={`${r.cx}-${r.cy}`} cx={r.cx} cy={r.cy} r={7.5} color="#7CCB4F" />
          ))}
          <Circle cx={24} cy={28} r={12.5} color="#A8E07A" />
        </Group>
      );
    case 'date-palm':
      return (
        <Group>
          <Path
            path="M24 15 C20 7 12 8 13 14 M24 15 C28 7 36 8 35 14 M24 15 C24 10 25 6 27 4"
            color={colors.leafBright}
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
          />
          <Oval x={11} y={15} width={26} height={29} color="#B5712F" />
          <Oval x={15} y={19} width={7} height={5} color="#C98B4E" />
        </Group>
      );
  }
}

function Face({
  mood,
  y,
  eyes,
}: {
  mood: Mood;
  y: number;
  eyes: SharedValue<{ scaleY: number }[]>;
}) {
  const stroke = {
    color: INK,
    style: 'stroke' as const,
    strokeWidth: 2.2,
    strokeCap: 'round' as const,
  };
  const cheeks = (
    <Group>
      <Oval x={12.5} y={y + 3.3} width={6} height={3.4} color={CHEEK} />
      <Oval x={29.5} y={y + 3.3} width={6} height={3.4} color={CHEEK} />
    </Group>
  );
  const roundEyes = (
    <Group transform={eyes} origin={vec(24, y - 1)}>
      <Circle cx={19} cy={y - 1} r={2.2} color={INK} />
      <Circle cx={29} cy={y - 1} r={2.2} color={INK} />
    </Group>
  );

  switch (mood) {
    case 'happy':
      return (
        <Group>
          {roundEyes}
          {cheeks}
          <Path path={`M19.5 ${y + 4} Q24 ${y + 9} 28.5 ${y + 4}`} {...stroke} />
        </Group>
      );
    case 'cheer':
      return (
        <Group>
          <Path
            path={`M16.5 ${y} Q19 ${y - 3.5} 21.5 ${y} M26.5 ${y} Q29 ${y - 3.5} 31.5 ${y}`}
            {...stroke}
          />
          {cheeks}
          <Path path={`M19 ${y + 3.5} Q24 ${y + 11} 29 ${y + 3.5} Z`} color={INK} />
        </Group>
      );
    case 'thirsty':
      return (
        <Group>
          <Path path={`M17 ${y - 1} L21 ${y - 1} M27 ${y - 1} L31 ${y - 1}`} {...stroke} />
          <Path path={`M20 ${y + 7} Q24 ${y + 3.5} 28 ${y + 7}`} {...stroke} />
        </Group>
      );
    case 'soggy':
      return (
        <Group>
          {roundEyes}
          <Path path={`M18.5 ${y + 6} q2.75 -2.4 5.5 0 t5.5 0`} {...stroke} />
        </Group>
      );
    case 'sleepy':
      return (
        <Group>
          <Path path={`M16.5 ${y - 1} q2.5 2.2 5 0 M26.5 ${y - 1} q2.5 2.2 5 0`} {...stroke} />
          <Circle cx={24} cy={y + 6} r={1.8} color={INK} />
        </Group>
      );
  }
}

const DROP = 'M0 0 C2.5 4.5 3 7 0 8.5 C-3 7 -2.5 4.5 0 0 Z';
const ZED = 'M0 0 H5 L0 6 H5';

export function CropMascot({
  crop,
  mood,
  size = 48,
  animated = true,
}: {
  crop: CropKind;
  mood: Mood;
  size?: number;
  animated?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;

  /** 0↔1 back and forth: breathing, wobble, hop. */
  const loop = useSharedValue(0);
  /** 0→1 repeating: drips and floating z's. */
  const cycle = useSharedValue(0.35);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (!live) {
      loop.set(0);
      cycle.set(0.35);
      blink.set(1);
      return;
    }
    const duration =
      mood === 'cheer' ? 380 : mood === 'thirsty' ? 850 : mood === 'sleepy' ? 2400 : 1600;
    loop.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    cycle.set(0);
    cycle.set(withRepeat(withTiming(1, { duration: mood === 'sleepy' ? 2600 : 1300 }), -1, false));
    blink.set(
      withRepeat(
        withSequence(
          withDelay(2800, withTiming(0.1, { duration: 80 })),
          withTiming(1, { duration: 120 }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(loop);
      cancelAnimation(cycle);
      cancelAnimation(blink);
    };
  }, [live, mood, loop, cycle, blink]);

  const bodyTransform = useDerivedValue(() => {
    const v = loop.get();
    switch (mood) {
      case 'thirsty':
        return [{ rotate: (v - 0.5) * 0.16 }];
      case 'soggy':
        return [{ translateX: (v - 0.5) * 2.4 }];
      case 'sleepy':
        return [{ scale: 1 + v * 0.035 }];
      case 'cheer':
        return [{ translateY: -v * 7 }];
      default:
        return [{ translateY: -v * 1.5 }, { scale: 1 + v * 0.02 }];
    }
  });
  const eyes = useDerivedValue(() => [{ scaleY: blink.get() }]);
  const dripTransform = useDerivedValue(() => [{ translateY: cycle.get() * 9 }]);
  const dripOpacity = useDerivedValue(() => {
    const c = cycle.get();
    return c < 0.15 ? c / 0.15 : 1 - (c - 0.15) / 0.85;
  });
  const zedA = useDerivedValue(() => {
    const c = cycle.get();
    return [{ translateX: 35 + c * 4 }, { translateY: 15 - c * 11 }, { scale: 0.9 + c * 0.3 }];
  });
  const zedB = useDerivedValue(() => {
    const c = (cycle.get() + 0.5) % 1;
    return [{ translateX: 37 + c * 4 }, { translateY: 13 - c * 11 }, { scale: 0.7 + c * 0.3 }];
  });
  const zedAOpacity = useDerivedValue(() => Math.sin(cycle.get() * Math.PI));
  const zedBOpacity = useDerivedValue(() => Math.sin(((cycle.get() + 0.5) % 1) * Math.PI));

  return (
    <Canvas
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Group transform={[{ scale: size / 48 }]}>
        {mood === 'soggy' ? (
          <Oval x={8} y={43} width={32} height={4} color={colors.skyBright} opacity={0.35} />
        ) : null}
        <Group transform={bodyTransform} origin={vec(24, 44)}>
          <Body crop={crop} />
          <Face mood={mood} y={FACE_Y[crop]} eyes={eyes} />
        </Group>
        {mood === 'thirsty' ? (
          <Group transform={dripTransform} opacity={dripOpacity}>
            <Path
              path={DROP}
              color={colors.skyBright}
              transform={[{ translateX: 40 }, { translateY: 7 }]}
            />
          </Group>
        ) : null}
        {mood === 'soggy' ? (
          <Group transform={dripTransform} opacity={dripOpacity}>
            <Path
              path={DROP}
              color={colors.skyBright}
              transform={[{ translateX: 12 }, { translateY: 34 }, { scale: 0.7 }]}
            />
            <Path
              path={DROP}
              color={colors.skyBright}
              transform={[{ translateX: 37 }, { translateY: 31 }, { scale: 0.6 }]}
            />
          </Group>
        ) : null}
        {mood === 'sleepy' ? (
          <Group>
            <Group transform={zedA} opacity={zedAOpacity}>
              <Path
                path={ZED}
                color={colors.grape}
                style="stroke"
                strokeWidth={1.8}
                strokeCap="round"
                strokeJoin="round"
              />
            </Group>
            <Group transform={zedB} opacity={zedBOpacity}>
              <Path
                path={ZED}
                color={colors.grape}
                style="stroke"
                strokeWidth={1.8}
                strokeCap="round"
                strokeJoin="round"
              />
            </Group>
          </Group>
        ) : null}
      </Group>
    </Canvas>
  );
}
