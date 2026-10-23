# Furrow — Product Requirements Document

**Status:** v0.3, in build · **Last updated:** 2026-10-21 · **Name:** Furrow (working name)

---

## 1. Summary

Furrow is a mobile app that tells farm managers **which plots need water, how much, and why**. It combines soil-moisture readings, weather forecasts and the FAO-56 crop water model. The output is a concrete instruction such as *"Irrigate tonight at 21:00 · 4 h 20 min · 38.9 m³"*, and the reasoning behind it is one tap away.

This is an open-source demo project: a production-quality slice of a real product (React Native app + backend), scoped to about five days of work. Soil sensors are simulated. The API, database, weather integration and offline sync are real.

## 2. Problem

- Many farms run irrigation on habit or a fixed schedule ("every plot, every evening"). When the weather or crop stage changes, that either wastes water or stresses the crop.
- Agriculture uses roughly 70% of global freshwater withdrawals (FAO AQUASTAT). In hot, arid regions such as the UAE, water is the main constraint on farming.
- Sensor dashboards show raw numbers ("soil moisture 20.5%"). They don't answer the manager's real question: *"Do I irrigate tonight, and for how long?"*
- Field teams often have weak signal. If a tool needs a connection to record work, people skip it, and the records end up incomplete.

## 3. Goals and non-goals

### Goals

| ID | Goal | Measured by |
|---|---|---|
| G1 | **Glanceable:** see which plots need attention without tapping | Test users find the plots that need water in < 5 s |
| G2 | **Explainable:** every recommendation shows its inputs and math | 100% of recommendations have a "Why?" breakdown |
| G3 | **Field-ready:** logging works with no signal | The offline test in §9 passes |
| G4 | **Production quality in a small scope** | All P0 requirements ship and the §9 criteria are met |

### Non-goals (v1)

- Real sensor hardware or gateways. Readings are simulated (Appendix A.4).
- Controlling valves or pumps. Furrow recommends; people act.
- Accounts, roles or multiple farms. There is one demo farm and no login.
- Greenhouse or hydroponic crops. Outdoor ET₀ does not apply indoors.
- Salinity management and leaching requirements. These matter with brackish groundwater but are out of scope.
- Fertigation (EC/pH), yield forecasting, satellite imagery.

## 4. Users

**Primary: farm manager.** Oversees 5–20 plots and checks the app in the morning and before evening irrigation. They need to decide quickly and trust the recommendation enough to act on it.

**Secondary: field technician.** Runs irrigation, applies fertilizer and scouts for pests. They work outdoors in bright sun, sometimes with gloves and often with weak signal, and need to record work in seconds.

Both use the same app in v1.

### Key user stories

1. As a farm manager, when I open the app I see which plots need water, sorted by urgency.
2. As a farm manager, I see how much to irrigate a plot, for how long and why, so I can trust or override the recommendation.
3. As a farm manager, I see how soil moisture changed over the past week and how it responded to irrigation.
4. As a field technician, I can log an irrigation, a fertilizer application or a pest sighting in under 30 seconds, even with no signal.
5. As a farm manager, I see the coming week's weather and crop water demand.

## 5. Requirements

**P0** = required for the demo · **P1** = only after all P0 items are done · **P2** = later

### 5.1 Farm overview (home)

| ID | Requirement | Pri |
|---|---|---|
| OV-1 | Header with the farm name and today's weather (max temperature, rain chance, ET₀), plus Open-Meteo attribution | P0 |
| OV-2 | Summary: how many plots need attention, and water used today vs. planned (m³) | P0 |
| OV-3 | Plot card: crop mascot showing the status mood, name, crop and growth stage, status label, current moisture %, a water meter against the happy zone, next action (e.g. "Tonight 21:00 · 4 h 20 min") | P0 |
| OV-4 | Plots sorted by action urgency: Irrigate now → Sensor offline → Pause (overwatered) → Irrigate tonight → Skip (rain) → No action | P0 |
| OV-5 | Pull to refresh, with an "Updated 2 min ago" label | P0 |
| OV-6 | Offline banner showing the age of the cached data | P0 |
| OV-7 | Designed loading (skeleton), error (with retry) and empty states | P0 |

### 5.2 Plot detail

| ID | Requirement | Pri |
|---|---|---|
| PD-1 | Header: plot name, crop, growth stage with day count, soil type, area, irrigation method | P0 |
| PD-2 | Current moisture as a large number, shown against the target band (refill point → field capacity) | P0 |
| PD-3 | Moisture chart with a 24 h / 7 d toggle, the target band shaded, and markers for irrigation and rain | P0 |
| PD-4 | Scrubbing: dragging shows the value and time under the finger at 60 fps (UI thread), with a haptic tick when crossing an irrigation marker or the refill line | P0 |
| PD-5 | Recommendation card: action, start time, duration and volume. The primary button "Log irrigation" opens a prefilled log | P0 |
| PD-6 | "Why?" expands into the inputs and math (Appendix A) in plain language | P0 |
| PD-7 | 7-day forecast: max/min temperature, rain amount and chance, ET₀, plus Open-Meteo attribution | P0 |
| PD-8 | The plot's last 5 activities | P1 |
| PD-9 | 14-day chart range | P2 |

