import type { TextStyle } from 'react-native';

/**
 * Fun and cheerful: a sunny cream canvas, white "sticker" cards and bright,
 * friendly accents. Fills that carry white text (leaf, tomato, sky) are deep
 * enough for WCAG AA; the bright tones are used for illustrations and tints.
 */
export const colors = {
  bg: '#FFF7E8',
  surface: '#FFFFFF',
  surfaceAlt: '#F7EEDC',
  line: '#F1E6CF',
  lineStrong: '#E6D6B5',

  ink: '#2D2A3E',
  inkMuted: '#6F6A7D',
  inkFaint: '#7A7366',

  leaf: '#1B8048',
  leafDeep: '#135C33',
  leafBright: '#3BB273',
  leafTint: '#DDF5E5',
  leafText: '#1B6B3F',

  tomato: '#CC4429',
  tomatoDeep: '#9E3018',
  tomatoBright: '#FF6B57',
  tomatoTint: '#FFE3D8',
  tomatoText: '#B23A20',

  sky: '#1D7FB8',
  skyDeep: '#155E88',
  skyBright: '#5BC4F5',
  skyTint: '#DDF2FD',
  skyText: '#0B6A99',

  sun: '#FFD54A',
  sunDeep: '#F5A623',
  sunTint: '#FFF0B8',
  sunText: '#7A5A12',

  grape: '#7C6AD6',
  grapeTint: '#EDE7FF',
  grapeText: '#5B4BB8',

  danger: '#C0392B',
  dangerTint: '#FDE2DF',

  primaryInk: '#FFFFFF',
  chartGrid: '#F1E9D8',
  band: 'rgba(59, 178, 115, 0.18)',
  bandEdge: 'rgba(27, 128, 72, 0.45)',
} as const;

export type ColorName = keyof typeof colors;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const fontFamily = {
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
} as const;

export const typography = {
  display: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.bodyHeavy, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: fontFamily.bodyHeavy, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fontFamily.bodyHeavy, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.2 },
  readout: { fontFamily: fontFamily.display, fontSize: 52, lineHeight: 58 },
  readoutSmall: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30 },
  data: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 18 },
  dataMedium: { fontFamily: fontFamily.display, fontSize: 17, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typography;

/** Minimum touch target (dp). */
export const HIT = 48;

/** Height of the "pressable edge" under chunky buttons and cards. */
export const EDGE = 4;

export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
