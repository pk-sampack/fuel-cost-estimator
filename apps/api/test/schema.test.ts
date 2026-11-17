import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(__dirname, '..', 'db', 'migrations');
const init = readFileSync(join(migrationsDir, '0001_init.sql'), 'utf8');
const seed = readFileSync(join(migrationsDir, '0002_seed_reference_data.sql'), 'utf8');

const ALLOWED_TABLES = [
  'admin_users',
  'app_config',
  'audit_log',
  'fuel_prices',
  'route_cache',
  'vehicle_types',
].sort();

describe('reference-data schema guard', () => {
  it('creates exactly the Phase 1 reference tables', () => {
    const tables = [...init.matchAll(/CREATE TABLE (\w+)/g)].map((match) => match[1]).sort();
    expect(tables).toEqual(ALLOWED_TABLES);
  });

  it('has no driver, trip, quote, fuel-log, device or session tables', () => {
    const forbidden = ['drivers', 'driver', 'trips', 'trip', 'quotes', 'quote', 'fuel_logs', 'fuel_log', 'devices', 'sessions'];
    for (const name of forbidden) {
      expect(init).not.toMatch(new RegExp(`CREATE TABLE (IF NOT EXISTS )?${name}\\b`, 'i'));
    }
  });

  it('stores no personal identifiers', () => {
    expect(init).not.toMatch(/\b(device_id|deviceId|driver_id|driverId|user_id|userId|account_id|customer_id|phone|msisdn|email_verified|fcm_token|push_token)\b/i);
  });

  it('route_cache keeps only a rounded-key hash and route facts', () => {
    const block = init.slice(init.indexOf('CREATE TABLE route_cache'), init.indexOf('CREATE INDEX route_cache_fetched_idx'));
    expect(block).toContain('key_hash');
    expect(block).not.toMatch(/\b(origin|destination|lat|lng|latitude|longitude|device|user)\b/i);
  });

  it('fuel prices are effective-dated with draft/approved workflow', () => {
    expect(init).toMatch(/effective_from\s+DATE NOT NULL/);
    expect(init).toMatch(/status\s+TEXT NOT NULL DEFAULT 'draft'/);
    expect(init).toMatch(/approved_by/);
    expect(init).toMatch(/approved_at/);
  });

  it('vehicle types include class, picture, default load penalty and typical range', () => {
    for (const column of ['class', 'picture_key', 'default_load_penalty_k', 'kmpl_min', 'kmpl_max', 'load_options']) {
      expect(init).toMatch(new RegExp(column));
    }
  });

  it('seed carries 14 vehicle types and 4 fuels', () => {
    expect((seed.match(/\('(motorcycle|rickshaw|car|taxi|wagon|bolan|coaster|van|pickup|shehzore|mazda|hino|truck|trailer)'/g) ?? []).length).toBe(14);
    for (const fuel of ['petrol', 'diesel', 'cng', 'lpg']) {
      expect(seed).toContain(`('${fuel}'`);
    }
  });
});
