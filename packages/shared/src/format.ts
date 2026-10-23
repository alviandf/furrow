/** Display formatting shared by the API (copy) and the app. */

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function formatVolume(liters: number): string {
  return liters >= 1000 ? `${(liters / 1000).toFixed(1)} m³` : `${Math.round(liters)} L`;
}

/** 0.205 → "20.5%" */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatMm(mm: number, digits = 1): string {
  return `${mm.toFixed(digits)} mm`;
}

/** Rounds for JSON payloads without float noise. */
export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
