# DECISIONS

Running log of choices, shortcuts and deliberate omissions. Format: SPEC section 12.

### Firebase config files written by hand instead of `firebase init`
- Context: SPEC section 8 step 5 says to run `firebase init` for Hosting and Database.
- Decision: `firebase.json` and `database.rules.json` are written directly; `.firebaserc` only names the project.
- Why: `firebase init` is interactive and generates extra files we don't need. The result is the same three small files, which are easier to read and explain.
- With two weeks: no change; this is the normal way once a project exists.

### Placeholder database rules in Phase 0
- Context: SPEC section 3 asks for typed, range-checked rules for `cars`, `ptt` and `roles`.
- Decision: Phase 0 ships auth-only rules (`/sessions` readable and writable by any signed-in user, everything else locked). Replaced in Phase 2 (see "Security rules scope").
- Why: nothing writes data yet; the Phase 0 goal is to prove the deploy path for rules.
- With two weeks: per-session membership, validation and rate limiting (see README two-week plan).

### `vitest run --passWithNoTests`
- Context: `npm test` must pass at the end of every phase.
- Decision: the test script passes when there are no test files.
- Why: Phase 0 has no domain logic yet; the first real tests land in Phase 1. Without the flag Vitest exits with an error.
- With two weeks: the flag can stay; it is harmless once tests exist.

### Tool versions
- Context: SPEC section 1 fixes Vite + React 18 + TypeScript + Vitest.
- Decision: React 18.3, Vite 7, TypeScript 5.9, Vitest 5, Firebase JS SDK 12.
- Why: React 18 as specified. TypeScript 5.9 rather than 7.x (the new native compiler) to stay on the widely supported toolchain. Vite 7 rather than 8 for the most mature React plugin pairing.
- With two weeks: upgrade together once the newer majors settle.

### Route: real road geometry instead of hand-authored waypoints
- Context: SPEC section 4 asks for ~60–80 hand-authored, approximate waypoints near Col de Turini.
- Decision: one OSRM driving route (OpenStreetMap data) from La Bollène-Vésubie to Col de Turini, simplified to 114 waypoints (Douglas-Peucker, 20 m tolerance), 16.4 km one way, stored as static data in `src/data/route.ts`. No routing call at runtime.
- Why: hand-drawn points would not line up with the road on the map tiles. 114 points was the smallest count that still follows the hairpins.
- With two weeks: real GPS positions map-matched to the road network.

### Route end: out-and-back loop, `s` as an odometer
- Context: SPEC section 4 says to clamp at the end of the route or loop back, and to document the choice.
- Decision: the route is driven up and back down (`outAndBack`), so it starts and ends at the same point and the cars loop forever with no jump on the map. `s` keeps growing; only drawing wraps it.
- Why: the demo never stops, and gaps computed from `s` stay correct across laps. At about 53 km/h average, `s` stays under the planned 1e6 rule limit for roughly 19 hours.
- With two weeks: real routes with a start and a destination.

### Uniform lookup table instead of binary search
- Context: SPEC section 4 says `positionAt` uses binary search plus linear interpolation.
- Decision: the table has a point every 10 m, so the index is `floor(s / 10)`; then interpolate.
- Why: same result, less code to explain.
- With two weeks: no change.

### Map tiles: OpenStreetMap with a CSS dark filter instead of CARTO dark
- Context: SPEC section 1 chose CARTO dark tiles because they needed no API key.
- Decision: CARTO now serves "API KEY REQUIRED" watermarked tiles (seen 2026-11-22). The map uses standard OSM tiles darkened with `filter: grayscale invert`. Esri's dark basemap was also checked; it has almost no road detail in this area.
- Why: no key, no sign-up, full road detail. Fine for a low-traffic demo under the OSM tile usage policy.
- With two weeks: a proper dark vector style (MapTiler or Stadia with a key, or self-hosted tiles).

