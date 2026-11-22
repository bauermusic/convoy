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
- Decision: CARTO now serves "API KEY REQUIRED" watermarked tiles (seen 2026-11-22). The map uses standard OSM tiles darkened with `filter: grayscale invert`. Esri's dark basemap was also checked; it has almost no road detail in this area. The filter is applied to each tile, with a matching map background, which hides the hairline seams between tiles.
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

### Along-route gaps and split hysteresis
- Context: the brief asks for an alert when the lead–tail distance exceeds a threshold (e.g. 1.5 km).
- Decision: gaps are differences of `s` (distance along the road). The alert turns on above 1500 m and only clears below 1200 m. Cars that lost contact are left out, and while a gap is unknown the alert keeps its last state.
- Why: on hairpins, straight-line distance can be a fraction of the road distance. A single threshold would flash the alert on and off while the gap hovers around 1.5 km.
- With two weeks: per-convoy thresholds, and alerts based on time gap (seconds behind) as well as distance.

### Simulated drivers obey the split alert
- Context: Phase 3 acceptance says the split alert clears again below 1.2 km. In the simulation nobody actually controls the cars.
- Decision: while the convoy is split, the simulated lead and mid cars drive at 50% speed (`WAIT_FACTOR`). The tail obeys only the lag slider.
- Why: the alert says "slow down and wait", so the simulated drivers do. Without this the gap could never close, and the demo would end stuck in "split".
- With two weeks: real drivers; the app would only advise.

### Threshold as a constant, demo settings in `meta/`
- Context: SPEC section 3 puts `meta/threshold` in the database.
- Decision: thresholds are constants in `domain/convoy.ts`. `meta/` holds the shared demo settings instead: `tailLag` (slider) and `resetAt` (reset button).
- Why: nothing changes the threshold at runtime. The lag and reset must be shared, because whichever tab drives the tail (human or host) has to apply them.
- With two weeks: per-session settings, editable by the convoy organiser.

### Reset session restarts cars at the grid in every tab
- Context: SPEC section 6 lists a "reset session" demo control.
- Decision: reset writes `meta/resetAt` (plus tail lag back to 1 and alerts cleared). Each tab, on seeing a new `resetAt`, puts the cars it drives back at their starting spacing and ignores old samples.
- Why: deleting car data is not enough, because every driving tab would immediately rewrite its car from memory. A first version continued from old samples that were still arriving, and testing caught it.
- With two weeks: server-owned session state makes reset a single server action.

### Pull-over alerts: 8 s banners, resume clears them
- Context: the brief asks for a "Pull over / Breakdown" quick action that broadcasts to all vehicles.
- Decision: hold-to-confirm (600 ms) sets your own car to `stopped` and pushes an alert to `alerts/` (append-only in the rules). All tabs show "ROLE: PULLING OVER" for 8 s; a RESUME tap drives on and clears that banner. A car taken over by the host as an NPC always drives on.
- Why: hold-to-confirm prevents accidental taps while driving. Alerts older than 10 s are ignored on load, so a late joiner doesn't see old news.
- With two weeks: acknowledgements ("seen by LEAD"), a persistent "stopped" marker on the map, and push notifications.

### Background tabs: the loop runs on a Web Worker timer
- Context: two-tab sync must keep working when one tab is in the background.
- Decision: the 100 ms loop is driven by a tiny Web Worker timer (`hooks/backgroundInterval.ts`), not `setInterval`.
- Why: in testing, a tab hidden for 5 minutes was throttled by Chrome to one timer run per minute. Its car, and the NPCs it hosted, showed "lost contact" in the other tab. Worker timers are not throttled that hard.
- With two weeks: a server-side simulation removes the dependency on any tab being active.

### Push-to-talk: tier 1 (state only) reached
- Context: the brief asks for hold-to-talk with a "transmitting now" state for everyone, a waveform or speaker indication, and simulated audio transfer.
- Decision: tier 1 of SPEC section 7. Holding the button (or Space) claims the floor. The talker's mic drives a live waveform. Everyone else sees "LEAD TALKING", a synthetic waveform and a green ring on that car's map marker, and hears a synthesized tone when the channel opens and closes. No voice is sent.
- Why: floor control and the shared "who is talking" state are the hard, testable part. Real audio (tier 2 clips, tier 3 WebRTC) is browser-specific and slow to verify in the time box.
- With two weeks: WebRTC streaming through an SFU (e.g. LiveKit), Opus at low bitrate, push-to-talk mapped to the publish/mute state.

### Floor control by transaction, no heartbeat
- Context: SPEC section 5 says to claim the floor with a transaction, clean up with `onDisconnect`, and heartbeat every 5 s while held.
- Decision: `claimFloor()` (pure, tested) runs inside the transaction: the floor can be taken if it is free, expired (held more than 30 s), or already ours. `onDisconnect` frees it when the talker's tab dies; the talker's tab also releases at 30 s. The rules enforce the same (holder or expired only). No heartbeat or `seq`.
- Why: the 30 s cap already bounds a stuck floor (a frozen tab that stays connected), and `onDisconnect` covers a closed or crashed tab. A heartbeat would only shorten the worst case from 30 s, at the cost of more code and writes.
- With two weeks: a 5 s heartbeat for faster recovery, plus talk priority (the lead can interrupt).

### Microphone only while the button is held
- Context: the talker's waveform needs mic access.
- Decision: `getUserMedia` is opened on press and closed on release. The audio goes into an AnalyserNode only; it is never played back or sent. If the mic is missing or refused, PTT still works as state only, with a note on the button.
- Why: the browser's recording indicator is only on while talking, which is what a user expects from a radio. The first press asks for permission, so the first transmission starts without a waveform until the user allows it.
- With two weeks: keep a warm stream during a drive to remove the start-up delay.

### Receivers hear tones only after touching the page
- Context: browsers block audio until the user interacts with the page (autoplay policy).
- Decision: the shared AudioContext is resumed on the first tap or key press anywhere. Until then, tones are skipped silently; the visual indicators always work.
- Why: browsers don't allow working around this.
- With two weeks: a "tap to enable radio audio" prompt on first load.

### Phone layouts and polish (Phase 5)
- Context: SPEC section 6 asks for landscape-first, usable in portrait, large targets, contrast of at least 7:1 for primary text.
- Decision: a compact layout for short landscape screens (phone on the dashboard) puts PULL OVER and TALK side by side, each at least 120 px tall. In portrait the panel takes the height it needs and the map gets the rest. `100dvh`, safe-area insets and no iOS long-press menu on the hold buttons. Contrast checked: primary text 14.8–17.8:1; muted secondary text about 5.3:1 (AA). The split banner was white on red at 3:1 and now uses dark text (5.9:1). Screen Wake Lock where supported. The map follows the car by whole-pixel pans instead of a view reset every 100 ms.
- Why: a phone in landscape is the likely in-car setup, and both critical buttons must be reachable without scrolling.
- With two weeks: an accessibility audit (screen reader labels, focus order, reduced motion), and testing on real car displays.
