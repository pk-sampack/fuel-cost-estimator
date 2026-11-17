import type {
  CurrentFuelPricesResponse,
  EstimateRequest,
  EstimateResponse,
  FuelPriceDto,
  FuelPricesRefreshResponse,
  PlaceDto,
  RouteEstimateResponse,
  VehicleTypeDto,
} from '@fce/contracts';
import { getDeviceToken } from './storage';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/v1';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const headers: Record<string, string> = {
    'x-device-token': getDeviceToken(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) headers['content-type'] = 'application/json';
  try {
    const response = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal });
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const error = payload as { error?: { code?: string; message?: string } } | null;
      throw new ApiError(error?.error?.code ?? 'http_error', error?.error?.message ?? 'Request failed', response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') throw new ApiError('timeout', 'Request timed out', 408);
    throw new ApiError('network_error', 'Could not reach the server', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async vehicleTypes(): Promise<VehicleTypeDto[]> {
    const data = await request<{ vehicleTypes: VehicleTypeDto[] }>('/vehicle-types');
    return data.vehicleTypes;
  },
  async currentPrices(): Promise<CurrentFuelPricesResponse> {
    return request<CurrentFuelPricesResponse>('/fuel-prices/current');
  },
  async refreshPrices(): Promise<FuelPricesRefreshResponse> {
    return request<FuelPricesRefreshResponse>('/fuel-prices/refresh', { method: 'POST' });
  },
  async places(query: string): Promise<PlaceDto[]> {
    const data = await request<{ places: PlaceDto[] }>(`/places?q=${encodeURIComponent(query)}`);
    return data.places;
  },
  async route(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<RouteEstimateResponse> {
    return request<RouteEstimateResponse>('/routes/estimate', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    });
  },
  async estimate(payload: EstimateRequest): Promise<EstimateResponse> {
    return request<EstimateResponse>('/estimate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export function priceFor(prices: FuelPriceDto[], fuelType: string): FuelPriceDto | undefined {
  return prices.find((price) => price.fuelType === fuelType);
}
