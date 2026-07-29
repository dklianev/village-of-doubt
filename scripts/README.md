# Scripts

Production operations are documented in
[`docs/operations/production-runbook.md`](../docs/operations/production-runbook.md).
The PostgreSQL backup timer units live under `ops/systemd/`.

## Production quality gates

- `pnpm operations:test` checks that backup scheduling, freshness verification,
  off-site copy support, and recovery documentation remain wired.
- `pnpm frontend:e2e` runs the production-build browser flow in Chromium.
- `pnpm frontend:e2e:cross-browser` runs the same flow in Chromium, Firefox, and
  WebKit.
- `pnpm lighthouse` audits the landing, tutorial, rules, and sign-in routes with
  desktop and mobile Lighthouse profiles.
- `pnpm loadtest:launch` exercises the measured launch target of 200 concurrent
  clients. `pnpm loadtest:heavy` is the 500-client stress profile.

`pnpm verify:heavy` combines the normal release gate with migration testing,
cross-browser QA, Lighthouse, and the stress profile. It is the candidate-release
gate, not a fast local edit loop.

## Dictionary check

Run `pnpm check:dict` before opening a PR. Warns only and exits 0.

Policy: hard `[warn]` items (English in JSX, anglicisms) must be fixed.
`[legacy]` items (Постижения vs Легенди) are accepted in Phase Б.

Future: this script may flip to enforcing after a parallel copy-migration PR.
