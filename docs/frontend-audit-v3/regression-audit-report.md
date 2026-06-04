# Regression + bug audit report

Date: 2026-05-31
Scope: current dirty worktree for the /play presentation overhaul and adjacent client UI touched by the same work. No commits were created.

## Summary

| Area | Coverage | Result |
|---|---:|---|
| Route matrix | 84 cells: 14 routes x 3 viewports x 2 themes | No P0/P1. No console/page errors, blank pages, or horizontal overflow. P2 contrast findings catalogued. |
| /play phase matrix | 4,480 cells: players 3..18 x 14 phases x 2 factions x 2 themes x 5 viewports | No remaining seat clipping/overlap after fixes. Resource-noise cells were rerun cleanly. |
| Targeted seat repro matrix | 432 cells around players 3..8 plus 9/12/18 regressions | Clean: outside=0, avatarOutside=0, coreHits=0, tokenPairs=0, avatarPairs=0. |
| Cookie banner | Landing mobile, no consent state | Banner visible, in viewport, dismisses to localStorage `cookie-consent=1`. |
| Secret state audit | PlayStage/PlaySeat grep + prop review | Stage receives public data plus targetable/selected IDs only; no private role/result/narrator snapshot on public stage. |
| Night-action audit | Client helper vs server validation read-through + tests | Static target rules match; server-only one-shot/history constraints need future private-state protocol support. |
| Full gate | See command table | Green, except full DB auth e2e cannot run without `DATABASE_URL`; local-only auth e2e passed. |

The original P1 seat clipping bug reported for:

`/play/VISUAL?visualGame=1&phase=night&family=werewolves&viewer=player&role=doctor&players=8`

is fixed in the current dirty worktree. It was verified at 1390x820 and 1366x768, including dark theme, with zero clipped seats and zero collisions with the table core.

## Matrix evidence

### Route matrix

Script evidence: `C:\Users\ADMINI~1\AppData\Local\Temp\werewolf-regression-audit\route-audit.json`

Routes:

- `/`
- `/werewolf`
- `/mafia`
- `/create?visualAuth=1`
- `/werewolf/create?visualAuth=1`
- `/mafia/create?visualAuth=1`
- `/history?visualHistory=fixture`
- `/achievements?visualAuth=1&visualAchievements=fixture`
- `/leaderboard`
- `/faq`
- `/privacy`
- `/terms`
- `/sign-in`
- `/account?visualAuth=1`

Viewports/themes: desktop 1440x900, laptop 1390x820, mobile 390x844, dark and light.

Result:

- 84/84 cells rendered with status 200.
- 0 console errors.
- 0 page errors.
- 0 horizontal overflow failures.
- 0 blank/empty body failures.
- The route audit initially counted `nextjs-portal` in all 84 cells as a framework overlay. Manual inspection showed this is the normal Next route announcer portal, not the Next error overlay. It is not a product failure.
- Axe found P2 contrast issues listed below.

### /play phase matrix

Script evidence:

- `C:\Users\ADMINI~1\AppData\Local\Temp\werewolf-regression-audit\play-seat-phase-matrix-3-3.json`
- `C:\Users\ADMINI~1\AppData\Local\Temp\werewolf-regression-audit\play-seat-phase-matrix-4-7.json`
- `C:\Users\ADMINI~1\AppData\Local\Temp\werewolf-regression-audit\play-seat-phase-matrix-8-11.json`
- `C:\Users\ADMINI~1\AppData\Local\Temp\werewolf-regression-audit\play-seat-phase-matrix-12-15.json`
- `C:\Users\ADMINI~1\AppData\Local\Temp\werewolf-regression-audit\play-seat-phase-matrix-16-18.json`

Coverage:

- players: 3..18
- phases: `lobby`, `role_reveal`, `first_night`, `night`, `day_announcement`, `day_discussion`, `nomination`, `defense`, `voting`, `resolution`, `hunter_revenge`, `mayor_successor`, `paused`, `game_over`
- families: `werewolves`, `mafia`
- themes: dark, light
- viewports: 1366x768, 1390x820, 1440x900, 1920x1080, 390x844

