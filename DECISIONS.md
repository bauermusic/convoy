# DECISIONS

Every shortcut, mock, deliberate omission and non-obvious choice, with what two weeks would change. Format: SPEC section 12. Where the code differs from SPEC.md, the entry says so.

## Architecture

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

### One anonymous user per tab (in-memory auth)
- Context: ownership of a role or the host slot is checked by uid, in code and in the rules.
- Decision: Firebase Auth uses in-memory persistence, and sign-in runs once per page. Every tab and every reload is a new anonymous user.
- Why: the default persistence shares one uid across all tabs of a browser, so two tabs could both "own" the same car. Signing in twice on one page (React StrictMode runs effects twice in dev) switched the database auth to a second user and made the rules refuse our claims. Both were seen in testing.
- With two weeks: real accounts. Anonymous users pile up, so enable automatic cleanup of anonymous accounts in the console.

### Silent seat holders: takeover after 15 s, host after 10 s
- Context: in device testing all three seats ended up held by tabs that had stopped running (a locked iPhone, a frozen tab). They kept their connections open, so `onDisconnect` never fired; a new visitor got "watching only" and saw every car as "lost contact". Reset couldn't help, because the rules only let a holder remove its own seat.
- Decision: a seat may be taken over when neither its claim nor its car has been updated for 15 s; the host may be taken over when its heartbeat (refreshed every 3 s) is older than 10 s. The claim transactions and the database rules enforce the same limits. Every 3 s the host frees silent seats (so their cars become NPCs again), other tabs take over a silent host, and a seatless tab retries. A tab that wakes up and finds its seat taken steps down and looks for another one. Reset also frees silent seats. The status line says when you got a different seat than the one in the URL.
- Why: phones lock and browsers freeze tabs all the time; a demo link used by reviewers over several days must recover on its own. Verified with fake ghost holders in a test session: takeover, NPC driving, step-down and reset all worked.
- With two weeks: real accounts (a returning driver gets their seat back), and a server that tracks presence instead of each client.

### Security rules scope
- Context: SPEC section 3 asks for typed rules.
- Decision: signed-in users can read `/sessions`. `host` and `roles/{role}` can only be written when empty or held by the same uid. `cars/{role}` is validated (s 0..1e6, v 0..100, status enum, `t <= now`, no extra fields), but any signed-in user may write any car, because the host writes NPC cars. `roles` and `host` can also be taken over once their holder is silent (15 s / 10 s); `ptt` can only be changed by its holder or once expired (30 s); `alerts` are append-only and typed; `meta` is range-checked.
- Why: enough to stop accidental clobbering and bad data in a demo.
- With two weeks: per-session membership, only the role holder or the host may write a car, and rate limiting.

### Roles have no `npc` flag
- Context: SPEC section 3 lists `roles/{role}: { uid, npc, claimedAt }`.
- Decision: `roles/` only holds human claims. A role with no entry is an NPC, and the host marks its cars with `npc: true`.
- Why: one source of truth for "is a human here", and no host bookkeeping in `roles/`.
- With two weeks: no change.

### Background tabs: the loop runs on a Web Worker timer
- Context: two-tab sync must keep working when one tab is in the background. `requestAnimationFrame` stops entirely in hidden tabs, so the loop never used it.
- Decision: the 100 ms loop is driven by a tiny Web Worker timer (`hooks/backgroundInterval.ts`), not `setInterval`.
- Why: in testing, a tab hidden for 5 minutes was throttled by Chrome to one timer run per minute. Its car, and the NPCs it hosted, showed "lost contact" in the other tab. Worker timers are not throttled that hard.
- With two weeks: a server-side simulation removes the dependency on any tab being active.

### Browser support
- Context: the brief asks for a responsive web/mobile app; audio APIs differ between browsers.
- Decision: targets current Chrome and Safari (desktop and iPhone). Only the audio code is browser-sensitive: it feature-detects Web Audio and `getUserMedia`, and falls back to state-only push-to-talk. Tested on Chrome desktop and iPhone Safari.
- Why: everything else uses standard APIs (Pointer Events, ResizeObserver, Web Workers with a `setInterval` fallback, Wake Lock where available).
- With two weeks: Firefox and Android Chrome test passes, and automated cross-browser end-to-end tests.

