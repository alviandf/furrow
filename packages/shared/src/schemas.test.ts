import { describe, expect, it } from 'vitest';

import { formatDuration, formatPercent, formatVolume } from './format';
import { createActivitySchema } from './schemas';

const base = {
  id: '6f1c2e2a-8b4d-4c1e-9f3a-2d5b7c9e1a40',
  plotId: 'c3a1f0d2-5e6b-4a7c-8d9e-0f1a2b3c4d5e',
  occurredAt: '2026-10-21T21:00:00+04:00',
};

describe('createActivitySchema', () => {
  it('accepts each activity type', () => {
    const inputs = [
      { ...base, type: 'irrigation', details: { durationMin: 260 } },
      { ...base, type: 'fertilizer', details: { product: 'NPK 20-20-20', amount: 25, unit: 'kg' } },
      {
        ...base,
        type: 'pest',
        details: { name: 'Whitefly', severity: 'medium' },
        note: 'Lower leaves',
      },
      { ...base, type: 'note', details: { text: 'Drip line 4 leaking' } },
    ];
    for (const input of inputs) expect(createActivitySchema.safeParse(input).success).toBe(true);
  });

  it('rejects details that do not match the type', () => {
    const result = createActivitySchema.safeParse({
      ...base,
      type: 'irrigation',
      details: { text: 'x' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range durations and bad ids', () => {
    expect(
      createActivitySchema.safeParse({ ...base, type: 'irrigation', details: { durationMin: 0 } })
        .success,
    ).toBe(false);
    expect(
      createActivitySchema.safeParse({ ...base, id: 'abc', type: 'note', details: { text: 'x' } })
        .success,
    ).toBe(false);
  });
});

describe('formatting', () => {
  it('formats durations, volumes and percentages', () => {
    expect(formatDuration(260)).toBe('4 h 20 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatVolume(38888.9)).toBe('38.9 m³');
    expect(formatVolume(850)).toBe('850 L');
    expect(formatPercent(0.205)).toBe('20.5%');
  });
});
