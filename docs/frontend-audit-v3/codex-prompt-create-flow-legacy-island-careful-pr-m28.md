# Codex prompt — PR M28: /create Flow Legacy Island (CAREFUL variant)

**Scope**: port the entire /create flow to a legacy visual island matching pre-primitives commit `69bbcca8`. Covers `/create`, `/werewolf/create`, `/mafia/create`, plus the LobbyWizard + all 16 step components.

**This is the most functionally complex legacy island port.** Unlike M19-M27 (content/display pages), the /create flow contains **interactive wizard state, form validation, role selection, manual tempo inputs, room creation, and submit→redirect logic**. Visual port must NOT regress functional behavior.

**Effort**: ~3-4 hours (NOT 2 hours — wizard port takes longer due to functional verification per commit).

**Goal**: visual 1:1 match with `:3101/create`, `:3101/werewolf/create`, `:3101/mafia/create` AND zero functional regression. Every wizard interaction must continue to work end-to-end.

---

## Why this prompt is different from M19-M27

| Aspect | M19-M27 content pages | M28 /create wizard |
|---|---|---|
| Primary purpose | Display text/data | **Interactive multi-step form** |
| State management | None | LobbyFormState (~30+ fields), reducer |
| Step navigation | None | Keyboard + click + validation gates |
| User submissions | None | Room creation → router.push |
| Functional tests | Few | Existing `__tests__` directory |
| Side effects | None | Confetti burst, haptics, autofocus |
| Risk profile | **Visual regression only** | **Visual + functional regression** |
| Required gates | regression+typecheck+build+visual | **+ playtest + manual smoke test** |
| Port strategy | Inside-out (any order) | **Outside-in (frame first, step content last)** |

---

## Pre-flight verification

```bash
# 1. Confirm M19-M27 legacy islands committed
test -f apps/web/components/sign-in/LegacySignIn.module.css && echo "✓ M25 sign-in committed"
test -f apps/web/components/account/LegacyAccount.module.css && echo "✓ M26 account committed"

# 2. Pre-primitives source available
test -d "E:/werewolf_mafia_pre_primitives_69bbcca8/apps/web/components/lobby" && echo "✓ legacy lobby source"

# 3. Pre-primitives dev server on :3101 reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:3101 | grep -q 200 && echo "✓ :3101 up"

# 4. Pre-flight functional baseline — current /create must work BEFORE port
# Open http://localhost:3000/create (logged in OR visualAuth=1)
# Manually verify:
# - Step 1 (Стая): room name auto-populates, mode selector works, player count slider responds
# - Step 2 (Роли): role checkboxes toggle, validation warnings appear
# - Step 3 (Стил): tempo presets selectable, manual tempo inputs work
# - Step 4 (Преглед): summary populates, Submit button enables when valid
# - Keyboard: arrow left/right navigates steps, Enter advances
# - Mobile summary chip appears on mobile viewport
# This is the BASELINE behavior to preserve.

# 5. Existing functional tests pass
pnpm --filter @werewolf/web test -- lobby
# Or whichever test scope covers lobby wizard

# 6. Architectural invariants
rg ":global\(\[data-ds-" apps/web | wc -l    # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l  # MUST be 3
pnpm regression 2>&1 | tail -3                # green
```

If pre-flight #4 fails ANYWHERE → STOP. Current /create has functional bug. Fix that first; don't compound with port work.

---

## Operating rules (STRICT — exceeds M19-M27)

### Per-commit gates (mandatory ALL)

After EVERY commit in this PR:

```bash
# Static gates (same as M19-M27)
pnpm regression && pnpm typecheck && pnpm build

# FUNCTIONAL gates (NEW for M28)
pnpm playtest    # MUST pass — verifies full game flow including room creation

# Manual functional smoke test (NEW for M28)
# 1. Open localhost:3000/create
# 2. Walk through Step 1 → 2 → 3 → 4
# 3. Click Submit → verify router pushes to /lobby/<code>
# 4. Back out and try /werewolf/create
# 5. Back out and try /mafia/create
# All three flows must complete without console errors
```

If any gate fails → `git reset --soft HEAD~1` (keep changes staged) → investigate → fix → recommit. Do NOT push to next commit until current is clean.

### Visual gates (per PR boundary)

