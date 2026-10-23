/**
 * Scrub math for the moisture chart. Plain worklets, so the chart's gesture
 * runs them on the UI thread and unit tests run them in Node.
 */

/** Index of the position in `xs` (ascending) nearest to `x`, or -1 when empty. */
export function nearestIndex(xs: readonly number[], x: number): number {
  'worklet';
  const n = xs.length;
  if (n === 0) return -1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] ?? 0) < x) lo = mid;
    else hi = mid;
  }
  return Math.abs((xs[lo] ?? 0) - x) <= Math.abs((xs[hi] ?? 0) - x) ? lo : hi;
}

/**
 * Whether moving the cursor from `previous` to `index` deserves a haptic tick:
 * it lands on or passes an irrigation marker, or crosses the refill line.
 * Works the same in both directions; -1 means the cursor was not showing.
 */
export function passesTick(
  previous: number,
  index: number,
  values: readonly number[],
  markerIndices: readonly number[],
  refill: number,
): boolean {
  'worklet';
  if (previous < 0 || index < 0 || previous === index) return false;
  const right = index > previous;
  for (let i = 0; i < markerIndices.length; i++) {
    const m = markerIndices[i] ?? -1;
    if (right ? m > previous && m <= index : m >= index && m < previous) return true;
  }
  return ((values[previous] ?? 0) - refill) * ((values[index] ?? 0) - refill) < 0;
}
