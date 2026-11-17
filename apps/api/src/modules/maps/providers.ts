import type { PlaceDto, RoutePoint } from '@fce/contracts';

export interface RouteResult {
  distanceKm: number;
  durationS: number;
  polyline: string | null;
}

export interface MapsProvider {
  readonly name: 'geoapify' | 'google' | 'mock';
  route(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult>;
  places(query: string): Promise<PlaceDto[]>;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const PLACES: PlaceDto[] = [
  { id: 'khi-saddar', name: 'Saddar', nameUr: 'صدر', address: 'Saddar, Karachi', lat: 24.8607, lng: 67.0101 },
  { id: 'khi-clifton', name: 'Clifton', nameUr: 'کلفٹن', address: 'Clifton, Karachi', lat: 24.8138, lng: 67.0300 },
  { id: 'khi-airport', name: 'Jinnah Airport', nameUr: 'جناح ایئرپورٹ', address: 'Airport Road, Karachi', lat: 24.9065, lng: 67.1608 },
  { id: 'khi-tower', name: 'Tower', nameUr: 'ٹاور', address: 'M.A. Jinnah Road, Karachi', lat: 24.8508, lng: 67.0051 },
  { id: 'lhr-liberty', name: 'Liberty Market', nameUr: 'لبرٹی مارکیٹ', address: 'Gulberg, Lahore', lat: 31.5120, lng: 74.3520 },
  { id: 'lhr-thokar', name: 'Thokar Niaz Baig', nameUr: 'ٹھوکر نیاز بیگ', address: 'Multan Road, Lahore', lat: 31.4681, lng: 74.2441 },
  { id: 'lhr-raiwind', name: 'Raiwind Road', nameUr: 'رائے ونڈ روڈ', address: 'Raiwind Road, Lahore', lat: 31.4536, lng: 74.2453 },
  { id: 'lhr-apollo', name: 'Apollo Bazar', nameUr: 'اپولو بازار', address: 'Apollo Bazar, Lahore', lat: 31.5710, lng: 74.3090 },
  { id: 'lhr-ringroad', name: 'Ring Road Interchange', nameUr: 'رنگ روڈ انٹرچینج', address: 'Ring Road, Lahore', lat: 31.4741, lng: 74.3962 },
  { id: 'isb-bluearea', name: 'Blue Area', nameUr: 'بلیو ایریا', address: 'Blue Area, Islamabad', lat: 33.7150, lng: 73.0670 },
  { id: 'isb-faisal', name: 'Faisal Mosque', nameUr: 'فیصل مسجد', address: 'Sector E-7, Islamabad', lat: 33.7297, lng: 73.0372 },
  { id: 'isb-g9', name: 'G-9 Markaz', nameUr: 'جی نائن مارکیز', address: 'G-9, Islamabad', lat: 33.6930, lng: 73.0300 },
  { id: 'rwp-raja', name: 'Raja Bazar', nameUr: 'راجہ بازار', address: 'Raja Bazar, Rawalpindi', lat: 33.5930, lng: 73.0631 },
  { id: 'rwp-faizabad', name: 'Faizabad', nameUr: 'فیض آباد', address: 'Faizabad, Rawalpindi', lat: 33.6637, lng: 73.0801 },
  { id: 'fsd-clock', name: 'Clock Tower', nameUr: 'گھنٹہ گھر', address: 'Clock Tower, Faisalabad', lat: 31.4187, lng: 73.0791 },
  { id: 'fsd-jinnah', name: 'Jinnah Colony', nameUr: 'جناح کالونی', address: 'Jinnah Colony, Faisalabad', lat: 31.4191, lng: 73.1080 },
  { id: 'mul-rukn', name: 'Shah Rukn-e-Alam', nameUr: 'شاہ رکن عالم', address: 'Shah Rukn-e-Alam, Multan', lat: 30.1885, lng: 71.4623 },
  { id: 'mul-cantt', name: 'Cantt', nameUr: 'کینٹ', address: 'Cantt, Multan', lat: 30.1970, lng: 71.4690 },
  { id: 'psh-qissa', name: 'Qissa Khawani', nameUr: 'قصہ خوانی', address: 'Qissa Khawani Bazar, Peshawar', lat: 34.0081, lng: 71.5748 },
  { id: 'psh-hayat', name: 'Hayatabad', nameUr: 'حیات آباد', address: 'Hayatabad, Peshawar', lat: 33.9950, lng: 71.4540 },
  { id: 'qta-liaqat', name: 'Liaquat Bazar', nameUr: 'لیاقت بازار', address: 'Liaquat Bazar, Quetta', lat: 30.1930, lng: 66.9980 },
  { id: 'qta-airport', name: 'Quetta Airport', nameUr: 'کوئٹہ ایئرپورٹ', address: 'Airport Road, Quetta', lat: 30.2514, lng: 66.9377 },
  { id: 'skt-cantt', name: 'Sialkot Cantt', nameUr: 'سیالکوٹ کینٹ', address: 'Cantt, Sialkot', lat: 32.4972, lng: 74.5361 },
  { id: 'hyd-latif', name: 'Latifabad', nameUr: 'لطیف آباد', address: 'Latifabad, Hyderabad', lat: 25.3600, lng: 68.3670 },
  { id: 'guj-gtroad', name: 'GT Road', nameUr: 'جی ٹی روڈ', address: 'GT Road, Gujranwala', lat: 32.1877, lng: 74.1945 },
  { id: 'sukkur-bunder', name: 'Bunder Road', nameUr: 'بندر روڈ', address: 'Bunder Road, Sukkur', lat: 27.7052, lng: 68.8574 },
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s,-]+/g, ' ').trim();
}

