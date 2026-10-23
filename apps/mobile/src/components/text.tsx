import { Text as RNText, type TextProps } from 'react-native';

import { colors, typography, type ColorName, type TypeVariant } from '@/theme/tokens';

/** Large readouts scale less so they never break their layout. */
const MAX_SCALE: Partial<Record<TypeVariant, number>> = {
  display: 1.3,
  readout: 1.15,
  readoutSmall: 1.3,
  eyebrow: 1.4,
};

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'ink', align, style, ...rest }: AppTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant] ?? 1.6}
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
