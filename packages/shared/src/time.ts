/**
 * Minimal time-zone helpers built on Intl, so farm-local schedules work on the
 * server and the device without a date library.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface IrrigationWindow {
  /** Local clock time, "HH:MM". */
  start: string;
  end: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, cached);
  }
  return cached;
}

export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `timeZone` from UTC at the given instant, in ms (e.g. +4 h for Asia/Dubai). */
export function timeZoneOffsetMs(epochMs: number, timeZone: string): number {
  const p = zonedParts(epochMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/** Instant of a local wall-clock time. Day/month overflow is allowed (day 32 → next month). */
export function zonedTimeToEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallClockAsUtc - timeZoneOffsetMs(wallClockAsUtc, timeZone);
  return wallClockAsUtc - timeZoneOffsetMs(firstGuess, timeZone);
}

export function startOfZonedDay(epochMs: number, timeZone: string): number {
  const p = zonedParts(epochMs, timeZone);
  return zonedTimeToEpoch(p.year, p.month, p.day, 0, 0, timeZone);
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** Local calendar date, "YYYY-MM-DD". */
export function zonedDate(epochMs: number, timeZone: string): string {
  const p = zonedParts(epochMs, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** ISO 8601 with the zone's offset, e.g. "2026-10-21T21:00:00+04:00". */
export function toZonedIso(epochMs: number, timeZone: string): string {
  const p = zonedParts(epochMs, timeZone);
  const offsetMin = Math.round(timeZoneOffsetMs(epochMs, timeZone) / 60_000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** "21:00" → 1260 */
export function parseClock(clock: string): number {
  const [hours = '0', minutes = '0'] = clock.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isInsideWindow(
  epochMs: number,
  timeZone: string,
  window: IrrigationWindow,
): boolean {
  const start = parseClock(window.start);
  const end = parseClock(window.end);
  const p = zonedParts(epochMs, timeZone);
  const minute = p.hour * 60 + p.minute;
  return start <= end ? minute >= start && minute < end : minute >= start || minute < end;
}

/**
 * Start S of the next irrigation window: `now` when already inside the window,
 * otherwise the next local occurrence of the window's start time.
 */
export function irrigationWindowStart(
  now: number,
  timeZone: string,
  window: IrrigationWindow,
): number {
  if (isInsideWindow(now, timeZone, window)) return now;
  const start = parseClock(window.start);
  const p = zonedParts(now, timeZone);
  const hour = Math.floor(start / 60);
  const minute = start % 60;
  const today = zonedTimeToEpoch(p.year, p.month, p.day, hour, minute, timeZone);
  return today > now ? today : zonedTimeToEpoch(p.year, p.month, p.day + 1, hour, minute, timeZone);
}

/** Whole days from one "YYYY-MM-DD" date to another. */
export function daysBetween(fromDate: string, toDate: string): number {
  const toUtc = (date: string) => {
    const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toDate) - toUtc(fromDate)) / 86_400_000);
}

/** "YYYY-MM-DD" shifted by a number of days. */
export function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
