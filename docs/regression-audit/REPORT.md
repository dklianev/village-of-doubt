# Full-stack regression audit · 2026-05-16

## Executive summary

- 🔴 P0 (blocker): 0 findings
- 🟠 P1 (high): 10 findings
- 🟡 P2 (medium): 4 findings
- 🟢 P3 (low): 3 findings

Commands/evidence captured in `docs/regression-audit/logs/`:

- Passed: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm regression`, `pnpm test`, `pnpm smoke`, `pnpm frontend:e2e`, `pnpm e2e:auth`, `pnpm visual`, `pnpm perf:budget`, `pnpm --filter @werewolf/database db:generate`.
- Failed once, then passed on rerun: `pnpm playtest`.
- Failed by design due advisories: `pnpm audit --json`.
- Runtime probe: `node docs/regression-audit/probe-routes.mjs` visited 25 routes and saved 12 screenshots in `docs/regression-audit/screenshots/`.

## Top 10 most urgent

1. [SEC-001](#11-dependency-security): `pnpm audit` reports high severity Next.js and Kysely advisories.
2. [TEST-001](#2-test-failures--flakiness): GameRoom race-condition test is flaky under `pnpm playtest`.
3. [AUTH-001](#7-authorization--secrets-cross-stack): achievements API exposes arbitrary user achievements by query parameter.
4. [DB-001](#9-database-schema-integrity): account deletion conflicts with game-history foreign keys.
5. [TEST-003](#2-test-failures--flakiness): auth E2E exits green while skipping database-backed auth flows.
6. [DEPLOY-001](#10-production-env--deployment-guards): Docker production environment omits Google OAuth and `NEXT_PUBLIC_APP_URL`.
7. [GAME-001](#6-game-server-colyseus-correctness): role assignment can fall back to `Math.random`.
8. [GAME-002](#6-game-server-colyseus-correctness): werewolves and vampires use wipe-out instead of documented parity.
9. [BG-001](#3-bg-only-invariant-violations-user-facing-copy): default 404 page leaks English UI text.
10. [BG-002](#3-bg-only-invariant-violations-user-facing-copy): game-server safe errors use Latin `host`.

## Findings by category

### 1. Build & TypeScript

Verified with `pnpm typecheck` and `pnpm build`; both passed. TypeScript had no hard errors.

Observed but not escalated to a launch blocker:

- Build/visual logs emit Node 24 `[DEP0205] module.register()` deprecation warnings from current tooling.
- Build/frontend-e2e logs include a Turbo warning on Windows: `provided value is too long when setting link name...`.
- `static-type-escapes.log` records a small number of explicit casts and eslint disables. The only production casts found are localized (`sound.ts`, `play-room-client.tsx`) and did not produce build failures.

No P0/P1 build finding was found.

### 2. Test failures & flakiness

**[TEST-001] [P1] [tests] GameRoom race-condition test is flaky under playtest**  
File: `apps/game-server/src/__tests__/GameRoom.race-conditions.test.ts:52`  
Repro: `pnpm playtest` failed once with expected deadPlayers `[race-3]` but received `[]`; immediate rerun passed. Logs: `docs/regression-audit/logs/playtest.log` and `docs/regression-audit/logs/playtest-rerun.log`.  
Impact: CI/release verification can fail nondeterministically, and the test may be advancing the narrator before the concurrent night submissions are fully processed.  
Suggested fix: Make the test wait for both server-side submissions to be accepted before `narratorAdvance`, or add an explicit deterministic helper/ack path for the race-condition contract.

**[TEST-002] [P2] [tests] playtest suite filter does not narrow Vitest to the intended three suites**  
File: `scripts/playtest.mjs:15`  
Repro: `pnpm playtest` output ran all 7 GameRoom tests, including `GameRoom.race-conditions.test.ts`, although `scripts/playtest.mjs` lists only three suites. The spawned command includes a literal `--` after the package script.  
Impact: `pnpm playtest` no longer means the documented multi-client regression subset and can inherit unrelated launch-coverage flakiness.  
Suggested fix: Adjust pnpm/Vitest argument forwarding so the selected suite paths are passed as Vitest filters without the extra literal separator.

**[TEST-003] [P1] [tests] Auth E2E reports success while skipping database-backed flows**  
File: `scripts/e2e-auth.mjs:34`  
Repro: Run `pnpm e2e:auth` without `DATABASE_URL`. It logs `пропуснато: DATABASE_URL липсва` for email registration, authenticated redirect return, and account deletion, then exits 0. CI (`.github/workflows/ci.yml`) does not provide a Postgres service.  
Impact: The standard `pnpm verify` gate can pass without exercising the highest-risk public-launch auth flows.  
Suggested fix: Provide a CI Postgres service and seedable test database for `e2e:auth`, or make skipped critical auth flows fail outside an explicitly marked local-only mode.

Other notes:

- `pnpm test` passed.
- `pnpm regression` passed.
- `pnpm smoke` passed.
- `pnpm frontend:e2e` passed.
- `pnpm visual` passed 30/30 screenshots.
- No `.skip` / `.todo` test markers were found in `apps`, `packages`, or `scripts`.

### 3. BG-only invariant violations (user-facing copy)

**[BG-001] [P1] [bg-copy] Default 404 page leaks English UI text**  
File: `apps/web/app/not-found.tsx:1` (missing file)  
Repro: Open `/this-does-not-exist` or inspect `docs/regression-audit/runtime-probe-results.json`; body text includes `This page could not be found.`  
Impact: Violates the Bulgarian-only UI invariant on a public route.  
Suggested fix: Add a custom `apps/web/app/not-found.tsx` with Bulgarian copy and links back to the main game surfaces.

**[BG-002] [P1] [bg-copy] Game-server safe errors use Latin `host` in user-facing messages**  
File: `apps/game-server/src/rooms/GameRoom.ts:350`  
Repro: Send privileged commands as a non-host client; safe errors include `Само host-ът...` at lines 350, 406, and 444.  
Impact: These safe errors are sent to clients and can appear in the UI, violating the Bulgarian-only copy invariant.  
Suggested fix: Replace `host-ът` with Bulgarian wording such as `домакинът` in all user-facing error strings.

Verified:

- The anonymous-copy grep contract passes (`pnpm regression`).
- Metadata and primary route copy sampled during runtime probe are Bulgarian except the default 404.
- Provider names `Google` and `Discord` were not counted as violations because they are OAuth brand names intentionally shown in the auth UI.

### 4. Frontend runtime errors

Runtime probe covered:

`/`, `/werewolf`, `/mafia`, `/werewolf/create`, `/mafia/create`, `/werewolf/join`, `/mafia/join`, `/werewolf/join/TEST01`, `/mafia/join/TEST01`, `/werewolf/roles`, `/mafia/roles`, `/roles`, `/werewolf/rules`, `/mafia/rules`, `/tutorial`, `/sign-in`, `/lobby`, `/lobby/TEST01`, `/play/TEST01`, `/history`, `/leaderboard`, `/achievements`, `/friends`, `/offline`, `/this-does-not-exist`.

No hydration errors, page errors, request failures, or horizontal overflow were found on the probed routes. Auth-gated routes correctly redirected to `/sign-in?redirect=...`.

Only finding from this category is [BG-001](#3-bg-only-invariant-violations-user-facing-copy): the expected 404 response uses Next's default English page.

### 5. Responsive layout breakage

Verified with:

- `pnpm visual` — 30/30 visual regression screenshots passed.
- `node docs/regression-audit/probe-routes.mjs` — checked `scrollWidth` vs `innerWidth` at desktop probe size and captured desktop/mobile screenshots for 6 key pages.
- Fresh screenshots saved under `docs/regression-audit/screenshots/`.

No responsive layout blocker was found in this audit pass.

### 6. Game-server (Colyseus) correctness

**[GAME-001] [P1] [game-server] Role assignment can fall back to Math.random**  
File: `packages/shared/src/role-assignment.ts:35`  
Repro: Inspect `defaultRandomSource`; when `globalThis.crypto.getRandomValues` is unavailable, it returns `Math.random()`.  
Impact: Violates the project invariant that role assignment must be crypto-based. In a crypto-less runtime/polyfill failure, roles become predictable.  
Suggested fix: Use Node crypto as a server fallback or throw a Bulgarian-safe configuration/runtime error instead of falling back to `Math.random`.

**[GAME-002] [P1] [game-server] Werewolves and Vampires win conditions used wipe-out instead of documented parity rule**  
File: `packages/shared/src/win-conditions.ts:69`  
Repro: Run 2 werewolves vs 2 villagers through `evaluateWinCondition`; pre-fix it returned `{ winner: null }`, while `docs/rules-bg.md:667` documents parity wins. UI role-card copy in `apps/web/components/play-room-client.tsx:2213` already promised "Върколаците да достигнат паритет със селото".  
Impact: Games continued 2+ phases past the documented endgame, frustrating play and contradicting UI promises.  
Suggested fix: Fixed in branch `fix/win-condition-parity` (commit `cd020a1`). Werewolves and vampires now win at parity; mixed WW+Vampires scenario resolves via faction headcount tie-break.

Verified:

- No live role field exists on `PlayerPublicState`; only `revealedRole` is public after death conditions.
- `publicEvents` and `publicChat` are capped at 120/80 respectively.
- `onDispose()` clears `phaseTimer`.
- `verifyGameToken` uses HMAC plus `timingSafeEqual`.
- Reconnect path resends private role only to the reconnecting client.

Related: [TEST-001](#2-test-failures--flakiness) is the practical risk signal for concurrent night submissions.

### 7. Authorization & secrets (cross-stack)

**[AUTH-001] [P1] [authorization] Achievements API exposes arbitrary user achievements by query parameter**  
File: `apps/web/app/api/achievements/route.ts:5`  
Repro: Call `GET /api/achievements?userId=<any-user-id>`; the route reads the user id from the URL and does not call `auth.api.getSession`. The route test at `apps/web/app/api/achievements/__tests__/route.test.ts:48` codifies this behavior.  
Impact: Personal achievements can be enumerated for any known user id despite `/achievements` being auth-gated.  
Suggested fix: Require a Better Auth session in the route and use `session.user.id`; reject mismatched `userId` parameters or remove the parameter entirely.

**[ENV-001] [P2] [authorization] Runtime secret validation is weaker than the documented 32-character invariant**  
File: `packages/shared/src/server.ts:117`  
Repro: `assertUsableSecret` rejects only secrets shorter than 16 characters, while `AGENTS.md` and `scripts/check-production-env.mjs` require 32+ characters. `apps/web/lib/env.ts:7` also validates `BETTER_AUTH_SECRET` with min 16.  
Impact: Local/test runtimes can accidentally exercise weaker-than-production secrets, and the invariant is enforced inconsistently across layers.  
Suggested fix: Align runtime validation and env schema with the 32-character minimum, while keeping explicit test fixtures long enough.

Verified:

- `/sign-in?redirect=...` is sanitized by `safeRedirect`; external URLs and `//host` are rejected.
- `ALLOW_DEV_AUTH=true` is rejected by production env checks and regression contracts.
- No `OAUTH_MOCK` code ships in auth routes/config.
- Game-token production fallback rejects missing/placeholder `GAME_TOKEN_SECRET`.

