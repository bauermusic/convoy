# Live Convoy HUD — POC Spec

Build brief: a responsive web app that simulates a driver's main screen (dashboard / CarPlay-style) for a driver inside an active convoy. 4-hour time box. Evaluated on: working live demo, architecture, code quality, and the clarity of the README. A technical walkthrough with the author follows, so **everything must be small enough for one person to read and explain**.

## 0. Working rules for the AI assistant

- Implement **one phase at a time** (section 11). Stop after each phase, run the checks, and wait.
- Keep the codebase small (target under ~1,500 lines excluding the route data). Prefer plain, readable code over clever abstractions.
- **No extra libraries** beyond those listed in section 1. No state-management library, no CSS framework, no react-leaflet.
- Put all domain logic in pure functions under `src/domain/` (no React, no Firebase imports) so it is testable and easy to explain.
- Whenever you take a shortcut, mock something, or skip something from the brief, **append an entry to `DECISIONS.md`** right then (format in section 12). Do not wait until the end.
- Never commit secrets. Firebase web config goes in `.env.local` (gitignored) with a committed `.env.example`.
- Comment the *why*, not the *what*. Every file that contains a non-obvious decision gets a short header comment.

## 1. Stack (fixed)

| Concern | Choice |
|---|---|
| App | Vite + React 18 + TypeScript (strict) |
| Map | Leaflet (plain, via a ref) with CARTO dark tiles (no API key) |
| Live channel | Firebase Realtime Database (RTDB) |
| Auth | Firebase Anonymous Auth |
| Hosting | Firebase Hosting |
| Audio | Web Audio API + `getUserMedia`; `MediaRecorder` for the optional clip tier |
| Tests | Vitest (domain logic only) |
| Styling | One plain CSS file (CSS variables) |

No Node server. State this in the README as a deliberate choice: client-owned state plus a managed realtime DB is enough for a POC.

## 2. Core idea

**Each browser tab owns one car.** A tab joins a session, claims a role (`lead`, `mid`, or `tail`), simulates that car locally along the route, and writes its telemetry to RTDB about 4 times per second. Every tab subscribes to all cars, estimates their current positions by dead reckoning, and computes gaps and alerts locally. The two-tab bonus is simply how the system works.

If a role has no human, the **session host** drives it as an NPC so a single tab shows a full convoy. Host = first joiner, claimed via transaction, released with `onDisconnect`; if the host leaves, another tab claims it.

Convoy is one-dimensional: every car is described by **distance along the route in metres** (`s`), not lat/lng. Lat/lng exists only for drawing.

## 3. Data model (RTDB)

All under `/sessions/{sid}` (default `sid = "demo"`).

```
meta/            { threshold: 1500 }                 // metres, split alert trigger
host/            { uid }                             // onDisconnect().remove()
roles/{role}/    { uid, npc: boolean, claimedAt }    // role ∈ lead | mid | tail; onDisconnect().remove()
cars/{role}/     { s, v, status, npc, t }            // s metres, v m/s, status "driving"|"stopped", t = ServerValue.TIMESTAMP
ptt/             { role, uid, startedAt, seq }       // null when channel is free; onDisconnect().remove()
alerts/{pushId}/ { type, role, t }                   // type "pullover" | "resume"
clips/{pushId}/  { role, mime, b64, t }              // optional tier 2 only; max ~8 s
```

Security rules (`database.rules.json`): any authenticated user may read `/sessions`; writes require `auth != null`; validate types and ranges for `cars` (`s` number 0..1e6, `v` number 0..100, `status` enum); `ptt` and `roles` writes are allowed only when empty or when `uid == auth.uid`. State in the README that production would add per-session membership and rate limiting.

## 4. Domain logic (`src/domain/`, pure and tested)

**`route.ts`**
- Input: ~60–80 hand-authored waypoints near Col de Turini (≈43.99 N, 7.39 E). Approximate is fine; it must be a plausible winding road at least 15 km long. Alternative: a coastal road.
- Resample into a lookup table at 10 m spacing with cumulative distance. `positionAt(s)` returns `{lat, lng, bearing}` via binary search plus linear interpolation. Clamp `s` to the route length (cars stop at the end, or loop back to 0 — pick one and document it).

**`sim.ts`**
- `stepCar(state, dt, params) -> state`. Target speed = base speed (~16–22 m/s) with a slow sinusoidal variation and a slowdown factor for sharp curvature. Speed moves toward target with bounded acceleration (no teleporting speeds).
- `params.lagFactor` (0.2–1.0) scales the target speed. Used by the demo slider to make the tail car fall behind.
- `status: "stopped"` ramps target speed to 0. `"driving"` resumes.
- Initial spacing: lead at 600 m, mid at 300 m, tail at 0 m.

