# Fuel Cost Estimator (Pakistan): Architecture and Phased Delivery Plan

Prepared from a senior system analyst view · November 12, 2026 · Version 1.2 · scope: no accounts, history or tracking

## 1. Purpose and principles

Give taxi drivers and goods transporters in Pakistan a fast cost estimate from distance, fuel price, tolls and the driver's own fuel average. The app is a stateless estimator, with no login, no trip history, no quote records and no fuel-cost tracking. The only thing it remembers is the driver's vehicle profile (vehicle type and km/l), which is saved on the phone. It runs in Urdu on low-end Android phones.

- **Every phase ships a working product.** No phase ends with half-built features in front of users.
- **Estimate only.** The app turns distance, fuel price, tolls and the driver's km/l into a cost figure. It keeps no history or trips, and stores no driver data on the server.
- **Enter once, reuse every time.** The driver sets vehicle type and km/l once; the phone remembers them.
- **Fresh inputs.** Fuel price is checked every day and shown with its date.
- **Simple for users, strict behind the scenes.** Three screens, large icons, Urdu first.
- **Show the inputs.** The result screen lists the distance, fuel price and its date, toll amount and formula version behind the number.
- **Changing data lives in the database with effective dates, never in code.** This covers fuel prices, toll rates and vehicle type settings.
- **Start as one deployable backend (modular monolith).** Split into services only when load demands it.
- **AI assists, never silently overrides.** Every AI result carries a confidence level and a manual fallback.

## 2. Users and constraints

| Segment | Typical need | Key constraint |
| --- | --- | --- |
| Taxi and ride drivers (car, rickshaw, wagon, Bolan) | Trip cost from distance, fuel and tolls | Low literacy, prefers voice, lives on WhatsApp |
| Goods transporters (Shehzore, Mazda, Hino, trailers) | Trip cost by load, with empty return | Load-dependent mileage, long routes, motorway tolls |

Platform constraints: Android first, 2 to 3 GB RAM devices, unstable 3G/4G, APK under about 25 MB, Urdu right-to-left layout, large touch targets, minimal typing.

## 3. Cost model (the core of the system)

```
load_ratio     = 0 (empty), 0.5 (half), 1 (full); taxis and cars always use 0
k              = 1 − (kmpl_full ÷ kmpl) if the driver entered both, else the default k for the vehicle type
adjusted_kmpl  = kmpl × (1 − k × load_ratio)
fuel_cost      = distance_km ÷ adjusted_kmpl × fuel_price_per_litre
estimated_cost = fuel_cost + tolls
```

Rules:

- The driver enters the vehicle type and fuel average (km per litre) once. It is saved on the phone, reused for every estimate, and editable at any time. No account is needed.
- Goods vehicles can also enter km/l when fully loaded. If skipped, the engine uses a default load penalty for that vehicle type, which the team tunes from field tests. Load is picked with pictures: empty, half or full.
- Distance comes from Google Routes. Fuel price comes from our database, refreshed daily. Tolls come from our toll table (Phase 2) or are typed in by the driver (Phase 1).
- Return leg: if the vehicle returns empty, calculate that leg with load\_ratio = 0 and show it as a separate line.
- Out of scope for now: margin, driver wage, maintenance, quote pricing, and saving of results.
- The engine is a pure, versioned function: the same inputs always give the same output. Nothing is stored on the server after the result is shown.

## 4. Target architecture

```
[Flutter app, Android first]
 (vehicle profile saved on the phone)
        │  HTTPS / JSON, anonymous device token
[Load balancer / API gateway]
        │
[Modular monolith API (NestJS)]
 ├─ Vehicle type settings
 ├─ Calculation engine (pure, versioned, stateless)
 ├─ Routing service (Google Routes wrapper + cache)
 ├─ Fuel price service
 ├─ Toll service
 ├─ Admin API (staff login only)
 └─ Later: vehicle catalog, AI gateway, voice
        │
[PostgreSQL + PostGIS]  [Redis cache and queue]
        │
[Workers: daily fuel price check, toll updates, notifications, AI jobs]

External: Google Maps Platform, FCM push, speech-to-text/text-to-speech, LLM with vision
```

