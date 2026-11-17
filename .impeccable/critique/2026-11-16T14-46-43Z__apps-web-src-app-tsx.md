---
target: apps/web
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\MIRZA DIGITAL\\Fuel-cost\\apps\\web\\src\\App.tsx"
target_fingerprint: "sha256:60d350ceaaadd80c6936b0a4201bc1ee4547368f6baf839e47e9624e9e2a00fb"
target_path: "D:\\MIRZA DIGITAL\\Fuel-cost\\apps\\web\\src\\App.tsx"
timestamp: 2026-11-16T14-46-43Z
slug: apps-web-src-app-tsx
---
# Critique — apps/web (Eendhan fuel-cost estimator)

Method: degraded single-context (no sub-agent/Task tool exposed). Reviewed at 390x844 and 1280x900, light + dark, EN + UR.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Stepper, skeletons, disabled-CTA reasons, price refresh states, inline validation |
| 2 | Match System / Real World | 3 | Local taxonomy and units, but passenger copy says "empty return" |
| 3 | User Control and Freedom | 3 | Back, Edit trip, swap, manual distance; no undo/recent trips |
| 4 | Consistency and Standards | 4 | Cohesive tokens, controls, spacing, RTL mirroring |
| 5 | Error Prevention | 3 | Validation + disabled CTA + range warnings; kmpl free-form beyond guards |
| 6 | Recognition Rather Than Recall | 3 | Everything labeled; 14 flat vehicle options force long scanning |
| 7 | Flexibility and Efficiency | 2 | Manual distance and keyboard radio-grid; no shortcuts/favorites/recents |
| 8 | Aesthetic and Minimalist Design | 3 | Strong hierarchy; price strip and repeated footer disclaimer add noise |
| 9 | Error Recovery | 2 | Network retry exists; estimate failures collapse to a generic dead-end |
| 10 | Help and Documentation | 2 | Good inline hints; no task help or FAQ |
| **Total** | | **29/40** | **Good (72.5%)** |

Cognitive load: 4 failed checks on step 1 (chunking, grouping, minimal choices, progressive disclosure) -> high cognitive load.

## Design Specificity Verdict

LLM: Genuinely authored for this product. Urdu-first RTL, Nastaliq wordmark, local vehicle taxonomy, per-litre price strip with staleness, load-penalty glyphs, tolls, WhatsApp share text. Result hero is the strongest authored moment.

Deterministic scan: `impeccable detect --json index.html src/App.tsx src/screens src/components` -> 0 findings (exit 0). Clean; no false positives. Detector does not cover layout order, cognitive load, copy semantics, or sticky-overlay collisions.

Visual overlays: no user-visible overlay; no presentable browser tab. Evidence from headless CDP screenshots and source. Contrast 4.63-9.35, passes AA.

## Overall Impression

Confident, locally specific utility with unusually good RTL craft and a shareable result. Biggest opportunity: step 1 is organized as a catalog, not a decision.

## What's Working

1. RTL is engineered, not flipped: fonts, mirrored icons, logical properties, currency placement, share text.
2. Result screen earns trust: one dominant number, estimate chip, leg-by-leg litres, price date, plain disclaimer.
3. Interaction guardrails: disabled CTAs explain themselves, inline validation, radiogroup keyboard support, persisted profile/locale.

## Priority Issues

### [P1] First step is a 14-tile wall and the required km/l field is buried below it
What: VehicleScreen.tsx:117-158 renders all 14 vehicle types flat; kmpl input at VehicleScreen.tsx:160-209 sits after the grid. After selecting Car, the next required input is ~4 screens down. Passenger/goods exist only as 12px meta.
Why: Users pick a vehicle then see more vehicles and a disabled Save; they must discover that scrolling past 12 tiles reveals the rest of the task. Main abandonment risk.
Fix: Group Passenger/Goods with headers; show selected-vehicle summary with kmpl directly beneath, then collapse remaining grid or use choose->confirm. Keep tile meta on one line.
Command: /impeccable layout (then /impeccable typeset)

### [P1] Open place picker is covered by the sticky Calculate bar
What: PlacePicker.tsx:86-123 inline list; .cta-bar fixed to viewport bottom (styles.css:1077-1086). Last result is clipped; more rows hidden behind CTA.
Why: User cannot tell whether the list ended or more results exist; interruption risk.
Fix: Hide/collapse CTA while a picker is open, or use a bottom sheet above the CTA with its own scroll and safe-area padding; list bottom padding >= CTA height.
Command: /impeccable adapt

### [P2] Stale fuel price is color-only
What: PriceStrip.tsx:40 marks stale prices with .is-stale, amber only (styles.css:314-316). No label/icon/legend.
Why: Staleness must not be under-communicated in a cost estimator; fails color-blind users and anyone who does not know the code.
Fix: Text/icon badge plus effective date next to the value; survive grayscale.
Command: /impeccable clarify + /impeccable audit

### [P2] Passenger round-trip copy uses goods language
What: RouteScreen.tsx:296 reuses route.roundTripHint for passengers; English string is "Includes the empty return to your starting point" (i18n.ts:163).
Why: Deadhead trucking language confuses car owners.
Fix: Split copy: passenger "Includes the journey back to your start"; goods keeps "Return empty".
Command: /impeccable clarify

### [P2] Estimate failures are generic and dead-ended
What: RouteScreen.tsx:151 maps non-network failures to "Sorry, something went wrong"; no cause, retry, or guidance.
Why: Likely causes (bad distance, stale prices) are user-fixable, but the message gives nothing to act on.
Fix: Name the likely cause and next step with inline retry; keep entered values.
Command: /impeccable harden + /impeccable clarify

## Persona Red Flags

Jordan (First-Timer): picks Car, scrolls through 11 more vehicles to find kmpl; no passenger/goods headers; "empty return" reads as a warning; no help. Abandons at step 1.

Casey (Distracted Mobile): picker results run under sticky CTA; last row clipped; long thumb scroll before Save is meaningful. Positives: 60px CTAs, numeric keypads, persisted profile/locale, thumb-zone bar.

Sam (Accessibility-Dependent): contrast passes, controls >=44px, labels/radiogroup solid. Stale price color-only; picker announces no result count; programmatic heading focus shows a 3px ring for keyboard users.

## Minor Observations

- H1 focus ring is keyboard/programmatic only; style heading focus discreetly.
- Price strip repeats on Vehicle and Trip and consumes first-viewport space.
- Footer disclaimer duplicates result honesty.
- Desktop stays a 560px phone column; result could widen to 720-800px.
- Number precision drifts: 330 in strip vs 330.00 Rs per litre in result.
- English vehicle meta wraps the range; use 10-20 km/l with nowrap.
- aria-describedby on kmpl omits the outside-range hint.
- No history/recent trips.

## Questions to Consider

- What if selecting a vehicle immediately revealed only its km/l field and collapsed the other 13?
- Does the first screen need the entire vehicle catalog before knowing whether the user moves people or goods?
- What would the trip screen look like if distance were the single required input and places were optional?
- Should the result peak be sharing, or comparing this trip to last time?
