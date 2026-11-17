import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculateEstimate, type EngineInput } from '../src/index';

const SOURCE = readFileSync(fileURLToPath(new URL('../src/calc-v1.ts', import.meta.url)), 'utf8');

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInput(rand: () => number, index: number): EngineInput {
  const goods = rand() > 0.4;
  const kmpl = Math.round((2 + rand() * 38) * 10) / 10;
  const useFull = goods && rand() > 0.5;
  const kmplFull = useFull ? Math.round((kmpl * (0.5 + rand() * 0.45)) * 10) / 10 : null;
  const loads = [0, 0.5, 1] as const;
  return {
    vehicleClass: goods ? 'goods' : 'passenger',
    distanceKm: Math.round((1 + rand() * 1200) * 10) / 10,
    fuelPricePerLitre: Math.round((150 + rand() * 200) * 100) / 100,
    kmpl,
    kmplFull,
    loadRatio: loads[index % 3] ?? 0,
    defaultLoadPenaltyK: Math.round(rand() * 0.35 * 1000) / 1000,
    tolls: Math.round(rand() * 8000),
    returnEmpty: goods && rand() > 0.5,
  };
}

describe('calculation engine v1 · purity and determinism', () => {
  it('has no clock, randomness, environment, network or storage access', () => {
    expect(SOURCE).not.toMatch(/Date\.now|new Date|Math\.random|process\.env|fetch\(|localStorage|sessionStorage/);
  });

  it('returns identical output for identical input across 500 runs', () => {
    const rand = lcg(20261114);
    for (let i = 0; i < 500; i += 1) {
      const input = randomInput(rand, i);
      const first = calculateEstimate(input);
      const second = calculateEstimate({ ...input });
      expect(second).toEqual(first);
    }
  });

  it('is not affected by the order of previous calls', () => {
    const rand = lcg(42);
    const inputs = Array.from({ length: 40 }, (_, i) => randomInput(rand, i));
    const forward = inputs.map((input) => calculateEstimate(input));
    const backward = [...inputs].reverse().map((input) => calculateEstimate(input)).reverse();
    expect(backward).toEqual(forward);
  });

  it('never returns a non-finite or negative number', () => {
    const rand = lcg(7);
    for (let i = 0; i < 300; i += 1) {
      const result = calculateEstimate(randomInput(rand, i));
      for (const value of [result.fuelCostTotal, result.total, result.fuelLitresTotal, result.tolls]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      for (const leg of result.legs) {
        expect(leg.adjustedKmpl).toBeGreaterThan(0);
        expect(leg.fuelCost).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps money at two decimals', () => {
    const rand = lcg(99);
    for (let i = 0; i < 300; i += 1) {
      const result = calculateEstimate(randomInput(rand, i));
      for (const value of [result.fuelCostTotal, result.total, result.tolls, ...result.legs.map((l) => l.fuelCost)]) {
        expect(Math.round(value * 100)).toBeCloseTo(value * 100, 6);
      }
    }
  });
});