## Map and route

### Leaflet over Google Maps / Mapbox
- Context: the brief allows Mapbox, Google Maps or Leaflet.
- Decision: plain Leaflet, driven through a React ref (no react-leaflet), with OpenStreetMap tiles.
- Why: no API key, billing account or usage quota, which suits a public demo link. Leaflet is small, and the map only needs a polyline and three markers. Driving it through a ref keeps React out of the map's way: the map is created once and markers are moved each tick.
- With two weeks: a vector map (MapLibre or Mapbox GL) with a proper dark style, 3D terrain on mountain roads, and heading-up rotation.

### Map follow mode: drag to look around, auto-resume after 15 s
- Context: the map re-centred on your car every 100 ms, which fought the user's drags and zooms (reported as "bumpy" in testing).
- Decision: a drag turns following off and shows a re-centre button; following resumes on a tap, or by itself after 15 s without touching the map. Zoom (wheel, pinch, double-tap) always happens around the map centre, which is your car, and re-centring pauses during a zoom and for 1 s after it. Offsets above 12 px glide back (30% per tick) instead of jumping.
- Why: this is how car navigation apps behave, and a driver shouldn't need to find a button to get the map back. Measured after the change: a zoom moves the car at most 10 px per frame, and a re-centre tap glides from 275 px to centred in about 1 s.
- With two weeks: heading-up rotation and zoom that adapts to speed.

### Map tiles: OpenStreetMap with a CSS dark filter instead of CARTO dark
- Context: SPEC section 1 chose CARTO dark tiles because they needed no API key.
- Decision: CARTO now serves "API KEY REQUIRED" watermarked tiles (seen 2026-11-22). The map uses standard OSM tiles darkened with `filter: grayscale invert`. Esri's dark basemap was also checked; it has almost no road detail in this area. The filter is applied to each tile, with a matching map background, which hides the hairline seams between tiles.
- Why: no key, no sign-up, full road detail. Fine for a low-traffic demo under the OSM tile usage policy.
- With two weeks: a proper dark vector style (MapTiler or Stadia with a key, or self-hosted tiles).

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

## Convoy logic

### Dead reckoning with a 3 s stale cutoff
- Context: telemetry arrives 4 times per second; markers must move smoothly and show lost cars.
- Decision: remote cars are extrapolated at their last speed for up to 3 s (server-time ages via `.info/serverTimeOffset`), and drawn positions ease toward the estimate. After 3 s without a sample the car freezes, dims and shows "lost contact".
- Why: smooth motion between updates, and an honest signal when a car drops out. 3 s is about 12 missed updates, so jitter doesn't trigger it.
- With two weeks: tune the cutoff on real mobile networks; buffer and replay the local car's samples after a reconnect.

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

### Car-following: no overtaking, queue behind a stopped car
- Context: a convoy keeps its order, but the first simulation let cars drive "through" each other (found in device testing: mid passed a lead that had pulled over).
- Decision: `keepBehind()` (pure, tested) runs after each step: a car never gets closer than 50 m to the nearest car ahead that is in contact, and at that distance it matches that car's speed. It never moves a car backwards. Cars are stepped front to back. A car that lost contact (e.g. a sleeping phone) is ignored, so the others pass it rather than the whole convoy stopping behind a frozen marker.
- Why: when the lead pulls over, mid and tail now queue 50 m apart and wait, and drive on in order after RESUME. After a stop the convoy stays close together and spreads out only gradually; Reset restores the 300 m spacing.
- With two weeks: real GPS positions, where cars pass or don't on their own; the app would only warn.

## Push-to-talk

