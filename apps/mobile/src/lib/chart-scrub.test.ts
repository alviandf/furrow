import { describe, expect, it } from 'vitest';

import { nearestIndex, passesTick } from './chart-scrub';

describe('nearestIndex', () => {
  const xs = [40, 50, 60, 70, 80];

  it('picks the closest point', () => {
    expect(nearestIndex(xs, 52)).toBe(1);
    expect(nearestIndex(xs, 58)).toBe(2);
    expect(nearestIndex(xs, 70)).toBe(3);
  });

  it('prefers the earlier point on an exact tie', () => {
    expect(nearestIndex(xs, 55)).toBe(1);
  });

  it('clamps to the ends when the finger is outside the plot', () => {
    expect(nearestIndex(xs, -100)).toBe(0);
    expect(nearestIndex(xs, 500)).toBe(4);
  });

  it('handles tiny and empty series', () => {
    expect(nearestIndex([10], 99)).toBe(0);
    expect(nearestIndex([10, 20], 16)).toBe(1);
    expect(nearestIndex([], 5)).toBe(-1);
  });

  it('matches a linear scan on uneven spacing', () => {
    const uneven = [3, 4, 9, 20, 21, 22, 40, 41, 75, 90];
    for (let x = -5; x <= 100; x += 0.5) {
      let best = 0;
      uneven.forEach((value, i) => {
        if (Math.abs(value - x) < Math.abs(uneven[best]! - x)) best = i;
      });
      expect(nearestIndex(uneven, x)).toBe(best);
    }
  });
});

describe('passesTick', () => {
  // Above the 0.10 refill line except index 4; a watering lands on index 6.
  const values = [0.12, 0.12, 0.11, 0.11, 0.09, 0.11, 0.12, 0.12];
  const markers = [6];
  const refill = 0.1;

  it('ticks when the cursor reaches a watering from either side', () => {
    expect(passesTick(5, 6, values, markers, refill)).toBe(true);
    expect(passesTick(7, 6, values, markers, refill)).toBe(true);
  });

  it('ticks when a fast drag jumps over a watering', () => {
    expect(passesTick(5, 7, values, markers, refill)).toBe(true);
    expect(passesTick(7, 5, values, markers, refill)).toBe(true);
  });

  it('does not tick again when leaving the watering', () => {
    expect(passesTick(6, 7, values, markers, refill)).toBe(false);
    expect(passesTick(6, 5, values, markers, refill)).toBe(false);
  });

  it('ticks when crossing the refill line', () => {
    expect(passesTick(3, 4, values, markers, refill)).toBe(true);
    expect(passesTick(4, 5, values, markers, refill)).toBe(true);
    expect(passesTick(0, 1, values, markers, refill)).toBe(false);
  });

  it('stays quiet when the cursor appears or does not move', () => {
    expect(passesTick(-1, 6, values, markers, refill)).toBe(false);
    expect(passesTick(3, 3, values, markers, refill)).toBe(false);
  });
});
