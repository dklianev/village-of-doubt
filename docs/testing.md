# Testing strategy

Pre-launch verification is layered so fast contracts catch regressions before slower browser and load checks.

## Standard chain

`pnpm verify` runs:

1. `pnpm verify:assets`
2. `pnpm regression`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm smoke`
6. `pnpm frontend:e2e`
7. `pnpm e2e:auth`
8. `pnpm playtest`
9. `pnpm test`
10. `pnpm visual`
11. `pnpm visual:ui`
12. `pnpm perf:budget`
13. `pnpm audit:prod`
14. `pnpm check:dict`

## Heavy preflight

`pnpm verify:heavy` extends the standard chain with migration and Colyseus load checks:

- `pnpm test:migrations`
- `pnpm loadtest`

Migration tests require a local PostgreSQL instance. The load test is hermetic by default: it starts a local game-server, creates signed test tokens, fills shared rooms, marks every player ready and starts every room. A single failed join, server room error, stats sample, unexpected leave or unsynchronised player count fails the gate; there is no percentage tolerance. The gate also enforces join p95, event-loop utilization and RSS limits over a 10-second observation window using the loopback-only `/operations/stats`. When `DATABASE_URL` points to a localhost database whose name contains `test` or `e2e`, every started room must appear in persistence and run-scoped rows are cleaned afterwards. External targets must provide an explicitly authorized `LOAD_STATS_URL` because runtime memory data is not public.

`pnpm loadtest:heavy` is the separate 500-client, two-minute soak. It is intentionally outside the ordinary CI load gate and uses broader resource budgets.

## Coverage map

- Shared unit tests cover tokens, role assignment, phase vocabulary, config, achievements and win conditions.
- Game-server integration tests cover security boundaries, reconnect, full night/day/vote flow, mayor succession and concurrent night submissions.
- Web component tests cover the lobby wizard, auth chip, OAuth buttons, tutorial clue chips and leaderboard headline rendering.
- API contract tests call Next route handlers directly for game tokens, achievements and account deletion.
- Browser scripts cover public page rendering, sign-in flow basics and a six-browser shared-room flow. The multiplayer flow requires `FRONTEND_E2E_DATABASE_URL` or `DATABASE_URL` to name a localhost `*test*`/`*e2e*` database. It seeds run-scoped Better Auth credential users, signs every browser in through the production `/api/auth/sign-in/email` endpoint, verifies the signed session cookie, obtains game tokens through the unmocked web route and starts a real Colyseus game over WebSocket with `ALLOW_DEV_AUTH=false`. Teardown deletes only those run-scoped users.
- Visual snapshots live in `apps/web/__visual__/__baseline__/` and compare desktop plus mobile routes.
- Bundle budgets inspect the production build with gzip sizes.

Accessibility checks run with the visual suites for the UI primitives and route audits.

## Focused play checks

The default `pnpm frontend:e2e` still runs the full browser gate. With the same
local test PostgreSQL and Redis configuration, `FRONTEND_E2E_FOCUS=play` runs
the real six-browser flows for both games and the token-retry case. These cover
private night investigations, accepted votes, socket reconnect, reload,
persisted finales, replay/back navigation and a fresh room. Native audio is
observed by decoded-file hash, including duplicate and overlap checks; it is
not replaced with a playback mock. Headless playback is not a listening test.
The Windows WebKit binary lacks Web Audio: that combination explicitly reports
native narration as unverified while still requiring the complete game flow.
Other browser/platform combinations must provide working native audio.

`FRONTEND_E2E_FOCUS=performance` runs a separate Chromium-only production
profile with 30 seeded test accounts, a signed SDK roster and one authenticated
mobile browser. It measures 12/30-player Werewolf and 12/24-player Mafia tables
at 390x844 with 4x CPU throttling. The reported click-to-paint estimate, long
tasks and memory counters are laboratory samples, not field INP or real-phone
measurements. Run before and after builds on an otherwise idle machine; compare
several runs before treating small timing changes as improvements.

Use `FRONTEND_E2E_ARTIFACT_DIR` for an external screenshot/JSON directory and
`FRONTEND_E2E_PERF_LABEL` to distinguish samples. `FRONTEND_E2E_SKIP_BUILD=true`
is only appropriate when the current production build already targets the test
ports. Focused runs do not replace the full regression gate or weaken budgets.
