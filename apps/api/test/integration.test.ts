import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';

const apiRoot = join(__dirname, '..');
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}/v1`;
const DB_DIR = join(apiRoot, '.data', 'test-integration');
const DEVICE = 'integration-device-token-01';
const RATE_DEVICE = 'integration-rate-limit-token-01';
const ADMIN_EMAIL = 'integration@fuelcost.local';
const ADMIN_PASSWORD = 'Integration-Pass-2026';

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  DB_DRIVER: 'pglite',
  PGLITE_DIR: DB_DIR,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  APP_ORIGIN: 'http://localhost:5173',
};

let server: ChildProcess | null = null;
let token = '';
let pendingMfaToken = '';
let totpSecret = '';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function runNode(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: apiRoot, env });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('exit', (code) => (code === 0 ? resolve(output) : reject(new Error(`${script} exited ${code}: ${output}`))));
  });
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await delay(250);
  }
  throw new Error('API did not become healthy');
}

function call(path: string, init: RequestInit = {}, device: string | null = DEVICE) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (device) headers['x-device-token'] = device;
  if (init.body) headers['content-type'] = 'application/json';
  return fetch(`${BASE}${path}`, { ...init, headers });
}

async function json<T>(path: string, init: RequestInit = {}, device: string | null = DEVICE): Promise<T> {
  const response = await call(path, init, device);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function adminLogin(extra: Record<string, unknown> = {}) {
  return json<{ token: string; mfaEnabled: boolean; mfaRequired: boolean }>(
    '/admin/auth/login',
    { method: 'POST', body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, ...extra }) },
    null,
  );
}

beforeAll(async () => {
  rmSync(DB_DIR, { recursive: true, force: true });
  await runNode('dist/db/cli-admin.js');
  server = spawn(process.execPath, ['dist/main.js'], { cwd: apiRoot, env });
  await waitForHealth();

  const first = await adminLogin();
  pendingMfaToken = first.token;
  const setupOptions = {
    method: 'POST',
    headers: { authorization: `Bearer ${pendingMfaToken}` },
  };
  const [setup, repeatedSetup] = await Promise.all([
    json<{ secret: string }>('/admin/auth/mfa/setup', setupOptions, null),
    json<{ secret: string }>('/admin/auth/mfa/setup', setupOptions, null),
  ]);
  totpSecret = setup.secret;
  expect(repeatedSetup.secret).toBe(totpSecret);
  await json('/admin/auth/mfa/verify', {
    method: 'POST',
    headers: { authorization: `Bearer ${pendingMfaToken}` },
    body: JSON.stringify({ code: authenticator.generate(totpSecret) }),
  }, null);
  const second = await adminLogin({ totp: authenticator.generate(totpSecret) });
  token = second.token;
}, 90_000);

afterAll(async () => {
  if (server) {
    server.kill();
    await delay(500);
  }
  rmSync(DB_DIR, { recursive: true, force: true });
});

describe('public API contract', () => {
  it('health reports ok and the calc version', async () => {
    const body = await json<{ status: string; calcVersion: string }>('/health', {}, null);
    expect(body.status).toBe('ok');
    expect(body.calcVersion).toBe('v1');
  });

  it('rejects a missing device token with a typed error', async () => {
    const response = await call('/vehicle-types', {}, null);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('device_token_missing');
  });

  it('serves vehicle types with picture keys and load options', async () => {
    const body = await json<{ vehicleTypes: Array<Record<string, unknown>> }>('/vehicle-types');
    expect(body.vehicleTypes).toHaveLength(14);
    const goods = body.vehicleTypes.find((v) => v.class === 'goods');
    expect(goods?.loadOptions).toEqual([0, 0.5, 1]);
    expect(goods?.payloadTons).toBeGreaterThan(0);
    expect(goods?.seats).toBeNull();
    const passenger = body.vehicleTypes.find((v) => v.class === 'passenger');
    expect(passenger?.loadOptions).toEqual([0]);
    expect(passenger?.pictureKey).toBeTruthy();
    expect(passenger?.nameUr).toBeTruthy();
    expect(passenger?.seats).toBeGreaterThan(0);
    expect(passenger?.payloadTons).toBeNull();
  });

  it('serves current fuel prices with their effective date', async () => {
    const body = await json<{ prices: Array<{ fuelType: string; pricePerLitre: number; effectiveFrom: string; stale: boolean }>; serverDate: string }>(
      '/fuel-prices/current',
    );
    expect(body.prices).toHaveLength(4);
    expect(body.prices.map((p) => p.fuelType)).toEqual(['petrol', 'diesel', 'cng', 'lpg']);
    for (const price of body.prices) {
      expect(price.pricePerLitre).toBeGreaterThan(0);
      expect(price.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof price.stale).toBe('boolean');
    }
  });

  it('serves a public price refresh that falls back to stored prices', async () => {
    const body = await json<{ prices: unknown[]; refreshed: boolean; serverDate: string }>('/fuel-prices/refresh', {
      method: 'POST',
    });
    expect(body.prices).toHaveLength(4);
    expect(body.refreshed).toBe(false);
    expect(body.serverDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('searches places and returns coordinates', async () => {
    const body = await json<{ places: Array<{ name: string; lat: number; lng: number }> }>('/places?q=lahore');
    expect(body.places.length).toBeGreaterThan(0);
    expect(body.places[0]?.lat).toBeGreaterThan(0);
  });

  it('caches a route on the second call and returns the same distance', async () => {
    const payload = JSON.stringify({
      origin: { lat: 31.512, lng: 74.352 },
      destination: { lat: 31.4681, lng: 74.2441 },
    });
    const first = await json<{ distanceKm: number; source: string; cached: boolean }>('/routes/estimate', { method: 'POST', body: payload });
    const second = await json<{ distanceKm: number; source: string; cached: boolean }>('/routes/estimate', { method: 'POST', body: payload });
    expect(first.distanceKm).toBeGreaterThan(0);
    expect(second.distanceKm).toBe(first.distanceKm);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.source).toBe('cache');
  });

  it('rejects incomplete route input before calling the provider', async () => {
    const response = await call('/routes/estimate', { method: 'POST', body: JSON.stringify({ origin: { lat: 31.5, lng: 74.3 } }) });
    expect(response.status).toBe(400);
  });

  it('calculates a golden shehzore estimate with the displayed price date', async () => {
    const body = await json<{
      calcVersion: string;
      fuelCostTotal: number;
      total: number;
      legs: unknown[];
      fuelPrice: { effectiveFrom: string; pricePerLitre: number };
      warnings: string[];
    }>('/estimate', {
      method: 'POST',
      body: JSON.stringify({
        vehicleTypeCode: 'shehzore',
        distanceKm: 200,
        fuelType: 'petrol',
        kmpl: 12,
        kmplFull: 9,
        loadRatio: 1,
        tolls: 500,
      }),
    });
    expect(body.calcVersion).toBe('v1');
    expect(body.fuelCostTotal).toBe(5966.67);
    expect(body.total).toBe(6466.67);
    expect(body.legs).toHaveLength(1);
    expect(body.fuelPrice.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.warnings).toContain('fuel_price_placeholder');
  });

  it('adds a separate empty return leg and charges tolls once', async () => {
    const body = await json<{ legs: Array<{ label: string; loadRatio: number }>; tolls: number; total: number; fuelCostTotal: number }>(
      '/estimate',
      {
        method: 'POST',
        body: JSON.stringify({
          vehicleTypeCode: 'shehzore',
          distanceKm: 200,
          fuelType: 'petrol',
          kmpl: 12,
          kmplFull: 9,
          loadRatio: 1,
          tolls: 500,
          returnEmpty: true,
        }),
      },
    );
    expect(body.legs.map((leg) => leg.label)).toEqual(['outbound', 'return']);
    expect(body.legs[1]?.loadRatio).toBe(0);
    expect(body.tolls).toBe(500);
    expect(body.fuelCostTotal).toBe(10441.67);
  });

  it('forces passenger load to empty', async () => {
    const body = await json<{ legs: Array<{ loadRatio: number }> }>('/estimate', {
      method: 'POST',
      body: JSON.stringify({
        vehicleTypeCode: 'car',
        distanceKm: 120,
        fuelType: 'petrol',
        kmpl: 14,
        loadRatio: 1,
        tolls: 0,
      }),
    });
    expect(body.legs[0]?.loadRatio).toBe(0);
  });

  it('rejects unknown vehicle types and invalid distances', async () => {
    const unknown = await call('/estimate', {
      method: 'POST',
      body: JSON.stringify({ vehicleTypeCode: 'ufo', distanceKm: 10, fuelType: 'petrol', kmpl: 10, loadRatio: 0, tolls: 0 }),
    });
    expect(unknown.status).toBe(404);
    const invalid = await call('/estimate', {
      method: 'POST',
      body: JSON.stringify({ vehicleTypeCode: 'car', distanceKm: 0, fuelType: 'petrol', kmpl: 14, loadRatio: 0, tolls: 0 }),
    });
    expect(invalid.status).toBe(400);
  });
});

describe('admin API contract', () => {
  it('blocks data endpoints until MFA is enrolled', async () => {
    const response = await call('/admin/fuel-prices', { headers: { authorization: `Bearer ${pendingMfaToken}` } }, null);
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('mfa_required');
  });

  it('creates a draft, refuses public visibility, then approves and serves it', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const draft = await json<{ id: number; status: string }>('/admin/fuel-prices', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ fuelType: 'diesel', pricePerLitre: 281.4, effectiveFrom: '2026-11-14', source: 'integration-test' }),
    }, null);
    expect(draft.status).toBe('draft');

    const before = await json<{ prices: Array<{ fuelType: string; pricePerLitre: number; source: string }> }>('/fuel-prices/current');
    expect(before.prices.find((p) => p.fuelType === 'diesel')?.source).toBe('seed-placeholder');

    const approved = await json<{ status: string; approvedBy: string }>(`/admin/fuel-prices/${draft.id}/approve`, {
      method: 'POST',
      headers: auth,
    }, null);
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe(ADMIN_EMAIL);

    const after = await json<{ prices: Array<{ fuelType: string; pricePerLitre: number; effectiveFrom: string }> }>('/fuel-prices/current');
    const diesel = after.prices.find((p) => p.fuelType === 'diesel');
    expect(diesel?.pricePerLitre).toBe(281.4);
    expect(diesel?.effectiveFrom).toBe('2026-11-14');
  });

  it('updates vehicle type settings and records an audit trail', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const patched = await json<{ defaultLoadPenaltyK: number }>('/admin/vehicle-types/mazda', {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ defaultLoadPenaltyK: 0.21 }),
    }, null);
    expect(patched.defaultLoadPenaltyK).toBeCloseTo(0.21, 3);

    const audit = await json<{ items: Array<{ action: string; actor: string }> }>('/admin/audit?limit=20', { headers: auth }, null);
    const actions = audit.items.map((item) => item.action);
    expect(actions).toContain('fuel_price.create');
    expect(actions).toContain('fuel_price.approve');
    expect(actions).toContain('vehicle_type.update');
    expect(audit.items.every((item) => item.actor === ADMIN_EMAIL)).toBe(true);
  });

  it('deletes a draft price and refuses to delete an approved one', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const draft = await json<{ id: number }>('/admin/fuel-prices', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ fuelType: 'cng', pricePerLitre: 199.5, effectiveFrom: '2099-02-02', source: 'integration-delete' }),
    }, null);

    const deleted = await json<{ id: number }>(`/admin/fuel-prices/${draft.id}`, { method: 'DELETE', headers: auth }, null);
    expect(deleted.id).toBe(draft.id);

    const list = await json<{ items: Array<{ id: number }> }>('/admin/fuel-prices', { headers: auth }, null);
    expect(list.items.some((item) => item.id === draft.id)).toBe(false);

    const approved = await json<{ id: number }>('/admin/fuel-prices', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ fuelType: 'lpg', pricePerLitre: 199.5, effectiveFrom: '2099-02-03', source: 'integration-delete' }),
    }, null);
    await json(`/admin/fuel-prices/${approved.id}/approve`, { method: 'POST', headers: auth }, null);

    const refused = await call(`/admin/fuel-prices/${approved.id}`, { method: 'DELETE', headers: auth }, null);
    expect(refused.status).toBe(409);
  });
});

describe('rate limits and quota', () => {
  it('returns 429 after the per-minute route limit', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 13; i += 1) {
      const response = await call('/routes/estimate', {
        method: 'POST',
        body: JSON.stringify({
          origin: { lat: 24.8 + i * 0.001, lng: 67.0 },
          destination: { lat: 24.9, lng: 67.1 + i * 0.001 },
        }),
      }, RATE_DEVICE);
      lastStatus = response.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  }, 30_000);
});
