/**
 * Demo seed (PRD Appendix D): reference data, 14 days of simulated history and
 * scenario targets computed from the live forecast, so every plot lands in its
 * intended state whatever the weather.
 */

import { randomUUID } from 'node:crypto';

import {
  DAY_MS,
  HOUR_MS,
  adjustDepletionFraction,
  clamp,
  cropCoefficient,
  irrigationAmount,
  irrigationWindowStart,
  parseClock,
  readilyAvailableWater,
  rootZoneDepletion,
  thetaForDepletion,
  totalAvailableWater,
  waterBudget,
  zonedDate,
  zonedParts,
  addDays,
} from '@furrow/shared';

import type { Db } from '../db/client';
import {
  activities,
  crops,
  farms,
  plotSimState,
  plots,
  sensorReadings,
  soils,
  type WeatherData,
} from '../db/schema';
import {
  cropParams,
  daysSincePlanting,
  irrigationWindow,
  loadPlotModels,
  plotParams,
  soilParams,
  type PlotModel,
} from '../domain';
import { STEP_MS, gridPoints, insertReadings, reportedVwc, stepPlot } from '../sim/simulator';
import { CROPS, FARM, PLOTS, SOILS, type Scenario } from './data';

const HISTORY_MS = 14 * DAY_MS;
const OFFLINE_FOR_MS = 5 * HOUR_MS;
const EASE_MS = DAY_MS;

/** Share of RAW at which the simulated farmer irrigates, per scenario. */
const REFILL_AT: Record<Scenario, number> = {
  optimal: 0.55,
  offline: 0.55,
  tonight: 0.8,
  'needs-water': 0.8,
  overwatered: 0.7,
};

/** Clears demo data and upserts the farm, crops, soils and plots (stable ids). */
export async function seedReference(db: Db, now: number): Promise<void> {
  const today = zonedDate(now, FARM.timezone);
  await db.transaction(async (tx) => {
    await tx.delete(activities);
    await tx.delete(sensorReadings);
    await tx.delete(plotSimState);

    const { id: _farmId, ...farmFields } = FARM;
    await tx.insert(farms).values(FARM).onConflictDoUpdate({ target: farms.id, set: farmFields });
    for (const crop of CROPS) {
      const { id: _id, ...fields } = crop;
      await tx.insert(crops).values(crop).onConflictDoUpdate({ target: crops.id, set: fields });
    }
    for (const soil of SOILS) {
      const { id: _id, ...fields } = soil;
      await tx.insert(soils).values(soil).onConflictDoUpdate({ target: soils.id, set: fields });
    }
    for (const { scenario: _scenario, daysSincePlanting: days, id, ...fields } of PLOTS) {
      const values = {
        ...fields,
        farmId: FARM.id,
        plantedOn: days === null ? null : addDays(today, -days),
      };
      await tx
        .insert(plots)
        .values({ id, ...values })
        .onConflictDoUpdate({ target: plots.id, set: values });
    }
  });
}

/** Water content each scenario should show at seed time. */
function scenarioTheta(
  scenario: Scenario,
  model: PlotModel,
  now: number,
  startAt: number,
  weather: WeatherData,
): number {
  const params = plotParams(model);
  const budget = waterBudget({
    now,
    startAt,
    soil: soilParams(model.soil),
    crop: cropParams(model.crop),
    daysSincePlanting: daysSincePlanting(model.plot, now, FARM.timezone),
    plot: params,
    hourly: weather.hourly,
  });
  const { rawMm: raw, tawMm: taw } = budget;

  let depletion: number;
  switch (scenario) {
    case 'overwatered':
      return model.soil.fieldCapacity + 0.05;
    case 'needs-water':
      depletion = raw + 0.15 * (taw - raw);
      break;
    case 'tonight':
      // Depletion at the window start sits half a day's crop use below RAW.
      depletion = clamp(
        raw -
          0.5 * budget.etcNext24hMm -
          budget.etcBeforeStartMm +
          budget.effectiveRainBeforeStartMm,
        0,
        raw * 0.98,
      );
      break;
    default:
      depletion = 0.3 * raw;
  }
  return thetaForDepletion(depletion, model.soil.fieldCapacity, params.rootDepthM);
}

interface History {
  readings: Array<{ t: number; theta: number }>;
  irrigations: Array<{ at: number; netMm: number }>;
}

