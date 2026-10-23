import { startOfZonedDay, type GrowthStage } from '@furrow/shared';

export { formatDuration, formatMm, formatPercent, formatVolume } from '@furrow/shared';

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-GB', { timeZone, ...options });
    formatters.set(key, cached);
  }
  return cached;
}

const toMs = (value: string | number) => (typeof value === 'number' ? value : Date.parse(value));

/** "21:00" in farm-local time. */
export function formatClock(value: string | number, timeZone: string): string {
  return fmt(timeZone, { hour: '2-digit', minute: '2-digit', hour12: false }).format(toMs(value));
}

/** "Tue 21 Oct" */
export function formatDay(value: string | number, timeZone: string): string {
  return fmt(timeZone, { weekday: 'short', day: 'numeric', month: 'short' }).format(toMs(value));
}

/** "Wed" */
export function formatWeekday(value: string | number, timeZone: string): string {
  return fmt(timeZone, { weekday: 'short' }).format(toMs(value));
}

/** "Today", "Yesterday" or "Mon 19 Oct", relative to farm-local days. */
export function formatRelativeDay(value: string | number, timeZone: string, now: number): string {
  const diff = Math.round(
    (startOfZonedDay(now, timeZone) - startOfZonedDay(toMs(value), timeZone)) / DAY_MS,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return formatDay(value, timeZone);
}

/** "just now", "4 min ago", "2 h ago" */
export function formatAgo(value: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - value) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

export const STAGE_LABEL: Record<GrowthStage, string> = {
  initial: 'Initial',
  development: 'Development',
  mid: 'Mid-season',
  late: 'Late season',
  complete: 'Season complete',
  perennial: 'Perennial',
};

/** "Development · day 50 of 155" or "Perennial" */
export function formatStage(
  stage: GrowthStage,
  day: number | null,
  seasonLength: number | null,
): string {
  const label = STAGE_LABEL[stage];
  if (day === null) return label;
  return seasonLength ? `${label} · day ${day} of ${seasonLength}` : `${label} · day ${day}`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** "2026-09-01" → "1 Sep 2026" */
export function formatCalendarDate(date: string): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return fmt('UTC', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    Date.UTC(y, m - 1, d),
  );
}

/** "Good morning" … "Good night", in farm-local time. */
export function greeting(now: number, timeZone: string): string {
  const hour = Number(fmt(timeZone, { hour: 'numeric', hour12: false }).format(now)) % 24;
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}
