import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { FuelType } from '@fce/contracts';
import { z } from 'zod';
import { PKT_OFFSET_MS, nowIso, todayInPakistan } from '../../common/time';
import { config } from '../../config';
import { AdminDataService, type FuelPriceImportAction } from './admin-data.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_ACTOR = 'autoones-sync';
const SYNC_SOURCE = 'autoones.com (OGRA)';
const MIN_PRICE = 50;
const MAX_PRICE = 1000;
const SCHEDULE_BUFFER_MS = 30_000;
const STARTUP_DELAY_MS = 20_000;
const RETRY_COOLDOWN_MS = 2 * 60 * 1000;
const SYNCED_FUELS = new Set<FuelType>(['petrol', 'diesel']);

const feedSchema = z.object({
  prices: z.array(
    z.object({
      slug: z.string(),
      price_pkr: z.number(),
      effective_date: z.string(),
    }),
  ),
});

export interface FuelSyncItem {
  fuelType: FuelType;
  pricePerLitre: number;
  effectiveFrom: string;
  action: FuelPriceImportAction;
  reason?: string;
}

export interface FuelSyncResult {
  ranAt: string;
  checked: number;
  results: FuelSyncItem[];
}

export function msUntilNextMidnightPkt(now = Date.now()): number {
  const pktNow = now + PKT_OFFSET_MS;
  const nextMidnight = Math.floor(pktNow / DAY_MS) * DAY_MS + DAY_MS;
  return Math.max(1000, nextMidnight - pktNow);
}

@Injectable()
export class FuelSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(FuelSyncService.name);
  private bootTimer: NodeJS.Timeout | null = null;
  private midnightTimer: NodeJS.Timeout | null = null;
  private inFlight: Promise<FuelSyncResult> | null = null;
  private lastSuccessAt: number | null = null;
  private lastAttemptAt: number | null = null;

  constructor(private readonly data: AdminDataService) {}

  onApplicationBootstrap(): void {
    if (config.nodeEnv === 'test' || !config.fuelSyncEnabled) return;

    this.bootTimer = setTimeout(() => {
      void this.runScheduled('startup');
    }, STARTUP_DELAY_MS);
    this.bootTimer.unref?.();

    this.scheduleMidnight();
  }

  onApplicationShutdown(): void {
    if (this.bootTimer) clearTimeout(this.bootTimer);
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
  }

  syncNow(actor = SYNC_ACTOR): Promise<FuelSyncResult> {
    if (!this.inFlight) {
      this.inFlight = this.performSync(actor).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  async refreshIfStale(maxAgeMs: number): Promise<boolean> {
    if (config.nodeEnv === 'test' || !config.fuelSyncEnabled) return false;
    if (this.inFlight) {
      try {
        await this.inFlight;
        return true;
      } catch {
        return false;
      }
    }
    if (this.lastSuccessAt !== null && Date.now() - this.lastSuccessAt < maxAgeMs) {
      return false;
    }
    if (this.lastAttemptAt !== null && Date.now() - this.lastAttemptAt < RETRY_COOLDOWN_MS) {
      return false;
    }
    try {
      await this.syncNow('web-refresh');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`On-demand fuel sync failed: ${message}`);
      return false;
    }
  }

  private async performSync(actor: string): Promise<FuelSyncResult> {
    this.lastAttemptAt = Date.now();
    let response: Response;
    try {
      response = await fetch(config.fuelSyncUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new Error(`Could not reach the fuel feed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    if (!response.ok) {
      throw new Error(`Fuel feed returned HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Fuel feed did not return valid JSON');
    }
    const parsed = feedSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error('Fuel feed response was not in the expected format');
    }

    const today = todayInPakistan();
    const latestAllowedDate = new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS)
      .toISOString()
      .slice(0, 10);
    const results: FuelSyncItem[] = [];

    for (const entry of parsed.data.prices) {
      if (!SYNCED_FUELS.has(entry.slug as FuelType)) continue;
      const fuelType = entry.slug as FuelType;
      const pricePerLitre = Math.round(entry.price_pkr * 100) / 100;
      const effectiveFrom = entry.effective_date;

      if (!isValidDate(effectiveFrom)) {
        results.push({
          fuelType,
          pricePerLitre,
          effectiveFrom,
          action: 'skipped',
          reason: 'effective date is not valid',
        });
        continue;
      }
      if (effectiveFrom > latestAllowedDate) {
        results.push({
          fuelType,
          pricePerLitre,
          effectiveFrom,
          action: 'skipped',
          reason: 'effective date is too far in the future',
        });
        continue;
      }
      if (!Number.isFinite(pricePerLitre) || pricePerLitre < MIN_PRICE || pricePerLitre > MAX_PRICE) {
        results.push({
          fuelType,
          pricePerLitre,
          effectiveFrom,
          action: 'skipped',
          reason: `price is outside Rs ${MIN_PRICE}-${MAX_PRICE}`,
        });
        continue;
      }

      const outcome = await this.data.importFuelPrice(
        { fuelType, pricePerLitre, effectiveFrom, source: SYNC_SOURCE },
        actor,
      );
      results.push({
        fuelType,
        pricePerLitre,
        effectiveFrom,
        action: outcome.action,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      });
    }

    if (results.length === 0) {
      throw new Error('Fuel feed did not include petrol or diesel prices');
    }

    this.lastSuccessAt = Date.now();
    return { ranAt: nowIso(), checked: results.length, results };
  }

  private scheduleMidnight(): void {
    const delay = msUntilNextMidnightPkt() + SCHEDULE_BUFFER_MS;
    this.midnightTimer = setTimeout(() => {
      void this.runScheduled('midnight').finally(() => this.scheduleMidnight());
    }, delay);
    this.midnightTimer.unref?.();
  }

  private async runScheduled(trigger: string): Promise<void> {
    try {
      const result = await this.syncNow();
      const summary = result.results
        .map((item) => `${item.fuelType}:${item.action}${item.reason ? `(${item.reason})` : ''}`)
        .join(', ');
      this.logger.log(`Fuel sync (${trigger}) finished: ${summary}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Fuel sync (${trigger}) failed: ${message}`);
    }
  }
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}
