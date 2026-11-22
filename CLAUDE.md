# CLAUDE.md

Project: Live Convoy HUD, a take-home POC (about 4 hours of active work, may be spread across sessions).

## Read first, every session

1. `PROGRESS.md` — current phase, what is done, what is broken.
2. `SPEC.md` — the full build plan. Follow it.
3. `BRIEF.md` — the original requirements. The final result is judged against this.

## Rules

- Implement **one phase at a time** (SPEC section 11), then stop, run `npm run typecheck` and `npm test`, summarize, and wait.
- Keep the code small and readable. No libraries beyond those listed in SPEC section 1. Domain logic stays pure in `src/domain/`.
- Log every shortcut, mock, or skipped item in `DECISIONS.md` as it happens, using the format in SPEC section 12.
- At the end of each phase: update `PROGRESS.md`, make one clear git commit.
- Never commit secrets or `.env.local`. Firebase web config comes from `VITE_FIREBASE_*` env vars.
- The README and status table must be **honest**. Mark anything simplified, mocked, or missing and say why. Never claim "Done" for something the code does not do.
- The author must be able to explain every part in a live walkthrough. Prefer the simpler design and explain non-obvious choices in comments.

## Context

- The author is a senior iOS developer, new to the web stack. When something is non-obvious (Firebase transactions, `onDisconnect`, dead reckoning), add a short comment explaining it.
- Browser support: modern browsers. Audio is verified on Chrome; Safari may fall back to state-only PTT (documented in README).
- Reviewers: a non-technical person and an AI reviewer who reads the repo and README. Make the repo easy to run from a fresh clone.