### Push-to-talk: tier 2 (recorded voice messages) reached
- Context: the brief asks for hold-to-talk with a "transmitting now" state for everyone, a waveform or speaker indication, and simulated audio transfer.
- Decision: tier 2 of SPEC section 7. Holding the button (or Space) claims the floor and records the mic with `MediaRecorder` (up to 8 s, 32 kbit/s). On release the clip is pushed to `clips/` as base64, and every other tab plays it through the shared AudioContext, queued so messages never overlap. Everyone sees "LEAD TALKING", a green ring on the map and the opening and closing tones while the talker is live; the message plays after release, with a real waveform. Clips are deleted after 30 s. Tier 1 (state only) was built first and is still the fallback without a mic.
- Why: a recorded message transfers real voice with no media server, and fits the database the app already uses. It is delayed rather than live, which suits walkie-talkie use. Tested iPhone Safari → Mac Chrome.
- With two weeks: WebRTC streaming through an SFU (e.g. LiveKit), Opus at low bitrate, push-to-talk mapped to the publish/mute state; recorded messages kept as the fallback.

### Floor control by transaction, no heartbeat
- Context: SPEC section 5 says to claim the floor with a transaction, clean up with `onDisconnect`, and heartbeat every 5 s while held.
- Decision: `claimFloor()` (pure, tested) runs inside the transaction: the floor can be taken if it is free, expired (held more than 30 s), or already ours. `onDisconnect` frees it when the talker's tab dies; the talker's tab also releases at 30 s. The rules enforce the same (holder or expired only). No heartbeat or `seq`.
- Why: the 30 s cap already bounds a stuck floor (a frozen tab that stays connected), and `onDisconnect` covers a closed or crashed tab. A heartbeat would only shorten the worst case from 30 s, at the cost of more code and writes.
- With two weeks: a 5 s heartbeat for faster recovery, plus talk priority (the lead can interrupt).

### Microphone only while the button is held, requested inside the tap
- Context: the talker's waveform and voice message need mic access.
- Decision: `getUserMedia` is called on press and closed on release. It is called directly in the tap, in parallel with the floor claim, not after it. If the mic is missing or refused, PTT still works as state only, and the button shows the reason (e.g. "permission denied").
- Why: the browser's recording indicator is only on while talking, which is what a user expects from a radio. iOS browsers can refuse a mic request that comes after the tap has ended (here, after the claim's network round-trip), without showing a prompt; this came up in device testing.
- With two weeks: keep a warm stream during a drive to remove the start-up delay.

### Receivers hear tones only after touching the page
- Context: browsers block audio until the user interacts with the page (autoplay policy).
- Decision: the shared AudioContext is resumed on the first tap or key press anywhere. Until then, tones are skipped silently; the visual indicators always work.
- Why: browsers don't allow working around this.
- With two weeks: a "tap to enable radio audio" prompt on first load.

## UI and tooling

### Phone layouts and polish (Phase 5)
- Context: SPEC section 6 asks for landscape-first, usable in portrait, large targets, contrast of at least 7:1 for primary text.
- Decision: a compact layout for short landscape screens (phone on the dashboard) puts PULL OVER and TALK side by side, each at least 120 px tall. In portrait the panel takes the height it needs and the map gets the rest. `100dvh`, safe-area insets and no iOS long-press menu on the hold buttons. Contrast checked: primary text 14.8–17.8:1; muted secondary text about 5.3:1 (AA). The split banner was white on red at 3:1 and now uses dark text (5.9:1). Screen Wake Lock where supported. The map follows the car by whole-pixel pans instead of a view reset every 100 ms.
- Why: a phone in landscape is the likely in-car setup, and both critical buttons must be reachable without scrolling.
- With two weeks: an accessibility audit (screen reader labels, focus order, reduced motion), and testing on real car displays.

### "Simulate network drop" button in the debug overlay
- Context: Phase 2 acceptance says a dropped network shows "lost contact" after 3 s.
- Decision: `?debug=1` adds a button that calls `goOffline()` / `goOnline()` on the Firebase connection.
- Why: reviewers can see "lost contact" and the reconnect without DevTools. Going offline also lets the server run `onDisconnect`, so the host takes over the car, and the tab reclaims it on reconnect.
- With two weeks: no change; it's a debug tool.

### Firebase config files written by hand instead of `firebase init`
- Context: SPEC section 8 step 5 says to run `firebase init` for Hosting and Database.
- Decision: `firebase.json` and `database.rules.json` are written directly; `.firebaserc` only names the project.
- Why: `firebase init` is interactive and generates extra files we don't need. The result is the same three small files, which are easier to read and explain.
- With two weeks: no change; this is the normal way once a project exists.

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
