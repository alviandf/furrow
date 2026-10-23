import type { Action, PlotStatus, PlotSummaryDto } from '@furrow/shared';

import type { ButtonTone } from '@/components/button';
import type { IconName } from '@/components/icon';
import type { CropKind, Mood } from '@/components/mascot';
import type { ColorName } from '@/theme/tokens';

import { formatClock, formatDuration, formatVolume } from './format';

interface Tone {
  color: ColorName;
  tint: ColorName;
  icon: IconName;
}

/** Friendly labels; the formal meaning is kept for screen readers. */
export const STATUS: Record<PlotStatus, Tone & { label: string; formal: string; mood: Mood }> = {
  OPTIMAL: {
    label: 'Happy',
    formal: 'optimal',
    mood: 'happy',
    color: 'leafText',
    tint: 'leafTint',
    icon: 'check',
  },
  NEEDS_WATER: {
    label: 'Thirsty',
    formal: 'needs water',
    mood: 'thirsty',
    color: 'tomatoText',
    tint: 'tomatoTint',
    icon: 'drop',
  },
  OVERWATERED: {
    label: 'Too much water',
    formal: 'overwatered',
    mood: 'soggy',
    color: 'skyText',
    tint: 'skyTint',
    icon: 'waves',
  },
  OFFLINE: {
    label: 'Sensor asleep',
    formal: 'sensor offline',
    mood: 'sleepy',
    color: 'grapeText',
    tint: 'grapeTint',
    icon: 'signalOff',
  },
};

export const ACTION_TONE: Record<Action, Tone & { button: ButtonTone }> = {
  IRRIGATE_NOW: { color: 'tomatoText', tint: 'tomatoTint', icon: 'drop', button: 'urgent' },
  IRRIGATE_TONIGHT: { color: 'skyText', tint: 'skyTint', icon: 'moon', button: 'water' },
  SKIP_RAIN: { color: 'skyText', tint: 'skyTint', icon: 'rain', button: 'water' },
  NO_ACTION: { color: 'leafText', tint: 'leafTint', icon: 'clock', button: 'primary' },
  PAUSE: { color: 'skyText', tint: 'skyTint', icon: 'pause', button: 'water' },
  SENSOR_OFFLINE: { color: 'grapeText', tint: 'grapeTint', icon: 'signalOff', button: 'secondary' },
};

const CROP_KINDS: Record<string, CropKind> = {
  tomato: 'tomato',
  cucumber: 'cucumber',
  lettuce: 'lettuce',
  'date-palm': 'date-palm',
};

export function cropKind(cropId: string): CropKind {
  return CROP_KINDS[cropId] ?? 'lettuce';
}

export interface ActionCopy {
  /** "Water tonight at 21:00" */
  title: string;
  /** "5 h 10 min · 51.6 m³" */
  detail: string | null;
  /** One plain-language sentence on why. */
  reason: string;
}

export function actionCopy(plot: PlotSummaryDto, timeZone: string, now: number): ActionCopy {
  const r = plot.recommendation;
  const amount =
    r.durationMin !== null && r.volumeL !== null
      ? `${formatDuration(r.durationMin)} · ${formatVolume(r.volumeL)}`
      : null;

  switch (r.action) {
    case 'IRRIGATE_NOW':
      return {
        title: 'Water now',
        detail: amount,
        reason: r.stressAt
          ? `It'll start to stress around ${formatClock(r.stressAt, timeZone)}, before tonight's window.`
          : "It's thirsty: the soil is past this crop's stress threshold.",
      };
    case 'IRRIGATE_TONIGHT': {
      const startsNow = r.startAt !== null && Math.abs(Date.parse(r.startAt) - now) < 5 * 60_000;
      return {
        title:
          startsNow || !r.startAt
            ? 'Water now (night window)'
            : `Water tonight at ${formatClock(r.startAt, timeZone)}`,
        detail: amount,
        reason: "It'll get thirsty within the next day, so top it up tonight while it's cool.",
      };
    }
    case 'SKIP_RAIN':
      return {
        title: 'Skip tonight',
        detail: 'Rain is coming',
        reason: 'Forecast rain covers what the crop will drink in the next 24 hours.',
      };
    case 'NO_ACTION':
      return {
        title: 'No watering needed',
        detail:
          r.daysUntilNext === 1
            ? 'Next: tomorrow night'
            : r.daysUntilNext
              ? `Next in ~${r.daysUntilNext} days`
              : 'Not this week',
        reason: 'Plenty of water in the root zone for at least the next day.',
      };
    case 'PAUSE':
      return {
        title: 'Hold the water',
        detail: 'Soil is soaked',
        reason: 'The soil holds more than it can keep, so extra water would just drain away.',
      };
    case 'SENSOR_OFFLINE':
      return {
        title: 'Sensor is asleep',
        detail: plot.latest
          ? `No reading since ${formatClock(plot.latest.recordedAt, timeZone)}`
          : 'No readings yet',
        reason: "We'll recommend again as soon as it wakes up and reports.",
      };
  }
}