```bash
# Visual diff
pnpm visual --grep "create|werewolf-create|mafia-create"

# Side-by-side manual comparison
# - localhost:3000/create?visualAuth=1
# - localhost:3101/create?visualAuth=1
# Both desktop + mobile, both light + dark
# Expected: pixel-level visual fidelity

# Only after manual approval per route:
pnpm visual --grep "create|werewolf-create|mafia-create" --update-snapshots
```

### Hard invariants

1. **NO `:global([data-ds-*])` overrides.** Anti-pattern guard stays FAIL.
2. **NO new dependencies, fonts, Motion imports.** Motion file count stays 3.
3. **NO `prefers-reduced-motion` guards.** Project convention.
4. **Bulgarian copy stays canonical** (spec terms preserved). `bg-copy-reviewer` agent after every commit touching JSX text.
5. **Functional behavior preserved 100%.** Wizard state machine, validation, submit flow, keyboard nav — all unchanged.
6. **Sacred files frozen** — game-server, play-room-client, primitive APIs (Pill/Dialog/etc remain for utility use).
7. **Existing tests must continue to pass.** If `__tests__/lobby` tests rely on specific class names or DOM structure, update tests AS PART of the port commit, not later.
8. **Logical commits** — one component per commit when possible, not mega-commits.

---

## Port order (outside-in)

Rationale: outer frame port doesn't touch inner state. Each subsequent inner component port has progressively smaller blast radius.

```
PORT ORDER:
1. /create + /werewolf/create + /mafia/create page.tsx files (entry points — minimal change)
2. lobby-create-client.tsx
3. LobbyWizard.tsx + LobbyWizard.module.css (outer frame — visual only)
4. StepNav.tsx (step indicator — visual only)
5. ModeTileCard.tsx + PresetChips.tsx + QuickStartRow.tsx (supporting display)
6. Field.tsx (form field wrapper — visual + minor accessibility)
7. StepRoom.tsx (Step 1 — room name + mode + player count)
8. StickyPreview.tsx + MobileSummaryChip.tsx (read-only display)
9. ManualTempoPanel.tsx + AdvancedDrawer.tsx (supporting controls)
10. StepStyle.tsx (Step 3 — tempo settings)
11. RoleTileLarge.tsx + RoleCarousel.tsx + RoleDetailModal.tsx (role display)
12. StepRoles.tsx (Step 2 — HIGHEST functional risk — role selection logic)
13. StepPreview.tsx (Step 4 — summary + submit trigger)
14. LegacyCreate.module.css extraction + cleanup
15. Modern fixes layer (title metadata, M13 reversions)
```

### Why this order

- **Steps 1-3** are entry points and outer chrome — visual only, no state risk
- **Steps 4-6** are display components — read state but don't mutate
- **Steps 7-9** are progressively functional but read-heavy
- **Steps 10-12** touch state mutation (StepRoles is highest risk — role validation)
- **Steps 13-15** are end-of-port cleanup

If something breaks mid-port, easy bisect tells you which step component caused it.

---

## Per-step commit specs

### Commit 1 — Port page entry points

**Files**:
- `apps/web/app/create/page.tsx`
- `apps/web/app/werewolf/create/page.tsx`
- `apps/web/app/mafia/create/page.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/app/create/page.tsx > /tmp/legacy-create-page.tsx
git show 69bbcca8:apps/web/app/werewolf/create/page.tsx > /tmp/legacy-ww-create-page.tsx
git show 69bbcca8:apps/web/app/mafia/create/page.tsx > /tmp/legacy-mafia-create-page.tsx
```