| Component | Responsibility |
| --- | --- |
| Mobile app | Urdu UI, vehicle setup (type and km/l saved on the phone), route and load input, result screen, sharing, local cache of prices |
| API | Business rules, validation, rate limiting per device and IP |
| Calculation engine | Deterministic, stateless cost math, unit-tested with golden cases |
| Routing service | Calls Google Routes only from the backend (key never in the app); caches popular routes for 24 hours using rounded origin and destination keys |
| Fuel price service | Stores effective-dated prices; serves current price with source and date |
| Toll service | Matches a route to toll segments and returns the toll for the vehicle class |
| Workers | Scheduled and queued jobs, including the daily fuel price check, so slow work never blocks a request |
| Admin panel | Approve prices, edit toll rates and vehicle type settings, view audit log (staff only) |

## 5. Technology stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Mobile | Flutter (Android first, iOS later) | One codebase, good performance on low-end phones |
| On-device storage | Flutter local storage (Hive or SharedPreferences) | Keeps vehicle type and km/l between launches, no account needed |
| Backend | Node.js with NestJS (TypeScript) | Modular structure, strong typing. FastAPI is an equal alternative |
| Database | PostgreSQL, with PostGIS from Phase 2 | Reference data (vehicle types, prices, tolls) plus toll segment geometry |
| Cache and jobs | Redis with BullMQ | Route cache, rate limits, daily price job and other workers |
| User access | No accounts: anonymous device token plus rate limits | Drivers open the app and get an estimate |
| Maps | Places Autocomplete, Routes API, Maps SDK | Distance, time, place search |
| Admin | React with React-Admin, staff login with MFA | Fast to build price, toll and vehicle type screens |
| Hosting | Cloud Run or AWS in the region with best latency to Pakistan | Autoscaling, low operations load |
| Observability | Sentry, cloud monitoring, uptime checks | Catch crashes and bad data early |
| CI/CD | GitHub Actions, Play Console staged rollout | Safe, repeatable releases |
| Voice (Phase 3) | Cloud speech-to-text and text-to-speech with Urdu | Test on real driver audio before committing |
| AI (Phase 4) | LLM with vision behind an AI gateway | Vehicle photo and registration extraction; images are not stored |

## 6. Core data model

The database holds reference data only. There are no tables for drivers, trips, quotes or fuel logs, and the driver's vehicle profile (type and km/l) lives on the phone.

- **vehicle\_types**: class, name and picture, default load penalty (k), typical km/l range (used to warn about unlikely entries), load options shown
- **fuel\_prices**: fuel\_type, price\_per\_litre, effective\_from, checked\_at, source, status (draft or approved), approved\_by
- **toll\_segments**: road\_code, entry, exit, geometry, distance\_km
- **toll\_rates**: segment\_id, vehicle\_class, amount, valid\_from, valid\_to, non\_tag\_surcharge\_pct
- **route\_cache**: key\_hash (rounded origin and destination), distance\_m, duration\_s, polyline, fetched\_at
- **app\_config**: stale-price threshold, city and highway factors
- **vehicle\_presets** (Phase 4): make, model, variant, year range, engine\_cc, fuel\_type, typical km/l, vehicle\_type, used only to match AI results
- **admin\_users** and **audit\_log**: staff accounts; actor, action, entity, before, after, timestamp

## 7. Key API endpoints by phase

| Phase | Endpoints |
| --- | --- |
| 1 | GET /vehicle-types, GET /fuel-prices/current, POST /routes/estimate, POST /estimate (stateless calculation) |
| 2 | GET /tolls/estimate; admin: approve fuel price, toll rate CRUD |
| 3 | POST /voice/transcribe, POST /voice/speak (audio processed and discarded); push through FCM topics, no device tokens stored |
| 4 | POST /vehicles/identify (image processed and discarded), GET /vehicle-presets |
| 5 | Multi-stop estimate, partner API |

## 8. Phased delivery plan

Assumed team: 1 backend developer, 1 Flutter developer, 1 part-time designer, 1 part-time QA/analyst, and one person maintaining vehicle and toll data. Durations are estimates and should be adjusted to the actual team.

| Phase | After release a driver can | New building blocks |
| --- | --- | --- |
| 1. Working Estimator (about 5 weeks) | Set vehicle type and km/l once, then get distance, fuel cost, tolls and a total in Urdu and share it | App, API, database, admin panel, CI/CD |
| 2. Reliable Pakistan Costing (about 4 weeks) | See fuel prices refreshed daily and automatic motorway tolls, and share a result card | Daily price worker, toll engine, PostGIS |
| 3. Voice and Low-Literacy Experience (about 4 weeks) | Speak the route and hear the result, with cached prices offline | Voice service, push notifications |
| 4. AI Vehicle Identification (about 4 weeks) | Photograph the registration book or vehicle and get make, model, cc and a suggested km/l filled in | Vehicle catalog, AI gateway |
| 5. Optional Extensions (modular) | Estimate multi-stop trips, or use the web or iOS version | Multi-stop routing, web and iOS, partner API |

### Phase 1: Working Estimator (about 5 weeks)

**Goal:** a driver can get a usable cost estimate end to end, with no sign-up.

**Operational on release day:** open the app, choose a vehicle type and enter the fuel average (km/l) once; it is saved on the phone. Then enter pickup and drop-off and the load, and see distance, fuel litres, fuel cost, toll (entered manually) and the estimated total. Share the result as a WhatsApp message. Staff check and update fuel prices every morning in the admin panel.

**Scope**

- Flutter app with Urdu (default) and English, three screens: vehicle, route and load, result
- First-run vehicle setup: pick a vehicle type from pictures (motorcycle or rickshaw, car or taxi, pickup or van, truck) and type the km/l; goods vehicles can add km/l when fully loaded. Saved on the phone and editable in one tap
- Typical km/l range per vehicle type shown as a hint, with a warning if the entry looks wrong
- Load picker with pictures (empty, half, full) for goods vehicles
- Places Autocomplete and Routes API distance and time through a backend proxy with caching
- Calculation engine v1: fuel cost with load factor, manual toll field, round-trip toggle
- Fuel prices for petrol, diesel, CNG and LPG, entered by staff every morning with an effective date and shown to the driver with that date
- Share the result as text (WhatsApp); nothing is saved on the server
- Admin panel: fuel prices and vehicle type settings

**Architecture delivered:** modular monolith, PostgreSQL, Redis, staging and production environments, CI/CD, Sentry, backups.

**Not included:** accounts or login, driver data on the server, trip or quote history, saved routes, multiple vehicle profiles, fuel-cost tracking, automatic prices, toll table, voice, AI.

**Exit criteria:** results within about 10% of real fuel receipts on at least 30 field trips; crash-free sessions above 99%; result in under 3 seconds on 4G; 50 beta drivers across 2 to 3 cities.

### Phase 2: Reliable Pakistan Costing (about 4 weeks)

**Goal:** keep the estimate accurate despite Pakistan's changing fuel prices and tolls.

**Operational on release day:** everything from Phase 1, plus fuel prices checked and updated every day, motorway tolls calculated per vehicle class, and a clean result card the driver can share.

**Scope**

- **Fuel price ingestion worker:** runs every day (and on demand when staff trigger it), reads official notifications, cross-checks a second source, creates a draft price, and publishes after admin approval (or automatically when both sources agree). Shows a stale-price warning if no successful check has happened for 2 days. Admin can always override.
- **Toll engine:** PostGIS matching of the route against toll segments for the main motorways and highways, using NHA vehicle classes (car, jeep and taxi; wagon; coaster; bus; 2 and 3 axle truck; articulated truck). Rates are effective-dated. An M-Tag toggle with an admin-switchable surcharge rule handles policy changes. If no match is found, the app falls back to manual entry.
- **Engine v2:** empty return leg, city and highway split, rounding to the nearest Rs 10
- **Result card:** shareable image generated on the phone, showing distance, fuel price and date, tolls and total; it is not stored anywhere
- **Admin:** toll rate management with valid-from dates, approval queue, audit log

**Architecture added:** worker process and queue, PostGIS, rules configuration. The result screen shows the price date and toll rate used; nothing is stored per estimate.

**Exit criteria:** new official fuel price visible in the app within 2 hours of notification; toll amounts match official rates on at least 20 test routes; at least half of active users share a result card in their first week.

### Phase 3: Voice and Low-Literacy Experience (about 4 weeks)

**Goal:** a driver with minimal reading skill can complete an estimate alone.

**Operational on release day:** speak the destination and load, hear the estimate read aloud, pick a popular route from a built-in city list, and still see cached prices and vehicles on a weak connection.

**Scope**

