# Testing strategy

Pre-launch verification is layered so fast contracts catch regressions before slower browser and load checks.

## Standard chain

`pnpm verify` runs:

1. `pnpm optimize:assets`
2. `pnpm regression`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm smoke`
6. `pnpm frontend:e2e`
7. `pnpm e2e:auth`
8. `pnpm playtest`
9. `pnpm test`
10. `pnpm visual`
11. `pnpm perf:budget`

## Heavy preflight

`pnpm verify:heavy` extends the standard chain with migration and Colyseus load checks:

- `pnpm test:migrations`
- `pnpm loadtest`

These require a local PostgreSQL instance and a running game-server target, so they stay out of the default push path.

## Coverage map

- Shared unit tests cover tokens, role assignment, phase vocabulary, config, achievements and win conditions.
- Game-server integration tests cover security boundaries, reconnect, full night/day/vote flow, mayor succession and concurrent night submissions.
- Web component tests cover the lobby wizard, auth chip, OAuth buttons, tutorial clue chips and leaderboard headline rendering.
- API contract tests call Next route handlers directly for game tokens, achievements and account deletion.
- Browser scripts cover public page rendering, auth gates and sign-in flow basics.
- Visual snapshots live in `apps/web/__visual__/__baseline__/` and compare desktop plus mobile routes.
- Bundle budgets inspect the production build with gzip sizes.

No accessibility tooling is included in this launch pass by explicit product direction.
