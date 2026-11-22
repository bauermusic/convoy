# PROGRESS

Update this file at the end of every phase and every work session.

## Status

- Current phase: **Phase 1 — done.** Next: Phase 2 (realtime sync)
- Last commit: Phase 1 route, simulation, map

## Time log (active work only)

Clock starts at the first commit, which contains only `SPEC.md`, `BRIEF.md`, `CLAUDE.md`, `PROGRESS.md`, `.gitignore`, `.env.example`.

| Session | Date | Active time | Phases worked |
|---|---|---|---|
| 1 | 2026-11-22 | 26min | 0 |

Total active time so far: 0h

## Phase checklist

- [x] Phase 0 — Setup and deploy a hello page
- [x] Phase 1 — Route, simulation, map (local only)
- [ ] Phase 2 — Realtime sync (roles, host/NPC, telemetry, presence)
- [ ] Phase 3 — HUD, convoy logic, alerts, quick action
- [ ] Phase 4 — PTT tier 1
- [ ] Phase 5 — Polish, phone test, final deploy
- [ ] Phase 6 — README, status table, DECISIONS.md
- [ ] Phase 7 (optional) — PTT tier 2, recorded clip

## Known issues / notes for the next session

- Database rules are auth-only placeholders; full validation rules come in Phase 2 (see DECISIONS.md).
- Phase 1 simulates all three cars in one tab (`hooks/useCars.ts`). Phase 2 changes it to own car local, other cars from RTDB.
- `App.tsx` shows a temporary readout table; the HUD replaces it in Phase 3. The live URL still shows the Phase 0 hello page (no deploy in Phase 1).
- `src/firebase/client.ts` is not imported by the app right now; `useSession` brings it back in Phase 2.
- Map tiles show faint seams between tiles (CSS filter on OSM tiles). Polish item for Phase 5.
- Map tiles switched from CARTO to OSM (CARTO now needs a key). See DECISIONS.md. The README must not say CARTO.
- Simulated over 2 h: gaps between neighbours stay 57–425 m, no overtaking, average ~53 km/h. A split only happens through the lag slider (Phase 3).
- Empty `src/audio/` folder holds a `.gitkeep` until Phase 4.
- Deploy: `npm run build && firebase deploy --only hosting` (rules: `firebase deploy --only database`).

## Deployed

- Live URL: https://convoy-hud-poc.web.app
- Firebase project ID: `convoy-hud-poc` (RTDB in europe-west1)
