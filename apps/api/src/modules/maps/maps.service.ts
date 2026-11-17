import { Injectable, Logger } from '@nestjs/common';
import type { PlaceDto, RoutePoint } from '@fce/contracts';
import { config } from '../../config';
import {
  GeoapifyMapsProvider,
  GoogleMapsProvider,
  MockMapsProvider,
  type MapsProvider,
  type RouteResult,
} from './providers';

export interface SourcedRoute {
  route: RouteResult;
  source: 'geoapify' | 'google' | 'mock';
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger('Maps');
  private readonly provider: MapsProvider;
  private readonly fallback = new MockMapsProvider();

  constructor() {
    this.provider = this.selectProvider();
  }

  private selectProvider(): MapsProvider {
    const preference = config.mapsProvider;
    const timeoutMs = 8000;

    if (preference === 'mock') return this.fallback;

    const wantsGeoapify = preference === 'geoapify' || (preference === 'auto' && !!config.geoapifyApiKey);
    if (wantsGeoapify && config.geoapifyApiKey) {
      return new GeoapifyMapsProvider({ apiKey: config.geoapifyApiKey, timeoutMs });
    }

    const wantsGoogle = preference === 'google' || (preference === 'auto' && !!config.googleMapsApiKey);
    if (wantsGoogle && config.googleMapsApiKey) {
      return new GoogleMapsProvider({ apiKey: config.googleMapsApiKey, timeoutMs });
    }

    if (preference === 'geoapify') {
      this.logger.warn('MAPS_PROVIDER=geoapify but GEOAPIFY_API_KEY is empty - using mock distances');
    } else if (preference === 'google') {
      this.logger.warn('MAPS_PROVIDER=google but GOOGLE_MAPS_API_KEY is empty - using mock distances');
    } else {
      this.logger.warn('No GEOAPIFY_API_KEY or GOOGLE_MAPS_API_KEY set - using deterministic mock distances');
    }
    return this.fallback;
  }

  async route(origin: RoutePoint, destination: RoutePoint): Promise<SourcedRoute> {
    try {
      const route = await this.provider.route(origin, destination);
      return { route, source: this.provider.name };
    } catch (error) {
      this.logger.error(`route provider failed: ${(error as Error).message}`);
      if (this.provider === this.fallback) throw error;
      const route = await this.fallback.route(origin, destination);
      return { route, source: 'mock' };
    }
  }

  async places(query: string): Promise<PlaceDto[]> {
    try {
      return await this.provider.places(query);
    } catch (error) {
      this.logger.error(`places provider failed: ${(error as Error).message}`);
      return this.fallback.places(query);
    }
  }
}
