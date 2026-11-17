import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { RouteEstimateRequest, RouteEstimateResponse, RoutePoint } from '@fce/contracts';
import { AppError, errorCodes } from '../../common/errors';
import { RateLimitService } from '../../common/rate-limit';
import { toIso, todayInPakistan } from '../../common/time';
import { SQL, type SqlClient } from '../../db/token';
import { CatalogService } from '../catalog/catalog.service';
import { MapsService } from '../maps/maps.service';

export function routeKey(origin: RoutePoint, destination: RoutePoint): string {
  const round = (value: number) => value.toFixed(3);
  return createHash('sha256')
    .update(`r:${round(origin.lat)},${round(origin.lng)}|${round(destination.lat)},${round(destination.lng)}`)
    .digest('hex');
}

interface CacheRow {
  distance_m: number | string;
  duration_s: number | string;
  polyline: string | null;
  fetched_at: unknown;
}

@Injectable()
export class RoutesService {
  constructor(
    @Inject(SQL) private readonly sql: SqlClient,
    private readonly catalog: CatalogService,
    private readonly maps: MapsService,
    private readonly limiter: RateLimitService,
  ) {}

  async estimate(request: RouteEstimateRequest, deviceId: string): Promise<RouteEstimateResponse> {
    const keyHash = routeKey(request.origin, request.destination);
    const ttlHours = await this.catalog.configNumber('route_cache_ttl_hours', 24);

    const cached = await this.sql.query<CacheRow>(
      'SELECT distance_m, duration_s, polyline, fetched_at FROM route_cache WHERE key_hash = $1',
      [keyHash],
    );
    const row = cached.rows[0];
    if (row) {
      const ageMs = Date.now() - new Date(toIso(row.fetched_at)).getTime();
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < ttlHours * 3_600_000) {
        return {
          distanceKm: round1(Number(row.distance_m) / 1000),
          durationS: Math.round(Number(row.duration_s)),
          polyline: row.polyline,
          source: 'cache',
          cached: true,
        };
      }
    }

    const quota = await this.catalog.configNumber('daily_route_quota_per_device', 60);
    const quotaResult = this.limiter.consumeDaily(`route:${deviceId}:${todayInPakistan()}`, quota);
    if (!quotaResult.allowed) {
      throw new AppError(errorCodes.quotaExceeded, 'Daily route limit reached for this device', 429, {
        limit: quota,
      });
    }

    const { route, source } = await this.maps.route(request.origin, request.destination);
    const fetchedAt = new Date();
    await this.sql.query(
      `INSERT INTO route_cache (key_hash, distance_m, duration_s, polyline, fetched_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key_hash) DO UPDATE
         SET distance_m = EXCLUDED.distance_m,
             duration_s = EXCLUDED.duration_s,
             polyline = EXCLUDED.polyline,
             fetched_at = EXCLUDED.fetched_at`,
      [keyHash, Math.round(route.distanceKm * 1000), Math.round(route.durationS), route.polyline, fetchedAt],
    );

    return {
      distanceKm: round1(route.distanceKm),
      durationS: Math.round(route.durationS),
      polyline: route.polyline,
      source,
      cached: false,
    };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
