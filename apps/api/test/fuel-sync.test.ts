import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayInPakistan } from '../src/common/time';
import type { AdminDataService } from '../src/modules/admin/admin-data.service';
import {
  FuelSyncService,
  msUntilNextMidnightPkt,
} from '../src/modules/admin/fuel-sync.service';

function feedResponse(prices: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      source: 'OGRA notified prices, Government of Pakistan',
      unit: 'PKR per litre',
      prices,
    }),
  } as unknown as Response;
}

function createService(outcomes: { action: string; reason?: string }[] = []) {
  const importFuelPrice = vi.fn(async () => outcomes.shift() ?? { action: 'inserted' });
  const service = new FuelSyncService({
    importFuelPrice,
  } as unknown as AdminDataService);
  return { service, importFuelPrice };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fuel sync', () => {
  it('imports rounded petrol and diesel prices and ignores other fuels', async () => {
    const today = todayInPakistan();
    const fetchMock = vi.fn().mockResolvedValue(
      feedResponse([
        { slug: 'petrol', price_pkr: 330.004, effective_date: today },
        { slug: 'diesel', price_pkr: 360, effective_date: today },
        { slug: 'cng', price_pkr: 210, effective_date: today },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { service, importFuelPrice } = createService();

    const result = await service.syncNow('tester@fuelcost.local');

    expect(result.checked).toBe(2);
    expect(importFuelPrice).toHaveBeenCalledTimes(2);
    expect(importFuelPrice).toHaveBeenNthCalledWith(
      1,
      {
        fuelType: 'petrol',
        pricePerLitre: 330,
        effectiveFrom: today,
        source: 'autoones.com (OGRA)',
      },
      'tester@fuelcost.local',
    );
    expect(importFuelPrice).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fuelType: 'diesel', pricePerLitre: 360 }),
      'tester@fuelcost.local',
    );
    expect(result.results.every((item) => item.action === 'inserted')).toBe(true);
  });

  it('rejects impossible prices, invalid dates and far-future dates', async () => {
    const today = todayInPakistan();
    const future = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        feedResponse([
          { slug: 'petrol', price_pkr: 10, effective_date: today },
          { slug: 'diesel', price_pkr: 5000, effective_date: today },
          { slug: 'petrol', price_pkr: 330, effective_date: 'not-a-date' },
          { slug: 'diesel', price_pkr: 360, effective_date: future },
        ]),
      ),
    );
    const { service, importFuelPrice } = createService();

    const result = await service.syncNow();

    expect(importFuelPrice).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(4);
    expect(result.results.every((item) => item.action === 'skipped')).toBe(true);
    expect(result.results.map((item) => item.reason)).toEqual([
      expect.stringContaining('outside'),
      expect.stringContaining('outside'),
      expect.stringContaining('not valid'),
      expect.stringContaining('future'),
    ]);
  });

  it('passes through duplicate and draft skip reasons', async () => {
    const today = todayInPakistan();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        feedResponse([
          { slug: 'petrol', price_pkr: 330, effective_date: today },
          { slug: 'diesel', price_pkr: 360, effective_date: today },
        ]),
      ),
    );
    const { service } = createService([
      { action: 'unchanged' },
      { action: 'skipped', reason: 'a draft for that date is waiting for review' },
    ]);

    const result = await service.syncNow();

    expect(result.results[0]).toMatchObject({ action: 'unchanged' });
    expect(result.results[1]).toMatchObject({
      action: 'skipped',
      reason: 'a draft for that date is waiting for review',
    });
  });

  it('fails clearly when the feed is unavailable or malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection reset')));
    await expect(createService().service.syncNow()).rejects.toThrow('Could not reach the fuel feed');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(createService().service.syncNow()).rejects.toThrow('HTTP 503');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ prices: [] }) }),
    );
    await expect(createService().service.syncNow()).rejects.toThrow(
      'did not include petrol or diesel',
    );
  });

  it('schedules for midnight Pakistan time', () => {
    const beforeMidnight = Date.parse('2026-11-15T18:59:00Z');
    const afterMidnight = Date.parse('2026-11-15T19:01:00Z');
    expect(msUntilNextMidnightPkt(beforeMidnight)).toBe(60_000);
    expect(msUntilNextMidnightPkt(afterMidnight)).toBe(86_400_000 - 60_000);
  });
});
