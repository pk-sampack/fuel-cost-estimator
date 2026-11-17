import { z } from 'zod';

export const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'lpg'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const VEHICLE_CLASSES = ['passenger', 'goods'] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export const LOAD_RATIOS = [0, 0.5, 1] as const;
export type LoadRatio = (typeof LOAD_RATIOS)[number];

export const fuelTypeSchema = z.enum(FUEL_TYPES);
export const vehicleClassSchema = z.enum(VEHICLE_CLASSES);
export const loadRatioSchema = z.union([z.literal(0), z.literal(0.5), z.literal(1)]);

export const fuelTypeLabels: Record<FuelType, { en: string; ur: string }> = {
  petrol: { en: 'Petrol', ur: 'پیٹرول' },
  diesel: { en: 'Diesel', ur: 'ڈیزل' },
  cng: { en: 'CNG', ur: 'سی این جی' },
  lpg: { en: 'LPG', ur: 'ایل پی جی' },
};

export const loadRatioLabels: Record<LoadRatio, { en: string; ur: string }> = {
  0: { en: 'Empty', ur: 'خالی' },
  0.5: { en: 'Half', ur: 'آدھا' },
  1: { en: 'Full', ur: 'پورا' },
};

export const vehicleTypeDtoSchema = z.object({
  code: z.string(),
  nameEn: z.string(),
  nameUr: z.string(),
  class: vehicleClassSchema,
  pictureKey: z.string(),
  defaultLoadPenaltyK: z.number(),
  kmplMin: z.number(),
  kmplMax: z.number(),
  loadOptions: z.array(loadRatioSchema),
  seats: z.number().int().positive().nullable(),
  payloadTons: z.number().positive().nullable(),
  sortOrder: z.number(),
});
export type VehicleTypeDto = z.infer<typeof vehicleTypeDtoSchema>;

export const fuelPriceDtoSchema = z.object({
  fuelType: fuelTypeSchema,
  pricePerLitre: z.number(),
  effectiveFrom: z.string(),
  checkedAt: z.string(),
  source: z.string(),
  stale: z.boolean(),
});
export type FuelPriceDto = z.infer<typeof fuelPriceDtoSchema>;

export const vehicleTypesResponseSchema = z.object({
  vehicleTypes: z.array(vehicleTypeDtoSchema),
});
export type VehicleTypesResponse = z.infer<typeof vehicleTypesResponseSchema>;

export const currentFuelPricesResponseSchema = z.object({
  prices: z.array(fuelPriceDtoSchema),
  stalePriceThresholdDays: z.number(),
  serverDate: z.string(),
});
export type CurrentFuelPricesResponse = z.infer<typeof currentFuelPricesResponseSchema>;

export const fuelPricesRefreshResponseSchema = currentFuelPricesResponseSchema.extend({
  refreshed: z.boolean(),
});
export type FuelPricesRefreshResponse = z.infer<typeof fuelPricesRefreshResponseSchema>;

export const routePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeId: z.string().max(300).optional(),
  label: z.string().max(200).optional(),
});
export type RoutePoint = z.infer<typeof routePointSchema>;

export const routeEstimateRequestSchema = z.object({
  origin: routePointSchema,
  destination: routePointSchema,
});
export type RouteEstimateRequest = z.infer<typeof routeEstimateRequestSchema>;

export const routeEstimateResponseSchema = z.object({
  distanceKm: z.number(),
  durationS: z.number(),
  polyline: z.string().nullable(),
  source: z.enum(['geoapify', 'google', 'mock', 'cache']),
  cached: z.boolean(),
});
export type RouteEstimateResponse = z.infer<typeof routeEstimateResponseSchema>;

export const estimateRequestSchema = z.object({
  vehicleTypeCode: z.string().min(1).max(60),
  distanceKm: z.number().positive().max(20000),
  fuelType: fuelTypeSchema,
  kmpl: z.number().positive().max(100),
  kmplFull: z.number().positive().max(200).nullable().optional(),
  loadRatio: loadRatioSchema,
  tolls: z.number().min(0).max(1_000_000).default(0),
  returnEmpty: z.boolean().default(false),
});
export type EstimateRequest = z.infer<typeof estimateRequestSchema>;

export const legResultSchema = z.object({
  label: z.enum(['outbound', 'return']),
  loadRatio: loadRatioSchema,
  k: z.number(),
  kSource: z.enum(['driver', 'vehicle_default']),
  adjustedKmpl: z.number(),
  fuelLitres: z.number(),
  fuelCost: z.number(),
});
export type LegResultDto = z.infer<typeof legResultSchema>;

export const estimateResponseSchema = z.object({
  calcVersion: z.literal('v1'),
  legs: z.array(legResultSchema),
  fuelLitresTotal: z.number(),
  fuelCostTotal: z.number(),
  tolls: z.number(),
  total: z.number(),
  k: z.number(),
  kSource: z.enum(['driver', 'vehicle_default']),
  fuelPrice: fuelPriceDtoSchema,
  vehicleType: z.object({
    code: z.string(),
    nameEn: z.string(),
    nameUr: z.string(),
    class: vehicleClassSchema,
  }),
  warnings: z.array(z.string()),
});
export type EstimateResponse = z.infer<typeof estimateResponseSchema>;

export const placeDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type PlaceDto = z.infer<typeof placeDtoSchema>;

export const placesResponseSchema = z.object({
  places: z.array(placeDtoSchema),
});
export type PlacesResponse = z.infer<typeof placesResponseSchema>;

export const adminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  totp: z.string().length(6).optional(),
});
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;

export const adminLoginResponseSchema = z.object({
  token: z.string(),
  email: z.string(),
  mfaEnabled: z.boolean(),
  mfaRequired: z.boolean(),
});
export type AdminLoginResponse = z.infer<typeof adminLoginResponseSchema>;

export const adminFuelPriceInputSchema = z.object({
  fuelType: fuelTypeSchema,
  pricePerLitre: z.number().positive().max(1000),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().min(2).max(200),
});
export type AdminFuelPriceInput = z.infer<typeof adminFuelPriceInputSchema>;

export const adminVehicleTypePatchSchema = z.object({
  nameEn: z.string().min(1).max(80).optional(),
  nameUr: z.string().min(1).max(80).optional(),
  defaultLoadPenaltyK: z.number().min(0).max(0.9).optional(),
  kmplMin: z.number().positive().max(100).optional(),
  kmplMax: z.number().positive().max(200).optional(),
  seats: z.number().int().positive().max(100).nullable().optional(),
  payloadTons: z.number().positive().max(100).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type AdminVehicleTypePatch = z.infer<typeof adminVehicleTypePatchSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