### 5.3 Log activity

| ID | Requirement | Pri |
|---|---|---|
| LG-1 | A bottom sheet reachable from every screen; the plot is preselected when opened from a plot | P0 |
| LG-2 | Types: **Irrigation** (duration; volume computed from the plot's flow rate), **Fertilizer** (product, amount, unit), **Pest/disease** (name, severity), **Note** | P0 |
| LG-3 | Time defaults to now and can be moved into the past, but not the future | P0 |
| LG-4 | Works offline: a new entry appears immediately as "Waiting to sync", syncs automatically on reconnect or app launch, and survives the app being killed | P0 |
| LG-5 | Idempotent writes: each entry carries a client-generated UUID, so retries never create duplicates | P0 |
| LG-6 | A logged irrigation updates the simulated soil moisture right away; when online, the chart shows the change within seconds | P0 |
| LG-7 | Touch targets ≥ 48 dp; steppers and chips instead of free typing where possible | P0 |
| LG-8 | Photo for pest reports (camera or gallery), compressed and uploaded when online | P1 |

### 5.4 Other

| ID | Requirement | Pri |
|---|---|---|
| AC-1 | Activity tab: history of all entries, filterable by plot and type, with each entry's sync state | P1 |
| NT-1 | Push notifications: an 18:00 digest ("2 plots need irrigation tonight"), plus an alert when a plot becomes Needs water, Overwatered or Sensor offline (once per change) | P1 |
| ST-1 | About screen: data sources and licenses, model assumptions, app version | P1 |
| OP-1 | Daily demo reset at 05:30 farm time, just after the irrigation window closes, so the daytime scenarios hold: wipe and re-seed the demo data | P1 |
| ST-2 | Dark theme | P2 |
| ST-3 | Arabic with RTL layout | P2 |

## 6. Irrigation logic

Furrow uses the FAO-56 single crop coefficient method and a root-zone water balance. Formulas, assumptions and test cases are in Appendix A. In short:

1. **Crop water use:** ETc = Kc × ET₀. ET₀ comes from the hourly forecast. Kc depends on the crop and the days since planting.
2. **Soil water budget:** total available water (TAW) depends on soil type and root depth. The crop starts to stress once depletion passes RAW = p × TAW.
3. **Depletion:** current depletion comes from the latest sensor reading. It is projected forward to tonight's irrigation window, and 24 h beyond it.
4. **Decision:**
   - Stressed now, or will be before tonight → irrigate now.
   - Would be stressed within 24 h after tonight's start → irrigate tonight, or skip if enough rain is forecast.
   - Otherwise → show when the next irrigation is expected.
5. **Amount:** refill the root zone to field capacity at the planned start time, divide by system efficiency, and convert to minutes using the plot's flow rate.

**Status** (the current soil state) and **action** (the recommendation) are separate concepts:

| Status | Rule |
|---|---|
| Sensor offline | No reading for more than 2 h (no recommendation is shown) |
| Overwatered | θ > θFC + 0.02 |
| Needs water | Dr ≥ RAW (θ below the refill point) |
| Optimal | Otherwise |

## 7. Design direction

The look is fun and cheerful. Farm managers open the app several times a day, and a friendly interface makes that routine lighter. The playful layer sits on top of the data and never replaces it: every mood has a number and a plain-language reason behind it.

### Principles

1. **Status first, detail on demand.** The overview answers "what needs me?" without a tap. Numbers are large and labels are short.
2. **Explain every recommendation.** The inputs and math are one tap away, in plain language.
3. **Built for the field.**
   - A light, high-contrast theme that stays readable in direct sun.
   - Touch targets ≥ 48 dp.
   - Primary actions within thumb reach.
   - Works offline.
4. **Friendly, not childish.**
   - A warm cream background with white "sticker" cards that have a chunky bottom edge.
   - Rounded type: Fredoka for headings and numbers, Nunito for body text.
   - A bright palette (leaf, tomato, sky, sun, grape), with darker text tones that pass WCAG AA on their tints.
   - Each crop has a mascot (tomato, cucumber, lettuce, date palm) drawn with Skia. Its mood mirrors the plot's status.
   - One icon set (Phosphor) and no emoji as icons.
5. **Honest states.** Loading, empty, error, stale data, offline and waiting to sync each have a designed state, often with a mascot.
6. **Motion that rewards.** Mascots breathe and blink, buttons press down, and charts draw in. Logging a watering ends with falling drops and confetti. All motion respects the system Reduce Motion setting.

### Signature interactions

- **The moisture chart.** You drag a finger across seven days of data and the value follows it. There is a haptic tick at each watering and at each crossing of the refill line.
- **Mood changes.** Logging a watering turns a thirsty mascot happy right away, and the farm overview re-sorts.

### Status language

| Status | Label | Mascot mood | Color |
|---|---|---|---|
| Optimal | Happy | Smiling and blinking | Leaf |
| Needs water | Thirsty | Frowning, with a sweat drop | Tomato |
| Overwatered | Too much water | Soggy, dripping into a puddle | Sky |
| Sensor offline | Sensor asleep | Sleeping, with floating z's | Grape |

Status is never shown by color alone. The label and the mascot's face carry it too, and screen readers hear the formal name (for example "needs water").

### Copy

English, sentence case, short and friendly: "Water now", "Water tonight at 21:00", "Hold the water", "Field 4 is drinking!". Units are always shown (%, mm, m³, min). Times are in farm local time.

## 8. Technical approach

### Architecture

```
┌──────────────── Mobile app (Expo / React Native) ────────────────┐
│ Expo Router · TanStack Query (persisted cache + offline outbox)  │
│ Skia + Reanimated chart · AsyncStorage · NetInfo · expo-haptics  │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS / JSON (zod contracts in packages/shared)
┌───────────────────────────────▼──────────────────────────────────┐
│ API (Hono on Node.js)                                            │
│ REST /v1 · validation · rate limiting                            │
│ Recommendation engine (packages/shared/irrigation)               │
│ Jobs: weather refresh (hourly) · sensor simulator (15 min,       │
│       catch-up) · nightly demo reset                             │
└──────────────┬───────────────────────────────────┬───────────────┘
               │                                   │
   PostgreSQL (Neon) / PGlite locally      Open-Meteo forecast API
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| App | Expo (React Native), Expo Router, TypeScript | The recommended way to start React Native apps; file-based routing; EAS builds |
| Data and offline | TanStack Query persisted to AsyncStorage, plus NetInfo | Cache-first reads; paused, persisted mutations act as an outbox. AsyncStorage ships in Expo Go (MMKV needs a custom build) |
| Chart and motion | @shopify/react-native-skia, Reanimated, Gesture Handler, expo-haptics | A custom chart drawn on the UI thread for smooth scrubbing |
| Forms | Shared zod schemas from `packages/shared` | The same schemas validate on client and server; the forms are small enough not to need a form library |
| API | Hono on Node.js (LTS) | Small and typed; easy to test with `app.request()` |
| Database | PostgreSQL in production (`DATABASE_URL`, e.g. Neon); embedded PGlite for local development and tests; Drizzle ORM and migrations | Clone-and-run with no database setup, and the same SQL and migrations everywhere |
| Jobs | In-process scheduler | Enough for a single instance |
| Weather | Open-Meteo forecast API | Free, no API key, provides FAO-56 ET₀ |
| Hosting | An always-on small instance for the API (e.g. Fly.io or Railway); Neon for the database | Free tiers that sleep cause cold starts and stop scheduled jobs |
| Builds | EAS Build (Android APK) | Installable without the Play Store |
| Tooling | npm workspaces, Vitest, ESLint (typescript-eslint, react-hooks incl. React Compiler rules), Prettier, GitHub Actions | |

### Repository layout

```
.
├── apps/
│   ├── mobile/      # Expo app
│   └── api/         # Hono API, jobs, seed script
├── packages/
│   └── shared/      # zod schemas, types, irrigation model (pure functions, unit-tested)
├── PRD.md
└── .github/workflows/
```

### Key decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Expo instead of bare React Native | Faster setup; native folders are generated, which makes upgrades easier; EAS for builds | Custom native code has to go through config plugins or Expo modules |
| Only Expo Go–compatible native modules | Anyone can open the app with Expo Go, with no custom build | No MMKV; AsyncStorage is slower but plenty for this cache |
| PGlite for local development and tests | `npm install && npm run dev:api` just works; tests use an in-memory database | Production must set `DATABASE_URL` to a real Postgres |
| Irrigation model in `packages/shared` | Pure, unit-tested functions kept separate from I/O; could later run on the device offline | The shared package adds workspace setup |
| Recommendations computed on read | Always consistent with the latest reading and forecast | Recomputed on every request, which is cheap at this scale |
| Simulator catches up from the last reading to now | Survives restarts and missed ticks; idempotent | Long gaps take a moment to fill (capped at 14 days) |
| In-process scheduler | Simple for one instance | A production system would use a queue and a worker |
| Weather cached hourly per farm | Stays far below Open-Meteo's free limits and survives outages | The forecast can be up to an hour old |

### Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Overview content visible < 2.5 s after a cold start on a mid-range Android phone (with the API warm); chart scrubbing at 60 fps; API p95 < 300 ms for GET endpoints |
| Offline | The last cached data is shown with its age; queued writes survive an app kill and sync exactly once |
| Accessibility | WCAG AA text contrast (4.5:1); touch targets ≥ 48 dp; font scaling to 130% without clipping; screen-reader labels, including a chart summary ("Moisture 20.5%, falling, refill point 19.4%"); Reduce Motion respected |
| Security | No secrets in the app bundle; zod validation on every input; rate limits on writes; upload size and type limits (P1); no personal data collected |
| Code quality | TypeScript strict everywhere; ESLint and Prettier; CI runs typecheck, lint and tests on every push |
| Testing | Unit tests for the irrigation model (Appendix A.5); API integration tests for every endpoint, including the idempotent POST and the demo scenarios; mobile verified with typecheck, lint (incl. React Compiler rules) and the manual offline test |
| Observability | Structured JSON logs with request IDs; error tracking (e.g. Sentry) is P2 |
| Data license | Open-Meteo attribution next to every place weather data appears (CC BY 4.0); the free API is for non-commercial use only |

## 9. Success criteria

1. All P0 requirements work end-to-end on a physical Android phone against the deployed API.
2. The irrigation model tests pass, including FAO-56 Example 37 and the worked examples in Appendix A.
3. **Offline test:** in airplane mode, log 10 entries, force-quit, relaunch and reconnect. Exactly 10 entries reach the server, with no duplicates.
4. Chart scrubbing drops no frames in the performance monitor on a mid-range Android phone.
5. **Hallway test** with 3 people: each person finds the plots that need water in < 5 s and logs an irrigation in < 30 s without help.
6. Shipped:
   - An Android APK
   - A demo video of about 90 seconds
   - A public repo with a README covering setup, architecture, decisions and next steps
   - A live API

## 10. Demo script (about 90 seconds)

| Time | Action |
|---|---|
| 0–12 s | The overview shows 5 plots sorted by urgency, each with its mascot: Field 4 *Thirsty*, Block B *Sensor asleep*, Field 5 *Too much water*. |
| 12–19 s | Open Field 4: a thirsty cucumber and seven days of soil moisture against the happy zone. |
| 19–34 s | The plan reads *Water now · 6 h 35 min*. Expand "Why?" to show the calculation. |
| 34–44 s | Tap *Log watering*: the form is prefilled. Save, and drops and confetti fall on a cheering cucumber. |
| 44–56 s | Field 4 is happy again, and the overview drops to "2 plots need you today". |
| 56–78 s | The server goes away: an offline banner appears, and a note is saved on the phone as *Waiting to sync*. |
| 78–91 s | The server comes back and the note syncs on its own. |

## 11. Milestones

| Day | Work | Exit criteria |
|---|---|---|
| 1 | Monorepo and CI; database schema, migrations and seed; irrigation model with tests; design tokens and designs for the three screens | Appendix A.5 tests pass; design decisions are made |
| 2 | Open-Meteo client and cache; simulator with catch-up and 14-day backfill; API endpoints; deploy; overview screen on live data | A development build on a phone shows the live overview from the deployed API |
| 3 | Plot detail: Skia chart with scrubbing and haptics; recommendation card with "Why?"; forecast | Smooth scrubbing on a mid-range Android phone |
| 4 | Log sheet; offline outbox with idempotent sync; offline banner; immediate simulator update after an irrigation is logged | The offline test (§9) passes |
| 5 | Accessibility pass; empty, error and stale states; README with architecture diagram; APK; demo video | All success criteria in §9 are met |

P1 items start only when every P0 item is done.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep | The demo ships late | Strict P0 list; day 5 is ship day regardless |
| The custom Skia chart takes longer than planned | Day 3 slips | Time-box it to one day; fall back to victory-native |
| Hosting sleeps or cold-starts | Visitors see spinners or stale data | Always-on instance; simulator catch-up; skeleton states |
| Open-Meteo is unavailable | No fresh forecast | Serve the last cached snapshot, labeled "Forecast as of …" |
| A recommendation looks wrong to an agronomist | Loss of credibility | Standard FAO-56 method; documented assumptions; "Why?" shows every input; tests against FAO examples |
| Someone wants to try it on an iPhone | They can't install the APK | The demo video in the README, or running it in Expo Go from a local checkout (decided: no TestFlight) |
| The UI looks generic | Undercuts the main goal | A design pass on day 1, before any components are built |

## 13. Open questions

1. **Name:** "Furrow" is a working name.
2. **First P1 item, if time allows:** push notifications or pest photos? (Activity history and the daily reset are already built.)

**Resolved**

- **Backend stack:** TypeScript with Hono.
- **iOS distribution:** no TestFlight. iPhone users can watch the demo video or run the app in Expo Go from a local checkout.
- **Palette and typeface:** the first take (a sand palette with IBM Plex) felt too serious, so it was replaced with the fun, cheerful direction in §7: cream background, sticker cards, Fredoka and Nunito, and crop mascots.
- **Demo location:** Al Ain, UAE.

---

## Appendix A — Irrigation model

### A.1 Inputs

| Symbol | Meaning | Unit | Source |
|---|---|---|---|
| θ | Current volumetric water content | m³/m³ | Latest sensor reading |
| θFC, θWP | Field capacity, wilting point | m³/m³ | Soil type (within FAO-56 Table 19 ranges) |
| Zr | Effective root depth | m | Crop: lower end of the FAO-56 Table 22 range, which FAO-56 suggests for irrigation scheduling |
| p_table | Depletion fraction without stress at ETc ≈ 5 mm/day | – | Crop (FAO-56 Table 22) |
| Kc | Crop coefficient for the current growth stage | – | Crop curve (FAO-56 Tables 11 and 12) |
| ET₀(h) | Hourly reference evapotranspiration | mm | Open-Meteo hourly `et0_fao_evapotranspiration` |
| P(h), prob(h) | Hourly precipitation and its probability | mm, % | Open-Meteo hourly `precipitation`, `precipitation_probability` |
| Window | The farm's irrigation window (default 21:00–05:00) | local time | Farm settings |
| Ea | Application efficiency | – | The plot's irrigation method |
| A | Plot area | m² | Plot |
| Q | System flow rate | L/h | Plot |

**Start time S:** if the current time is inside the irrigation window, S = now. Otherwise S is the next window start (e.g. today at 21:00).

### A.2 Calculation

#### Steps

1. **Kc from the crop curve** (FAO-56 Ch. 6). With d = days since planting and stage lengths L_ini, L_dev, L_mid and L_late:
   - initial stage → Kc_ini
   - development → linear from Kc_ini to Kc_mid
   - mid-season → Kc_mid
   - late season → linear from Kc_mid to Kc_end
   - after the season → Kc_end, and the plot is flagged "season complete"
   - perennials (date palms) → constant Kc
2. **ETc(a→b)** = Kc × Σ ET₀(h) over the hours from a to b.
3. **Pe(a→b)** = Σ P(h) over the hours where prob(h) ≥ 50%. It counts only if the total is ≥ 0.2 × Σ ET₀(h) for the same hours; runoff is assumed to be 0.
4. **p** = clamp(p_table + 0.04 × (5 − ETc(S→S+24h)), 0.1, 0.8) (FAO-56 Ch. 8)
5. **TAW** = 1000 × (θFC − θWP) × Zr (Eq. 82)
6. **RAW** = p × TAW (Eq. 83)
7. **Dr** = clamp(1000 × (θFC − θ) × Zr, 0, TAW) (Eqs. 86–87)
8. **Refill point** θ_refill = θFC − RAW / (1000 × Zr). The app shows the target band from θ_refill to θFC.
9. **Depletion at the start time:** Dr(S) = clamp(Dr + ETc(now→S) − Pe(now→S), 0, TAW)
10. **Depletion 24 h after the start:**
    - Dr(S+24h) = Dr(S) + ETc(S→S+24h) − Pe(S→S+24h)
    - Dr_dry(S+24h) is the same value without rain.

#### Decision

The first matching row wins.

| # | Condition | Action |
|---|---|---|
| 1 | No reading for > 2 h | `SENSOR_OFFLINE`: show the last known values and no recommendation |
| 2 | θ > θFC + 0.02 | `PAUSE`: "Soil is above field capacity" |
| 3 | Dr ≥ RAW | `IRRIGATE_NOW` |
| 4 | Dr(S) ≥ RAW | `IRRIGATE_NOW`: "Will pass the stress threshold at ~HH:MM, before tonight's window" (found by stepping hour by hour) |
| 5 | Dr(S+24h) ≥ RAW | `IRRIGATE_TONIGHT`: start at S |
| 6 | Dr_dry(S+24h) ≥ RAW | `SKIP_RAIN`: "Rain expected" |
| 7 | Otherwise | `NO_ACTION`: "Next irrigation in ~N days", found by stepping day by day through the forecast until projected depletion ≥ RAW ("> 7 days" if it never does) |

#### Amount

Applies to `IRRIGATE_NOW` and `IRRIGATE_TONIGHT`.

- **Net depth** In = Dr for `IRRIGATE_NOW`, or Dr(S) for `IRRIGATE_TONIGHT`. This refills to field capacity; FAO-56 requires In ≤ depletion.
- **Gross depth** Ig = In / Ea
- **Volume** V = Ig × A (1 mm over 1 m² = 1 L)
- **Duration** t = V / Q × 60 min, rounded to the nearest 5 min

### A.3 Worked example

Field 3: tomato at mid-season, sandy loam, drip irrigation. It is 21:00, the start of the irrigation window, so S = now.

| Input | Value |
|---|---|
| θFC / θWP | 0.23 / 0.10 |
| Zr | 0.70 m |
| p_table | 0.40 |
| Kc (mid) | 1.15 |
| θ | 0.205 |
| Σ ET₀, next 24 h | 7.1 mm |
| Rain | 0 mm |
| Ea | 0.90 |
| A | 2,000 m² |
| Q | 9,000 L/h |

| Step | Result |
|---|---|
| ETc(S→S+24h) = 1.15 × 7.1 | 8.165 mm |
| p = 0.40 + 0.04 × (5 − 8.165) | 0.2734 |
| TAW = 1000 × 0.13 × 0.70 | 91.0 mm |
| RAW = 0.2734 × 91.0 | 24.88 mm |
| Dr = 1000 × (0.23 − 0.205) × 0.70 | 17.5 mm (= Dr(S), since S = now) |
| θ_refill = 0.23 − 24.88 / 700 | 0.1945 (19.4%) |
| Status | Optimal (0.205 ≥ 0.1945) |
| Dr(S+24h) = 17.5 + 8.165 | 25.67 mm ≥ RAW → `IRRIGATE_TONIGHT` |
| Ig = 17.5 / 0.90 | 19.44 mm |
| V = 19.44 × 2,000 | 38,889 L (38.9 m³) |
| t = 38,889 / 9,000 × 60 = 259.3 | **260 min (4 h 20 min)** |

UI copy:

> **Irrigate tonight at 21:00 · 4 h 20 min · 38.9 m³**
> Why: soil is at 20.5%, just above the 19.4% refill point. In the next 24 hours the crop will use about 8.2 mm (ET₀ 7.1 mm × Kc 1.15). That would take depletion to 25.7 mm, past the 24.9 mm stress threshold. Refilling 17.5 mm (19.4 mm gross at 90% drip efficiency) brings the root zone back to field capacity.

### A.4 Sensor simulator

The simulator runs in 15-minute steps, from each plot's last simulated time up to now. Restarts and missed ticks therefore catch up automatically (capped at 14 days). Readings are upserted on (plot_id, recorded_at), so re-running a step is harmless.

Each step (Δt = 0.25 h):

1. ET₀_step = hourly `et0_fao_evapotranspiration` × 0.25
2. Water stress: Ks = 1 if Dr ≤ RAW; otherwise Ks = (TAW − Dr) / ((1 − p) × TAW) (FAO-56 Eq. 84)
3. θ ← θ − Ks × Kc × ET₀_step / (1000 × Zr)
4. Rain: θ ← θ + hourly `precipitation` × 0.25 / (1000 × Zr). All observed rain counts as effective.
5. Irrigation logged since the last step: θ ← θ + (V × Ea / A) / (1000 × Zr).
   - Logged irrigations are treated as completed and applied at the next step, whatever their `occurred_at` (history is not rewritten).
   - The API runs a catch-up immediately after an irrigation is logged. Its last step ends exactly at "now", or is zero-length if the plot is already there, so the water shows up at once. Readings are upserted, so that step's value replaces the earlier one.
6. Drainage above field capacity: θ ← θFC + (θ − θFC) × (1 − k_drain)^Δt. The default k_drain is 0.10 per hour.
7. Reported reading = θ + noise (σ = 0.001). The noise comes from a random generator seeded by plot and timestamp, so results are reproducible. σ is kept small enough that the demo scenarios are never flipped by noise alone.

Ks keeps θ from falling below θWP, because Dr never exceeds TAW. Plots in the "offline" scenario are paused and produce no readings.

### A.5 Test cases

| Function | Input | Expected |
|---|---|---|
| `taw` | θFC 0.32, θWP 0.12, Zr 0.8 | 160 mm (FAO-56 Example 37) |
| `raw` | TAW 160, p 0.40 | 64 mm (FAO-56 Example 37) |
| `ks` | TAW 160, p 0.40, Dr 67.0 | ≈ 0.97 (FAO-56 Example 37) |
| `ks` | TAW 160, p 0.40, Dr 100.8 | ≈ 0.62 (FAO-56 Example 37) |
| `adjustP` | p 0.30, ETc 12 | 0.10 (clamped from 0.02) |
| `adjustP` | p 0.70, ETc 0 | 0.80 (clamped from 0.90) |
| `kc` (tomato 35/45/70/30 days; Kc 0.60/1.15/0.80) | day 20 / 62 / 100 / 165 / 200 | 0.60 / 0.93 / 1.15 / 0.975 / 0.80 + season complete |
| `effectiveRain` | Σ ET₀ 7.1; rain 1.0 mm at 80% / 6.0 mm at 80% / 6.0 mm at 30% | 0 / 6.0 / 0 |
| `recommend` | Worked example (A.3), 21:00 | `IRRIGATE_TONIGHT`, net 17.5 mm, 38,889 L, 260 min |
| `recommend` | A.3 inputs at 12:00 with Σ ET₀(12:00→21:00) = 4.0 mm | Dr(S) 22.1 mm → `IRRIGATE_TONIGHT`, net 22.1 mm, 49,111 L, 325 min |
| `recommend` | Same as above with θ = 0.195 | Dr 24.5 < RAW, Dr(S) 29.1 ≥ RAW → `IRRIGATE_NOW`, net 24.5 mm, 54,444 L, 365 min |

Unrounded values are compared with a tolerance of ±0.01.

### A.6 Assumptions

| Assumption | Value | Note |
|---|---|---|
| When rain counts | prob ≥ 50% and total ≥ 0.2 × ET₀ | FAO-56 notes that rain below about 0.2 × ET₀ can usually be ignored; the probability threshold is a product choice |
| Overwatered tolerance | θFC + 0.02 | Allows for sensor noise right after irrigation |
| Sensor offline | > 2 h without a reading | 8 missed readings at 15-minute intervals |
| Application efficiency | Drip 0.90, bubbler 0.85, sprinkler 0.75 | Typical values, configurable per plot |
| Irrigation window | 21:00–05:00 | Less evaporation at night; configurable per farm |
| Kc climate adjustment | Not applied | FAO-56 Table 12 assumes RHmin ≈ 45% and wind ≈ 2 m/s. FAO-56 also gives an adjustment for drier, windier climates, which is a v2 candidate |
| Drainage | 10% of the excess per hour | Simplified; slower for compacted soil |

## Appendix B — Data model (PostgreSQL)

| Table | Key columns |
|---|---|
| `farms` | `id`, `name`, `latitude`, `longitude`, `timezone`, `irrigation_window_start` (21:00), `irrigation_window_end` (05:00) |
| `crops` | `id` (slug), `name`, `kc_ini`, `kc_mid`, `kc_end`, `p_table`, `root_depth_m`, `stage_days` (ini/dev/mid/late), `perennial` |
| `soils` | `id` (slug), `name`, `field_capacity`, `wilting_point`, `drainage_per_hour` |
| `plots` | `id`, `farm_id`, `name`, `crop_id`, `soil_id`, `planted_on` (null for perennials), `area_m2`, `root_depth_m` (override), `irrigation_method`, `efficiency`, `flow_rate_lph`, `drainage_per_hour` (override), `sort_order` |
| `sensor_readings` | PK (`plot_id`, `recorded_at`), `vwc` |
| `plot_sim_state` | `plot_id` (PK), `theta`, `as_of`, `paused_at` |
| `activities` | `id` (client UUID, PK), `plot_id`, `type` (irrigation, fertilizer, pest, note), `occurred_at`, `details` (jsonb, validated per type), `photo_key`, `created_at`; index on (`plot_id`, `occurred_at` desc) |
| `weather_snapshots` | PK (`farm_id`, `fetched_at`), `data` (jsonb); keep only the latest few |
| `push_tokens` (P1) | `token` (PK), `platform`, `created_at` |

Activity `details` by type:

| Type | Fields |
|---|---|
| irrigation | `durationMin` (1–1440), `volumeL` (optional; computed from the flow rate if missing) |
| fertilizer | `product`, `amount`, `unit` (kg or L) |
| pest | `name`, `severity` (low, medium, high) |
| note | `text` (≤ 1000 characters) |

Every type also accepts an optional `note`.

## Appendix C — API

The base path is `/v1` and everything is JSON.

Units:
- Moisture is a fraction (0–1).
- Depths are in mm, volumes in liters and durations in minutes.
- Timestamps are ISO 8601 with offset.

The app handles display formatting.

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/farm` | Farm, today's weather and a summary (plots needing attention, water used vs. planned) |
| GET | `/v1/plots` | Plot list: status, latest reading, 24 h sparkline (hourly points), recommendation summary |
| GET | `/v1/plots/:id` | Plot detail with the full recommendation and its inputs |
| GET | `/v1/plots/:id/readings?range=24h` (or `7d`) | Time series (24 h: 15-minute points; 7 d: hourly) plus irrigation and rain events |
| GET | `/v1/forecast` | 7-day daily forecast for the farm |
| GET | `/v1/activities?plotId=&type=&cursor=&limit=` | Activity history, cursor-paginated |
| POST | `/v1/activities` | Create an activity; idempotent on `id` (201 if created, 200 if it already exists) |
| POST | `/v1/uploads` (P1) | Presigned upload URL for a pest photo |
| POST | `/v1/push-tokens` (P1) | Register a device for notifications |
| GET | `/health` | Liveness and database check |

Rate limits per IP: 120 requests/min for GET and 30/min for POST.

Error format:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "durationMin must be between 1 and 1440", "details": [] } }
```

Example response from `GET /v1/plots/:id`, using the worked example:

```json
{
  "status": "OPTIMAL",
  "recommendation": {
    "action": "IRRIGATE_TONIGHT",
    "startAt": "2026-10-21T21:00:00+04:00",
    "netDepthMm": 17.5,
    "grossDepthMm": 19.44,
    "volumeL": 38889,
    "durationMin": 260,
    "inputs": {
      "vwc": 0.205,
      "fieldCapacity": 0.23,
      "wiltingPoint": 0.1,
      "rootDepthM": 0.7,
      "growthStage": "mid",
      "kc": 1.15,
      "et0Next24hMm": 7.1,
      "etcNext24hMm": 8.165,
      "p": 0.2734,
      "tawMm": 91.0,
      "rawMm": 24.88,
      "depletionMm": 17.5,
      "depletionAtStartMm": 17.5,
      "depletionAfter24hMm": 25.67,
      "effectiveRainMm": 0,
      "efficiency": 0.9,
      "flowRateLph": 9000
    }
  }
}
```

### External: Open-Meteo

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=24.2&longitude=55.7
  &daily=et0_fao_evapotranspiration,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min
  &hourly=et0_fao_evapotranspiration,precipitation,precipitation_probability,temperature_2m,relative_humidity_2m
  &timezone=auto&timeformat=unixtime&past_days=14&forecast_days=7
```

