# OpenCode Build Instructions — Fuel Cost Estimator (Pakistan)

You are building the **Fuel Cost Estimator (Pakistan)** exactly as specified in the attached `Tab 1.md`. Read that document fully before writing any code. It is the source of truth for scope, architecture, data model, endpoints, and phase boundaries.

---

## 0. Non-negotiable scope rules

- **Stateless estimator.** No accounts, no login, no trip history, no quote records, no fuel-cost tracking.
- The **only** thing persisted between launches is the vehicle profile (`vehicle_type` + `kmpl`, and optionally `kmpl_full`) stored **on the phone** (Hive/SharedPreferences).
- **No driver data on the server.** No tables for drivers, trips, quotes, or fuel logs.
- Route cache stores **rounded coordinates only** (`key_hash`), never linked to a person.
- AI images and voice audio are **processed in memory and discarded** — never stored.
- Ship **only Phase 1** unless explicitly told otherwise. Do not build ahead into Phase 2+ features.
- Every phase must end with a **working product** — no half-built features in front of users.

---

## 1. Skills to apply

Use these skills throughout. Invoke them explicitly as you work.

### Primary: `ui-ux-pro-max`
Use for **every** screen, component, and interaction. This is the highest-priority skill.

Requirements to satisfy with it:
- **Urdu-first RTL layout** (default language: Urdu; English secondary). Correct `Directionality`, mirrored icons, RTL-safe spacing.
- **Three screens only** in Phase 1: **Vehicle**, **Route & Load**, **Result**.
- **Large touch targets** (min 48dp, prefer 56–64dp for primary actions).
- **Picture-first** vehicle and load selection (empty / half / full).
- **Minimal typing** — big number pad for km/l, autocomplete for places.
- **Low-end Android** (2–3 GB RAM): no heavy animations, no large assets, APK target **< 25 MB**.
- **Accessible contrast**, large readable Urdu type, clear hierarchy, honest UI (label results as estimates; always show fuel price date).
- Design for **low literacy**: icons + pictures carry meaning, text is a fallback.
- Polished, professional, trust-building aesthetic — this is a driver's tool, not a toy.

### Supporting skills (invoke as needed)
- **`mobile-app-development` / Flutter expertise** — Flutter app, Android first, Hive or SharedPreferences for the vehicle profile, HTTP client with retry, offline tolerance.
- **`backend-development` / NestJS (TypeScript)** — modular monolith, strict typing, validation (class-validator/Zod), DTOs, rate limiting per device + IP, secrets from a secrets manager.
- **`database-design` / PostgreSQL** — reference-data schema exactly as §6 of the spec (`vehicle_types`, `fuel_prices`, `toll_segments`, `toll_rates`, `route_cache`, `app_config`, `admin_users`, `audit_log`). Effective-dated rows. **No** driver/trip/quote tables.
- **`api-design`** — Phase 1 endpoints only: `GET /vehicle-types`, `GET /fuel-prices/current`, `POST /routes/estimate`, `POST /estimate`. JSON, versioned, contract-tested.
- **`testing`** — Golden-case unit tests for the **calculation engine** (pure, versioned, deterministic). API contract tests. Manual test on a 2 GB Android device.
- **`security`** — TLS everywhere, API keys restricted by app + server, secrets manager, encryption at rest, admin MFA + audit trail, rate limits.
- **`devops` / CI-CD** — GitHub Actions, staging + production environments, Sentry, backups, staged rollout via Play Console.
- **`admin-panel`** — React + React-Admin, staff login with MFA. Phase 1 scope: **fuel prices** and **vehicle type settings** only.
- **`observability`** — Sentry, uptime checks, structured logs, budget alerts for Maps usage.
- **`cost-control`** — Maps field masks, route cache (24h, rounded keys), per-device daily quota, no Routes call until inputs complete.

---

## 2. The calculation engine (build this first, test it hardest)

Implement exactly as §3 of the spec. It is a **pure, versioned, stateless function**:
