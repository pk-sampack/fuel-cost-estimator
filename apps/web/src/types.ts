import type { EstimateResponse, FuelType, LoadRatio } from '@fce/contracts';

export type Screen = 'vehicle' | 'route' | 'result';

export interface PlaceName {
  ur: string;
  en: string;
}

export interface TripSummary {
  origin: PlaceName | null;
  destination: PlaceName | null;
  distanceKm: number;
  fuelType: FuelType;
  loadRatio: LoadRatio;
  returnEmpty: boolean;
}

export interface ResultBundle {
  estimate: EstimateResponse;
  summary: TripSummary;
}
