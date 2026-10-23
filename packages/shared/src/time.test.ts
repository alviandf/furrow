import { describe, expect, it } from 'vitest';

import {
  addDays,
  daysBetween,
  irrigationWindowStart,
  toZonedIso,
  zonedDate,
  zonedTimeToEpoch,
} from './time';

const DUBAI = 'Asia/Dubai';
const WINDOW = { start: '21:00', end: '05:00' };
const local = (hour: number, minute = 0) => zonedTimeToEpoch(2026, 10, 21, hour, minute, DUBAI);

describe('time zones', () => {
  it('formats ISO strings with the farm offset', () => {
    expect(toZonedIso(Date.UTC(2026, 9, 21, 17, 0), DUBAI)).toBe('2026-10-21T21:00:00+04:00');
    expect(zonedDate(Date.UTC(2026, 9, 21, 21, 30), DUBAI)).toBe('2026-10-22');
  });

  it('converts wall-clock time across a DST change', () => {
    // Europe/Berlin leaves summer time on 2026-10-25.
    expect(zonedTimeToEpoch(2026, 10, 24, 21, 0, 'Europe/Berlin')).toBe(
      Date.UTC(2026, 9, 24, 19, 0),
    );
    expect(zonedTimeToEpoch(2026, 10, 25, 21, 0, 'Europe/Berlin')).toBe(
      Date.UTC(2026, 9, 25, 20, 0),
    );
  });
});

describe('irrigationWindowStart', () => {
  it('returns tonight 21:00 during the day', () => {
    expect(irrigationWindowStart(local(12), DUBAI, WINDOW)).toBe(local(21));
    expect(irrigationWindowStart(local(5), DUBAI, WINDOW)).toBe(local(21));
  });

  it('returns now inside the night window, before and after midnight', () => {
    expect(irrigationWindowStart(local(22, 30), DUBAI, WINDOW)).toBe(local(22, 30));
    expect(irrigationWindowStart(local(3), DUBAI, WINDOW)).toBe(local(3));
  });

  it('handles windows that do not cross midnight', () => {
    const morning = { start: '04:00', end: '07:00' };
    expect(irrigationWindowStart(local(12), DUBAI, morning)).toBe(
      zonedTimeToEpoch(2026, 10, 22, 4, 0, DUBAI),
    );
  });
});

describe('calendar dates', () => {
  it('counts and shifts days', () => {
    expect(daysBetween('2026-09-01', '2026-10-21')).toBe(50);
    expect(addDays('2026-10-21', -50)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