**Port strategy**:
- Use pre-primitives JSX structure verbatim
- Preserve current modern fixes:
  - Title metadata: no duplicate brand suffix (use `absoluteTitle: true` or remove suffix from title)
  - `data-faction="werewolves"|"mafia"` on `<main>` (NOT `data-theme="werewolves"|"mafia"` — that's reserved for light/dark)
  - `requireSession()` auth gating preserved
  - `visualAuth=1` query param bypass preserved
- Remove primitive imports if present

**Commit message**:
```
feat(create): port create page entry points to legacy markup
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest
# Manual: open /create, /werewolf/create, /mafia/create — all render
# Manual: ?visualAuth=1 bypass still works
```

---

### Commit 2 — Port lobby-create-client.tsx

**File**: `apps/web/components/lobby-create-client.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby-create-client.tsx > /tmp/legacy-lobby-create-client.tsx
```

**Port strategy**:
- Use pre-primitives Suspense fallback styling (no primitive shells)
- Preserve mode parsing logic
- Preserve family detection

**Commit message**:
```
feat(create): port lobby-create-client suspense fallback to legacy markup
```

---

### Commit 3 — Port LobbyWizard frame

**Files**:
- `apps/web/components/lobby/LobbyWizard.tsx`
- `apps/web/components/lobby/LobbyWizard.module.css`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/LobbyWizard.tsx > /tmp/legacy-wizard.tsx
git show 69bbcca8:apps/web/app/globals.css | grep -nE "^\.(lobby-wizard|lobby-form|lobby-step)" > /tmp/legacy-wizard-css.txt
```

**Port strategy**:
- **CRITICAL**: this file holds wizard state via `useReducer(lobbyFormReducer)`. State logic must NOT change.
- Port: outer JSX structure, `<main>`, `<section>` wrappers, hero/header markup
- Remove: `<SceneCard background={...}>` wrapper around wizard content
- Preserve: reducer dispatch, transition logic, submit flow, autofocus, ViewTransition API usage
- Drop M13 atmospheric layers: tavern backdrop config, faction borders, parchment chapter chip integration

**M13 reversion checklist**:
- ❌ `--art-lobby-werewolves`/`--art-lobby-mafia` token consumption removed
- ❌ Parchment chapter chips with Roman numerals → replaced with pre-primitives numeric step pills
- ❌ Frosted plaque on step nav → flat pre-primitives styling
- ❌ Faction-color hairline border on wizard frame → pre-primitives chrome
- ❌ SceneCard veil/scrim overlay → no SceneCard wrapping

**Module CSS** — replace current `LobbyWizard.module.css` content with pre-primitives styles. Add header:
```css
/* Legacy visual island. Fidelity target: 69bbcca8. Do not migrate to primitives without design approval. */
```

**Commit message**:
```
feat(create): port LobbyWizard frame to legacy markup keeping reducer intact
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual: full wizard click-through Step 1 → 2 → 3 → 4
# Keyboard: arrow nav works
# Submit: end-to-end game creation succeeds
```

**FAILURE mode — if wizard reducer breaks**: stash + restart from pre-flight baseline. The reducer is wizard's brain — must not be touched. Only outer JSX/CSS.

---

### Commit 4 — Port StepNav

**File**: `apps/web/components/lobby/StepNav.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/StepNav.tsx > /tmp/legacy-step-nav.tsx
```

**Port strategy**:
- Replace Roman numeral chapter chips → numeric step pills (1, 2, 3, 4)
- Remove `data-status="visited"` wax seal stamp logic — pre-primitives had simpler "active/inactive" pattern
- Preserve keyboard handler (`onKeyDown` arrow nav)
- Preserve `canAdvance` validation gating
- Preserve dispatch behavior

**Drop wrapper-context plaque CSS** (it's in LobbyWizard.module.css now after Commit 3).

**Commit message**:
```
feat(create): port StepNav to legacy numeric step pills
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual: click each step, verify chip styling
# Keyboard arrow left/right works
# Visited steps don't show ✓ seal (pre-primitives didn't have this)
```

---

### Commit 5 — Port ModeTileCard + PresetChips + QuickStartRow

**Files**:
- `apps/web/components/lobby/ModeTileCard.tsx`
- `apps/web/components/lobby/PresetChips.tsx`
- `apps/web/components/lobby/QuickStartRow.tsx`

**Pre-primitives source**:
```bash
for f in ModeTileCard PresetChips QuickStartRow; do
  git show 69bbcca8:apps/web/components/lobby/$f.tsx > /tmp/legacy-$f.tsx
done
```

**Port strategy**:
- Remove `<PaperCard>` wrappers if present in current
- Pre-primitives uses `<button>` with custom classes like `.mode-tile`, `.preset-chip`
- Preserve onClick handlers + selected state logic

**Commit message**:
```
feat(create): port supporting display components to legacy markup
```

---

### Commit 6 — Port Field component

**File**: `apps/web/components/lobby/Field.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/Field.tsx > /tmp/legacy-field.tsx
```

**Port strategy**:
- Remove any primitive imports
- Preserve label/input/hint/error markup structure
- Preserve `actionLabel` button (refresh icon)

**This is shared form helper** — used by many step components. Port BEFORE step components that use it.

**Commit message**:
```
feat(create): port Field form helper to legacy markup
```

---

### Commit 7 — Port StepRoom (Step 1)

**File**: `apps/web/components/lobby/StepRoom.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/StepRoom.tsx > /tmp/legacy-step-room.tsx
```

**Port strategy**:
- Remove `<PaperCard>` shell wrapper
- Preserve `useRef` autofocus logic
- Preserve `dispatch` calls for room name, mode change, player count slider
- Preserve `playerRange` validation

**Functional verification — Step 1**:
- Room name auto-populates with random name
- Refresh button regenerates name
- Mode selector changes wizard state
- Player count slider responds + clamps to valid range

**Commit message**:
```
feat(create): port StepRoom (step 1) to legacy markup
```

**Gates** (STRICTER for state-touching commits):
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual Step 1 verification:
# - Open /create
# - Verify room name auto-populates
# - Click refresh icon → new name
# - Change mode dropdown → confirm wizard state updates
# - Drag player count slider → confirm clamping
# - Tab through inputs — focus order matches pre-primitives
```

---

### Commit 8 — Port StickyPreview + MobileSummaryChip

**Files**:
- `apps/web/components/lobby/StickyPreview.tsx`
- `apps/web/components/lobby/MobileSummaryChip.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/StickyPreview.tsx > /tmp/legacy-sticky.tsx
git show 69bbcca8:apps/web/components/lobby/MobileSummaryChip.tsx > /tmp/legacy-mobile-chip.tsx
```

**Port strategy**:
- Read-only display components — minimal risk
- Pre-primitives sticky behavior: `position: fixed` or `sticky` with specific offset
- Mobile chip: appears on mobile only via media query

**Commit message**:
```
feat(create): port StickyPreview and MobileSummaryChip to legacy markup
```

---

### Commit 9 — Port ManualTempoPanel + AdvancedDrawer

**Files**:
- `apps/web/components/lobby/ManualTempoPanel.tsx`
- `apps/web/components/lobby/AdvancedDrawer.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/ManualTempoPanel.tsx > /tmp/legacy-manual-tempo.tsx
git show 69bbcca8:apps/web/components/lobby/AdvancedDrawer.tsx > /tmp/legacy-advanced-drawer.tsx
```

**Port strategy**:
- ManualTempoPanel: time inputs for day/night/vote phases
- AdvancedDrawer: collapsible advanced options
- Preserve dispatch + validation

**Functional verification — manual tempo**:
- Click "Ръчно" tempo card → ManualTempoPanel appears
- Enter time values → wizard state updates
- AdvancedDrawer expands/collapses

**Commit message**:
```
feat(create): port ManualTempoPanel and AdvancedDrawer to legacy markup
```

---

### Commit 10 — Port StepStyle (Step 3)

**File**: `apps/web/components/lobby/StepStyle.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/StepStyle.tsx > /tmp/legacy-step-style.tsx
```

**Port strategy**:
- Remove `<PaperCard>` shell
- Tempo cards (Бърза/Нормална/На живо/Ръчно) become raw `<button>` with classes
- Preserve `dispatch({ type: "SET_TEMPO", payload })` calls

**Functional verification — Step 3**:
- Click each tempo card → wizard state updates
- "Ръчно" reveals ManualTempoPanel
- ManualTempoPanel time inputs persist on step change

**Commit message**:
```
feat(create): port StepStyle (step 3) to legacy markup
```

---

### Commit 11 — Port RoleTileLarge + RoleCarousel + RoleDetailModal

**Files**:
- `apps/web/components/lobby/RoleTileLarge.tsx`
- `apps/web/components/lobby/RoleCarousel.tsx`
- `apps/web/components/lobby/RoleDetailModal.tsx`

**Pre-primitives source**:
```bash
for f in RoleTileLarge RoleCarousel RoleDetailModal; do
  git show 69bbcca8:apps/web/components/lobby/$f.tsx > /tmp/legacy-$f.tsx
done
```

**Port strategy**:
- RoleTileLarge: role card with portrait, name, description
- RoleCarousel: scrollable role browser
- RoleDetailModal: pre-primitives may have used custom modal, NOT Dialog primitive
- Preserve onClick + selection state

**Sacred**: if RoleDetailModal used `Dialog` primitive (current), check if pre-primitives had custom modal. If yes, port custom; if no, decide carefully whether to remove Dialog (Dialog is one of the 3 Motion files — its primitive remains for other consumers).

**Recommendation**: keep `Dialog` primitive in RoleDetailModal IF pre-primitives used a generic modal (functionally equivalent). Otherwise port pre-primitives custom modal markup.

**Commit message**:
```
feat(create): port role tile/carousel/modal to legacy markup
```

---

### Commit 12 — Port StepRoles (Step 2 — HIGHEST RISK)

**File**: `apps/web/components/lobby/StepRoles.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/StepRoles.tsx > /tmp/legacy-step-roles.tsx
```

**Port strategy**:
- Remove `<PaperCard>` shell
- Role checkboxes become raw markup with custom classes
- **Preserve `criticalRoleWarnings(state)` validation**
- **Preserve `countRoles(config.roles)` logic**
- **Preserve role count vs player count validation**

**Functional verification — Step 2**:
- Click role checkboxes → wizard state updates
- Counter shows roles vs player count
- Validation warnings appear when invalid (e.g., not enough roles for player count)
- Can't advance to Step 3 if validation fails

**Commit message**:
```
feat(create): port StepRoles (step 2) to legacy markup preserving role validation
```

**THIS COMMIT'S GATE IS STRICTER**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Test ALL these scenarios:
# - Default role config: confirm valid → can advance
# - Manually uncheck roles below count: validation warns
# - Try advance with warnings: blocked
# - Check critical role addition (e.g., Seer for werewolves): updates count
# - Mafia role config: separate validation works
# - Werewolves role config: separate validation works
```

If ANY scenario fails → revert + investigate.

---

### Commit 13 — Port StepPreview (Step 4 — submit flow)

**File**: `apps/web/components/lobby/StepPreview.tsx`

**Pre-primitives source**:
```bash
git show 69bbcca8:apps/web/components/lobby/StepPreview.tsx > /tmp/legacy-step-preview.tsx
```

**Port strategy**:
- Remove `<PaperCard>` shell + `<Pill>` submit button
- Pre-primitives uses raw `<button class="btn btn-primary">` for submit
- **Preserve `onSubmit` callback prop**
- **Preserve summary rendering from wizard state**
- Pre-primitives may have specific confetti trigger position — verify markup

**Sacred**: do NOT change `onSubmit` signature. LobbyWizard passes its room creation handler.

**Functional verification — Step 4**:
- Summary shows: room name, mode, player count, role list, tempo
- Submit button visible
- Click Submit → confetti burst → router.push("/lobby/<code>")
- Network: POST request to room creation endpoint
- Redirect successful

**Commit message**:
```
feat(create): port StepPreview (step 4) submit flow to legacy markup
```

**END-TO-END TEST AFTER THIS COMMIT**:
```bash
pnpm playtest

# Manual full flow:
# 1. localhost:3000/create
# 2. Step 1: name auto, change to "Тест", select mode
# 3. Step 2: keep default roles
# 4. Step 3: select Нормална tempo
# 5. Step 4: review summary
# 6. Submit → confetti → /lobby/<6-digit-code>

# Try /werewolf/create same flow
# Try /mafia/create same flow

# All three: end-to-end game creation MUST work
```

---

### Commit 14 — Extract LegacyCreate.module.css

**Goal**: consolidate any wizard-specific CSS that ended up in component files into a shared `LegacyCreate.module.css` module.

**Files**:
- `apps/web/components/lobby/LegacyCreate.module.css` (NEW)
- Update imports in all wizard components to consume this module

**Pre-primitives CSS extraction**:
```bash
# Identify wizard CSS in pre-primitives globals.css
git show 69bbcca8:apps/web/app/globals.css | grep -nE "^\.(lobby-|mode-|preset-|tempo-|role-|field-|step-|sticky-|mobile-summary|wizard|advanced-drawer|manual-tempo|quick-start)" > /tmp/wizard-css-blocks.txt
```

**Add header**:
```css
/* Legacy visual island. Fidelity target: 69bbcca8. Do not migrate to primitives without design approval. */
```

**globals.css discipline**: any wizard-specific CSS that snuck into `apps/web/app/globals.css` during port should be MOVED to `LegacyCreate.module.css`, not duplicated. Verify with grep at end.

**Commit message**:
```
style(create): extract LegacyCreate.module.css from pre-primitives
```

---

### Commit 15 — Modern fixes layer (reapply on top)

**Files**: page.tsx files + any components that have modern fixes

**Modern fixes to reapply** (verify each one):

1. **Title metadata** — no duplicate brand suffix:
   - `/create` → `Създай игра` (or use `absoluteTitle: true`)
   - `/werewolf/create` → `Създай стая за Върколак`
   - `/mafia/create` → `Създай стая за Мафия`

2. **`data-faction` attribute namespace**:
   - `<main data-faction="werewolves" data-family="werewolves">` (preserve)
   - NOT `data-theme="werewolves"` (reserved for light/dark)

3. **Bulgarian copy preservation**:
   - All wizard step labels match dictionary canonical terms
   - No legacy strings leaked through during port
   - Verify "Постижения" never appears (should be "Легенди" if mentioned)

4. **Auth gating**:
   - `requireSession()` preserved on all 3 page.tsx files
   - `visualAuth=1` bypass preserved

5. **M13 reversions verified** (final check):
   - No Roman numeral step nav
   - No frosted plaque wrappers
   - No faction-color hairline borders
   - No tavern atmospheric backdrop drift (revert to pre-primitives backdrop behavior)
   - No SceneCard imports in any wizard component

**Commit message**:
```
chore(create): reapply modern fixes layer after legacy port
```

---

## Sacred files / patterns frozen

These MUST NOT be touched during port:

| File/pattern | Why frozen |
|---|---|
| `apps/web/lib/lobby-form.ts` | Reducer + state logic — wizard's brain |
| `apps/web/lib/roomname-generator.ts` | Random name logic |
| `apps/web/lib/role-art.ts` | Role artwork mapping |
| `lobbyFormReducer` calls | State machine — must not change |
| `dispatch({ type: ... })` calls | State events — must not change |
| `criticalRoleWarnings(state)` logic | Validation rules |
| `countRoles(config.roles)` logic | Counting logic |
| `playerRange(mode)` constraints | Mode-specific bounds |
| `boundedPlayerCount(state)` | Clamping |
| `timersForState(state)` | Tempo calculation |
| `requireSession()` auth | Auth gating |
| ViewTransition usage | Page transition |
| Confetti burst trigger | Submit feedback |
| `router.push("/lobby/...")` | Redirect after creation |
| Game server room creation API | Backend contract |

**Rule**: every commit touches **only JSX structure + CSS**. Logic stays untouched.

---

## Test preservation strategy

### Existing tests

Locate:
```bash
find apps/web/components/lobby/__tests__ apps/web/lib/__tests__ -name "*.test.*" 2>&1
```

These tests likely cover:
- Wizard step navigation
- Form validation
- Reducer state transitions
- Mode + tempo selection logic

### Test updates allowed

If a test fails due to **class name change** (visual port renamed CSS classes): UPDATE the test in the same commit as the JSX change.

If a test fails due to **behavioral change**: STOP. Behavior changed unintentionally. Revert.

### Test additions

If port introduces a NEW edge case (e.g., new keyboard interaction), add a regression test.

---

## Anti-pattern guard considerations

Current guard (from M19-M27 round 1 final state) allows:
- ✅ `:global(.lobby-shell .anything)` — page-namespaced
- ✅ `:global(.lobby-wizard-frame)` — page-local class
- ✅ `:global(.mode-tile)` — page-local

Still forbidden:
- ❌ `:global(.paper-card)` direct — primitive identity override
- ❌ `:global([data-ds-scene-card])` direct — primitive data attribute override

Run after each commit:
```bash
rg ":global\([^)]*\.(paper-card|scene-card|pill|medallion|surface)" apps/web 2>&1 | wc -l
# Expected: 0
```

If anti-pattern fires → guard is doing its job. Refactor offending selector to page-namespaced.

---

## Verification matrix (final acceptance)

Per route × theme × viewport:

```
Routes:
- /create?visualAuth=1
- /werewolf/create?visualAuth=1
- /mafia/create?visualAuth=1

Themes:
- light
- dark

Viewports:
- desktop (1280x800)
- mobile (375x812)

Total: 3 routes × 2 themes × 2 viewports = 12 visual scenarios
```

For each scenario, compare side-by-side:
- localhost:3000/<route> (current/legacy)
- localhost:3101/<route> (pre-primitives reference)

Acceptance:
- ✅ Pixel-level visual fidelity (or explained intentional diff)
- ✅ Functional end-to-end works (create game → /lobby redirect)
- ✅ Keyboard navigation works
- ✅ Validation warnings appear at right time
- ✅ Mobile summary chip behaves
- ✅ Sticky preview behaves
- ✅ Console errors: zero
- ✅ Hydration warnings: zero

---

## Failure modes + recovery

| Symptom | Likely cause | Recovery |
|---|---|---|
| Wizard freezes after step change | Reducer state corrupted during port | `git reset --soft HEAD~1`, restore reducer logic from current |
| Submit button doesn't fire | `onSubmit` callback wired wrong | Re-verify props chain LobbyWizard → StepPreview |
| Validation always passes | Validation logic accidentally removed | Restore `criticalRoleWarnings` call |
| Roman numeral step nav persists | M13 chip styling not removed | Re-extract pre-primitives StepNav rendering |
| Tavern backdrop visible | M13 token consumption not removed | Drop `--art-lobby-werewolves`/`--art-lobby-mafia` references |
| Mobile summary chip overflows | Pre-primitives mobile media query not ported | Add to LegacyCreate.module.css |
| Confetti doesn't trigger on submit | Confetti effect tied to wrong state change | Re-verify state transition that triggers confetti |
| Keyboard arrows don't navigate | StepNav `onKeyDown` handler removed | Restore from pre-primitives source |
| Tests fail on class name change | Test selectors hardcoded | Update test selectors in same commit |
| `pnpm playtest` fails | Submit endpoint broken or redirect wrong | Check `router.push` path matches existing room URL pattern |
| Visual diff massive | M13 layers not fully reverted | Re-verify token consumption + backdrop CSS |
| Anti-pattern guard fires | New `:global(.paper-card)` rule snuck in | Refactor to page-namespaced selector |

---

## Operator notes

- **ONE commit at a time, gate between each.** Do NOT batch multiple components into one commit.
- **Outside-in port order is mandatory.** Don't skip ahead to StepRoles before StepRoom.
- **`pnpm playtest` after every commit** — non-negotiable for /create.
- **End-to-end manual smoke after every state-touching commit** (StepRoom, StepStyle, StepRoles, StepPreview).
- **`bg-copy-reviewer` after every commit** touching JSX text — even if you think text is unchanged.
- **Sacred lobby logic frozen** — only JSX structure + CSS change.
- **Existing tests are SAFETY NET** — failing tests mean something broke. Don't disable them.
- **Functional > visual** if conflict — preserve behavior even if visual diff exists. Document diff for follow-up.
- **Pre-primitives dev server `:3101` mandatory** for visual reference. Without it, cannot verify pixel fidelity.
- **Modern fixes layer LAST** (Commit 15) — port DOM structure first, fix bugs after.

---

## After M28 lands

Architecture state:

| Routes | Primitives | Legacy islands |
|---|---|---|
| `/` (landing) | ✅ Display, Pill | — |
| `/werewolf`, `/mafia` | ✅ minimal | — |
| `/werewolf/roles`, `/mafia/roles` | already mixed | already mixed |
| `ArtifactImage` utility | ✅ | — |
| **All 17+ other routes** | — | ✅ Legacy island |

Primitives chapter shrinks to landing + utility. Legacy islands chapter covers everything else.

Optional follow-up: visual baseline refresh global, anti-pattern guard final hardening, docs update.

---

## TL;DR for handoff

> Execute M28 at `docs/frontend-audit-v3/codex-prompt-create-flow-legacy-island-careful-pr-m28.md`. 15 atomic commits, ~3-4 hours. Port `/create` + `/werewolf/create` + `/mafia/create` + LobbyWizard + 16 step components to legacy visual island matching commit `69bbcca8`. **STRICTER** than M19-M27: `pnpm playtest` after every commit, end-to-end manual smoke after state-touching commits, outside-in port order, sacred lobby reducer/validation logic FROZEN. Compare against `:3101/create?visualAuth=1` for pixel fidelity. If wizard reducer or submit flow breaks → revert commit immediately.
