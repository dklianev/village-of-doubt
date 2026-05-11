# Frontend Visual Audit

Date: 2026-05-11
Base URL: http://localhost:3000
Commit audited: 618c56c (main / origin/main)

## Method

- Read AGENTS.md and confirmed the latest main commit with `git log -1`.
- Started local dev servers with `pnpm dev`.
- Verified health endpoints:
  - `http://127.0.0.1:3000/api/health`
  - `http://127.0.0.1:2567/health`
- Used Playwright MCP first for browser screenshots. MCP batch capture hit runtime limits (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`, then route-transition context loss), so the bulk capture continued with regular Playwright against the same local dev server.
- Viewports:
  - Mobile: 390x844
  - Tablet: 820x1180
  - Desktop: 1440x900
  - Big desktop: 1920x1080
- Screenshots are stored under `docs/frontend-audit/<route-slug>/<route-slug>_<viewport>.png`.
- Raw automated DOM scan is stored in `docs/frontend-audit/audit-raw.json`.

## Issue Tags

- `[overlap]` elements visually collide or force horizontal overflow.
- `[image-size]` image/card sizing is unstable, blank, clipped, or distorted.
- `[mobile]` mobile breakpoint or touch target polish problem.
- `[sticky]` sticky/fixed element detaches or behaves as visual obstruction.
- `[spacing]` uneven spacing/alignment visible across surfaces.
- `[text-overflow]` text is clipped or squeezed by layout constraints.
- `[empty-state]` empty surfaces are visually weak or broken.
- `[touch-target]` visible mobile controls fall below the 44px target requested for this pass.
- `[layering]` fixed/dev/bottom-sheet elements compete in the same visual layer.

## Findings

### /werewolf/roles

#### Mobile 390
Screenshot: `docs/frontend-audit/werewolf-roles/werewolf-roles_mobile.png`

- `[image-size] [empty-state]` Role codex cards after the first visible items become large blank paper panels in full-page capture. File: `apps/web/app/globals.css` around `.role-codex-card`. Likely cause: `content-visibility: auto` with `contain-intrinsic-size` prevents offscreen role content from rendering in deterministic full-page screenshots and can flash blank during fast scrolling.
  Fix: remove `content-visibility` from `.role-codex-card` or scope it away from audit-critical cards.

#### Tablet 820
Screenshot: `docs/frontend-audit/werewolf-roles/werewolf-roles_tablet.png`

- `[text-overflow] [image-size]` Two-column role grid stays active at tablet width. Each card still uses an internal art+copy grid, so titles and copy become squeezed/clipped. File: `apps/web/app/globals.css` around `.role-codex-grid` and `.role-codex-card`.
  Fix: collapse `.role-codex-grid` to one column earlier, around max-width 1100px.

#### Desktop 1440 / Big Desktop 1920
Screenshots:
- `docs/frontend-audit/werewolf-roles/werewolf-roles_desktop.png`
- `docs/frontend-audit/werewolf-roles/werewolf-roles_wide.png`

- `[image-size] [empty-state]` Same blank offscreen role-card issue appears in full-page screenshots. The first viewport is visually fine, but the rest of the long role list becomes blank paper panels.
  Fix: same `.role-codex-card` content-visibility removal.

### /mafia/roles

#### Mobile 390
Screenshot: `docs/frontend-audit/mafia-roles/mafia-roles_mobile.png`

- `[image-size] [empty-state]` Mafia role cards after the first visible cards become blank paper panels for the same `.role-codex-card` reason.
  Fix: remove or change `content-visibility` on `.role-codex-card`.

#### Tablet 820
Screenshot: `docs/frontend-audit/mafia-roles/mafia-roles_tablet.png`

- `[text-overflow] [image-size]` Mafia role cards remain in the cramped two-column layout at tablet width.
  Fix: same earlier one-column tablet collapse for `.role-codex-grid`.

#### Desktop 1440 / Big Desktop 1920
Screenshots:
- `docs/frontend-audit/mafia-roles/mafia-roles_desktop.png`
- `docs/frontend-audit/mafia-roles/mafia-roles_wide.png`

- `[image-size] [empty-state]` Offscreen cards render as blank paper panels in deterministic full-page screenshots.
  Fix: same `.role-codex-card` content-visibility removal.

### /roles

#### Mobile 390 / Tablet 820 / Desktop 1440 / Big Desktop 1920
Screenshots:
- `docs/frontend-audit/roles/roles_mobile.png`
- `docs/frontend-audit/roles/roles_tablet.png`
- `docs/frontend-audit/roles/roles_desktop.png`
- `docs/frontend-audit/roles/roles_wide.png`

- `[image-size] [empty-state]` The aggregate roles route shares the same role codex implementation and shows the same blank offscreen cards in full-page capture.
  Fix: same `.role-codex-card` content-visibility removal.

### /werewolf/rules

#### Tablet 820
Screenshot: `docs/frontend-audit/werewolf-rules/werewolf-rules_tablet.png`

- `[overlap] [text-overflow]` The phase detail card bleeds past the right edge and creates 77px horizontal overflow. File: `apps/web/app/globals.css` around `.rules-phase-lab`.
  Fix: collapse `.rules-phase-lab` before tablet width, around max-width 1100px.

#### Mobile 390
Screenshot: `docs/frontend-audit/werewolf-rules/werewolf-rules_mobile.png`

- No hard overflow after the existing mobile collapse. The floating dev badge appears over the left edge in dev screenshots, but it is a Next/dev overlay, not app UI.

### /mafia/rules

#### Tablet 820
Screenshot: `docs/frontend-audit/mafia-rules/mafia-rules_tablet.png`

- `[overlap] [text-overflow]` Same 77px horizontal overflow as the Werewolf rules page. File: `apps/web/app/globals.css` around `.rules-phase-lab`.
  Fix: same earlier collapse.

### Shared Mobile Chrome

#### Affected mobile screenshots
Examples:
- `docs/frontend-audit/home/home_mobile.png`
- `docs/frontend-audit/werewolf-create/werewolf-create_mobile.png`
- `docs/frontend-audit/mafia-create/mafia-create_mobile.png`
- `docs/frontend-audit/werewolf-join/werewolf-join_mobile.png`
- `docs/frontend-audit/mafia-join/mafia-join_mobile.png`

- `[mobile] [touch-target]` Header navigation links and chrome controls are visually readable but below the requested 44px touch target on mobile. File: `apps/web/app/globals.css` around `.site-nav a`, `.site-sound-toggle`, `.site-theme-toggle`, and the mobile media block.
  Fix: add an explicit `@media (max-width: 480px)` rule with `min-height: 44px` and centered inline-flex controls.

### Lobby Wizard Mobile

#### /lobby and /werewolf/create mobile 390
Screenshots:
- `docs/frontend-audit/lobby-create/lobby-create_mobile.png`
- `docs/frontend-audit/werewolf-create/werewolf-create_mobile.png`

- `[layering]` The fixed `.mobile-summary-chip` appears over the flow during full-page screenshots. This is expected for a fixed bottom sheet trigger, but it should keep enough bottom padding and not cover final actionable content.
  Fix: no Phase 2 change unless re-audit shows it blocks a button after other mobile spacing changes.

### /play routes

#### Mobile 390 / Desktop 1440
Screenshots:
- `docs/frontend-audit/play-werewolf/play-werewolf_mobile.png`
- `docs/frontend-audit/play-mafia/play-mafia_desktop.png`
- `docs/frontend-audit/play-spectator/play-spectator_mobile.png`

- `[spacing]` Play pages are visually dense but no route-level horizontal overflow was found. The dev badge appears in screenshots but is not app UI. Keep under observation during final re-audit after global mobile chrome changes.

### Utility Routes

#### /history, /leaderboard, /friends, /achievements, /tutorial, /sign-in
Screenshots:
- `docs/frontend-audit/history/history_mobile.png`
- `docs/frontend-audit/leaderboard/leaderboard_mobile.png`
- `docs/frontend-audit/friends/friends_mobile.png`
- `docs/frontend-audit/achievements/achievements_mobile.png`
- `docs/frontend-audit/tutorial/tutorial_mobile.png`
- `docs/frontend-audit/sign-in/sign-in_mobile.png`

- No blocking visual regressions found in Phase 1. Empty states are designed cards rather than raw placeholder text.

## Phase 2 Fix Plan

1. `[overlap]` Collapse `.rules-phase-lab` at tablet widths before it overflows.
2. `[image-size] [text-overflow] [empty-state]` Remove `content-visibility` from role codex cards and collapse role codex to one column at tablet widths.
3. `[mobile] [touch-target]` Add max-width 480px mobile chrome target sizing and add regression hygiene contracts.
4. Re-screenshot affected routes and append re-audit notes after fixes.