- Urdu voice input for places and load (for example, two tons) and spoken results
- Picture-first vehicle and load selection, big number pad, simple wording, Roman Urdu fallback
- Drop-a-pin and popular-city shortcuts from a built-in list (not based on the driver's past trips)
- Offline mode: cached fuel prices and vehicle catalog; a new route estimate still needs a connection
- Push notifications for fuel price changes through FCM topics, so no device is stored on the server
- Short voice-guided onboarding; text support for Punjabi, Sindhi and Pashto, with voice added if quality allows

**Architecture added:** voice service with a vendor abstraction layer, FCM topics, local cache, remote config for strings.

**Exit criteria:** at least 80% of new users in a usability test with 15 target drivers finish their first estimate without help; voice place recognition meets a target (suggested 85%) on a recorded test set; cached prices and vehicles still load with no connection.

### Phase 4: AI Vehicle Identification (about 4 weeks)

**Goal:** fill in vehicle details and fuel average automatically so drivers type less.

**Operational on release day:** photograph the registration book or vehicle (or say the model), and the app fills in make, model, cc, fuel type and a suggested km/l from the catalog. The driver confirms or edits it, and it is saved on the phone like a manual entry.

**Scope**

- **Vehicle catalog:** about 100 popular Pakistani models (make, model, year range, cc, fuel type, typical km/l), built by staff and used only to match AI results
- **AI gateway:** one service that calls the LLM with vision, enforces a JSON schema, timeouts, retries, caching and cost caps
- **Vehicle identification:** extract make, model, year and cc, match to the catalog with a confidence score; on low confidence, ask the driver to choose from three pictures
- **Unknown vehicles:** the driver types km/l as in Phase 1; the app reports only the unmatched make and model text (no images, no user ID) so staff can add popular models to the catalog
- **Manual override:** the driver can always type or change km/l; the profile stays on the phone
- **Privacy:** images are processed in memory and discarded; no ID card data is stored

**Architecture added:** vehicle catalog table, AI gateway, feature flags, evaluation dataset.

**Exit criteria:** correct catalog match on at least 90% of a 200-photo test set; catalog km/l stays within 10% of real field measurements for the matched models.

### Phase 5: Optional Extensions (modules ship independently)

Each module is operational on its own and can be reordered by demand.

- **5A Multi-stop routes:** estimate fuel and tolls for several stops in one trip
- **5B Wider coverage:** more toll roads, more vehicle presets, regional fuel and CNG price differences
- **5C iOS and web:** Flutter iOS build and a simple web estimator
- **5D Partner API:** let load-board and ride apps request an estimate by API, with API keys and rate limits
- **5E Scale:** read replicas, autoscaling, and separate routing and AI services only when load requires it

**Deferred, not planned:** user accounts, trip or quote history, fuel-cost tracking, fleet management, subscriptions and payments. The architecture leaves room for an auth module, but nothing is built for it.

**Exit criteria per module:** defined with the business owner before development; each requires a measurable adoption target.

## 9. Cross-cutting requirements

- **Security:** TLS everywhere, rate limits per device and IP, API keys restricted by app and server, secrets in a secrets manager, encryption at rest, admin accounts with MFA and an audit trail.
- **Privacy:** no accounts, no stored trips and no driver data on the server. The vehicle profile (type and km/l) stays on the phone. Origins and destinations are used only to compute the estimate, and the route cache keeps rounded coordinates not linked to any person. Publish a privacy policy in Urdu and confirm obligations with local legal counsel.
- **Quality:** golden-case unit tests for the engine, API contract tests, testing on low-end Android devices, and field validation against real fuel receipts before every release.
- **Cost control:** Maps field masks, route cache, per-device daily quota, budget alerts, and no Routes call until inputs are complete.
- **Honesty in the UI:** results are estimates; always show the fuel price date.
- **Release management:** feature flags, staged rollout (5%, 25%, 100%), rollback plan, backward-compatible database migrations.

## 10. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Official fuel price source changes format or timing | Daily check, two-source check, admin override, stale-price warning |
| Toll rates or surcharge rules change or are disputed | Effective-dated rates, admin-switchable rules, manual toll fallback |
| Map and toll data weak in smaller towns | Own toll tables, drop-a-pin, popular-city list |
| Mileage estimates inaccurate | Driver supplies own km/l, show a range, tune default load penalties from field tests |
| Driver enters a wrong km/l | Typical range per vehicle type, warning outside it, one-tap edit |
| Phone data lost or app reinstalled | Setup takes under 30 seconds; no server backup without accounts |
| Low adoption among low-literacy users | Usability testing every phase, voice and picture-first design |
| Maps or AI costs grow with usage | Caching, per-device quotas, budget alerts, class-default fallbacks |
| Urdu voice accuracy too low | Test on real driver audio first; keep picture and number input as a fallback |

## 11. Recommended next step

Start Phase 1 with a two-week discovery sprint: interview 10 to 15 drivers, build the 40-vehicle preset list with verified mileage, and record 30 real trips (distance, litres, load) to serve as the accuracy baseline for every later phase.
