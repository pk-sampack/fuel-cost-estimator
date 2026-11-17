import type { FuelType } from '@fce/contracts';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/v1';

export const TOKEN_KEY = 'fce.admin.token.v1';

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

export interface AdminSession {
  token: string;
  email: string;
}

export interface AdminMe {
  email: string;
  role: 'admin' | 'editor';
  mfaEnabled: boolean;
}

export interface FuelPrice {
  id: number;
  fuelType: FuelType;
  pricePerLitre: number;
  effectiveFrom: string;
  checkedAt: string;
  source: string;
  status: 'draft' | 'approved';
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface VehicleType {
  id: number;
  code: string;
  nameEn: string;
  nameUr: string;
  class: string;
  pictureKey: string;
  defaultLoadPenaltyK: number;
  kmplMin: number;
  kmplMax: number;
  seats: number | null;
  payloadTons: number | null;
  sortOrder: number;
  active: boolean;
  updatedAt: string;
}

export interface FuelPriceInput {
  fuelType: FuelType;
  pricePerLitre: number;
  effectiveFrom: string;
  source: string;
}

export interface VehicleTypePatch {
  nameEn?: string;
  nameUr?: string;
  defaultLoadPenaltyK?: number;
  kmplMin?: number;
  kmplMax?: number;
  seats?: number | null;
  payloadTons?: number | null;
  active?: boolean;
  sortOrder?: number;
}

export interface FuelSyncItem {
  fuelType: FuelType;
  pricePerLitre: number;
  effectiveFrom: string;
  action: 'inserted' | 'updated' | 'unchanged' | 'skipped';
  reason?: string;
}

export interface FuelSyncResult {
  ranAt: string;
  checked: number;
  results: FuelSyncItem[];
}

export interface LoginResult {
  token: string;
  email: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('network_error', 'Cannot reach the API. Is it running?', 0);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      error?.code ?? 'http_error',
      error?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return payload as T;
}

export const api = {
  login(email: string, password: string, totp?: string) {
    return request<LoginResult>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(totp ? { totp } : {}) }),
    });
  },

  me(token: string) {
    return request<AdminMe>('/admin/auth/me', {}, token);
  },

  setupMfa(token: string) {
    return request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>(
      '/admin/auth/mfa/setup',
      { method: 'POST' },
      token,
    );
  },

  verifyMfa(token: string, code: string) {
    return request<{ mfaEnabled: true }>(
      '/admin/auth/mfa/verify',
      { method: 'POST', body: JSON.stringify({ code }) },
      token,
    );
  },

  async listPrices(token: string): Promise<FuelPrice[]> {
    const data = await request<{ items: FuelPrice[] }>('/admin/fuel-prices', {}, token);
    return data.items;
  },

  createPrice(token: string, input: FuelPriceInput) {
    return request<FuelPrice>(
      '/admin/fuel-prices',
      { method: 'POST', body: JSON.stringify(input) },
      token,
    );
  },

  patchPrice(token: string, id: number, patch: Partial<FuelPriceInput>) {
    return request<FuelPrice>(
      `/admin/fuel-prices/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      token,
    );
  },

  approvePrice(token: string, id: number) {
    return request<FuelPrice>(
      `/admin/fuel-prices/${id}/approve`,
      { method: 'POST' },
      token,
    );
  },

  deletePrice(token: string, id: number) {
    return request<{ id: number }>(
      `/admin/fuel-prices/${id}`,
      { method: 'DELETE' },
      token,
    );
  },

  syncPrices(token: string) {
    return request<FuelSyncResult>('/admin/fuel-prices/sync', { method: 'POST' }, token);
  },

  async listVehicles(token: string): Promise<VehicleType[]> {
    const data = await request<{ items: VehicleType[] }>('/admin/vehicle-types', {}, token);
    return data.items;
  },

  patchVehicle(token: string, code: string, patch: VehicleTypePatch) {
    return request<VehicleType>(
      `/admin/vehicle-types/${encodeURIComponent(code)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      token,
    );
  },
};

export function isAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === 'mfa_required')
  );
}
