# PROGRESS

Update this file at the end of every phase and every work session.

## Status

- Current phase: **Phase 5 — done in code and deployed; waiting on the author's phone test (Chrome + Safari).** Next: Phase 6 (README, status table, DECISIONS tidy)
- Last commit: Phase 5 polish

## Time log (active work only)

Clock starts at the first commit, which contains only `SPEC.md`, `BRIEF.md`, `CLAUDE.md`, `PROGRESS.md`, `.gitignore`, `.env.example`.

| Session | Date | Active time | Phases worked |
|---|---|---|---|
| 1 | 2026-11-22 | 26min | 0 |

Total active time so far: 0h

## Phase checklist

- [x] Phase 0 — Setup and deploy a hello page
- [x] Phase 1 — Route, simulation, map (local only)
- [x] Phase 2 — Realtime sync (roles, host/NPC, telemetry, presence)
- [x] Phase 3 — HUD, convoy logic, alerts, quick action
- [x] Phase 4 — PTT tier 1
- [ ] Phase 5 — Polish, phone test, final deploy
- [ ] Phase 6 — README, status table, DECISIONS.md
- [ ] Phase 7 (optional) — PTT tier 2, recorded clip

## Known issues / notes for the next session

- Database rules are auth-only placeholders; full validation rules come in Phase 2 (see DECISIONS.md).
- Phase 2 verified in two tabs (`?sid=qa2`): sync, tail tab closing (host takes it over, no jump), network drop ("lost contact" after 3 s, host takes over, tab reclaims on reconnect), host tab closing (other tab becomes host). Deployed and checked on the live URL.
- Bugs found and fixed while testing: the cars subscription started before sign-in; a refused claim threw instead of meaning "taken"; double sign-in under StrictMode. See DECISIONS.md "One anonymous user per tab".
- Database was wiped after Phase 2 testing (it held stuck claims from the double sign-in bug). Test sessions (`qa*`, `parked`) are removed after each phase.
- The debug "msgs/s in" count includes Firebase's local echo of our own writes, so it is not pure network traffic.
- `t` in car samples is server time; `s` grows forever (odometer), well under the 1e6 rule limit for a demo.
- Phase 3 verified in two tabs (`?sid=qa3`): lag 0.2 → split banner on both tabs at 1.54 km; lag back to 1 → lead/mid wait, alert clears at 1.19 km; quick tap ignored, 700 ms hold → "LEAD: PULLING OVER" on both tabs, car stops, banner gone after 8 s, RESUME works; reset → 300 m / 300 m in both tabs; portrait layout; a tab hidden for 7+ minutes keeps publishing (Web Worker timer).
- Reset does not release roles: a stuck role (crashed tab whose onDisconnect never ran) still needs `firebase database:remove /sessions/demo/roles/<role>`.
- Demo flow for the README: gear → tail lag 0.2 → wait ~1 min for CONVOY SPLIT → lag back to 1.0 → clears in ~1 min.
- Phase 4 verified in two tabs (`?sid=qa4`): lead talks → tail sees "LEAD TALKING", disabled button, synthetic waveform, green ring on L; tail's Space press rejected; release → tail can talk (Space shortcut works); closing the talking tab frees the channel in < 2 s; forced release at 30 s.
- NOT verified yet (the test browser has no mic or speakers): the real mic waveform and hearing the tones. Check on Chrome, and Safari in Phase 5.
- After a forced release at 30 s, the user must lift and press again to talk.
- Phase 5 checked in the test browser at 844×390 (phone landscape, with the split banner showing), 390×844 (portrait) and desktop. Both big buttons visible without scrolling.
- Map tiles switched from CARTO to OSM (CARTO now needs a key). See DECISIONS.md. The README must not say CARTO.
- Simulated over 2 h: gaps between neighbours stay 57–425 m, no overtaking, average ~53 km/h. A split only happens through the lag slider (Phase 3).
- Empty `src/audio/` folder holds a `.gitkeep` until Phase 4.
- Deploy: `npm run build && firebase deploy --only hosting` (rules: `firebase deploy --only database`).

## Deployed

- Live URL: https://convoy-hud-poc.web.app
- Firebase project ID: `convoy-hud-poc` (RTDB in europe-west1)
