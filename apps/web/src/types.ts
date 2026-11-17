import type { EstimateResponse, FuelType, LoadRatio } from '@fce/contracts';

declare global {
  interface Window {
    __FCE_API_BASE__?: string;
  }
}

export type Screen = 'vehicle' | 'route' | 'result';

export interface PlaceName {
  ur: string;
  en: string;
}

export interface TripSummary {
  origin: PlaceName | null;
  destination: PlaceName | null;
  distanceKm: number;
  durationS: number | null;
  fuelType: FuelType;
  loadRatio: LoadRatio;
  returnEmpty: boolean;
}

export interface ResultBundle {
  estimate: EstimateResponse;
  summary: TripSummary;
}
