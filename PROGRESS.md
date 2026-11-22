# PROGRESS

Update this file at the end of every phase and every work session.

## Status

- Current phase: **Phase 2 — done.** Next: Phase 3 (HUD, convoy logic, alerts, quick action)
- Last commit: Phase 2 realtime sync

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
- [ ] Phase 3 — HUD, convoy logic, alerts, quick action
- [ ] Phase 4 — PTT tier 1
- [ ] Phase 5 — Polish, phone test, final deploy
- [ ] Phase 6 — README, status table, DECISIONS.md
- [ ] Phase 7 (optional) — PTT tier 2, recorded clip

## Known issues / notes for the next session

- Database rules are auth-only placeholders; full validation rules come in Phase 2 (see DECISIONS.md).
- Phase 2 verified in two tabs (`?sid=qa2`): sync, tail tab closing (host takes it over, no jump), network drop ("lost contact" after 3 s, host takes over, tab reclaims on reconnect), host tab closing (other tab becomes host). Deployed and checked on the live URL.
- `App.tsx` still shows a temporary readout table; the HUD replaces it in Phase 3.
- Bugs found and fixed while testing: the cars subscription started before sign-in; a refused claim threw instead of meaning "taken"; double sign-in under StrictMode. See DECISIONS.md "One anonymous user per tab".
- Database was wiped after testing (it held stuck claims from the double sign-in bug). If a role ever looks stuck, run `firebase database:remove /sessions/demo` (Phase 3 adds a reset button).
- The debug "msgs/s in" count includes Firebase's local echo of our own writes, so it is not pure network traffic.
- `t` in car samples is server time; `s` grows forever (odometer), well under the 1e6 rule limit for a demo.
- Map tiles show faint seams between tiles (CSS filter on OSM tiles). Polish item for Phase 5.
- Map tiles switched from CARTO to OSM (CARTO now needs a key). See DECISIONS.md. The README must not say CARTO.
- Simulated over 2 h: gaps between neighbours stay 57–425 m, no overtaking, average ~53 km/h. A split only happens through the lag slider (Phase 3).
- Empty `src/audio/` folder holds a `.gitkeep` until Phase 4.
- Deploy: `npm run build && firebase deploy --only hosting` (rules: `firebase deploy --only database`).

## Deployed

- Live URL: https://convoy-hud-poc.web.app
- Firebase project ID: `convoy-hud-poc` (RTDB in europe-west1)
