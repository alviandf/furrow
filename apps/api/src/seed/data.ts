/**
 * Demo farm (PRD Appendix D). Crop values from FAO-56 Tables 11, 12 and 22;
 * soil values within the FAO-56 Table 19 ranges.
 */

import type { Crop, Farm, Plot, Soil } from '../db/schema';

export const FARM: Farm = {
  id: '95037bbc-36dc-4890-9c8e-1caecc958956',
  name: 'Furrow Demo Farm',
  location: 'Al Ain, UAE',
  latitude: 24.2,
  longitude: 55.7,
  timezone: 'Asia/Dubai',
  irrigationWindowStart: '21:00',
  irrigationWindowEnd: '05:00',
};

export const CROPS: Crop[] = [
  {
    id: 'tomato',
    name: 'Tomato',
    kcIni: 0.6,
    kcMid: 1.15,
    kcEnd: 0.8,
    pTable: 0.4,
    rootDepthM: 0.7,
    stageDays: [35, 45, 70, 30],
  },
  {
    id: 'cucumber',
    name: 'Cucumber',
    kcIni: 0.6,
    kcMid: 1.0,
    kcEnd: 0.75,
    pTable: 0.5,
    rootDepthM: 0.7,
    stageDays: [25, 35, 50, 20],
  },
  {
    id: 'lettuce',
    name: 'Lettuce',
    kcIni: 0.7,
    kcMid: 1.0,
    kcEnd: 0.95,
    pTable: 0.3,
    rootDepthM: 0.3,
    stageDays: [25, 35, 30, 10],
  },
  {
    id: 'date-palm',
    name: 'Date palms',
    kcIni: 0.9,
    kcMid: 0.95,
    kcEnd: 0.95,
    pTable: 0.5,
    rootDepthM: 1.5,
    stageDays: null,
  },
];

export const SOILS: Soil[] = [
  { id: 'sand', name: 'Sand', fieldCapacity: 0.12, wiltingPoint: 0.05, drainagePerHour: 0.1 },
  {
    id: 'loamy-sand',
    name: 'Loamy sand',
    fieldCapacity: 0.15,
    wiltingPoint: 0.06,
    drainagePerHour: 0.1,
  },
  {
    id: 'sandy-loam',
    name: 'Sandy loam',
    fieldCapacity: 0.23,
    wiltingPoint: 0.1,
    drainagePerHour: 0.1,
  },
  { id: 'loam', name: 'Loam', fieldCapacity: 0.27, wiltingPoint: 0.12, drainagePerHour: 0.1 },
];

export type Scenario = 'optimal' | 'offline' | 'tonight' | 'needs-water' | 'overwatered';

export interface PlotSeed extends Omit<Plot, 'farmId' | 'plantedOn'> {
  daysSincePlanting: number | null;
  scenario: Scenario;
}

const plot = (
  seed: Omit<PlotSeed, 'rootDepthM' | 'drainagePerHour'> & Partial<PlotSeed>,
): PlotSeed => ({
  rootDepthM: null,
  drainagePerHour: null,
  ...seed,
});

export const PLOTS: PlotSeed[] = [
  plot({
    id: 'cfbeea7a-1ba5-4cc1-99ac-0b3d91dff5d8',
    name: 'Block A',
    cropId: 'date-palm',
    soilId: 'sand',
    daysSincePlanting: null,
    areaM2: 10_000,
    irrigationMethod: 'bubbler',
    efficiency: 0.85,
    flowRateLph: 60_000,
    sortOrder: 1,
    scenario: 'optimal',
  }),
  plot({
    id: 'eccb74fe-64a1-4abc-a589-9d6fea9aa46e',
    name: 'Block B',
    cropId: 'date-palm',
    soilId: 'sand',
    daysSincePlanting: null,
    areaM2: 8_000,
    irrigationMethod: 'bubbler',
    efficiency: 0.85,
    flowRateLph: 48_000,
    sortOrder: 2,
    scenario: 'offline',
  }),
  plot({
    id: '0bcd812e-ea87-4626-bdd6-b742d5d9740a',
    name: 'Field 3',
    cropId: 'tomato',
    soilId: 'loamy-sand',
    daysSincePlanting: 50,
    areaM2: 2_000,
    irrigationMethod: 'drip',
    efficiency: 0.9,
    flowRateLph: 10_000,
    sortOrder: 3,
    scenario: 'tonight',
  }),
  plot({
    id: '5520bf00-6f20-4be0-8ea7-d12a21587a71',
    name: 'Field 4',
    cropId: 'cucumber',
    soilId: 'sand',
    daysSincePlanting: 30,
    areaM2: 1_500,
    irrigationMethod: 'drip',
    efficiency: 0.9,
    flowRateLph: 7_500,
    sortOrder: 4,
    scenario: 'needs-water',
  }),
  plot({
    id: '8a459b4f-dc40-4270-9771-9570d45a832e',
    name: 'Field 5',
    cropId: 'lettuce',
    soilId: 'loam',
    daysSincePlanting: 20,
    areaM2: 1_000,
    irrigationMethod: 'sprinkler',
    efficiency: 0.75,
    flowRateLph: 10_000,
    drainagePerHour: 0.02, // compacted layer: drains slowly
    sortOrder: 5,
    scenario: 'overwatered',
  }),
];
