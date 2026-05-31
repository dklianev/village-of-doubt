# Codex prompt — PR M28.1: /create Wizard Stability Fixes

**Scope**: 4 surgical fixes to /create wizard after M28 legacy port revealed visual/layout issues:

1. **Faction accent colors missing** (CSS namespace mismatch: `[data-theme="werewolves"|"mafia"]` selectors vs current `data-family`/`data-faction` JSX attributes)
2. **Step pane height jumps** between steps (`content-visibility: hidden` breaks CSS Grid auto-sizing)
3. **StepNav chip width changes** between steps (no width lock on step pills)
4. **Sticky preview moves** between steps (symptom of #2 — auto-resolves)

**Effort**: ~45 minutes, 4 atomic commits.

**Risk profile**: Issue 1 fix touches `apps/web/app/globals.css` faction-themed rules — affects MANY pages (`/werewolf`, `/mafia`, `/werewolf/roles`, `/mafia/roles`, `/play`, role cards, lobby, leaderboard, etc.). Issues 2-4 scoped to lobby module only.

---

## Pre-flight verification

```bash
# 1. M28 committed (no uncommitted work in lobby/)
git log --oneline -5 | grep -E "(2d40909f|077e21b2)" && echo "✓ M28 committed"
git status --short apps/web/components/lobby/ 2>&1 | wc -l   # Should be 0 or just visual baselines

# 2. Pre-primitives server on :3101 for visual reference
curl -s -o /dev/null -w "%{http_code}" http://localhost:3101 | grep -q 200 && echo "✓ :3101 up"

# 3. Confirm namespace mismatch (Issue 1)
echo "JSX attributes used:"
grep -h "data-(faction|family|theme)" apps/web/components/lobby/LobbyWizard.tsx \
  apps/web/app/create/page.tsx apps/web/app/werewolf/create/page.tsx apps/web/app/mafia/create/page.tsx

echo "CSS selectors expecting (must NOT find data-faction/data-family for these factions):"
grep -nE "\[data-theme=\"(werewolves|mafia)\"\]" apps/web/app/globals.css | wc -l
# Expected: 50+ lines — that's the bug

# 4. Functional baseline still works
pnpm playtest 2>&1 | tail -3
pnpm regression 2>&1 | tail -3

# 5. Architectural invariants
rg ":global\(\[data-ds-" apps/web | wc -l    # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l  # MUST be 3
```

---

## Operating rules (inherit M28 strictness)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`.
2. After every commit: `pnpm playtest` (M28 wizard verification).
3. Manual smoke test after Issue 1 commit on ALL faction-themed pages.
4. **NO new dependencies. No new fonts. No new Motion imports.** Motion file count stays 3.
5. **Bulgarian copy unchanged** in this PR. No `bg-copy-reviewer` invocation needed.
6. **Sacred files frozen**: `lobbyFormReducer`, validation logic, submit flow, primitive APIs.
7. **Anti-pattern guard stays FAIL** — verify after each commit.
8. **Logical commits** — one fix per commit, easy individual revert.

---

## Commit 1 — Refactor faction selectors (`data-theme` → `data-family`)

### Root cause
JSX uses:
```tsx
<main data-faction={state.family} data-family={state.family} ...>
```

CSS in `apps/web/app/globals.css` uses:
```css
[data-theme="werewolves"] { --blood: ...; --gold: ...; }
[data-theme="mafia"] { --blood: ...; --gold: ...; }
```

`data-theme` is NEVER set on `<main>` (reserved for `light|dark` on `<html>`). Faction CSS variables don't apply → wizard uses default `--blood` (generic red) regardless of faction.

### Fix: refactor CSS to `[data-family="..."]` namespace

**Files affected**:
- `apps/web/app/globals.css` (main file)
- Any `Legacy*.module.css` files using `[data-theme="werewolves"|"mafia"]`
- Any other CSS using same pattern

### Discovery commands

```bash
# Find ALL faction selectors using data-theme
grep -nE "\[data-theme=\"(werewolves|mafia)\"\]" apps/web/app/globals.css | wc -l
grep -rnE "\[data-theme=\"(werewolves|mafia)\"\]" apps/web/components --include="*.css" | wc -l

# CRITICAL — DO NOT touch these (light/dark theme):
grep -nE "\[data-theme=\"(light|dark)\"\]" apps/web/app/globals.css | head -5
```

### Refactor rules

Replace ONLY faction occurrences:
- `[data-theme="werewolves"]` → `[data-family="werewolves"]`
- `[data-theme="mafia"]` → `[data-family="mafia"]`

**Untouched** (still light/dark theme namespace):
- `html[data-theme="light"]` — keep
- `html[data-theme="dark"]` — keep
- `[data-theme="dark"] ::before` — keep
- Any `[data-theme="..."]` where `...` is NOT `werewolves` or `mafia`

### Recommended sed approach (verify before apply)

```bash
# Dry-run first — see what would change
grep -nE "\[data-theme=\"(werewolves|mafia)\"\]" apps/web/app/globals.css | head -20

# If output is exclusively faction (no light/dark mixed in), proceed:
sed -i 's/\[data-theme="werewolves"\]/[data-family="werewolves"]/g' apps/web/app/globals.css
sed -i 's/\[data-theme="mafia"\]/[data-family="mafia"]/g' apps/web/app/globals.css

# Apply to Legacy*.module.css files too if they have same pattern
for f in apps/web/components/**/Legacy*.module.css; do
  if grep -qE "\[data-theme=\"(werewolves|mafia)\"\]" "$f"; then
    echo "Refactoring $f"
    sed -i 's/\[data-theme="werewolves"\]/[data-family="werewolves"]/g' "$f"
    sed -i 's/\[data-theme="mafia"\]/[data-family="mafia"]/g' "$f"
  fi
done
```

### Verification (mandatory after this commit)

Open **all faction-themed pages** and verify accent colors apply:

```
Werewolves (expect green/gold/moss accents):
- http://localhost:3000/werewolf
- http://localhost:3000/werewolf/roles
- http://localhost:3000/werewolf/create
- http://localhost:3000/create (with werewolves preset)

Mafia (expect red/brass/wine accents):
- http://localhost:3000/mafia
- http://localhost:3000/mafia/roles
- http://localhost:3000/mafia/create

Other faction-dependent (verify no regression):
- http://localhost:3000/play/<room-code> (during game — role cards)
- http://localhost:3000/leaderboard
- http://localhost:3000/history (when filtering by faction)
- http://localhost:3000/achievements (faction medals)
```

**Side-by-side check**:
- localhost:3000/werewolf/create (after refactor)
- localhost:3101/werewolf/create (pre-primitives reference)

Should now match — accent colors visible.

### Gates

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest
# Manual: open 8 verification pages above, check accent colors
# Compare any 2 against :3101 for fidelity
```

### Commit message

```
refactor(css): align faction selectors with data-family attribute namespace

Pre-primitives CSS used [data-theme="werewolves"|"mafia"] for faction
accent variables, but current JSX renders data-faction + data-family
(data-theme reserved for light|dark per v2 PR M1.0.b). Refactor
globals.css and Legacy*.module.css selectors to match active JSX
namespace. Light/dark theme selectors untouched.
```

### Failure modes

| Symptom | Fix |
|---|---|
| /play room loses faction theme | Missed `[data-theme="..."]` in game-shell rules; re-grep + refactor |
| Role cards lose color | role-civilian/mafioso/commissioner rules use `[data-theme]`; refactor |
| Light/dark theme breaks on /werewolf or any page | Accidentally refactored `[data-theme="light"|"dark"]`; revert those specific lines |
| Some page partial color | CSS in another file uses old namespace; grep `apps/web/components` for stragglers |

---

## Commit 2 — Fix step pane resize (remove `content-visibility: hidden`)

### Root cause
```css
:global(.lobby-step-pane) {
  display: grid;
  min-height: clamp(560px, 70vh, 880px);
}
:global(.lobby-step-slot) {
  grid-area: 1 / 1;  /* all 4 slots overlap in same grid cell */
}
:global(.lobby-step-slot:not([data-active="true"])) {
  content-visibility: hidden;  /* ← excludes from layout calc */
  overflow: hidden;
}
```

CSS Grid normally sizes its cell to the **largest child** (so all 4 step slots together determine pane height). But `content-visibility: hidden` skips paint AND layout calculation for inactive slots → pane resizes per active step's content.

When step 1 (Стая) is active: pane = StepRoom height.
When step 2 (Роли) is active: pane = StepRoles height (much taller, has role grid).
→ Pane height fluctuates → page reflows → sticky preview re-evaluates → looks like everything shifts.

### Fix

```diff
 // apps/web/components/lobby/LegacyCreate.module.css

 :global(.lobby-step-slot:not([data-active="true"])) {
-  content-visibility: hidden;
   overflow: hidden;
 }
```

**Why this works**: removing `content-visibility: hidden` means inactive slots still participate in layout calculation. CSS Grid sizes cell to LARGEST slot (likely StepRoles). All step transitions now happen within a stable pane height.

**Performance trade-off**: inactive slots render their DOM (small perf cost). Already mitigated by `visibility: hidden` + `inert` + `opacity: 0` — no visual paint cost, just layout calc. Net negligible.

### Alternative (if Codex prefers performance preservation)

```diff
 :global(.lobby-step-slot:not([data-active="true"])) {
-  content-visibility: hidden;
+  content-visibility: auto;
+  contain-intrinsic-size: auto 720px;  /* reserve estimated height */
   overflow: hidden;
 }
```

`content-visibility: auto` keeps perf benefit but uses `contain-intrinsic-size` to reserve space — browser treats slot as 720px tall for layout purposes even when content is skipped.

**Recommended**: simpler removal (first option). Perf benefit not worth complexity.

### Verification

Open `/create` and click through Step 1 → 2 → 3 → 4:
- Pane height **stable** across all steps
- No page reflow visible
- Sticky preview position **stable** (auto-resolves Issue 4)
- Browser DevTools: `Performance > Layout shifts` shows 0 CLS contribution from wizard

### Gates

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest
# Manual: click through all 4 steps, verify no pane resize
# Manual: open mobile viewport, verify same stability
```

### Commit message

```
fix(create): keep all step slots in layout to prevent pane resize

content-visibility: hidden on inactive slots was excluding them from
CSS Grid sizing calculation, causing pane height to fluctuate with
each step's content size. Removed — slots now uniformly contribute
to grid cell sizing, pane height stable across all 4 steps. Sticky
preview position also stabilizes (was a symptom of pane resize).
```

### Failure modes

| Symptom | Fix |
|---|---|
| Pane has scrollbar on small viewport | Bump `min-height: clamp(560px, 70vh, 880px)` → `clamp(560px, 70vh, 920px)` to fit StepRoles comfortably |
| Mobile pane too tall | Add mobile media query lowering min-height to fit phone screen |
| Tab order broken between steps | Verify `inert` attribute still works (Chrome 102+, Firefox 112+) |
| Slight visual jump on first step swap | Add `contain: layout paint` to `.lobby-step-pane` if not present |

---

## Commit 3 — Lock StepNav chip width

### Root cause
`.lobby-step-nav` chips have different padding/border when active. Without explicit width constraint, chips resize based on content + active state → menu width "jumps" as active step moves.

User reported: "при стъпка 2 менюто със стъпките е по голямо" — step 2 chip larger than step 1/3/4.

### Fix

Investigate current `.lobby-step-nav` rule first:

```bash
grep -A5 "lobby-step-nav" apps/web/components/lobby/LegacyCreate.module.css | head -30
```

Then apply ONE of these (whichever fits existing structure):

**Option A — Grid equal columns** (preferred — most stable):

```diff
 :global(.lobby-step-nav) {
+  display: grid;
+  grid-template-columns: repeat(4, 1fr);
+  gap: 8px;
 }
```

**Option B — Flex equal distribution** (if existing is flex):

```diff
 :global(.lobby-step-nav button) {
+  flex: 1 1 0;
+  min-width: clamp(80px, 12vw, 140px);
 }
```

**Option C — Explicit min-width on buttons** (if neither flex nor grid):

```diff
 :global(.lobby-step-nav button) {
+  min-width: 120px;
+  text-align: center;
 }
```

**Codex picks based on existing layout**. Default to Option A unless Grid breaks the existing chip layout.

### Verification

Click through Step 1 → 2 → 3 → 4:
- Nav menu **same width** throughout
- Each step chip **same width**
- Active state styling visible (background, color, etc.) but **chip dimensions identical** to inactive
- Mobile: chips equally distributed within row

### Gates

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest
# Manual: visually verify nav menu stability across steps
# Use DevTools to confirm chip widths are equal
```

### Commit message

```
fix(create): lock StepNav chip width to prevent menu jump

Step pills now use equal-distribution layout (grid with repeat(4, 1fr))
so active state styling doesn't change chip dimensions. Menu width
stable as user navigates between steps. Visual symmetry preserved.
```

### Failure modes

| Symptom | Fix |
|---|---|
| Chip text wraps to 2 lines | Bump `min-width` to fit longest label ("Преглед" is widest) |
| Mobile chips too small | Override grid-template-columns for narrow viewport to `repeat(2, 1fr)` or scroll-snap |
| Active state invisible | Active styling now constrained to background/border, not size — verify visibility |
| Existing keyboard nav broken | Verify focus styling still visible within constrained chip size |

---

## Commit 4 — Visual baselines refresh

After Commits 1-3 land and **manual side-by-side approval** against `:3101`:

```bash
# Inspect every diff manually before update
pnpm visual --grep "create|werewolf-create|mafia-create"

# Expected diffs:
# - Faction colors visible (green/red accents on werewolves/mafia routes)
# - Step pane stable height
# - StepNav chip width stable
# - Sticky preview stable position
# - Page bg + atmosphere unchanged from M28

# After manual sign-off:
pnpm visual --grep "create|werewolf-create|mafia-create" --update-snapshots
```

### Commit message

```
test(visual): refresh create baselines after M28.1 stability fixes
```

---

## Acceptance criteria

### Per route × theme × viewport

Routes:
- `/create?visualAuth=1`
- `/werewolf/create?visualAuth=1`
- `/mafia/create?visualAuth=1`

Themes: light + dark
Viewports: desktop (1280x800) + mobile (375x812)

Total: 3 × 2 × 2 = **12 verification scenarios**.

For each:
- ✅ Faction accent colors apply (`/werewolf/create` green-tinted, `/mafia/create` red-tinted)
- ✅ Step pane height **stable** across Step 1 → 2 → 3 → 4
- ✅ StepNav chip width **stable** across active step changes
- ✅ Sticky preview position **stable** (no movement on step swap)
- ✅ Page background atmosphere unchanged (M28 + body backdrop preserved)
- ✅ Mobile summary chip behaves correctly

### Functional preservation

- ✅ `pnpm playtest` green — end-to-end game creation works
- ✅ Wizard reducer state transitions work
- ✅ Keyboard arrows navigate steps
- ✅ Submit flow → /lobby/<code> redirect
- ✅ Validation warnings appear at right time
- ✅ Confetti burst on submit

### Architectural invariants

- ✅ `pnpm regression` all 16 contracts pass
- ✅ Anti-pattern guard remains FAIL mode
- ✅ Motion file count = 3 (Dialog, Sheet, Toast)
- ✅ globals.css size doesn't bloat (within ±50 LOC tolerance from current 3,862)
- ✅ No new dependencies, fonts, Motion imports
- ✅ Bulgarian copy unchanged

### Cross-page regression check (Commit 1 specifically)

Faction-themed pages outside /create — verify Commit 1 didn't break them:

| Page | Expected behavior | Check |
|---|---|---|
| `/werewolf` | Green-tinted hero + faction styling | Manual + screenshot |
| `/mafia` | Red-tinted hero + faction styling | Manual + screenshot |
| `/werewolf/roles` | Role grid faction-themed | Manual + screenshot |
| `/mafia/roles` | Role grid faction-themed | Manual + screenshot |
| `/play/<room>` (during werewolf game) | Role cards green-themed | Functional smoke during playtest |
| `/play/<room>` (during mafia game) | Role cards red-themed | Functional smoke during playtest |
| `/history` filtered by werewolves | Faction-themed entries | Manual |
| `/history` filtered by mafia | Faction-themed entries | Manual |

---

## Operator notes

- **Commit 1 is highest-impact** — touches `globals.css` with ~50+ faction selector lines. Verify NOT touching `[data-theme="light"|"dark"]`. If unsure, do dry-run grep first.
- **Sequential commits, gates between each** — don't batch all 3 fixes into 1 commit. Atomic revertability matters.
- **Cross-page smoke test after Commit 1** — faction-themed pages outside /create may be affected.
- **Side-by-side with `:3101`** — pre-primitives reference confirms visual fidelity.
- **Visual baselines update LAST** (Commit 4) — only after all manual approvals.
- **Sacred files frozen**: `lobbyFormReducer`, validation, submit flow, primitive APIs.
- **NO new tokens, no new fonts, no new dependencies.**
- **Functional verification per commit**: `pnpm playtest` after each.

---

## After M28.1 lands

`/create` wizard is finally **stable** AND **identity-themed**:
- Visual fidelity to pre-primitives (M28)
- Faction accents apply correctly (M28.1 #1)
- No layout shift between steps (M28.1 #2-4)
- Cross-page faction theming preserved on /werewolf, /mafia, /play, etc.

Other pages that depended on `[data-theme="werewolves"|"mafia"]` selectors now also work correctly — this was a latent bug surfaced by M28 legacy port.

Optional follow-up M28.2 (defer unless needed):
- Mobile-specific wizard layout polish if mobile shows different issues
- StepNav accessibility (keyboard focus styling)
- Inert attribute fallback for older browsers (if telemetry shows issue)

---

## TL;DR for handoff

> Execute M28.1 at `docs/frontend-audit-v3/codex-prompt-create-wizard-stability-fixes-pr-m28-1.md`. 4 atomic commits, ~45 minutes. Fixes /create wizard issues from M28 port: (1) refactor `[data-theme="werewolves"|"mafia"]` → `[data-family="..."]` to restore faction accent colors, (2) remove `content-visibility: hidden` from inactive step slots to prevent pane resize, (3) lock StepNav chip width with grid equal columns, (4) refresh visual baselines after side-by-side approval. Cross-page smoke test after Commit 1 (Werewolf/Mafia/play). `pnpm playtest` after every commit.
