import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, radius, space } from '@/theme/tokens';

import { Text } from './text';

export function TextField({
  label,
  multiline,
  style,
  ...rest
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.wrap}>
      <Text variant="smallMedium" color="inkMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.leaf}
        multiline={multiline}
        {...rest}
        style={[styles.input, multiline && styles.multiline, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  input: {
    minHeight: 52,
    borderRadius: radius.md + 2,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fontFamily.body,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
