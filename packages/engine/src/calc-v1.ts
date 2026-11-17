import {
  CALC_VERSION,
  EngineValidationError,
  type EstimateResult,
  type EngineInput,
  type KSource,
  type LegLabel,
  type LegResult,
  type LoadRatio,
} from './types';

const MAX_DISTANCE_KM = 20000;
const MAX_PRICE = 1000;
const MAX_KMPL = 100;
const MAX_K = 0.9;

function round(value: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

function assertNumber(field: string, value: unknown, min: number, max: number, minInclusive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new EngineValidationError(field, 'must be a finite number');
  }
  if (minInclusive ? value < min : value <= min) {
    throw new EngineValidationError(field, `must be greater than ${minInclusive ? 'or equal to ' : ''}${min}`);
  }
  if (value > max) {
    throw new EngineValidationError(field, `must be at most ${max}`);
  }
  return value;
}

export function resolveLoadPenalty(input: {
  kmpl: number;
  kmplFull?: number | null;
  defaultLoadPenaltyK: number;
}): { k: number; kSource: KSource } {
  const kmpl = assertNumber('kmpl', input.kmpl, 0, MAX_KMPL);
  const fallback = assertNumber('defaultLoadPenaltyK', input.defaultLoadPenaltyK, 0, MAX_K, true);

  if (input.kmplFull !== null && input.kmplFull !== undefined) {
    const kmplFull = assertNumber('kmplFull', input.kmplFull, 0, MAX_KMPL * 2);
    if (kmplFull > kmpl) {
      throw new EngineValidationError(
        'kmplFull',
        'full-load economy cannot be better than empty-load economy',
      );
    }
    const k = 1 - kmplFull / kmpl;
    if (k < 0 || k > MAX_K) {
      throw new EngineValidationError('kmplFull', 'derived load penalty is outside the supported range');
    }
    return { k: round(k, 6), kSource: 'driver' };
  }

  return { k: fallback, kSource: 'vehicle_default' };
}

function computeLeg(args: {
  label: LegLabel;
  distanceKm: number;
  fuelPricePerLitre: number;
  kmpl: number;
  k: number;
  kSource: KSource;
  loadRatio: LoadRatio;
}): LegResult {
  const adjustedKmpl = args.kmpl * (1 - args.k * args.loadRatio);
  if (!(adjustedKmpl > 0)) {
    throw new EngineValidationError('adjustedKmpl', 'adjusted economy must be greater than zero');
  }
  const fuelLitres = args.distanceKm / adjustedKmpl;
  const fuelCost = fuelLitres * args.fuelPricePerLitre;
  return {
    label: args.label,
    loadRatio: args.loadRatio,
    k: args.k,
    kSource: args.kSource,
    adjustedKmpl: round(adjustedKmpl, 3),
    fuelLitres: round(fuelLitres, 2),
    fuelCost: round(fuelCost, 2),
  };
}

export function calculateEstimate(input: EngineInput): EstimateResult {
  if (input.vehicleClass !== 'passenger' && input.vehicleClass !== 'goods') {
    throw new EngineValidationError('vehicleClass', 'must be passenger or goods');
  }
  const distanceKm = assertNumber('distanceKm', input.distanceKm, 0, MAX_DISTANCE_KM);
  const fuelPricePerLitre = assertNumber('fuelPricePerLitre', input.fuelPricePerLitre, 0, MAX_PRICE);
  const tolls = assertNumber('tolls', input.tolls, -1, 1_000_000, true);
  if (tolls < 0) {
    throw new EngineValidationError('tolls', 'must be zero or greater');
  }

  const isGoods = input.vehicleClass === 'goods';
  const { k, kSource } = resolveLoadPenalty({
    kmpl: input.kmpl,
    kmplFull: input.kmplFull ?? null,
    defaultLoadPenaltyK: input.defaultLoadPenaltyK,
  });

  const requestedLoad: LoadRatio = input.loadRatio;
  if (requestedLoad !== 0 && requestedLoad !== 0.5 && requestedLoad !== 1) {
    throw new EngineValidationError('loadRatio', 'must be 0, 0.5 or 1');
  }
  const loadRatio: LoadRatio = isGoods ? requestedLoad : 0;
  const returnEmpty = Boolean(input.returnEmpty);

  const primaryLeg = computeLeg({
    label: 'outbound',
    distanceKm,
    fuelPricePerLitre,
    kmpl: input.kmpl,
    k,
    kSource,
    loadRatio,
  });

  const returnLeg = returnEmpty
    ? computeLeg({
        label: 'return',
        distanceKm,
        fuelPricePerLitre,
        kmpl: input.kmpl,
        k,
        kSource,
        loadRatio: 0,
      })
    : null;

  const legs = returnLeg ? [primaryLeg, returnLeg] : [primaryLeg];
  const fuelCostTotal = round(
    legs.reduce((sum, leg) => sum + leg.fuelCost, 0),
    2,
  );
  const fuelLitresTotal = round(
    legs.reduce((sum, leg) => sum + leg.fuelLitres, 0),
    2,
  );

  return {
    calcVersion: CALC_VERSION,
    legs,
    primaryLeg,
    returnLeg,
    fuelLitresTotal,
    fuelCostTotal,
    tolls: round(tolls, 2),
    total: round(fuelCostTotal + tolls, 2),
    k,
    kSource,
    inputs: {
      vehicleClass: input.vehicleClass,
      distanceKm,
      fuelPricePerLitre,
      kmpl: input.kmpl,
      kmplFull: input.kmplFull ?? null,
      loadRatio,
      defaultLoadPenaltyK: input.defaultLoadPenaltyK,
      returnEmpty,
    },
  };
}
