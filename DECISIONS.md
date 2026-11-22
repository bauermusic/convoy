# DECISIONS

Running log of choices, shortcuts and deliberate omissions. Format: SPEC section 12.

### Firebase config files written by hand instead of `firebase init`
- Context: SPEC section 8 step 5 says to run `firebase init` for Hosting and Database.
- Decision: `firebase.json` and `database.rules.json` are written directly; `.firebaserc` only names the project.
- Why: `firebase init` is interactive and generates extra files we don't need. The result is the same three small files, which are easier to read and explain.
- With two weeks: no change; this is the normal way once a project exists.

### Placeholder database rules in Phase 0
- Context: SPEC section 3 asks for typed, range-checked rules for `cars`, `ptt` and `roles`.
- Decision: Phase 0 ships auth-only rules (`/sessions` readable and writable by any signed-in user, everything else locked). Full validation rules arrive with the realtime layer in Phase 2.
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