Result:

- Seat geometry checks passed after the fixes: no seat outside `.play-stage`, no avatar outside `.play-stage`, no seat/table-core collision, no seat-seat overlap.
- Three cells in the long matrix hit local Chromium resource noise (`ERR_NO_BUFFER_SPACE` / HMR websocket resource churn). Each affected cell was rerun independently and passed with geometry counts at zero.
- A focused 432-cell retry-aware pass around the reported bug and regressions also passed with `failureCount=0`.

Focused pass details:

- players 3..8 x `lobby/night/day_discussion/voting` x both families x both themes x 1390x820/1366x768/mobile
- players 9, 12, 18 x the same phase/family/theme/viewport subset
- Result: 432 checked, 0 failures.

### Cookie banner

Repro:

1. Clear `localStorage.cookie-consent`.
2. Open `/` at 390x844.
3. Inspect `[data-cookie-banner]`.
4. Click `Разбрах`.

Result:

- Banner is visible in viewport: left 12, right 378, bottom 832 on a 390x844 viewport.
- `role="dialog"` and `aria-label="Бисквитки"` are present.
- Privacy link and dismiss button are reachable.
- Dismiss sets `localStorage.cookie-consent` to `1` and removes the banner.

## Findings

### [P1] /play open-density seats clipped at short laptop heights

Route/cell:

- `/play/VISUAL?visualGame=1&phase=night&family=werewolves&viewer=player&role=doctor&players=8`
- 1390x820 and 1366x768, dark theme
- Also risked players 3..8 across active phases.

Repro:

1. Open the fixture URL above.
2. Use a laptop-height viewport, especially 1390x820 or 1366x768.
3. Inspect bottom seats against `.play-stage`.

Expected:

- Every seat token and avatar remains within `.play-stage`.
- No seat overlaps `.play-table-core`.
- No seat-seat overlap.

Actual before fix:

- Lower medallions could fall below the compressed stage and be clipped by stage overflow.

Root cause:

- `.play-layout` is viewport-height constrained.
- At short heights, `.play-stage` compresses to roughly 360-400px.
- The `<9` open-density branch used an over-tall circular/oval distribution and larger tokens, so lower seats could exceed the available stage bounds.

Fix:

- `apps/web/components/play/PlayStage.tsx`: tuned open-density top/bottom gaps in `getSeatPosition`.
- `apps/web/components/play/PlayRoom.module.css`: tightened open-density table inset and compacted open-density seats/tokens for desktop.
- `apps/web/components/play/PlayRoom.module.css`: restored explicit mobile open-density grid fallback.

Status:

- Fixed SHA-less in current dirty worktree.
- Verified by targeted repro checks and the 432-cell focused pass.

### [P1] /play full/crowded seats could overlap each other or the table core

Route/cell:

- Found during matrix checks around players 12 and 18.
- Highest-risk examples: 1366x768 short desktop and `hunter_revenge` with 13..18 players.

Repro:

1. Open `/play/VISUAL?visualGame=1&phase=hunter_revenge&family=mafia&viewer=player&role=hunter&players=18`.
2. Use 1440x900 and short desktop viewports.
3. Inspect crowded seat placement and table core.

Expected:

- No crowded token overlaps with another token.
- No crowded token overlaps `.play-table-core`.

Actual before fix:

- Crowded seats and the central timer core were too large for some high-count/phase combinations, producing core hits or token-pair overlap.

Root cause:

- The crowded density kept visible names/state and a larger core/timer. In constrained stage heights, the perimeter and core had too little usable space.

Fix:

- `apps/web/components/play/PlayStage.tsx`: moved crowded top/bottom perimeter rows to the ring edges (`y=0` / `y=100`) to maximize vertical space.
- `apps/web/components/play/PlayRoom.module.css`: compacted crowded tokens, avatars, table core, sigil, and timer.
- `apps/web/components/play/PlayRoom.module.css`: added short-height compaction for full-density seats.

Status:

- Fixed SHA-less in current dirty worktree.
- Verified by full matrix reruns and targeted cells for 9, 12, and 18 players.

### [P2] Shared site CTA and brand subtitle fail AA contrast in several route/theme cells

Route/cell:

- `.site-brand-subtitle @ 1.88`: landing/werewolf/mafia/achievements light desktop+laptop examples.
- `nav > .site-play-cta[href$="create"] > span @ 2.38`: many desktop/laptop route cells.
- `.site-primary-band > .site-play-cta[href$="create"] > span @ 2.38`: create/werewolf-create/mafia-create desktop+laptop cells.
- `.site-play-cta-mobile > span @ 2.38`: multiple mobile cells.

Repro:

1. Open any affected route from the route matrix, e.g. `/mafia` or `/create?visualAuth=1`.
2. Run axe color-contrast check in dark/light and desktop/mobile as listed above.

Expected:

- Text contrast >= 4.5:1 for normal text.

Actual:

- Shared gold/cream CTA text and brand subtitle fail AA in axe.

Root cause:

- Shared site chrome uses low-contrast warm gold/cream combinations, especially on light parchment and gold CTA backgrounds.

Proposed fix:

- Tune shared site chrome CTA/subtitle token colors in a dedicated accessibility pass.
- Prefer dark ink text on gold CTA or deepen the gold surface enough to pass AA.

Status:

- For human / later focused PR. Not fixed here because it is P2 shared chrome polish and outside the current P0/P1 regression fix scope.

### [P2] Legal/account secondary labels have borderline/failed contrast

Route/cell:

- `/terms`, dark theme, desktop/laptop/mobile:
  - `section:nth-child(1) > .terms-section-head > .terms-section-kicker @ 3.74`
  - `.terms-examples-not-ok > .terms-examples-label @ 3.32`
- `/account?visualAuth=1`, dark theme, desktop/laptop/mobile:
  - `.account-stat-card:nth-child(1) > .account-stat-hint @ 4.47`
  - `.account-stat-card:nth-child(2) > .account-stat-hint @ 4.47`

Repro:

1. Open `/terms` and `/account?visualAuth=1` in dark theme.
2. Run axe color-contrast.

Expected:

- Secondary labels meet AA contrast.

Actual:

- Terms labels fail AA. Account stat hints are borderline below 4.5:1.

Root cause:

- Secondary text tokens are tuned visually but too muted over dark card surfaces.

Proposed fix:

- Raise dark-theme secondary label luminance or use stronger semantic warning colors for the terms examples.

Status:

- For human / later focused PR. Not fixed here because it is P2 and unrelated to the /play seat regression.

### [P2] Some night-action constraints remain server-only and cannot be fully pre-filtered by the current client snapshot

Route/cell:

- `/play/VISUAL?visualGame=1&phase=night&family=werewolves|mafia&role=<role>`
- Roles with history/one-shot constraints: `healer`, `witch`, `priest`, `blacksmith`, `investigator`, `vampire_hunter`.

Repro:

1. In a real game, reach a later night after a constrained role has already used a one-shot resource or has a last-night target restriction.
2. The client can still render static target choices from `shortcutTargets`.
3. Submit the action; the server rejects invalid history/resource cases.

Expected:

- The client should not offer a target/action the server will reject when the required private-state information is available.

Actual:

- Static constraints are handled:
  - living/dead filters
  - self-target filters
  - first-night-only roles
  - `doctorCanSelfProtect`
  - two-target roles
- Dynamic private-state constraints remain server-only:
  - healer cannot protect the same target two nights in a row
  - witch heal/poison used state
  - priest blessing used/already blessed
  - blacksmith/investigator one-shot used state
  - vampire hunter disarmed state

Root cause:

- Those dynamic facts live in server private state (`PrivatePlayerState`) and are not represented in the public/client snapshot enough for deterministic pre-filtering. The server correctly remains authoritative.

Proposed fix:

- Add a future private, current-viewer-only capability payload such as available night action kinds, used-resource flags, and disallowed target IDs/reasons. Keep it out of public stage DOM.

Status:

- For human / future protocol-private-state refinement. Not fixed here because HARD CONSTRAINTS forbid server/protocol/schema changes in this audit. Current server-side rejection is safe.

### [P3] `apps/web/next-env.d.ts` changed as generated Next type-path churn

Route/cell:

- Build/dev workflow artifact, not a route.

Repro:

1. Run Next dev/build/typecheck flows.
2. Observe `apps/web/next-env.d.ts` flipping from `./.next/dev/types/routes.d.ts` to `./.next/types/routes.d.ts`.

Expected:

- Generated file churn should not pollute the review diff unless intentionally accepted.

Actual:

- The current dirty tree includes:
  - from `import "./.next/dev/types/routes.d.ts";`
  - to `import "./.next/types/routes.d.ts";`

Root cause:

- Next generated type reference is environment-sensitive between dev and production build output.

Proposed fix:

- Before committing, decide whether this generated change belongs in the branch. If not, revert only this file intentionally.

Status:

- For human decision. Not reverted automatically to avoid undoing unreviewed user/generated changes.

## Invariants

| Invariant | Evidence | Result |
|---|---|---|
| No primitive identity override in app CSS | `rg ':global\\(.*\\.(paper-card|scene-card|pill|medallion|surface)|:global\\(\\[data-ds-' apps/web -n` | 0 matches |
| Motion primitive file count unchanged | `rg 'from "motion/react"' packages/ui/src/primitives -n` | 3 matches |
| No source `prefers-reduced-motion` block | `rg 'prefers-reduced-motion' apps/web packages/shared apps/game-server -n` | Only `apps/web/hooks/play/README.md` documentation note |
| Visual fixture production-gated | `apps/web/app/play/[code]/page.tsx`, `apps/web/hooks/play/visual-game-fixture.ts`, `use-game-room.test.tsx` | `visualGame=1` disabled when `NODE_ENV === "production"` |
| Secret role data not in public stage | grep of PlayStage/PlaySeat for `privateRole`, `privateResult`, `privateLover`, `narratorSnapshot`, `roleNameBg` | 0 matches |
| Bulgarian copy hard check | `pnpm check:dict` | 0 hard warnings |

## Gate results

| Command | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | Included in full gate and rerun separately during audit. |
| `pnpm test` | Pass | 31 web files/118 web tests plus shared/ui/game-server suites green. |
| `pnpm regression` | Pass | Contract checks green, including primitive override guard. |
| `pnpm playtest` | Pass | Multi-client GameRoom regression suite green. |
| `pnpm build` | Pass | Next production build generated 37 app routes. |
| `pnpm check:dict` | Pass | 0 hard warnings, 0 legacy-OK hits. |
| `pnpm perf:budget` | Pass | JS/art budgets within thresholds. |
| `git diff --check` | Pass | No whitespace errors. |
| `pnpm frontend:e2e` | Pass | Production build + standalone web/game server + Playwright QA passed. |
| `pnpm e2e:auth` | Not runnable in full DB mode | Failed by design because `DATABASE_URL` is absent. |
| `$env:E2E_LOCAL_ONLY='true'; pnpm e2e:auth` | Pass | Auth gate and sign-in surface passed; DB-backed registration/create/account deletion scenarios skipped by script. |

Non-blocking tooling warnings observed:

- pnpm warns that the `pnpm` field in `package.json` is no longer read for overrides/auditConfig.
- Next/Turbo emitted an IO warning about a long link name under `.next/dev/node_modules/require-in-the-middle...`; commands still exited 0.

## Remaining work for human decision

1. P2 shared chrome/accessibility contrast pass for CTA and brand subtitle.
2. P2 terms/account dark-theme secondary label contrast pass.
3. P2 future private-state capability design for night-action pre-filtering of server-only one-shot/history constraints.
4. P3 decide whether to keep or revert `apps/web/next-env.d.ts` generated type-path churn before committing.

## Final status

P0/P1 findings discovered during this audit are fixed in the current dirty worktree. The required route matrix, /play phase matrix, focused seat repro matrix, invariants, and gates are covered. No commits were created.