- No API key is needed. `timezone` is required whenever daily data is requested.
- `past_days` (max 92) provides 14 days of history for the simulator backfill.
- Free tier: non-commercial use only, with limits of 600 calls/min, 5,000/hour and 10,000/day. One hourly refresh per farm stays far below that.
- The data license is CC BY 4.0. Show "Weather data by Open-Meteo.com", linked, wherever weather data appears.

## Appendix D — Demo seed

**Farm:** Furrow Demo Farm, Al Ain, UAE (≈ 24.2° N, 55.7° E), timezone `Asia/Dubai`.

### Crops

Kc, p and Zr values come from FAO-56 Tables 12 and 22. Stage lengths come from the arid-region rows of Table 11.

| Crop | Kc ini / mid / end | p | Zr: FAO range → used | Stages ini/dev/mid/late (days) |
|---|---|---|---|---|
| Tomato | 0.60 / 1.15 / 0.80 ¹ | 0.40 | 0.7–1.5 → 0.7 m | 35 / 45 / 70 / 30 (Oct/Nov planting) |
| Cucumber (fresh market) | 0.60 / 1.00 / 0.75 | 0.50 | 0.7–1.2 → 0.7 m | 25 / 35 / 50 / 20 (Nov or Feb planting) |
| Lettuce | 0.70 / 1.00 / 0.95 | 0.30 | 0.3–0.5 → 0.3 m | 25 / 35 / 30 / 10 (Oct/Nov planting) |
| Date palms | 0.95 constant ² | 0.50 | 1.5–2.5 → 1.5 m | Perennial |