export class MockMapsProvider implements MapsProvider {
  readonly name = 'mock' as const;

  async route(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
    const direct = haversineKm(origin, destination);
    const distanceKm = Math.max(1, Math.round(direct * 1.3 * 10) / 10);
    const averageSpeed = distanceKm > 120 ? 62 : 42;
    return {
      distanceKm,
      durationS: Math.round((distanceKm / averageSpeed) * 3600),
      polyline: null,
    };
  }

  async places(query: string): Promise<PlaceDto[]> {
    const q = normalise(query);
    if (!q) return PLACES.slice(0, 8);
    const matches = PLACES.filter((place) => {
      const haystack = normalise(`${place.name} ${place.nameUr ?? ''} ${place.address}`);
      return haystack.includes(q);
    });
    return (matches.length > 0 ? matches : PLACES).slice(0, 8);
  }
}

interface GeoapifyConfig {
  apiKey: string;
  timeoutMs: number;
}

interface GeoapifyRouteFeature {
  properties?: {
    distance?: number;
    time?: number;
  };
  geometry?: unknown;
}

interface GeoapifyRouteResponse {
  features?: GeoapifyRouteFeature[];
}

interface GeoapifyGeoFeature {
  properties?: {
    place_id?: string;
    name?: string;
    address_line1?: string;
    address_line2?: string;
    formatted?: string;
    lat?: number;
    lon?: number;
  };
}

interface GeoapifyGeocodeResponse {
  features?: GeoapifyGeoFeature[];
}

export class GeoapifyMapsProvider implements MapsProvider {
  readonly name = 'geoapify' as const;

  constructor(private readonly cfg: GeoapifyConfig) {}

  async route(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
    const params = new URLSearchParams({
      waypoints: `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`,
      mode: 'drive',
      units: 'metric',
      apiKey: this.cfg.apiKey,
    });

    const response = await fetch(`https://api.geoapify.com/v1/routing?${params.toString()}`, {
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) throw new Error(`Geoapify Routing ${response.status}`);
    const data = (await response.json()) as GeoapifyRouteResponse;
    const props = data.features?.[0]?.properties;
    if (!props || typeof props.distance !== 'number') throw new Error('Geoapify Routing returned no route');

    return {
      distanceKm: Math.round((props.distance / 1000) * 10) / 10,
      durationS: typeof props.time === 'number' ? Math.round(props.time) : 0,
      polyline: null,
    };
  }

  async places(query: string): Promise<PlaceDto[]> {
    const params = new URLSearchParams({
      text: query,
      filter: 'countrycode:pk',
      limit: '8',
      lang: 'ur',
      apiKey: this.cfg.apiKey,
    });

    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`, {
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) throw new Error(`Geoapify Geocoding ${response.status}`);
    const data = (await response.json()) as GeoapifyGeocodeResponse;
    return (data.features ?? [])
      .map((feature, index) => {
        const props = feature.properties ?? {};
        const address =
          props.formatted ?? [props.address_line1, props.address_line2].filter(Boolean).join(', ');
        return {
          id: props.place_id ?? `geoapify-${index}`,
          name: props.name ?? props.address_line1 ?? props.formatted ?? 'Unknown place',
          nameUr: null,
          address,
          lat: props.lat ?? 0,
          lng: props.lon ?? 0,
        };
      })
      .filter((place) => place.lat !== 0 || place.lng !== 0);
  }
}

interface GoogleConfig {
  apiKey: string;
  timeoutMs: number;
}

interface GoogleRouteResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }>;
}

interface GooglePlacesResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
}

export class GoogleMapsProvider implements MapsProvider {
  readonly name = 'google' as const;

  constructor(private readonly cfg: GoogleConfig) {}

  async route(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        units: 'METRIC',
      }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) throw new Error(`Google Routes ${response.status}`);
    const data = (await response.json()) as GoogleRouteResponse;
    const route = data.routes?.[0];
    if (!route?.distanceMeters) throw new Error('Google Routes returned no route');
    const durationSeconds = Number(String(route.duration ?? '0').replace('s', ''));
    return {
      distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
      durationS: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : 0,
      polyline: route.polyline?.encodedPolyline ?? null,
    };
  }

  async places(query: string): Promise<PlaceDto[]> {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'ur',
        regionCode: 'PK',
        maxResultCount: 8,
        locationBias: {
          rectangle: {
            low: { latitude: 23.5, longitude: 60.5 },
            high: { latitude: 37.5, longitude: 77.5 },
          },
        },
      }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) throw new Error(`Google Places ${response.status}`);
    const data = (await response.json()) as GooglePlacesResponse;
    return (data.places ?? [])
      .map((place, index) => ({
        id: place.id ?? `google-${index}`,
        name: place.displayName?.text ?? place.formattedAddress ?? 'Unknown place',
        nameUr: null,
        address: place.formattedAddress ?? '',
        lat: place.location?.latitude ?? 0,
        lng: place.location?.longitude ?? 0,
      }))
      .filter((place) => place.lat !== 0 || place.lng !== 0);
  }
}