### 8. API route hygiene (Next.js routes)

**[API-001] [P2] [api] Game-token route signs normalized codes without enforcing room-code length**  
File: `apps/web/app/api/game-token/route.ts:14`  
Repro: POST `{ "code": "ABC" }` to `/api/game-token` with a valid session; line 14 normalizes and line 16 only rejects empty strings.  
Impact: The API can mint tokens for impossible or malformed room codes, pushing validation failure later to the game-server connect path.  
Suggested fix: Validate `roomCode` with the same 4-12 uppercase alphanumeric rule used by the join UI before signing.

Also covered by API route review:

- `/api/game-token` requires a session except local/dev auth fallback.
- `/api/account/delete` requires a session.
- `/api/achievements` is the exception and is listed as [AUTH-001](#7-authorization--secrets-cross-stack).

### 9. Database schema integrity

**[DB-001] [P1] [database] Account deletion conflicts with game-history foreign keys**  
File: `packages/database/src/schema.ts:77`  
Repro: `/api/account/delete` calls Better Auth `deleteUser` at `apps/web/app/api/account/delete/route.ts:23`, but `games.hostId`, `game_players.userId`, and `game_events.actorId/targetId` reference `user.id` without cascade or set-null behavior.  
Impact: Users with persisted games may receive `Не успяхме да изтрием профила.` and remain undeleted, undermining the GDPR deletion flow.  
Suggested fix: Define an account deletion policy: anonymize game-history user references before deletion, or change selected FKs to `onDelete: set null`/cascade where legally and product-wise correct.

Verified:

- `pnpm --filter @werewolf/database db:generate` reported `No schema changes, nothing to migrate`.
- Better Auth tables (`user`, `session`, `account`, `verification`) exist in schema and migrations.
- Hot paths have basic indexes for `games.code`, `games.hostId`, `games.status`, `game_players.gameId`, `game_players.userId`, `game_events.gameId`, and `user_achievements.userId`.

### 10. Production env & deployment guards

**[DEPLOY-001] [P1] [deployment] Docker production environment omits Google OAuth and NEXT_PUBLIC_APP_URL**  
File: `docker-compose.yml:29`  
Repro: Inspect the `web.environment` block: it passes Discord OAuth and `NEXT_PUBLIC_GAME_SERVER_URL`, but not `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `NEXT_PUBLIC_APP_URL`. `scripts/check-production-env.mjs:51` warns only about Discord OAuth.  
Impact: A Docker deployment can silently ship without Google sign-in despite the public-launch UI presenting Google as a primary auth path; URL-dependent metadata/client config can also fall back unexpectedly.  
Suggested fix: Pass Google OAuth variables and `NEXT_PUBLIC_APP_URL` into the web service, and extend production env checks to require or explicitly warn on Google OAuth.

**[DEPLOY-002] [P2] [deployment] Production CSP still allows unsafe inline/eval scripts and non-TLS connect targets**  
File: `Caddyfile:9`  
Repro: Inspect the `Content-Security-Policy` header: `script-src` includes `'unsafe-inline' 'unsafe-eval'`, and `connect-src` includes `http:` and `ws:`.  
Impact: The reverse proxy has useful baseline headers, but CSP is permissive enough to weaken XSS and mixed-content defense for a public launch.  
Suggested fix: Tighten CSP after confirming Next/Sentry requirements: remove `unsafe-eval` in production, move toward nonce/hash-based scripts, and restrict `connect-src` to HTTPS/WSS origins.

Verified:

- Docker Compose has restart policies and Postgres healthcheck.
- Caddy has HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- Game-server CORS is deny-by-default in production when no origins are configured.

### 11. Dependency security

**[SEC-001] [P1] [dependency-security] pnpm audit reports high severity advisories in Next.js and Kysely**  
File: `apps/web/package.json:20`  
Repro: Run `pnpm audit --json`; see `docs/regression-audit/logs/audit.json`. It exits non-zero with 8 high, 6 moderate and 3 low advisories, including Next.js <16.2.6 and Kysely <0.28.17.  
Impact: Public launch would ship known high severity framework advisories, including App Router middleware/proxy bypass, SSRF/DoS classes, and Kysely JSON-path injection risk through drizzle-orm.  
Suggested fix: Upgrade Next.js to a patched version satisfying the audit advisories, and update drizzle-orm/Kysely once compatible patched versions are available; rerun `pnpm audit` and the full verify chain.

Audit summary:

- critical: 0
- high: 8
- moderate: 6
- low: 3

### 12. Performance regressions

Verified with `pnpm perf:budget` after `pnpm build`:

- Total JS gzip: 494.5 KB, budget 550 KB.
- Largest JS gzip: 125.3 KB.
- Largest optimized art: `village-map.webp`, 564.5 KB.

No performance budget violation was found.

### 13. Dead code / unused exports

**[DEAD-001] [P3] [dead-code] Legacy AuthForm component remains unused after sign-in redesign**  
File: `apps/web/components/auth-form.tsx:9`  
Repro: Run `rg -n 'AuthForm|auth-form' apps/web`; the only hits are the component definition and its own CSS class.  
Impact: Dead auth UI code can confuse future changes and still contains pre-redesign behavior/copy surface.  
Suggested fix: Delete `auth-form.tsx` and any orphaned `.auth-form` CSS after confirming no tests or docs depend on it.

No broader `ts-prune` run was performed because it is not installed and the audit constraints said not to add dependencies.

### 14. TODO / FIXME / HACK debt

**[TODO-001] [P3] [todo-debt] Launch-visible stats TODOs remain in landing quickstart**  
File: `apps/web/components/landing/QuickStartSection.tsx:182`  
Repro: Run `rg -n 'TODO|FIXME|HACK|XXX|@deprecated' apps packages scripts docs`; TODOs remain at lines 182 and 214 for family/byFamily stats, plus `packages/shared/src/game-config.ts:66` for promo rules.  
Impact: Not a blocker, but the home quickstart data story still has known incomplete stats wiring.  
Suggested fix: Either wire the missing stats fields or move the TODOs to a tracked issue and simplify the code comments.

### 15. Documentation drift

**[DOC-001] [P3] [documentation] AGENTS.md command and stack notes drift from current scripts**  
File: `AGENTS.md:18`  
Repro: Inspect `AGENTS.md`: auth stack mentions Discord but not Google; `pnpm test` still says 39 tests; `pnpm verify` omits `frontend:e2e`, `e2e:auth`, `visual`, and `perf:budget`; hook docs reference `.husky` while the repo uses `.githooks/pre-commit`.  
Impact: New agents and contributors can rely on stale launch instructions and miss the real verification chain.  
Suggested fix: Update AGENTS.md to match current auth providers, test counts, verify chain, and hook location.

Verified:

- `.env.example` and `.env.local.example` include Google and Discord OAuth variables.
- `docs/auth-setup.md` documents Google and Discord callback URLs.
- `docs/testing.md` is closer to the current verify chain than `AGENTS.md`.

## Findings index by file

`AGENTS.md`

- [DOC-001] (P3): command and stack notes drift from current scripts.

`Caddyfile`

- [DEPLOY-002] (P2): production CSP still allows unsafe inline/eval scripts and non-TLS connect targets.

`apps/game-server/src/__tests__/GameRoom.race-conditions.test.ts`

- [TEST-001] (P1): race-condition test is flaky under playtest.

`apps/game-server/src/rooms/GameRoom.ts`

- [BG-002] (P1): user-facing safe errors use Latin `host`.

`apps/web/app/api/achievements/route.ts`

- [AUTH-001] (P1): achievements API exposes arbitrary user achievements by query parameter.

`apps/web/app/api/game-token/route.ts`

- [API-001] (P2): game-token route signs normalized codes without enforcing room-code length.

`apps/web/app/not-found.tsx`

- [BG-001] (P1): missing custom 404 page leaks English default UI text.

`apps/web/components/auth-form.tsx`

- [DEAD-001] (P3): legacy `AuthForm` component remains unused.

`apps/web/components/landing/QuickStartSection.tsx`

- [TODO-001] (P3): launch-visible stats TODOs remain.

`apps/web/package.json`

- [SEC-001] (P1): Next.js version is covered by high severity audit advisories.

`docker-compose.yml`

- [DEPLOY-001] (P1): web service omits Google OAuth and `NEXT_PUBLIC_APP_URL`.

`packages/database/src/schema.ts`

- [DB-001] (P1): account deletion conflicts with game-history foreign keys.

`packages/shared/src/role-assignment.ts`

- [GAME-001] (P1): role assignment can fall back to `Math.random`.

`packages/shared/src/win-conditions.ts`

- [GAME-002] (P1): werewolves and vampires used wipe-out instead of documented parity.

`packages/shared/src/server.ts`

- [ENV-001] (P2): runtime secret validation is weaker than documented invariant.

`scripts/e2e-auth.mjs`

- [TEST-003] (P1): auth E2E reports success while skipping database-backed flows.

`scripts/playtest.mjs`

- [TEST-002] (P2): playtest suite filter does not narrow Vitest to intended suites.

## Recommended fix order

1. Patch dependency advisories first: Next.js and Kysely/drizzle path, then rerun full verify.
2. Fix auth/data privacy issues: achievements API session enforcement and account deletion/FK policy.
3. Stabilize verification: race-condition test, playtest filtering, and auth E2E database coverage in CI.
4. Fix public-launch deployment env: Google OAuth variables, `NEXT_PUBLIC_APP_URL`, and production env checker coverage.
5. Fix BG-only violations: custom 404 and `host-ът` safe errors.
6. Fix gameplay correctness drift: werewolves/vampires parity resolution and hunter-revenge ordering coverage.
7. Tighten security posture: crypto-only role assignment, secret minimum consistency, CSP.
8. Clean low-risk drift: dead `AuthForm`, TODOs, and `AGENTS.md`.

## What was NOT audited

- No destructive DB operations were run. `pnpm test:migrations` was intentionally skipped because it drops/recreates a test database.
- `pnpm loadtest` was not run because it is bursty and requires an intentionally running game-server target; this remains pre-release manual verification.
- No accessibility audit was performed; this was explicitly out of scope.
- Dependency advisories were not exploit-tested; this report treats `pnpm audit` as source evidence and recommends upgrades.
- The untracked `audit-v3/desktop`, `audit-v3/mobile`, and `docs/frontend-audit-v3` folders were read only lightly for overlap context and were not modified by this audit.

## Fix verification (2026-05-16)

All 16 findings from the 2026-05-16 audit have been addressed in branch `fix/regression-audit-followup`.

| ID | Status | Commit |
|---|---|---|
| SEC-001 | ✅ Fixed | 5aa4528 |
| AUTH-001 | ✅ Fixed | 269337e |
| DB-001 | ✅ Fixed | f4c88dd |
| TEST-001 | ✅ Fixed | e735283 |
| TEST-003 | ✅ Fixed | 41398c5 |
| DEPLOY-001 | ✅ Fixed | ba8fb35 |
| GAME-001 | ✅ Fixed | 66771c9 |
| BG-001 | ✅ Fixed | b7f7e44 |
| BG-002 | ✅ Fixed | e8c0147 |
| API-001 | ✅ Fixed | 1b3710f |
| ENV-001 | ✅ Fixed | 8a0f016 |
| TEST-002 | ✅ Fixed | 50006a6 |
| DEPLOY-002 | ✅ Fixed | 6e37b19 |
| DEAD-001 | ✅ Fixed | b01206f |
| TODO-001 | ✅ Fixed | 22c84a9 |
| DOC-001 | ✅ Fixed | d0c3536 |