**`deadReckoning.ts`**
- `estimate(sample, serverNow) -> { s, stale }` where `s = sample.s + sample.v * min(age, 3s)`. If `age > 3 s` the car is `stale`: the position freezes and the UI shows "lost contact". Stale cars are excluded from split detection.
- The renderer lerps displayed position toward the estimate each animation frame to hide corrections.
- `serverNow = Date.now() + serverTimeOffset` where the offset comes from `.info/serverTimeOffset`.

**`convoy.ts`**
- `gaps(cars)`: along-route distance between consecutive cars (lead→mid, mid→tail) and lead→tail. **Use along-route distance, not haversine**, because on hairpins straight-line distance is misleading.
- `splitState(prev, leadTailGap, threshold = 1500, release = 1200) -> boolean`: **hysteresis** so the alert does not flicker around the threshold.
- Message shown: `CONVOY SPLIT — SLOW DOWN AND WAIT` (and the Hebrew line `השיירה התפצלה – האט להמתנה` as secondary text, since the original brief is Hebrew).

**`pttFloor.ts`**
- Pure reducer describing floor states: `free | held(by) | busy(other)`. Max talk time 30 s then forced release.

**Tests (Vitest, keep them short):** route `positionAt` bounds and monotonic distance; gaps ordering; hysteresis (trigger at 1501, still on at 1300, off at 1199); dead reckoning staleness cutoff; floor reducer rejects a second claimer.

## 5. Realtime layer (`src/firebase/`)

- `client.ts`: init app from `import.meta.env.VITE_FIREBASE_*`, anonymous sign-in, export `db`.
- `session.ts`: `joinSession(sid, wantedRole)` — claim role by `runTransaction` on `roles/{role}`; if taken, fall back to the first free role; register `onDisconnect().remove()`; claim host the same way.
- `telemetry.ts`: publish own car at 4 Hz (only when changed or every 500 ms heartbeat); subscribe to `cars`. Host also publishes NPC cars (`npc: true`) for roles without a human. When a human claims a role, the host stops publishing it.
- `ptt.ts`: floor claim/release via `runTransaction` on `ptt` (claim succeeds only if null or expired); `onDisconnect().remove()`; heartbeat every 5 s while held.
- `alerts.ts`: push alerts, subscribe to last few, ignore alerts older than 10 s on load.
- Debug counters (messages/sec in and out, last RTT estimate, connection state from `.info/connected`) feed the debug overlay.

URL parameters: `?sid=demo&role=lead|mid|tail&debug=1`. No role = `mid` (the "My Car" of the brief). The label "YOU" marks the local car in the UI.

## 6. UI (driver HUD)

Dark mode, high contrast, large targets, **landscape-first** and usable in portrait.

- Palette (CSS variables): background `#0B0D10`, surface `#14181D`, text `#F2F5F7`, muted `#8A94A0`, accent cyan `#3DD6F5`, warning amber `#FFB020`, danger red `#FF4D4F`, talking green `#35E08A`. Contrast ratio ≥ 7:1 for primary text. System font stack, tabular numerals for speed and distances.
- **Landscape layout:** map on the left (~65%); right column holds speed (very large, km/h), the convoy strip, and controls. **Portrait:** map on top, panels below.
- **Convoy strip (gap bar):** horizontal line Lead — You — Tail with positions to scale and the two gaps in metres/km. Turns amber above 1.2 km and red when split.
- **Map:** route polyline, three markers (distinct colours, role letters L/M/T, "YOU" ring), map auto-follows the local car. Stale car markers are dimmed.
- **PTT button:** at least 120×120 px, bottom of the right column, thumb-reachable, `touch-action: none`, pointer events (down = claim, up/cancel = release). Desktop shortcut: hold **Space**. States: idle, transmitting (green glow + waveform), busy (disabled, "LEAD talking"), unsupported.
- **Quick action:** large "PULL OVER / BREAKDOWN" button (confirm by press-and-hold 600 ms to prevent accidental taps). Sets own status to `stopped`, pushes an alert; a "RESUME" button replaces it. All tabs show a full-width banner: "TAIL: PULLING OVER".
- **Alert banner:** top of screen, full width, role-coloured, persistent while split state is on; pull-over alerts auto-dismiss after 8 s.
- **Demo controls** (small collapsible panel, `?debug=1` or a gear icon): tail lag slider (0.2–1.0), reset session, role switcher, debug overlay toggle (latency, msgs/s, connection state, host/NPC flags).
- Optional one-liner: request a Screen Wake Lock while the HUD is open.
- No animation that distracts; reserve motion for the cars and the talking indicator.

