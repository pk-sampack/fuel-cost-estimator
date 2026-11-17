export const CALC_VERSION = 'v1' as const;
export type CalcVersion = typeof CALC_VERSION;

export type VehicleClass = 'passenger' | 'goods';
export type LoadRatio = 0 | 0.5 | 1;
export type LegLabel = 'outbound' | 'return';
export type KSource = 'driver' | 'vehicle_default';

export interface EngineInput {
  vehicleClass: VehicleClass;
  distanceKm: number;
  fuelPricePerLitre: number;
  kmpl: number;
  kmplFull?: number | null;
  loadRatio: LoadRatio;
  defaultLoadPenaltyK: number;
  tolls: number;
  returnEmpty?: boolean;
}

export interface LegResult {
  label: LegLabel;
  loadRatio: LoadRatio;
  k: number;
  kSource: KSource;
  adjustedKmpl: number;
  fuelLitres: number;
  fuelCost: number;
}

export interface EstimateResult {
  calcVersion: CalcVersion;
  legs: LegResult[];
  primaryLeg: LegResult;
  returnLeg: LegResult | null;
  fuelLitresTotal: number;
  fuelCostTotal: number;
  tolls: number;
  total: number;
  k: number;
  kSource: KSource;
  inputs: {
    vehicleClass: VehicleClass;
    distanceKm: number;
    fuelPricePerLitre: number;
    kmpl: number;
    kmplFull: number | null;
    loadRatio: LoadRatio;
    defaultLoadPenaltyK: number;
    returnEmpty: boolean;
  };
}

export class EngineValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'EngineValidationError';
    this.field = field;
  }
}
