import type { WeatherMeta } from '@furrow/shared';
import { Linking, Pressable } from 'react-native';

import { Text } from './text';

/** Open-Meteo data is CC BY 4.0: credit it, linked, wherever it is shown. */
export function WeatherAttribution({ weather }: { weather: WeatherMeta }) {
  const { attribution } = weather;
  if (!attribution) {
    return (
      <Text variant="small" color="inkFaint">
        Synthetic weather · Open-Meteo unreachable
      </Text>
    );
  }
  return (
    <Pressable
      onPress={() => void Linking.openURL(attribution.url)}
      accessibilityRole="link"
      hitSlop={8}>
      <Text variant="small" color="inkFaint" style={{ textDecorationLine: 'underline' }}>
        {attribution.text}
        {weather.stale ? ' · forecast not refreshed recently' : ''}
      </Text>
    </Pressable>
  );
}
