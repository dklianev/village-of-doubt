# Codex prompt — PR M25-M30: Round 2 Legacy Visual Islands

**Scope**: continue the legacy visual islands pattern from M19-M24 (privacy, terms, report, status, faq, friends, history, achievements, tutorial). Six more route groups port to fidelity-match commit `69bbcca8`:

- M25 — `/sign-in` (pilot)
- M26 — `/account` dashboard (7 components)
- M27 — `/leaderboard` newspaper (7 components)
- M28 — `/create` flow (`/create` + `/werewolf/create` + `/mafia/create` + LobbyWizard + step components)
- M29 — `/history/[gameId]/replay`
- M30 — `/lobby/[code]` waiting room

**Effort**: ~8-10 hours, 6 PRs (logical per route group).

**Goal**: visual 1:1 match with pre-primitives commit `69bbcca8` for ALL remaining heavily-primitive-using routes. After this round, primitives chapter shrinks to: landing pages (`/`, `/werewolf`, `/mafia`), role pages (`/werewolf/roles`, `/mafia/roles` — already mixed), `ArtifactImage` utility. Everything else becomes legacy islands.

---

## Inherits everything from M19-M24 legacy islands master plan

This PR series follows the SAME pattern Codex established in M19-M24 (round 1 legacy islands). Specifically:

