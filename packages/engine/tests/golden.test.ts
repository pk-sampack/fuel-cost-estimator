import { describe, expect, it } from 'vitest';
import { calculateEstimate, type EngineInput } from '../src/index';

interface Golden {
  name: string;
  input: EngineInput;
  k: number;
  kSource: 'driver' | 'vehicle_default';
  adjustedKmpl: number;
  litres: number;
  fuelCost: number;
  fuelCostTotal: number;
  total: number;
}

const GOLDENS: Golden[] = [
  {
    name: 'car · passenger · load forced to empty · petrol Rs 268.50',
    input: { vehicleClass: 'passenger', distanceKm: 120, fuelPricePerLitre: 268.5, kmpl: 14, loadRatio: 1, defaultLoadPenaltyK: 0, tolls: 0 },
    k: 0,
    kSource: 'vehicle_default',
    adjustedKmpl: 14,
    litres: 8.57,
    fuelCost: 2301.43,
    fuelCostTotal: 2301.43,
    total: 2301.43,
  },
  {
    name: 'rickshaw · passenger · short hop',
    input: { vehicleClass: 'passenger', distanceKm: 25, fuelPricePerLitre: 268.5, kmpl: 35, loadRatio: 0, defaultLoadPenaltyK: 0, tolls: 0 },
    k: 0,
    kSource: 'vehicle_default',
    adjustedKmpl: 35,
    litres: 0.71,
    fuelCost: 191.79,
    fuelCostTotal: 191.79,
    total: 191.79,
  },
  {
    name: 'wagon · goods · empty · default load penalty',
    input: { vehicleClass: 'goods', distanceKm: 100, fuelPricePerLitre: 268.5, kmpl: 12, loadRatio: 0, defaultLoadPenaltyK: 0.15, tolls: 0 },
    k: 0.15,
    kSource: 'vehicle_default',
    adjustedKmpl: 12,
    litres: 8.33,
    fuelCost: 2237.5,
    fuelCostTotal: 2237.5,
    total: 2237.5,
  },
  {
    name: 'bolan · goods · half load · driver kmpl_full',
    input: { vehicleClass: 'goods', distanceKm: 150, fuelPricePerLitre: 268.5, kmpl: 10, kmplFull: 7, loadRatio: 0.5, defaultLoadPenaltyK: 0.15, tolls: 0 },
    k: 0.3,
    kSource: 'driver',
    adjustedKmpl: 8.5,
    litres: 17.65,
    fuelCost: 4738.24,
    fuelCostTotal: 4738.24,
    total: 4738.24,
  },
  {
    name: 'shehzore · goods · full load · driver kmpl_full',
    input: { vehicleClass: 'goods', distanceKm: 200, fuelPricePerLitre: 268.5, kmpl: 12, kmplFull: 9, loadRatio: 1, defaultLoadPenaltyK: 0.2, tolls: 0 },
    k: 0.25,
    kSource: 'driver',
    adjustedKmpl: 9,
    litres: 22.22,
    fuelCost: 5966.67,
    fuelCostTotal: 5966.67,
    total: 5966.67,
  },
  {
    name: 'mazda · goods · full load · manual toll Rs 1,500',
    input: { vehicleClass: 'goods', distanceKm: 400, fuelPricePerLitre: 275.6, kmpl: 5, loadRatio: 1, defaultLoadPenaltyK: 0.2, tolls: 1500 },
    k: 0.2,
    kSource: 'vehicle_default',
    adjustedKmpl: 4,
    litres: 100,
    fuelCost: 27560,
    fuelCostTotal: 27560,
    total: 29060,
  },
  {
    name: 'hino · goods · half load · driver kmpl_full',
    input: { vehicleClass: 'goods', distanceKm: 300, fuelPricePerLitre: 275.6, kmpl: 4.5, kmplFull: 3.2, loadRatio: 0.5, defaultLoadPenaltyK: 0.2, tolls: 0 },
    k: 0.288889,
    kSource: 'driver',
    adjustedKmpl: 3.85,
    litres: 77.92,
    fuelCost: 21475.33,
    fuelCostTotal: 21475.33,
    total: 21475.33,
  },
  {
    name: 'trailer · goods · half load · default penalty 0.25',
    input: { vehicleClass: 'goods', distanceKm: 500, fuelPricePerLitre: 275.6, kmpl: 2.8, loadRatio: 0.5, defaultLoadPenaltyK: 0.25, tolls: 0 },
    k: 0.25,
    kSource: 'vehicle_default',
    adjustedKmpl: 2.45,
    litres: 204.08,
    fuelCost: 56244.9,
    fuelCostTotal: 56244.9,
    total: 56244.9,
  },
  {
    name: 'shehzore · goods · full load · empty return leg · toll Rs 500',
    input: { vehicleClass: 'goods', distanceKm: 200, fuelPricePerLitre: 268.5, kmpl: 12, kmplFull: 9, loadRatio: 1, defaultLoadPenaltyK: 0.2, tolls: 500, returnEmpty: true },
    k: 0.25,
    kSource: 'driver',
    adjustedKmpl: 9,
    litres: 22.22,
    fuelCost: 5966.67,
    fuelCostTotal: 10441.67,
    total: 10941.67,
  },
  {
    name: 'rickshaw · CNG Rs 210',
    input: { vehicleClass: 'passenger', distanceKm: 18, fuelPricePerLitre: 210, kmpl: 30, loadRatio: 0, defaultLoadPenaltyK: 0, tolls: 0 },
    k: 0,
    kSource: 'vehicle_default',
    adjustedKmpl: 30,
    litres: 0.6,
    fuelCost: 126,
    fuelCostTotal: 126,
    total: 126,
  },
];