/** Forward simulation with a simple farmer: irrigate at the window start once depletion nears RAW. */
function simulateHistory(
  model: PlotModel,
  scenario: Scenario,
  from: number,
  to: number,
  weather: WeatherData,
): History {
  const tz = FARM.timezone;
  const { fieldCapacity: fc, wiltingPoint: wp } = model.soil;
  const zr = plotParams(model).rootDepthM;
  const taw = totalAvailableWater(fc, wp, zr);
  const windowStart = parseClock(FARM.irrigationWindowStart);

  let theta = thetaForDepletion(0.2 * model.crop.pTable * taw, fc, zr);
  let t = from;
  const history: History = { readings: [], irrigations: [] };

  for (const next of gridPoints(from, to)) {
    let irrigationMm = 0;
    const local = zonedParts(next, tz);
    if (local.hour * 60 + local.minute === windowStart) {
      const { kc } = cropCoefficient(
        cropParams(model.crop),
        daysSincePlanting(model.plot, next, tz),
      );
      const dailyEt0 = weather.daily.find((d) => d.date === zonedDate(next, tz))?.et0Mm ?? 5;
      const raw = readilyAvailableWater(
        taw,
        adjustDepletionFraction(model.crop.pTable, kc * dailyEt0),
      );
      const depletion = rootZoneDepletion(theta, fc, zr, taw);
      const hoursLeft = (to - next) / HOUR_MS;

      if (scenario === 'overwatered' && hoursLeft < 24) {
        irrigationMm = depletion + 12; // timer stuck: far more than the deficit
      } else if (
        !(scenario === 'needs-water' && hoursLeft < 60) &&
        depletion >= REFILL_AT[scenario] * raw
      ) {
        irrigationMm = depletion;
      }
    }

    theta = stepPlot(model, theta, t, next, weather, irrigationMm, tz);
    if (irrigationMm > 0) history.irrigations.push({ at: next, netMm: irrigationMm });
    history.readings.push({ t: next, theta });
    t = next;
  }
  return history;
}

/** Blends the last day of history towards the scenario target (demo-only adjustment). */
function easeTowards(history: History, target: number, at: number, floor: number): void {
  const last = history.readings.at(-1);
  if (!last) return;
  const delta = target - last.theta;
  const start = at - EASE_MS;
  for (const reading of history.readings) {
    if (reading.t <= start) continue;
    const x = (reading.t - start) / EASE_MS;
    reading.theta = Math.max(floor, reading.theta + delta * x * x * (3 - 2 * x));
  }
}

export async function seedHistory(
  db: Db,
  options: { now: number; weather: WeatherData },
): Promise<void> {
  const { now, weather } = options;
  const tz = FARM.timezone;
  const models = await loadPlotModels(db, FARM.id);
  const startAt = irrigationWindowStart(now, tz, irrigationWindow(FARM));
  const end = Math.floor(now / STEP_MS) * STEP_MS;

  for (const model of models) {
    const seed = PLOTS.find((p) => p.id === model.plot.id);
    if (!seed) continue;
    const offline = seed.scenario === 'offline';
    const historyEnd = offline ? end - OFFLINE_FOR_MS : end;

    const target = scenarioTheta(seed.scenario, model, now, startAt, weather);
    const history = simulateHistory(
      model,
      seed.scenario,
      historyEnd - HISTORY_MS,
      historyEnd,
      weather,
    );
    easeTowards(history, target, historyEnd, model.soil.wiltingPoint);

    await insertReadings(
      db,
      history.readings.map(({ t, theta }) => ({
        plotId: model.plot.id,
        recordedAt: new Date(t),
        vwc: reportedVwc(model.plot.id, t, theta),
      })),
    );

    const irrigationRows = history.irrigations.map(({ at, netMm }) => {
      const amount = irrigationAmount(netMm, plotParams(model));
      return {
        id: randomUUID(),
        plotId: model.plot.id,
        type: 'irrigation' as const,
        occurredAt: new Date(at),
        details: { durationMin: amount.durationMin, volumeL: Math.round(amount.volumeL) },
        createdAt: new Date(at),
        appliedAt: new Date(at),
      };
    });
    if (irrigationRows.length > 0) await db.insert(activities).values(irrigationRows);

    await db.insert(plotSimState).values({
      plotId: model.plot.id,
      theta: target,
      asOf: new Date(historyEnd),
      pausedAt: offline ? new Date(historyEnd) : null,
    });
  }

  await db.insert(activities).values(storyActivities(now));
}

/** A few hand-written entries so the activity log tells a story. */
function storyActivities(now: number) {
  const [blockB, field3, field4, field5] = ['Block B', 'Field 3', 'Field 4', 'Field 5'].map(
    (name) => PLOTS.find((p) => p.name === name)!.id,
  );
  const ago = (ms: number) => new Date(Math.floor((now - ms) / 60_000) * 60_000);
  return [
    {
      id: randomUUID(),
      plotId: field4!,
      type: 'fertilizer' as const,
      occurredAt: ago(4 * DAY_MS + 3 * HOUR_MS),
      details: { product: 'NPK 20-20-20', amount: 15, unit: 'kg' },
      note: 'Through the drip line',
    },
    {
      id: randomUUID(),
      plotId: field3!,
      type: 'pest' as const,
      occurredAt: ago(2 * DAY_MS + 5 * HOUR_MS),
      details: { name: 'Whitefly', severity: 'low' },
      note: 'Yellow sticky traps up on rows 3–6',
    },
    {
      id: randomUUID(),
      plotId: field5!,
      type: 'note' as const,
      occurredAt: ago(10 * HOUR_MS),
      details: { text: 'Sprinkler timer stuck on last night — ran far too long. Valve replaced.' },
    },
    {
      id: randomUUID(),
      plotId: blockB!,
      type: 'note' as const,
      occurredAt: ago(OFFLINE_FOR_MS + 40 * 60_000),
      details: { text: 'Sensor B-2 battery low. Replacement ordered.' },
    },
  ].map((row) => ({ ...row, createdAt: row.occurredAt }));
}
