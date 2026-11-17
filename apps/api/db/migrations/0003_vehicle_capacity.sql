ALTER TABLE vehicle_types
  ADD COLUMN IF NOT EXISTS seats INTEGER CHECK (seats IS NULL OR seats > 0),
  ADD COLUMN IF NOT EXISTS payload_tons NUMERIC(6, 2) CHECK (payload_tons IS NULL OR payload_tons > 0);

UPDATE vehicle_types AS target
   SET seats = source.seats,
       payload_tons = source.payload_tons
  FROM (
    VALUES
      ('motorcycle', 2,    NULL::NUMERIC),
      ('rickshaw',   3,    NULL::NUMERIC),
      ('car',        4,    NULL::NUMERIC),
      ('taxi',       4,    NULL::NUMERIC),
      ('wagon',      7,    NULL::NUMERIC),
      ('bolan',      7,    NULL::NUMERIC),
      ('coaster',    26,   NULL::NUMERIC),
      ('van',        NULL, 0.75::NUMERIC),
      ('pickup',     NULL, 0.80::NUMERIC),
      ('shehzore',   NULL, 2.50::NUMERIC),
      ('mazda',      NULL, 3.50::NUMERIC),
      ('hino',       NULL, 8.00::NUMERIC),
      ('truck',      NULL, 12.00::NUMERIC),
      ('trailer',    NULL, 30.00::NUMERIC)
  ) AS source(code, seats, payload_tons)
 WHERE target.code = source.code;