¹ FAO-56 gives 0.70–0.90 for tomato Kc end; the midpoint is used.
² FAO-56 gives 0.90 / 0.95 / 0.95; the mid value is used year-round for mature palms.

### Soils

All values fall within the FAO-56 Table 19 ranges. The loamy sand values are the ones used in FAO-56 Example 36. The sandy loam row is kept for the worked example in A.3.

| Soil | θFC | θWP |
|---|---|---|
| Sand | 0.12 | 0.05 |
| Loamy sand | 0.15 | 0.06 |
| Sandy loam | 0.23 | 0.10 |
| Loam | 0.27 | 0.12 |

### Plots

| Plot | Crop (at seed time) | Soil | Method (Ea) | Area | Flow | Scenario |
|---|---|---|---|---|---|---|
| Block A | Date palms | Sand | Bubbler (0.85) | 10,000 m² | 60,000 L/h | Optimal |
| Block B | Date palms | Sand | Bubbler (0.85) | 8,000 m² | 48,000 L/h | Sensor offline |
| Field 3 | Tomato, day 50 (development) | Loamy sand | Drip (0.90) | 2,000 m² | 10,000 L/h | Irrigate tonight |
| Field 4 | Cucumber, day 30 (development) | Sand | Drip (0.90) | 1,500 m² | 7,500 L/h | Needs water |
| Field 5 | Lettuce, day 20 (initial) | Loam, compacted (k_drain 0.02/h) | Sprinkler (0.75) | 1,000 m² | 10,000 L/h | Overwatered |

