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
