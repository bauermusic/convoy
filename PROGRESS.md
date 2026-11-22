# PROGRESS

Update this file at the end of every phase and every work session.

## Status

- Current phase: **Phase 0 — done.** Next: Phase 1 (route, simulation, map, local only)
- Last commit: Phase 0 scaffold and deploy

## Time log (active work only)

Clock starts at the first commit, which contains only `SPEC.md`, `BRIEF.md`, `CLAUDE.md`, `PROGRESS.md`, `.gitignore`, `.env.example`.

| Session | Date | Active time | Phases worked |
|---|---|---|---|
| 1 | 2026-11-22 | (fill in) | 0 |

Total active time so far: 0h

## Phase checklist

- [x] Phase 0 — Setup and deploy a hello page
- [ ] Phase 1 — Route, simulation, map (local only)
- [ ] Phase 2 — Realtime sync (roles, host/NPC, telemetry, presence)
- [ ] Phase 3 — HUD, convoy logic, alerts, quick action
- [ ] Phase 4 — PTT tier 1
- [ ] Phase 5 — Polish, phone test, final deploy
- [ ] Phase 6 — README, status table, DECISIONS.md
- [ ] Phase 7 (optional) — PTT tier 2, recorded clip

## Known issues / notes for the next session

- Database rules are auth-only placeholders; full validation rules come in Phase 2 (see DECISIONS.md).
- `npm test` passes with no test files (`--passWithNoTests`); first real tests in Phase 1.
- Empty `src/*/` folders hold a `.gitkeep`; remove each one when the folder gets real files.
- Deploy: `npm run build && firebase deploy --only hosting` (rules: `firebase deploy --only database`).

## Deployed

- Live URL: https://convoy-hud-poc.web.app
- Firebase project ID: `convoy-hud-poc` (RTDB in europe-west1)
