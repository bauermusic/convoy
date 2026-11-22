# Kickoff prompts

Paste the first one into a fresh Claude Code session started in the repo folder. Use the second for every later session.

## First session

```
Read CLAUDE.md, SPEC.md, BRIEF.md and PROGRESS.md. Then implement Phase 0 only, following the Firebase checklist in SPEC section 8. Where a step needs me to act in the Firebase console, stop and tell me exactly what to do. When Phase 0 is done, update PROGRESS.md, commit, and summarize what exists and what I should verify.
```

## Every later session

```
Read CLAUDE.md, SPEC.md, BRIEF.md and PROGRESS.md. Continue with the next unfinished phase only. Stop at the end of that phase, run typecheck and tests, update PROGRESS.md and DECISIONS.md, commit, and summarize.
```

## Last session (README)

```
Read everything, then do Phase 6. Review the code against BRIEF.md and fill in the README requirements status table honestly, matching what the code actually does. Flag anything in SPEC.md that I did not implement.
```

## Wrap-up session (leftovers + pitch preparation)

```
Read CLAUDE.md, PROGRESS.md, README.md, DECISIONS.md and BRIEF.md (SPEC.md only if needed).

Status: all build phases are done, including optional Phase 7 (recorded voice messages).
Live: https://convoy-hud-poc.web.app · Repo: https://github.com/bauermusic/convoy
Latest work, all committed and deployed: map follow mode, voice messages, car-following
(cars queue behind a stopped car), and recovery of seats held by frozen tabs / locked phones.
npm run typecheck and npm test (29 tests) pass.

Working preferences for this session:
- Verify changes locally first (dev server, test sessions like ?sid=qa…, then delete them).
  Deploy only for a device test or when I ask, and ask before deploying.
- Keep README, DECISIONS.md and PROGRESS.md honest and in sync with any change.

Leftovers, in this order:
1. Help me verify on devices: open the live link on the iPhone, lock it, and confirm the
   seat is taken over after ~15 s and that the phone gets a seat back when unlocked.
2. Untested (my Mac has no microphone): voice from Chrome to the iPhone, and the mic in
   Chrome on iOS. Decide with me whether to test with another device or just document it.
3. Minor, probably leave as is unless cheap: PULL OVER hold isn't keyboard-accessible;
   after the 8 s / 30 s cut-off you must lift and press again; Vite warns the bundle is
   just over 500 kB (Firebase SDK); anonymous Firebase users accumulate.
4. My side: fill in the time log in PROGRESS.md; reset the `demo` session right before
   submitting.

Then the main task: prepare my presentation.
- What the app does from a user's point of view (3 cars on a real mountain road, positions
  simulated; hold-to-talk voice messages; split alert; pull over with queueing; lost contact
  and takeover; empty seats driven by the app).
- Brief vs delivered, with honest caveats (simulated positions, voice is recorded not live,
  tested iPhone Safari → Mac Chrome only).
- A ~12 minute talk: problem (30 s), live demo (4 min, laptop as lead + iPhone landscape as
  tail), how it works (3 min), trade-offs (2 min), how it was verified incl. bugs found
  (1 min), what I would do with two more weeks (2 min, prioritised: live WebRTC audio,
  real GPS + server-checked positions, network-drop handling, security/scale,
  CarPlay/Android Auto, accessibility + end-to-end tests).
- A demo script and pre-demo checklist, and short answers to likely questions (why no
  server, two people tapping the same seat, the host leaving, why audio in the database,
  scaling to 1,000 convoys, security).
Ask me which format I want (slides, speaker notes, or both) before producing it.
```
