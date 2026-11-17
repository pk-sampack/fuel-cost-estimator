CREATE TABLE vehicle_types (
  id                       SERIAL PRIMARY KEY,
  code                     TEXT NOT NULL UNIQUE,
  name_en                  TEXT NOT NULL,
  name_ur                  TEXT NOT NULL,
  class                    TEXT NOT NULL CHECK (class IN ('passenger', 'goods')),
  picture_key              TEXT NOT NULL,
  default_load_penalty_k   NUMERIC(4, 3) NOT NULL CHECK (default_load_penalty_k >= 0 AND default_load_penalty_k <= 0.9),
  kmpl_min                 NUMERIC(5, 2) NOT NULL CHECK (kmpl_min > 0),
  kmpl_max                 NUMERIC(5, 2) NOT NULL CHECK (kmpl_max > kmpl_min),
  load_options             JSONB NOT NULL DEFAULT '[0]'::jsonb,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vehicle_types_active_sort_idx ON vehicle_types (active, sort_order);

CREATE TABLE fuel_prices (
  id                 SERIAL PRIMARY KEY,
  fuel_type          TEXT NOT NULL CHECK (fuel_type IN ('petrol', 'diesel', 'cng', 'lpg')),
  price_per_litre    NUMERIC(10, 2) NOT NULL CHECK (price_per_litre > 0),
  effective_from     DATE NOT NULL,
  checked_at         TIMESTAMPTZ NOT NULL,
  source             TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  approved_by        TEXT,
  approved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fuel_prices_one_row_per_day UNIQUE (fuel_type, effective_from)
);

CREATE INDEX fuel_prices_current_idx ON fuel_prices (fuel_type, status, effective_from DESC);

CREATE TABLE route_cache (
  key_hash    TEXT PRIMARY KEY,
  distance_m  INTEGER NOT NULL CHECK (distance_m >= 0),
  duration_s  INTEGER NOT NULL CHECK (duration_s >= 0),
  polyline    TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX route_cache_fetched_idx ON route_cache (fetched_at);

CREATE TABLE app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  totp_secret    TEXT,
  mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  role           TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  before      JSONB,
  after       JSONB,
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
