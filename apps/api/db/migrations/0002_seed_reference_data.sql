INSERT INTO vehicle_types (code, name_en, name_ur, class, picture_key, default_load_penalty_k, kmpl_min, kmpl_max, load_options, sort_order)
VALUES
  ('motorcycle', 'Motorcycle', 'موٹر سائیکل', 'passenger', 'motorcycle', 0.000, 35.00, 55.00, '[0]', 10),
  ('rickshaw',   'Rickshaw',   'رکشہ',        'passenger', 'rickshaw',   0.000, 25.00, 40.00, '[0]', 20),
  ('car',        'Car',        'کار',          'passenger', 'car',        0.000, 10.00, 20.00, '[0]', 30),
  ('taxi',       'Taxi',       'ٹیکسی',        'passenger', 'taxi',       0.000, 10.00, 18.00, '[0]', 40),
  ('wagon',      'Wagon',      'ویگن',         'passenger', 'wagon',      0.000,  8.00, 15.00, '[0]', 50),
  ('bolan',      'Bolan',      'بولان',        'passenger', 'bolan',      0.000,  9.00, 16.00, '[0]', 60),
  ('coaster',    'Coaster',    'کوسٹر',        'passenger', 'coaster',    0.000,  5.00,  9.00, '[0]', 70),
  ('van',        'Van',        'وین',          'goods',     'van',        0.150,  8.00, 14.00, '[0,0.5,1]', 80),
  ('pickup',     'Pickup',     'پک اپ',        'goods',     'pickup',     0.150,  8.00, 13.00, '[0,0.5,1]', 90),
  ('shehzore',   'Shehzore',   'شہزور',        'goods',     'shehzore',   0.180,  9.00, 14.00, '[0,0.5,1]', 100),
  ('mazda',      'Mazda',      'مزدا',         'goods',     'mazda',      0.200,  4.00,  7.00, '[0,0.5,1]', 110),
  ('hino',       'Hino',       'ہینو',         'goods',     'hino',       0.220,  3.50,  6.00, '[0,0.5,1]', 120),
  ('truck',      'Truck',      'ٹرک',          'goods',     'truck',      0.250,  2.50,  5.00, '[0,0.5,1]', 130),
  ('trailer',    'Trailer',    'ٹریلر',        'goods',     'trailer',    0.250,  1.80,  3.50, '[0,0.5,1]', 140)
ON CONFLICT (code) DO NOTHING;

INSERT INTO fuel_prices (fuel_type, price_per_litre, effective_from, checked_at, source, status, approved_by, approved_at)
VALUES
  ('petrol', 268.50, DATE '2026-11-13', TIMESTAMPTZ '2026-11-13T06:00:00Z', 'seed-placeholder', 'approved', 'system-seed', TIMESTAMPTZ '2026-11-13T06:05:00Z'),
  ('diesel', 275.60, DATE '2026-11-13', TIMESTAMPTZ '2026-11-13T06:00:00Z', 'seed-placeholder', 'approved', 'system-seed', TIMESTAMPTZ '2026-11-13T06:05:00Z'),
  ('cng',    210.00, DATE '2026-11-13', TIMESTAMPTZ '2026-11-13T06:00:00Z', 'seed-placeholder', 'approved', 'system-seed', TIMESTAMPTZ '2026-11-13T06:05:00Z'),
  ('lpg',    320.00, DATE '2026-11-13', TIMESTAMPTZ '2026-11-13T06:00:00Z', 'seed-placeholder', 'approved', 'system-seed', TIMESTAMPTZ '2026-11-13T06:05:00Z')
ON CONFLICT (fuel_type, effective_from) DO NOTHING;

INSERT INTO app_config (key, value) VALUES
  ('stale_price_threshold_days', '2'::jsonb),
  ('route_cache_ttl_hours', '24'::jsonb),
  ('daily_route_quota_per_device', '60'::jsonb),
  ('result_rounding', '"2dp"'::jsonb),
  ('calc_version', '"v1"'::jsonb),
  ('data_status', '"placeholder"'::jsonb)
ON CONFLICT (key) DO NOTHING;