## 7. Push-to-talk (build LAST)

Tiers — stop at the highest tier that fits the time left, and document it.

1. **State-only (required):** hold = claim the floor; everyone sees who is talking and the button state. Local mic level drives a waveform on the sender (`getUserMedia` → `AnalyserNode`). Receivers show an animated synthetic waveform and hear a short synthesized "roger" tone from the Web Audio API when the floor opens/closes. Feature-detect and fall back cleanly.
2. **Recorded clip (optional):** `MediaRecorder` captures while held (max 8 s); on release, push a base64 clip to `clips/` and receivers play it; delete clips older than 30 s. Verified on Chrome; Safari may differ.
3. **Real streaming (NOT built):** WebRTC via LiveKit or a selective forwarding unit. Document as the first item for the two-week plan.

Browser notes to put in the README: audio needs a user gesture (the press is one), the mic needs HTTPS or localhost, and Safari/iOS audio and `MediaRecorder` may behave differently. Everything else in the app has no browser-specific dependencies.

## 8. Firebase setup checklist (do this first, ~20 min)

1. Console → create a project (disable Analytics). Project name e.g. `convoy-hud-poc`.
2. Project settings → add a **Web app**, copy the config values into `.env.local` as `VITE_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._DATABASE_URL`, `..._PROJECT_ID`, `..._APP_ID`. Mirror the names (without values) in `.env.example`.
3. Build → **Realtime Database** → create (choose a European region, e.g. `europe-west1`; copy the exact database URL because it varies by region). Start in locked mode; rules are deployed from the repo.
4. Build → **Authentication** → Sign-in method → enable **Anonymous**.
5. `npm i -g firebase-tools`, `firebase login`, `firebase init` → select **Hosting** and **Database**; public directory `dist`; single-page app rewrite = yes; keep `database.rules.json`.
6. `firebase deploy --only database` then, with a blank hello page: `npm run build && firebase deploy --only hosting`. **Open the live URL before building anything else.** If this works, deployment risk is gone.
7. Free (Spark) plan is enough. Deleting the project later removes everything.

Firebase web config values are not secrets; the database rules are what protect data. Say so in the README.

## 9. Repo layout

```
.
├── README.md            # run instructions, architecture, status table, next steps
├── DECISIONS.md         # running log of choices and shortcuts
├── SPEC.md
├── database.rules.json
├── firebase.json
├── .env.example
└── src/
    ├── main.tsx, App.tsx, styles.css
    ├── data/route.ts            # waypoints
    ├── domain/                  # route, sim, deadReckoning, convoy, pttFloor, types (+ *.test.ts)
    ├── firebase/                # client, session, telemetry, ptt, alerts
    ├── audio/                   # mic (analyser), tone, clip (tier 2)
    ├── hooks/                   # useSession, useCars, useClock
    └── ui/                      # MapView, Hud, ConvoyStrip, PttButton, AlertBanner, DemoControls, DebugOverlay
```

`package.json` scripts: `dev`, `build`, `preview`, `typecheck`, `test`, `lint` (if ESLint is added, keep the config minimal).

## 10. README must contain

1. One-paragraph description plus the live demo URL, with a `?role=lead` and a `?role=tail` link so the reviewer can see two-tab sync immediately.
2. **Run locally:** `npm install`, copy `.env.example` to `.env.local`, `npm run dev`; deploy commands.
3. **Architecture:** a short diagram (ASCII or Mermaid) of tabs ↔ RTDB, the data model summary, and the data flow of one telemetry update and one PTT claim.
4. **Requirements status table** (below), filled in honestly.
5. **Key decisions** (linked to `DECISIONS.md`): client-owned simulation instead of a server, RTDB over Firestore, along-route distance, hysteresis, dead reckoning, transaction-based floor control, Leaflet over Google/Mapbox, no Node server.
6. **Known limitations and the two-week plan:** server-authoritative simulation and anti-spoofing, real audio over WebRTC, offline/reconnect buffering and state resync, rate limiting and security rules per session, scaling beyond one session, real GPS and map-matching, battery and background behaviour, native CarPlay/Android Auto integration, accessibility audit, automated end-to-end tests.
7. Browser note (section 7).

### Requirements status table (template, fill at the end)