### Simulation loop on `setInterval`, not `requestAnimationFrame`
- Context: the cars must keep moving and publishing in Phase 2.
- Decision: the sim steps every 100 ms on `setInterval`, with `dt` capped at 1 s.
- Why: rAF stops in background tabs, while intervals keep running (throttled). A background tab still drives its car.
- With two weeks: a Web Worker, or a server-side simulation.

### Client-owned simulation with a host for empty roles (no server)
- Context: the brief asks for a simulation that updates position, speed and distance through a live channel.
- Decision: each tab simulates the car it holds and writes it to RTDB. One tab, the host (claimed by transaction, freed by `onDisconnect`), also drives every role no human holds, as an NPC. When a tab closes, the host continues that car from its last sample. When the host leaves, another tab claims host.
- Why: no server to build, deploy or pay for. A single tab still shows a full convoy, and two tabs is just the normal case.
- With two weeks: a server-authoritative simulation, so clients can't spoof positions.

### Realtime Database over Firestore
- Context: the brief allows Firebase RTDB, Firestore or WebSockets.
- Decision: RTDB.
- Why: built for many small, frequent writes with low latency. It has presence built in (`onDisconnect`, `.info/connected`, `.info/serverTimeOffset`). Firestore bills per document write and has no disconnect hooks.
- With two weeks: still RTDB for live state; Firestore if we add history or accounts.

### Dead reckoning with a 3 s stale cutoff
- Context: telemetry arrives 4 times per second; markers must move smoothly and show lost cars.
- Decision: remote cars are extrapolated at their last speed for up to 3 s (server-time ages via `.info/serverTimeOffset`), and drawn positions ease toward the estimate. After 3 s without a sample the car freezes, dims and shows "lost contact".
- Why: smooth motion between updates, and an honest signal when a car drops out. 3 s is about 12 missed updates, so jitter doesn't trigger it.
- With two weeks: tune the cutoff on real mobile networks; buffer and replay the local car's samples after a reconnect.

### One anonymous user per tab (in-memory auth)
- Context: ownership of a role or the host slot is checked by uid, in code and in the rules.
- Decision: Firebase Auth uses in-memory persistence, and sign-in runs once per page. Every tab and every reload is a new anonymous user.
- Why: the default persistence shares one uid across all tabs of a browser, so two tabs could both "own" the same car. Signing in twice on one page (React StrictMode runs effects twice in dev) switched the database auth to a second user and made the rules refuse our claims. Both were seen in testing.
- With two weeks: real accounts. Anonymous users pile up, so enable automatic cleanup of anonymous accounts in the console.

### Security rules scope
- Context: SPEC section 3 asks for typed rules.
- Decision: signed-in users can read `/sessions`. `host` and `roles/{role}` can only be written when empty or held by the same uid. `cars/{role}` is validated (s 0..1e6, v 0..100, status enum, `t <= now`, no extra fields), but any signed-in user may write any car, because the host writes NPC cars. `ptt` and `alerts` rules come with those phases.
- Why: enough to stop accidental clobbering and bad data in a demo.
- With two weeks: per-session membership, only the role holder or the host may write a car, and rate limiting.

### Roles have no `npc` flag
- Context: SPEC section 3 lists `roles/{role}: { uid, npc, claimedAt }`.
- Decision: `roles/` only holds human claims. A role with no entry is an NPC, and the host marks its cars with `npc: true`.
- Why: one source of truth for "is a human here", and no host bookkeeping in `roles/`.
- With two weeks: no change.

### "Simulate network drop" button in the debug overlay
- Context: Phase 2 acceptance says a dropped network shows "lost contact" after 3 s.
- Decision: `?debug=1` adds a button that calls `goOffline()` / `goOnline()` on the Firebase connection.
- Why: reviewers can see "lost contact" and the reconnect without DevTools. Going offline also lets the server run `onDisconnect`, so the host takes over the car, and the tab reclaims it on reconnect.
- With two weeks: no change; it's a debug tool.
