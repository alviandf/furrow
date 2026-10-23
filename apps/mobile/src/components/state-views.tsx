import { StyleSheet, View } from 'react-native';

import { NetworkError } from '@/api/client';
import { colors, radius, space } from '@/theme/tokens';

import { Button } from './button';
import { CropMascot, type CropKind, type Mood } from './mascot';
import { Text } from './text';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const offline = error instanceof NetworkError;
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <CropMascot crop="date-palm" mood="sleepy" size={84} />
      <Text variant="heading" align="center">
        {offline ? "Can't reach the farm server" : 'Something went wrong'}
      </Text>
      <Text variant="small" color="inkMuted" align="center">
        {offline
          ? 'Check your connection. Anything you log is saved and syncs later.'
          : error instanceof Error
            ? error.message
            : 'Try again in a moment.'}
      </Text>
      <Button
        label="Try again"
        icon="sync"
        tone="secondary"
        onPress={onRetry}
        style={styles.button}
      />
    </View>
  );
}

export function EmptyState({
  title,
  message,
  crop = 'lettuce',
  mood = 'happy',
}: {
  title: string;
  message: string;
  crop?: CropKind;
  mood?: Mood;
}) {
  return (
    <View style={styles.box}>
      <CropMascot crop={crop} mood={mood} size={72} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="small" color="inkMuted" align="center">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  button: { marginTop: space.sm, alignSelf: 'stretch' },
});
