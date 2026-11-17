# Build Journal — Fuel Cost Estimator (Pakistan)
# Format: [YYYY-MM-DDTHH:MM:SSZ] STEP <n> <AREA> <verb> <target> :: <one-line note>
# Append-only. Never store secret values here — reference secret names only.

[2026-11-14T08:05:14Z] STEP 001 SESSION start build :: read Tab 1.md fully; recovered BUILD_INSTRUCTIONS from 4 fragments; Phase 1 plan posted, awaiting go-ahead
[2026-11-14T08:15:02Z] STEP 002 SCOPE decide shell :: user directed web app now, Android later; Tab 1 puts web in Phase 5C - approved deviation, engine/API/admin unchanged
[2026-11-14T08:15:40Z] STEP 003 ENV verify flutter :: Flutter already at D:\flutter, no install; node 24.15.0; C free 10.5GB, D free 51.7GB; Docker daemon NOT running
[2026-11-14T08:16:10Z] STEP 004 DECIDE dbdriver use drizzle :: PGlite embedded for dev/CI (no Docker), node-postgres for prod; same SQL migrations both
[2026-11-14T08:16:30Z] STEP 005 DECIDE maps use mock :: GOOGLE_MAPS_API_KEY deferred by user; MapsProvider interface with deterministic mock + Google impl behind env
[2026-11-14T08:31:12Z] STEP 006 REPO scaffold monorepo :: npm workspaces packages/engine + apps/api,web,admin; root tsconfig/gitignore
[2026-11-14T08:40:05Z] STEP 007 ENGINE write calc-v1 :: pure fn, k resolution, load ratio, empty return leg, 2dp money, no clock/random/IO
[2026-11-14T08:47:31Z] STEP 008 ENGINE test golden :: 10 golden cases across car/rickshaw/wagon/bolan/shehzore/mazda/hino/trailer + 8 rule cases + 4 purity cases, all green
[2026-11-14T08:48:10Z] STEP 009 DECIDE return-leg tolls :: toll field charged once (outbound); return leg is fuel only; documented in result UI
[2026-11-14T08:48:40Z] STEP 010 DECIDE no-orm use raw-sql :: thin SqlClient over PGlite (dev) and pg (prod), parameterised queries, handwritten SQL migrations
[2026-11-14T08:52:18Z] STEP 011 DB write schema :: 0001_init reference tables only (vehicle_types, fuel_prices, route_cache, app_config, admin_users, audit_log); no driver/trip/quote/toll tables
[2026-11-14T08:55:40Z] STEP 012 DB seed reference data :: 14 vehicle types placeholder + 4 fuel prices dated 2026-11-13 + app_config thresholds
[2026-11-14T08:58:02Z] STEP 013 DB run migrations :: 2 applied successfully on embedded PGlite
[2026-11-14T09:05:44Z] STEP 014 API build endpoints :: vehicle-types, fuel-prices/current, places, routes/estimate, estimate, health, admin auth+data, audit
[2026-11-14T09:12:20Z] STEP 015 API fix DI runtime :: tsx/esbuild omits decorator metadata; switched to tsc build + node dist/main.js
[2026-11-14T09:14:55Z] STEP 016 API smoke public :: route 1340.7km then cache hit; estimate v1 shehzore 2 legs total 73346.62, price date shown
[2026-11-14T09:20:10Z] STEP 017 ADMIN enforce mfa :: data endpoints return 403 mfa_required until TOTP enrolled and verified
[2026-11-14T09:26:31Z] STEP 018 ADMIN price workflow :: draft -> approve -> public current serves 269.75 @ 2026-11-14 -> estimate uses it; audit rows written
[2026-11-14T09:28:00Z] STEP 019 DECIDE pglite single-process :: CLI writers must run with API stopped (embedded engine has no cross-process visibility)