- Per-page `LegacyXXX.module.css` file in component directory
- Header comment on each module: `/* Legacy visual island. Fidelity target: 69bbcca8. Do not migrate to primitives without design approval. */`
- No `@werewolf/ui` primitive imports in ported pages (where pre-primitives didn't use them)
- Workflow: `git show 69bbcca8:path > temp` → manual port → reapply modern fixes
- Anti-pattern guard already configured to allow page-namespaced `:global(.shell-class)` selectors
- Modern fixes preserved: Bulgarian copy migration, metadata title fix, hydration warnings resolved, `data-faction` separation, asset diet (no wholesale public/ restore)
- `globals.css` stays thin (currently ~3,933 LOC, must not bloat)

---

## Operating rules (cumulative)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. Revert if red.
2. Per-PR visual gate: `pnpm visual --grep "<route-pattern>"` + manual diff review BEFORE baseline update.
3. **Compare against `:3101`** (pre-primitives dev server) — every page should reach pixel-level parity.
4. **NO `:global([data-ds-*])` overrides.** Anti-pattern guard stays FAIL.
5. **NO new dependencies. No new fonts. No new Motion imports.** Motion file count stays 3.
6. **NO `prefers-reduced-motion` guards.** Project convention.
7. **Bulgarian copy stays canonical** (post-PR-F spec terms). Legacy strings re-migrate as needed during port.
8. **Sacred files frozen** — game-server, play-room-client, primitive APIs (Pill, Dialog, etc. continue to exist for landing + utility use).
9. **Per-route auth/fixture handling** — same pattern as M19-M24 round 1 (visualAuth=1, visualHistory=fixture, etc.).
10. **Logical commits per page** — NOT one mega-commit. Each PR is one route group with 3-7 commits inside.
11. **`bg-copy-reviewer` agent runs after every commit touching JSX text** — even if text appears unchanged (port may have shifted legacy strings).
12. **Modern fixes layer LAST** — port DOM/class structure first, then reapply Bulgarian copy + title meta + hydration fixes.

---

## Pre-flight verification

```bash
# Confirm M19-M24 round 1 landed (committed or uncommitted)
test -f apps/web/components/privacy/LegacyPrivacy.module.css && echo "✓ M19-M24 round 1 visible"
test -f apps/web/components/history/LegacyHistory.module.css && echo "✓ history ported"
test -f apps/web/components/achievements/LegacyAchievements.module.css && echo "✓ achievements ported"

# Pre-primitives worktree available
test -d "E:/werewolf_mafia_pre_primitives_69bbcca8/apps/web" && echo "✓ pre-primitives source available"

# Pre-primitives dev server on :3101 (if running for visual comparison)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3101 2>&1 | grep -q 200 && echo "✓ pre-primitives server up"

# Current state baselines
grep -l "@werewolf/ui" apps/web/components/account/*.tsx \
                       apps/web/components/leaderboard/*.tsx \
                       apps/web/components/sign-in/*.tsx \
                       apps/web/components/lobby/*.tsx | wc -l
# Expected: ~20+ (these are what we're porting)

# Architectural invariants
rg ":global\(\[data-ds-" apps/web | wc -l    # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l  # MUST be 3
pnpm regression 2>&1 | tail -3                # green
```

---

## PR M25 — `/sign-in` Legacy Island (pilot, ~1h)

### Why pilot
Smallest scope, fewest components (3 files: page.tsx + 3 helpers). Establishes pattern for subsequent PRs in this round.

### Files to port

**Current state** (post-primitives):
- `apps/web/app/sign-in/page.tsx`
- `apps/web/components/sign-in/EmailPasswordForm.tsx`
- `apps/web/components/sign-in/OAuthButton.tsx`
- `apps/web/components/sign-in/SignInStage.tsx`
- (possibly other helper components)

**Pre-primitives source**:
- `E:/werewolf_mafia_pre_primitives_69bbcca8/apps/web/app/sign-in/page.tsx`
- `E:/werewolf_mafia_pre_primitives_69bbcca8/apps/web/components/sign-in/EmailPasswordForm.tsx`
- `E:/werewolf_mafia_pre_primitives_69bbcca8/apps/web/components/sign-in/OAuthButton.tsx`
- `E:/werewolf_mafia_pre_primitives_69bbcca8/apps/web/components/sign-in/SignInStage.tsx`

### Workflow

For each file:

```bash
# 1. Read pre-primitives source
git show 69bbcca8:apps/web/components/sign-in/SignInStage.tsx > /tmp/SignInStage-legacy.tsx

# 2. Manual port (NOT blind overwrite)
# - Copy DOM/JSX structure
# - Copy class name references
# - Remove @werewolf/ui imports
# - Replace primitive components with raw HTML/page-local classes
# - Verify event handlers + state logic match current behavior

# 3. Apply modern fixes layer
# - Title metadata: no duplicate brand suffix
# - Bulgarian copy: "Постижения" → "Легенди" etc. (none expected on /sign-in but check)
# - Hydration warning fix: ensure consistent server/client render
# - data-faction not data-theme for any faction styling
```

### Create `LegacySignIn.module.css`

```bash
# Identify sign-in styles in pre-primitives globals.css
# Search for: .sign-in-*, .auth-stage-*, .oauth-button-*, etc.
git show 69bbcca8:apps/web/app/globals.css | grep -nE "^\.(sign-in|auth-stage|oauth-|email-form)"
```

Extract those CSS blocks into `apps/web/components/sign-in/LegacySignIn.module.css`:

```css
/* Legacy visual island. Fidelity target: 69bbcca8. Do not migrate to primitives without design approval. */
:global(.sign-in-shell) { ... }
:global(.auth-stage) { ... }
/* etc. */
```

### Commits (4):

```
1. feat(sign-in): port SignInStage to legacy island matching 69bbcca8
2. feat(sign-in): port EmailPasswordForm to legacy markup
3. feat(sign-in): port OAuthButton to legacy markup
4. chore(sign-in): reapply hydration fix and metadata title
```

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "sign-in"

# Manual: open localhost:3000/sign-in and localhost:3101/sign-in side-by-side
# - Compare hero/banner/welcome stage
# - Compare OAuth button styling
# - Compare email form input chrome
# - Compare error states
# - Verify mobile responsiveness matches pre-primitives
# - Verify no console hydration warnings
```

### Failure modes

| Symptom | Fix |
|---|---|
| Hydration warning returns | Apply M10 hydration fix patch (see git log for `fix(sign-in): resolve hydration mismatch`) |
| OAuth button missing hover state | Pre-primitives `.oauth-button:hover` rule missing from extracted CSS — re-extract |
| Email form input doesn't focus correctly | Verify modern form state logic preserved during port |
| Mobile sign-in stacked wrong | Pre-primitives media query for sign-in not ported — check globals.css around `@media` blocks |
| `data-theme` returns for faction | Replace with `data-faction` per project convention |

---

## PR M26 — `/account` Dashboard Legacy Island (~2h)

### Files to port

**Current state** (8 files):
- `apps/web/app/account/page.tsx`
- `apps/web/components/account/AccountAchievements.tsx`
- `apps/web/components/account/AccountDangerZone.tsx`
- `apps/web/components/account/AccountDashboard.tsx`
- `apps/web/components/account/AccountDataExport.tsx`
- `apps/web/components/account/AccountHero.tsx`
- `apps/web/components/account/AccountProfile.tsx`
- `apps/web/components/account/AccountRecentGames.tsx`
- `apps/web/components/account/AccountStats.tsx`

### Sacred file warning

`AccountDangerZone.tsx` is in the **sacred preservation list** (since v2 of redesign work). Its body logic MUST stay intact (destructive flow). Only outer wrapper / shell styling can change.

For Danger Zone:
- ✅ OK to remove `Dialog` primitive usage from wrapper
- ✅ OK to replace SceneCard/PaperCard shell with raw markup
- ❌ DO NOT change confirmation flow logic
- ❌ DO NOT alter delete/disable/export logic
- ❌ DO NOT change form validation

### Create `LegacyAccount.module.css`

Extract from pre-primitives globals.css:
- `.account-shell`, `.account-dashboard`, `.account-hero-*`
- `.account-profile-*`, `.account-stats-*`, `.account-achievements-*`
- `.account-recent-games-*`, `.account-data-export-*`
- `.account-danger-zone-*`

### Commits (8):

```
1. feat(account): port AccountDashboard wrapper to legacy markup
2. feat(account): port AccountHero to legacy markup
3. feat(account): port AccountProfile to legacy markup
4. feat(account): port AccountStats to legacy markup
5. feat(account): port AccountAchievements to legacy markup
6. feat(account): port AccountRecentGames to legacy markup
7. feat(account): port AccountDataExport to legacy markup
8. style(account): reshell AccountDangerZone keeping confirmation logic intact
```

### Modern fixes layer

- Title metadata: `Твоето досие` (no duplicate brand suffix; layout template handles it)
- Bulgarian copy:
  - "Постижения" eyebrow → "Легенди" (was missed in PR F migration — fix now)
  - All other achievement-related labels → "Легенди"
- `data-faction` for any faction styling (not `data-theme`)

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "account"

# Manual: side-by-side compare account dashboard
# - Hero banner with avatar
# - Stats grid layout
# - Achievements section eyebrow says "ЛЕГЕНДИ" not "ПОСТИЖЕНИЯ"
# - Recent games list styling
# - Data export section
# - Danger zone shell + confirmation modal works
# - Mobile layout matches pre-primitives
```

### Critical: bg-copy-reviewer

After all commits in M26, run `bg-copy-reviewer` agent. Specifically verify:
- Eyebrow on achievements section is "ЛЕГЕНДИ" not "ПОСТИЖЕНИЯ"
- Member-since label format matches (e.g. "Член от май 2026 г.")
- Profile section copy matches dictionary

### Failure modes

| Symptom | Fix |
|---|---|
| "ПОСТИЖЕНИЯ" eyebrow returns | Apply Bulgarian copy migration patch after port (Step 3) |
| Title shows "Твоето досие | Върколак и Мафия | Върколак и Мафия" | Title metadata fix not reapplied — use absoluteTitle or remove suffix from page metadata |
| Danger zone confirmation flow breaks | Logic was overwritten during port — restore from current `git show HEAD:` and only port outer shell |
| Avatar image stretched/wrong size | Pre-primitives `.account-hero-avatar` rule missing — re-extract from globals.css |
| Stats grid breaks on mobile | Pre-primitives mobile media queries not all copied — verify with screenshot diff |

---

## PR M27 — `/leaderboard` Newspaper Legacy Island (~1.5h)

### Files to port

**Current state** (post-M17 newspaper polish):
- `apps/web/app/leaderboard/page.tsx`
- `apps/web/components/leaderboard/Masthead.tsx`
- `apps/web/components/leaderboard/MainHeadline.tsx`
- `apps/web/components/leaderboard/SecondaryStories.tsx`
- `apps/web/components/leaderboard/RanksColumn.tsx`
- `apps/web/components/leaderboard/ClassifiedsList.tsx`
- `apps/web/components/leaderboard/NewspaperPage.tsx`
- `apps/web/components/leaderboard/NewspaperEmpty.tsx`

### Special note about M17 work

`/leaderboard` received significant M17 polish work (printer's press body backdrop, halftone portrait, ink stamp, supporting sidebars "ВРЕМЕТО НА МАСАТА" + "ТЪРСИ СЕ", custom empty press state).

**All M17 additions are reverted in this port.** Pre-primitives version is simpler newspaper. If user wants to keep specific M17 details (e.g. supporting sidebars), they need to flag this BEFORE port. Default: port verbatim, lose M17 additions.

### Create `LegacyLeaderboard.module.css`

Already exists in pre-primitives globals.css with full newspaper style block. Extract:
- `.newspaper-shell`, `.newspaper-page`, `.newspaper-page-empty`
- `.masthead`, `.masthead-ornament`, `.masthead-meta`
- `.headline-main`, `.headline-portrait`, `.headline-stats`, `.headline-dropcap`, `.headline-lede`
- `.secondary-stories`, `.secondary-story`
- `.ranks-column`, `.ranks-column-*`
- `.classifieds`, `.classifieds-*`
- `.leaderboard-empty-state`

### Commits (5):

```
1. feat(leaderboard): port NewspaperPage + Masthead to legacy markup
2. feat(leaderboard): port MainHeadline + SecondaryStories to legacy markup
3. feat(leaderboard): port RanksColumn + ClassifiedsList to legacy markup
4. feat(leaderboard): port NewspaperEmpty to legacy markup
5. chore(leaderboard): reapply title metadata and Bulgarian copy
```

### Modern fixes layer

- Title metadata: `Вечерен брой — седмичният списък на масата` (no duplicate brand)
- Bulgarian copy: `Класация` → `Вечерен брой` (already migrated, verify retained)
- Section labels: "Класирани" can stay (this is the pre-primitives original term within newspaper context)

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "leaderboard"

# Manual compare against :3101/leaderboard
# - Masthead title typography
# - Portrait image with halftone (verify pre-primitives didn't have halftone — if M17 added it, it goes away)
# - Top-3 stories layout
# - Ranks column 4-8
# - Classifieds 9+
# - Empty state styling
```

### M17 reversion checklist

After port, verify these M17 additions are gone:
- ❌ `--art-leaderboard-press` token usage (revert to original `--art-leaderboard`)
- ❌ Halftone overlay on headline portrait
- ❌ Ink stamp issue number rotated in corner
- ❌ Printer's marks between sections (●─◆─●)
- ❌ Paper crease line + ink smudges
- ❌ "ВРЕМЕТО НА МАСАТА" + "ТЪРСИ СЕ" sidebars
- ❌ Custom "Печатницата чака" empty state with ghost lines

All replaced by pre-primitives simpler newspaper.

### Failure modes

| Symptom | Fix |
|---|---|
| Empty state shows generic primitive EmptyState | NewspaperEmpty.tsx not ported correctly; use pre-primitives version with direct artifact + custom copy |
| Issue number not visible | Pre-primitives had inline issueNumber() in masthead meta, not as separate stamp — verify |
| Drop cap on lede broken | `.headline-dropcap` CSS rule missing from extraction |
| Portrait stretched wrong | Pre-primitives image dimensions different — verify width/height props match |

---

## PR M28 — `/create` Flow Legacy Island (~2h)

### Files to port (largest scope of this round)

**Pages**:
- `apps/web/app/create/page.tsx`
- `apps/web/app/werewolf/create/page.tsx`
- `apps/web/app/mafia/create/page.tsx`

**Wizard components**:
- `apps/web/components/lobby-create-client.tsx`
- `apps/web/components/lobby/LobbyWizard.tsx`
- `apps/web/components/lobby/StepNav.tsx`
- `apps/web/components/lobby/StepRoom.tsx`
- `apps/web/components/lobby/StepRoles.tsx`
- `apps/web/components/lobby/StepStyle.tsx`
- `apps/web/components/lobby/StepPreview.tsx`
- `apps/web/components/lobby/Field.tsx`
- `apps/web/components/lobby/ModeTileCard.tsx`
- `apps/web/components/lobby/PresetChips.tsx`
- `apps/web/components/lobby/QuickStartRow.tsx`
- `apps/web/components/lobby/StickyPreview.tsx`
- `apps/web/components/lobby/MobileSummaryChip.tsx`
- `apps/web/components/lobby/RoleTileLarge.tsx`
- `apps/web/components/lobby/RoleCarousel.tsx`
- `apps/web/components/lobby/RoleDetailModal.tsx`
- `apps/web/components/lobby/ManualTempoPanel.tsx`
- `apps/web/components/lobby/AdvancedDrawer.tsx`

### M13 reversion warning

`/create` flow received M13 atmospheric work (tavern backdrop, parchment chapter chips with Roman numerals, faction-color hairline borders, wizard frame ornamentation).

**ALL M13 work is reverted in this port.** Pre-primitives wizard is simpler.

### Create `LegacyCreate.module.css`

Extract from pre-primitives globals.css. Massive CSS block — wizard has dozens of selectors:
- `.lobby-shell`, `.lobby-wizard-frame`, `.lobby-wizard-main`
- `.lobby-step-pane`, `.lobby-step-slot`
- `.step-nav`, `.step-nav-pill` (note: not Roman numeral chapter chips)
- `.lobby-form-error`
- `.mode-tile-*`, `.preset-chip-*`
- `.field`, `.field-label`, `.field-input-wrap`, `.field-action`, `.field-error`, `.field-hint`
- `.role-tile-large-*`, `.role-carousel-*`, `.role-detail-modal-*`
- `.manual-tempo-*`, `.advanced-drawer-*`
- `.sticky-preview-*`, `.mobile-summary-chip-*`

### Commits (10):

```
1. feat(create): port lobby-create-client and page entry points
2. feat(create): port LobbyWizard frame to legacy markup
3. feat(create): port StepNav to legacy pill (no Roman numerals)
4. feat(create): port StepRoom legacy markup
5. feat(create): port StepRoles + Role carousel/modal/tile components
6. feat(create): port StepStyle + ManualTempoPanel + AdvancedDrawer
7. feat(create): port StepPreview + StickyPreview + MobileSummaryChip
8. feat(create): port Field + PresetChips + ModeTileCard
9. style(create): extract LegacyCreate.module.css from pre-primitives
10. chore(create): reapply title metadata for all 3 create routes
```

### Modern fixes layer

- Title metadata: 3 create pages have separate titles, all should drop duplicate brand suffix
- `data-faction` not `data-theme` for werewolves/mafia faction context
- M13 reversions: drop `--art-lobby-werewolves`/`--art-lobby-mafia` token consumption if pre-primitives didn't use them
- Body backdrop drift for lobby shell: keep current drift OR revert to pre-primitives static — check pre-primitives behavior

### M13 reversion checklist

Verify these M13 additions are gone:
- ❌ Tavern backdrop with ambient drift (revert to pre-primitives backdrop behavior)
- ❌ Parchment chapter chips with Roman numerals (I, II, III, IV) — restore numeric step pills
- ❌ Wax seal stamps on visited steps
- ❌ Faction-color hairline border on wizard frame
- ❌ Frosted plaque on step nav

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "create|werewolf-create|mafia-create"

# Manual compare against :3101/create, :3101/werewolf/create, :3101/mafia/create
# - Wizard frame styling
# - Step indicators (numeric, not Roman)
# - Mode preset cards
# - Player count slider
# - Role selection grid
# - Manual tempo panel
# - Advanced drawer
# - Sticky preview sidebar
# - Mobile summary chip
# - Submit flow (functional, not just visual)
```

### Critical: functional verification

`/create` flow is interactive — wizard state, validation, room creation logic. Port must NOT break:
- Form state management
- Wizard step navigation (back/forward/keyboard arrows)
- Player count constraints
- Role checkbox toggles
- Manual tempo time inputs
- Room name generation
- Confetti burst on submit
- Redirect to lobby after creation

Test full creation flow end-to-end after port.

### Failure modes

| Symptom | Fix |
|---|---|
| Step nav shows Roman numerals | M13 chapter chips not removed — restore numeric `.step-nav-pill` |
| Role selection grid styled like primitives PaperCard | Re-extract `.role-tile-large-*` from pre-primitives globals.css |
| Submit button styling matches Pill primitive | Pre-primitives used `.btn.btn-primary` — verify port |
| Mobile summary chip position wrong | Pre-primitives `position: fixed` rule missing — check |
| Sticky preview sidebar misaligned | Pre-primitives sticky behavior different — verify CSS extraction complete |
| Faction theming broken | `data-faction` attribute set on main + correct fallback chain |

---

## PR M29 — `/history/[gameId]/replay` Legacy Island (~1h)

### Files to port

- `apps/web/app/history/[gameId]/replay/page.tsx`
- (replay is mostly inline in page.tsx — verify if separate components exist)

### Current state warning

Current replay page uses `SceneCard + Display` from primitives. Pre-primitives used custom replay components/markup.

### Files to extract from pre-primitives

```bash
git show 69bbcca8:apps/web/app/history/[gameId]/replay/page.tsx > /tmp/replay-legacy.tsx
```

Identify all replay-specific CSS classes used:
- `.replay-shell`, `.replay-hero`, `.replay-verdict-card`
- `.replay-participants`, `.replay-player-grid`, `.replay-player-chip`
- `.replay-timeline-v2`, `.replay-section-head`
- `.replay-achievements`, `.replay-empty-note`

### Create `LegacyReplay.module.css`

Or extend existing `LegacyHistory.module.css` with replay-specific rules (if Codex prefers consolidation).

### Commits (3):

```
1. feat(history): port replay page to legacy markup
2. style(history): extract replay-specific CSS to legacy module
3. chore(history): reapply title metadata for replay route
```

### Modern fixes layer

- Title: `Запис` (already non-duplicating)
- `data-faction` for werewolves/mafia theme on `<main>`
- Auth requirement preserved (`requireSession`)

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "replay"

# Need fixture or real game ID to test
# Compare :3000/history/<id>/replay vs :3101/history/<id>/replay (using same fixture/test data)
```

### Failure modes

| Symptom | Fix |
|---|---|
| Replay hero uses dark SceneCard | Not ported — verify @werewolf/ui import removed |
| Timeline groups missing styling | `.replay-timeline-v2 .phase-group` rules not in legacy module — extract |
| Achievement section in replay broken | Pre-primitives `.replay-achievements` block missing |
| data-theme="werewolves" returns | Replace with data-faction |

---

## PR M30 — `/lobby/[code]` Waiting Room Legacy Island (~1.5h)

### Files to port

**Current state**:
- `apps/web/app/lobby/[code]/page.tsx`
- `apps/web/components/lobby/InviteShare.tsx` (if exists)
- `apps/web/components/lobby/RoomReadyPanel.tsx` (if exists)
- `apps/web/components/lobby-invite-client.tsx`

### Investigation required

`/lobby/[code]` is the WAITING ROOM after creating/joining a room (different from `/create` wizard). Verify what primitives it currently uses:

```bash
grep -rl "@werewolf/ui" apps/web/app/lobby/ apps/web/components/lobby-invite-*.tsx 2>&1
```

If `/lobby` uses primitives heavily, port. If it's already mostly raw, only port specific touch-ups.

### Create `LegacyLobby.module.css`

Extract pre-primitives lobby waiting room styles:
- `.lobby-shell.join-shell`, `.lobby-shell.lobby-room`
- `.lobby-invite-*`, `.lobby-share-*`, `.lobby-room-*`
- Faction-themed shell styling

### Commits (4):

```
1. feat(lobby): port lobby waiting room page to legacy markup
2. feat(lobby): port lobby-invite-client to legacy markup
3. style(lobby): extract LegacyLobby.module.css from pre-primitives
4. chore(lobby): reapply title metadata and Bulgarian copy
```

### Modern fixes layer

- Title: `Лоби` (no duplicate brand)
- Bulgarian copy preserved
- Auth gating preserved
- `data-faction` set on `<main>` for werewolves/mafia theme

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "lobby"

# Manual: create a game, join the lobby, compare /lobby/<code> behavior
# - Room code display
# - Invite share UI
# - Player list
# - Host controls (start game)
# - Faction-themed accents
```

---

## After M25-M30: Architecture state

### Pages using primitives (`@werewolf/ui`)

After this round:
- `/` (landing) — Display, Pill
- `/werewolf`, `/mafia` (faction homes) — minimal primitive use
- `ArtifactImage` utility — used in EmptyStates (which are now mostly removed from legacy islands)

That's it. Primitives library still exists in `packages/ui/` (Pill, Dialog, SceneCard, PaperCard, EmptyState, Display, Eyebrow, Surface, etc.) but only landing pages consume them.

### Legacy islands (post-M19-M30)

17 routes now legacy islands:
- /privacy, /terms, /report, /status, /faq, /friends, /tutorial, /history, /achievements (M19-M24)
- /sign-in, /account, /leaderboard (M25-M27)
- /create, /werewolf/create, /mafia/create (M28)
- /history/[gameId]/replay (M29)
- /lobby/[code] (M30)

Each has its own `LegacyXXX.module.css` file in component directory.

### Anti-pattern guard policy

Stays configured per M28 (round 1 final state):
- ALLOWED: `:global(.page-shell-class .anything)` (page-namespaced)
- ALLOWED: `:global(.legacy-class-name)` direct (page-local class names without primitive shadowing)
- FORBIDDEN: `:global(.paper-card)` direct (primitive identity override)
- FORBIDDEN: `:global([data-ds-scene-card])` direct (primitive data attribute override)

### Bundle size

Expected slight bundle increase from CSS modules + removed primitive tree-shaking benefits. Verify with `pnpm perf:budget` after each PR. If budget breaks, sweep dead primitive imports.

---

## Workflow summary (apply per PR)

```bash
# 1. Inspect pre-primitives source
cd /tmp
git -C E:/werewolf_mafia_pre_primitives_69bbcca8 show 69bbcca8:apps/web/components/<dir>/<file>.tsx > legacy-<file>.tsx

# 2. Identify pre-primitives CSS blocks
git -C E:/werewolf_mafia_pre_primitives_69bbcca8 show 69bbcca8:apps/web/app/globals.css | \
  grep -nE "^\.(<page-prefix>)" > /tmp/legacy-css-blocks.txt

# 3. Manual port to current repo
# - Copy JSX structure (no primitives)
# - Reapply modern fixes (title meta, copy migration, hydration, data-faction)
# - Extract CSS to new LegacyXXX.module.css

# 4. Per-commit gates
cd E:/werewolf_mafia
pnpm regression && pnpm typecheck && pnpm build

# 5. After all PR commits, visual verify
pnpm visual --grep "<route-pattern>"

# 6. Bulgarian copy review (if any text touched)
# Invoke bg-copy-reviewer agent

# 7. Manual side-by-side
# Compare localhost:3000/<route> vs localhost:3101/<route>
# Both viewports + both themes

# 8. Update visual baselines AFTER manual approval
pnpm visual --grep "<route-pattern>" --update-snapshots

# 9. Commit logically (per page, not per file)
git add <files>
git commit -m "feat(<page>): port to legacy visual island matching 69bbcca8"
```

---

## Acceptance criteria (cumulative)

| Metric | Target |
|---|---|
| `@werewolf/ui` imports in `/sign-in`, `/account/*`, `/leaderboard/*`, `/create/*`, `/lobby/[code]`, `/history/[gameId]/replay` | **0** |
| New `LegacyXXX.module.css` files | **6** (sign-in, account, leaderboard, create, lobby, replay-if-separate) |
| `globals.css` size | unchanged (~3,933 LOC) |
| Motion primitive files | 3 (unchanged) |
| Visual baselines refreshed for all touched routes | ✓ after manual approval |
| `pnpm regression` | green (all 16 contracts pass) |
| `pnpm typecheck` | green |
| `pnpm build` | green |
| `pnpm perf:budget` | green |
| Anti-pattern guard | green (no primitive identity overrides) |
| Bulgarian copy preserved (Постижения→Легенди etc.) | ✓ |
| Title metadata no duplicate brand suffix | ✓ |
| Hydration warning on /sign-in | none |
| `data-faction` separation from `data-theme` | preserved |
| Functional tests pass for /create flow | ✓ |
| Auth flows work | ✓ |

### Qualitative

- `/sign-in` looks 1:1 with `:3101/sign-in` (no halftone, no SceneCard hero)
- `/account` dashboard cards match pre-primitives layout, eyebrow says "ЛЕГЕНДИ"
- `/leaderboard` is pre-primitives newspaper without M17 printer's press additions
- `/create` wizard uses numeric step pills (not Roman numerals), no tavern atmospheric backdrop
- `/history/[gameId]/replay` hero matches pre-primitives custom markup
- `/lobby/[code]` waiting room visually consistent with pre-primitives

---

## Operator notes

- **One PR at a time**. Do not start M26 until M25 merges + visual approved.
- **`git show 69bbcca8:path` for source**, never blind checkout.
- **NEVER `git checkout 69bbcca8 -- globals.css`**. CSS extracts go to per-page `LegacyXXX.module.css`.
- **NEVER restore old `public/` assets wholesale.** If old CSS references missing assets, map to current optimized equivalent first.
- **Modern fixes layer LAST** — port DOM structure first, reapply fixes after.
- **`bg-copy-reviewer` agent mandatory** on every commit touching JSX text.
- **`/create` flow has functional logic** — test end-to-end after port, not just visual.
- **`AccountDangerZone.tsx`** body logic frozen. Only outer wrapper styling can change.
- **Pre-primitives dev server on `:3101`** must run for visual comparison. If not available, skip pixel comparison and rely on screenshots.
- **Commit logically per page**, not per file. Each commit is independently revertable.
- **`pnpm visual --update-snapshots` only after manual approval per page**.

---

## TL;DR for handoff

> Execute M25-M30 at `docs/frontend-audit-v3/codex-prompt-legacy-islands-round-2-pr-m25-m30.md`. 6 PRs total. Follows the same legacy visual islands pattern Codex established in M19-M24 (round 1). For each of /sign-in, /account, /leaderboard, /create flow, /history/[gameId]/replay, /lobby waiting room: port pre-primitives DOM/CSS structure from commit 69bbcca8, create per-page LegacyXXX.module.css, layer modern fixes (Bulgarian copy, title metadata, hydration, data-faction). Stop at each PR boundary for visual approval. M28 (/create) has functional logic — test end-to-end. Compare against `:3101` pre-primitives server for pixel-level fidelity.
