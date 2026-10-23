import { zonedDate, zonedTimeToEpoch, type DailyForecast, type WeatherMeta } from '@furrow/shared';
import { StyleSheet, View } from 'react-native';

import { formatWeekday } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

import { WeatherAttribution } from './attribution';
import { Card } from './card';
import { Icon, type IconName } from './icon';
import { Text } from './text';

function dayLabel(date: string, timeZone: string, now: number): string {
  if (date === zonedDate(now, timeZone)) return 'Today';
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return formatWeekday(zonedTimeToEpoch(y, m, d, 12, 0, timeZone), timeZone);
}

function sky(day: DailyForecast): { icon: IconName; color: string } {
  const chance = day.rainProbability ?? 0;
  if (day.rainMm >= 1 || chance >= 60) return { icon: 'rain', color: colors.sky };
  return chance >= 30
    ? { icon: 'cloudSun', color: colors.sunDeep }
    : { icon: 'sun', color: colors.sunDeep };
}

export function ForecastCard({
  days,
  weather,
  timeZone,
  now,
}: {
  days: DailyForecast[];
  weather: WeatherMeta;
  timeZone: string;
  now: number;
}) {
  const maxEt0 = Math.max(1, ...days.map((d) => d.et0Mm));
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text variant="heading" style={styles.title}>
          This week
        </Text>
        <Text variant="eyebrow" color="inkFaint" style={styles.rainCol}>
          Rain
        </Text>
        <Text variant="eyebrow" color="inkFaint" style={styles.et0Header}>
          Crop thirst
        </Text>
      </View>
      {days.map((day) => {
        const s = sky(day);
        return (
          <View
            key={day.date}
            style={styles.row}
            accessible
            accessibilityLabel={`${dayLabel(day.date, timeZone, now)}: high ${Math.round(day.maxTempC)}, low ${Math.round(day.minTempC)} degrees, rain chance ${day.rainProbability ?? 0} percent, evapotranspiration ${day.et0Mm.toFixed(1)} millimetres`}>
            <Text variant="bodyMedium" style={styles.dayCol}>
              {dayLabel(day.date, timeZone, now)}
            </Text>
            <View style={styles.temps}>
              <Icon name={s.icon} size={20} weight="fill" color={s.color} />
              <Text variant="dataMedium">{Math.round(day.maxTempC)}°</Text>
              <Text variant="data" color="inkFaint">
                {Math.round(day.minTempC)}°
              </Text>
            </View>
            <Text
              variant="data"
              color={(day.rainProbability ?? 0) >= 30 ? 'skyText' : 'inkMuted'}
              style={styles.rainCol}>
              {day.rainMm >= 0.1 ? `${day.rainMm.toFixed(1)} mm` : `${day.rainProbability ?? 0}%`}
            </Text>
            <View style={styles.et0Col}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: `${(day.et0Mm / maxEt0) * 100}%` }]} />
              </View>
              <Text variant="data" style={styles.et0Value}>
                {day.et0Mm.toFixed(1)}
              </Text>
            </View>
          </View>
        );
      })}
      <WeatherAttribution weather={weather} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  dayCol: { width: 64 },
  temps: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rainCol: { width: 56, textAlign: 'right' },
  et0Header: { width: 104, textAlign: 'right' },
  et0Col: {
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.skyTint,
    marginLeft: space.md,
  },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.skyBright },
  et0Value: { width: 28, textAlign: 'right' },
});