describe('calculation engine v1 · golden cases', () => {
  for (const golden of GOLDENS) {
    it(golden.name, () => {
      const result = calculateEstimate(golden.input);
      expect(result.calcVersion).toBe('v1');
      expect(result.k).toBe(golden.k);
      expect(result.kSource).toBe(golden.kSource);
      expect(result.primaryLeg.adjustedKmpl).toBe(golden.adjustedKmpl);
      expect(result.primaryLeg.fuelLitres).toBe(golden.litres);
      expect(result.primaryLeg.fuelCost).toBe(golden.fuelCost);
      expect(result.fuelCostTotal).toBe(golden.fuelCostTotal);
      expect(result.total).toBe(golden.total);
    });
  }

  it('total always reconciles with the displayed parts', () => {
    for (const golden of GOLDENS) {
      const result = calculateEstimate(golden.input);
      const summed = Math.round(result.legs.reduce((s, l) => s + l.fuelCost, 0) * 100) / 100;
      expect(result.fuelCostTotal).toBe(summed);
      expect(result.total).toBe(Math.round((result.fuelCostTotal + result.tolls) * 100) / 100);
    }
  });

  it('return leg carries load ratio 0 and its own line', () => {
    const result = calculateEstimate({
      vehicleClass: 'goods',
      distanceKm: 200,
      fuelPricePerLitre: 268.5,
      kmpl: 12,
      kmplFull: 9,
      loadRatio: 1,
      defaultLoadPenaltyK: 0.2,
      tolls: 500,
      returnEmpty: true,
    });
    expect(result.legs).toHaveLength(2);
    expect(result.returnLeg?.label).toBe('return');
    expect(result.returnLeg?.loadRatio).toBe(0);
    expect(result.returnLeg?.adjustedKmpl).toBe(12);
    expect(result.returnLeg?.fuelCost).toBe(4475);
    expect(result.tolls).toBe(500);
  });
});

describe('calculation engine v1 · rules', () => {
  const base: EngineInput = {
    vehicleClass: 'goods',
    distanceKm: 100,
    fuelPricePerLitre: 268.5,
    kmpl: 10,
    loadRatio: 0.5,
    defaultLoadPenaltyK: 0.2,
    tolls: 0,
  };

  it('passengers never take a load ratio', () => {
    const result = calculateEstimate({ ...base, vehicleClass: 'passenger', loadRatio: 1 });
    expect(result.inputs.loadRatio).toBe(0);
    expect(result.primaryLeg.adjustedKmpl).toBe(10);
  });

  it('kmpl_full equal to kmpl gives k = 0', () => {
    const result = calculateEstimate({ ...base, kmplFull: 10 });
    expect(result.k).toBe(0);
    expect(result.primaryLeg.adjustedKmpl).toBe(10);
  });

  it('omitting kmpl_full uses the vehicle default penalty', () => {
    const result = calculateEstimate({ ...base, kmplFull: null });
    expect(result.k).toBe(0.2);
    expect(result.kSource).toBe('vehicle_default');
  });

  it('rejects kmpl_full better than kmpl', () => {
    expect(() => calculateEstimate({ ...base, kmpl: 10, kmplFull: 12 })).toThrowError(/full-load economy/);
  });

  it('rejects a zero distance', () => {
    expect(() => calculateEstimate({ ...base, distanceKm: 0 })).toThrowError(/distanceKm/);
  });

  it('rejects negative tolls', () => {
    expect(() => calculateEstimate({ ...base, tolls: -1 })).toThrowError(/tolls/);
  });

  it('adds an empty return leg for a passenger round trip', () => {
    const oneWay = calculateEstimate({ ...base, vehicleClass: 'passenger', loadRatio: 0 });
    const roundTrip = calculateEstimate({ ...base, vehicleClass: 'passenger', loadRatio: 0, returnEmpty: true });
    expect(roundTrip.legs).toHaveLength(2);
    expect(roundTrip.returnLeg?.loadRatio).toBe(0);
    expect(roundTrip.returnLeg?.adjustedKmpl).toBe(10);
    expect(roundTrip.fuelCostTotal).toBe(oneWay.fuelCostTotal * 2);
    expect(roundTrip.total).toBe(roundTrip.fuelCostTotal);
  });

  it('rejects load penalties above 0.9', () => {
    expect(() => calculateEstimate({ ...base, defaultLoadPenaltyK: 0.95 })).toThrowError(/defaultLoadPenaltyK/);
  });

  it('rejects an invalid load ratio', () => {
    expect(() => calculateEstimate({ ...base, loadRatio: 0.75 as never })).toThrowError(/loadRatio/);
  });

  it('accepts a large toll without touching fuel math', () => {
    const result = calculateEstimate({ ...base, tolls: 12500 });
    expect(result.fuelCostTotal).toBe(2983.33);
    expect(result.total).toBe(15483.33);
  });
});