The vegetable fields use sandy soils, which are typical around Al Ain, and drip rates of about 5 mm/h. With sandy loam, Field 3's deficit came to roughly 36 mm, which needs about 9 hours. That is longer than the 8-hour night window and would look wrong to an agronomist. On loamy sand the run is about 5 h 25 min, which fits.

### Scenario targets

Targets are computed from the live forecast at seed time, so each plot lands in its intended state whatever the weather.

| Scenario | Target |
|---|---|
| Optimal | Dr = 0.3 × RAW |
| Irrigate tonight | Dr(S) = RAW − 0.5 × ETc(S→S+24h), so the current Dr = Dr(S) − ETc(now→S). Dr(S) stays constant through the day, so the scenario holds until the window opens. |
| Needs water | Dr = RAW + 0.15 × (TAW − RAW) |
| Overwatered | θ = θFC + 0.05, after an over-long sprinkler run the previous evening. With slow drainage it stays above the threshold for about a day. |

Targets use the live start time S. If the demo is seeded during the night window, "Irrigate tonight" therefore shows as "start now". The daily reset runs at 05:30, after the window closes, so the scenarios hold through the day.
| Sensor offline | The Optimal target, then the simulator is paused for the 5 h before seed time |

The seed builds the history in three steps:
1. Backfill 14 days using real hourly ET₀ from Open-Meteo.
2. Add irrigations every 2–3 days.
3. Ease the last 24 h toward each target. This adjustment is demo-only.