| # | Requirement from the brief | Status | Notes / why |
|---|---|---|---|
| 1 | Live map with 3 cars on a defined route | Done | Leaflet; hand-authored approximate route |
| 2 | Simulation updates position, speed, relative distance | Done | Pure `stepCar`, tested |
| 3 | Live channel between users | Done | Firebase RTDB |
| 4 | Bonus: two tabs sync live | Done | Each tab owns a role |
| 5 | Large hold-to-talk PTT button | | |
| 6 | "Transmitting now" state and who is talking | | |
| 7 | Waveform indicator | | Local mic level / synthetic on receivers |
| 8 | Audio transfer | | Tier reached: 1 / 2 |
| 9 | Split alert beyond threshold | Done | Along-route gap with hysteresis |
| 10 | Quick action "pull over / breakdown" | | |
| 11 | Dark, high-contrast, landscape HUD | | |
| 12 | Live demo + GitHub + README | | |

## 11. Build phases

Every phase ends with: `npm run typecheck`, `npm test`, a manual check, a git commit with a clear message, and a `DECISIONS.md` update if anything was simplified.

**Phase 0 — Setup and deploy (≤ 25 min).** Vite + React + TS scaffold, Vitest, folder skeleton, Firebase checklist (section 8), a hello page deployed to Hosting, `.env.example`, `.gitignore`, first commit. *Acceptance:* the live URL loads; the anonymous sign-in succeeds (log the uid).

**Phase 1 — Route, simulation, map, local only (≤ 55 min).** `route.ts`, `data/route.ts`, `sim.ts`, tests, `MapView` with polyline and three moving markers driven by a local loop. *Acceptance:* three cars run the road with plausible speeds; tests pass.

**Phase 2 — Realtime sync (≤ 45 min).** Firebase layer for session, roles, host/NPC, telemetry, dead reckoning, presence, and the debug overlay. Security rules deployed. *Acceptance:* two tabs (`?role=lead`, `?role=tail`) show each other moving smoothly; closing a tab frees its role and the host takes over its NPC within a few seconds; a stopped network shows "lost contact" after 3 s.

**Phase 3 — HUD and convoy logic (≤ 45 min).** Landscape layout, speed display, convoy strip, `convoy.ts` with tests, split alert banner, lag slider, pull-over/resume with hold-to-confirm, alerts broadcast. *Acceptance:* dragging the lag slider to 0.2 triggers `CONVOY SPLIT` on every tab, and it clears below 1.2 km; a pull-over appears on all tabs.

**Phase 4 — PTT tier 1 (≤ 40 min).** Floor control with transactions, `PttButton` with pointer events and the Space shortcut, local waveform, synthesized tone, busy state, forced release after 30 s, disconnect cleanup. *Acceptance:* two tabs cannot talk at once; the second tab sees "X talking"; killing the talker's tab frees the channel.

**Phase 5 — Polish and deploy (≤ 25 min).** Portrait layout, large tap targets, colour/contrast pass, feature-detect fallbacks, test on a phone (Chrome and Safari), final deploy. *Acceptance:* the live URL works from a clean device with no setup.

**Phase 6 — README and decisions (≤ 15 min).** Fill the status table and the two-week section, tidy `DECISIONS.md`, final commit.

**Optional Phase 7 — PTT tier 2 (only with time left).** Recorded clip send/play, Chrome-verified.

**Cut order if running late:** tier 2 audio → debug overlay polish → unit tests beyond the hysteresis and floor tests → portrait layout. **Never cut:** the live deploy, README, status table, and two-tab sync.

## 12. `DECISIONS.md` format

One short entry per decision or shortcut:

```
### <title>
- Context: what the brief asked for
- Decision: what was built (or deliberately not built)
- Why: the trade-off (time, risk, cost, complexity)
- With two weeks: what would replace it
```

Minimum entries expected: client-owned simulation vs server, RTDB vs Firestore, Leaflet vs Google/Mapbox, along-route distance, hysteresis, dead reckoning and the 3 s stale cutoff, floor control by transaction, PTT audio tier reached and why, anonymous auth and rules scope, browser support note, no Node server.

## 13. Definition of done (what a reviewer, human or AI, will check)

- The live URL opens into a working HUD with no setup; the `?role=` links show two-tab sync.
- A fresh clone runs with `npm install && npm run dev` after copying `.env.example`.
- `npm run typecheck` and `npm test` pass.
- No secrets or `.env.local` in git history.
- README states clearly what is done, simplified, mocked, or missing, and why, with a realistic two-week plan.
- Code reads cleanly: domain logic is pure and tested, Firebase code is isolated, components are small.
