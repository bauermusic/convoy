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