The result is a chart with a realistic dry-down and refill pattern.

## Appendix E — Glossary

| Term | Meaning |
|---|---|
| θ, VWC | Volumetric water content: the share of soil volume that is water (m³/m³, shown as %) |
| Field capacity (θFC) | Water content after free drainage; the upper target |
| Wilting point (θWP) | Below this, plants can no longer extract water |
| TAW | Total available water in the root zone (mm) |
| RAW | Readily available water; depletion beyond this stresses the crop (mm) |
| p | The fraction of TAW that can be depleted before stress |
| Dr | Root-zone depletion below field capacity (mm) |
| ET₀ | Reference evapotranspiration: weather-driven water demand of a reference grass (mm) |
| Kc | Crop coefficient; ETc = Kc × ET₀ |
| Ks | Water stress coefficient (0–1) |
| Ea | Application efficiency of the irrigation system |

## References

- Allen, R. G., Pereira, L. S., Raes, D., Smith, M. (1998). *Crop evapotranspiration — Guidelines for computing crop water requirements.* FAO Irrigation and Drainage Paper 56. Chapter 6: <https://www.fao.org/4/x0490e/x0490e0b.htm> · Chapter 7: <https://www.fao.org/4/x0490e/x0490e0c.htm> · Chapter 8: <https://www.fao.org/4/x0490e/x0490e0e.htm>
- Open-Meteo Forecast API: <https://open-meteo.com/en/docs> · Terms: <https://open-meteo.com/en/terms> · License: <https://open-meteo.com/en/licence>
