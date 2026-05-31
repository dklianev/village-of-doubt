# Codex prompt — PR M28.2: /create Wizard Faction Accent Visibility

**Scope**: visually distinguish `/werewolf/create` (green) from `/mafia/create` (red) by introducing a faction-aware `--accent-faction` token and applying it to key wizard UI elements. M28.1 already restored selector namespace matching (CSS variables populate correctly per faction), but specific elements still use hardcoded amber values OR generic `--gold` that's visually similar across factions.

**Effort**: ~45 minutes, 5 atomic commits.

**Risk profile**: Low — additive token + targeted style replacements. No structural CSS changes. No JSX changes.

---

## Why this is needed

Side-by-side audit (post-M28.1) showed:
- `/werewolf/create` active step indicator: amber/gold
- `/mafia/create` active step indicator: amber/gold (visually identical)

Both factions use `var(--gold)`:
- werewolves `--gold`: `#d19a42` (amber)
- mafia `--gold`: `#c89a55` (slightly darker amber)

Visually 5% delta — indistinguishable to user. Pre-primitives reference had same behavior, but user requested **clear visual differentiation** so faction is obvious from the moment they open the wizard.

Solution: introduce `--accent-faction` token using existing distinct faction colors (`--moss` for werewolves, `--blood` for mafia base).

---

## Pre-flight verification

```bash
# 1. M28.1 committed
git log --oneline -5 | grep -E "(24fd2d91|f83d0b32|0e5e438a)" && echo "✓ M28.1 committed"

# 2. Existing faction tokens in globals.css
grep -nE "^\s*--(moss|blood|gold)\s*:" apps/web/app/globals.css | head -10
# Expected: shows --moss, --blood, --gold values per faction block

# 3. M28.1 :where() selector list pattern
grep -nE ":where\(\[data-family=\"(werewolves|mafia)\"\]" apps/web/app/globals.css | head -5

# 4. Hardcoded amber in current LegacyCreate (the target to replace)
grep -nE "rgba\(209, 154, 66" apps/web/components/lobby/LegacyCreate.module.css | head -10

# 5. Architectural invariants
rg ":global\(\[data-ds-" apps/web | wc -l    # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l  # MUST be 3
pnpm regression 2>&1 | tail -3                # green
```

---

## Operating rules (inherit M28.1)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`.
2. After every commit: `pnpm playtest`.
3. Visual side-by-side comparison: `:3000` vs `:3101` after each commit (manual).
4. **NO new dependencies. No new fonts. No new Motion imports.** Motion file count stays 3.
5. **Bulgarian copy unchanged.** No `bg-copy-reviewer` needed.
6. **Sacred files frozen**: `lobbyFormReducer`, validation logic, submit flow, primitive APIs.
7. **Anti-pattern guard stays FAIL.**
8. **Logical commits** — one concern per commit.

---

## Commit 1 — Add `--accent-faction` tokens

### Goal
Introduce faction-distinct accent tokens at the root level. Both factions get faction-specific values; non-faction default falls back to gold (preserves landing pages, neutral surfaces).

### File: `apps/web/app/globals.css`

Locate the existing `:where([data-family="werewolves"], [data-faction="werewolves"], [data-theme="werewolves"])` block (M28.1 introduced this pattern around line 263). Add inside it:

```diff
 :where([data-family="werewolves"], [data-faction="werewolves"], [data-theme="werewolves"]) {
   --ink: #1b100c;
   /* ... existing tokens ... */
+
+  /* Faction-distinct accent (M28.2) */
+  --accent-faction: #59633b;          /* moss green base */
+  --accent-faction-bright: #7a8a4f;   /* lighter moss for hover/highlight */
+  --accent-faction-tint: rgba(89, 99, 59, 0.18);  /* low-alpha tint for backgrounds */
 }
```

Locate the existing `:where([data-family="mafia"], [data-faction="mafia"], [data-theme="mafia"])` block (around line 309). Add:

```diff
 :where([data-family="mafia"], [data-faction="mafia"], [data-theme="mafia"]) {
   --ink: #17120f;
   /* ... existing tokens ... */
+
+  /* Faction-distinct accent (M28.2) */
+  --accent-faction: #7b1f1b;          /* burgundy red base */
+  --accent-faction-bright: #9e342d;   /* brighter blood for hover/highlight */
+  --accent-faction-tint: rgba(123, 31, 27, 0.18);  /* low-alpha tint for backgrounds */
 }
```

**Default fallback** (for pages without faction): add `--accent-faction` to base `:root` block as gold fallback:

```diff
 :root {
   /* ... existing tokens ... */
+
+  /* Faction accent fallback (gold) for non-faction pages */
+  --accent-faction: var(--gold);
+  --accent-faction-bright: var(--ember, #f0b45d);
+  --accent-faction-tint: rgba(209, 154, 66, 0.18);
 }
```

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual: open browser DevTools
# Inspect <main data-family="werewolves"> → check computed style
# Confirm: --accent-faction: #59633b
# Inspect <main data-family="mafia">
# Confirm: --accent-faction: #7b1f1b
```

### Commit message

```
feat(css): introduce --accent-faction token for faction-distinct surfaces

Add faction-aware --accent-faction (and bright/tint variants) per
faction block. Werewolves uses moss green (#59633b), mafia uses
burgundy red (#7b1f1b). Default fallback to gold for non-faction
pages. Token now available for any UI element that wants to read
faction tint without hardcoding amber.
```

---

## Commit 2 — Apply `--accent-faction` to StepNav active state

### Goal
Replace hardcoded `rgba(209, 154, 66, ...)` in `.lobby-step-nav button[data-status="active"]` with `--accent-faction`. This is the **most visible faction-distinguishing change** — active step pill border + background now show faction color.

### File: `apps/web/components/lobby/LegacyCreate.module.css`

```diff
 :global(.lobby-step-nav button[data-status="active"]) {
-  border-color: rgba(209, 154, 66, 0.58);
-  background: rgba(209, 154, 66, 0.16);
+  border-color: color-mix(in srgb, var(--accent-faction) 62%, transparent);
+  background: var(--accent-faction-tint);
   color: #fff6e5;
 }

 :global(.lobby-step-nav button[data-status="active"] span),
 :global(.player-count-control button),
 :global(.role-tile-controls button) {
-  background: var(--gold);
+  background: var(--accent-faction);
   color: var(--ink);
 }
```

**Note**: `color-mix(in srgb, ...)` is widely supported (Chrome 111+, Firefox 113+, Safari 16.2+). If broader compatibility is needed, hardcode the tint with same percentage but lose the dynamic theme adjustment — keep `color-mix` unless playtest reveals compatibility issue.

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual visual:
# - Open localhost:3000/werewolf/create
# - Step 1 active: GREEN border + GREEN background tint
# - Step 1 number circle: GREEN background
# - Open localhost:3000/mafia/create
# - Step 1 active: RED border + RED background tint
# - Step 1 number circle: RED background
# - Click through steps — color follows active state per faction
```

### Commit message

```
style(create): apply --accent-faction to StepNav active state

Active step pill border and background now show faction color
(green for werewolves, red for mafia) instead of generic amber.
Number circle inside active step also uses faction accent. Same
treatment extends to player-count-control and role-tile-controls
buttons. Visual distinction between /werewolf/create and
/mafia/create immediately obvious at first viewport.
```

### Failure modes

| Symptom | Fix |
|---|---|
| Active step still amber | Browser cache → hard refresh; verify `--accent-faction` exists in DevTools |
| Active step black/white | `color-mix()` not supported by browser; fall back to hardcoded `rgba(89, 99, 59, 0.62)` for werewolves and `rgba(123, 31, 27, 0.62)` for mafia using paired rules |
| Active state has no background | `--accent-faction-tint` not propagating; check Commit 1 added it |
| Faction theme breaks on non-create pages | Verify default fallback in `:root` is set; `--accent-faction: var(--gold)` |

---

## Commit 3 — Apply to sticky preview validation, slider, focus rings

### Goal
Extend faction accent to secondary surfaces: sticky preview validation indicator, player count slider track, focus rings.

### File: `apps/web/components/lobby/LegacyCreate.module.css`

#### 3a. Sticky preview validation indicator

```diff
 :global(.sticky-preview .preview-validation[data-valid="true"]) {
-  color: var(--gold);
+  color: var(--accent-faction-bright);
+  border-color: color-mix(in srgb, var(--accent-faction) 40%, transparent);
 }
```

#### 3b. Player count slider track

```diff
 :global(.player-count-control input[type="range"]) {
-  accent-color: var(--gold);
+  accent-color: var(--accent-faction);
 }
```

#### 3c. Focus ring on faction-distinct surfaces

Search for `outline:` or `box-shadow:` rules used for focus indicators in this module. If they hardcode gold, replace:

```diff
 :global(.lobby-step-nav button:focus-visible),
 :global(.create-recipe-card:focus-visible),
 :global(.role-tile-large:focus-visible) {
-  outline: 2px solid var(--gold);
+  outline: 2px solid var(--accent-faction);
   outline-offset: 2px;
 }
```

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual:
# - Verify "Частно село" / "Частна маса" validation tag uses faction color
# - Drag player count slider — track shows faction color
# - Tab through interactive elements — focus ring is faction-tinted
# - Test on /werewolf/create AND /mafia/create
```

### Commit message

```
style(create): extend --accent-faction to validation, slider, focus rings

Sticky preview "valid" validation tag, player count slider track,
and focus indicators across StepNav/preset/role tiles now use
faction-distinct accent. Secondary surfaces complete the faction
theming once eye lands on primary StepNav signal.
```

---

## Commit 4 — Apply to preset cards + role tile selection states

### Goal
Final layer of faction visibility: featured preset card border, selected role tile border, active tempo card highlight.

### File: `apps/web/components/lobby/LegacyCreate.module.css`

#### 4a. Featured preset card left border

```diff
 :global(.create-recipe-card[data-featured="true"]) {
-  border-left: 4px solid var(--blood);
+  border-left: 4px solid var(--accent-faction);
 }
```

#### 4b. Selected role tile border

Search for `.role-tile-large[data-selected="true"]` or similar pattern:

```diff
 :global(.role-tile-large[data-selected="true"]) {
-  border-color: var(--gold);
-  box-shadow: 0 0 0 2px rgba(209, 154, 66, 0.32);
+  border-color: var(--accent-faction);
+  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-faction) 32%, transparent);
 }
```

#### 4c. Active tempo card

Search for `.tempo-card[data-active="true"]` or `.preset-chip[data-active="true"]`:

```diff
 :global(.tempo-card[data-active="true"]) {
-  border-color: var(--gold);
-  background: rgba(209, 154, 66, 0.12);
+  border-color: var(--accent-faction);
+  background: var(--accent-faction-tint);
 }
```

If selector names differ, use **grep** to find the right rule first:

```bash
grep -nE "(data-selected|data-active|data-featured).*border-color" apps/web/components/lobby/LegacyCreate.module.css | head -10
```

### Verification

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm playtest

# Manual: full wizard click-through on /werewolf/create
# - Step 1: featured preset has GREEN left border
# - Step 2: select roles — GREEN border on selected tiles
# - Step 3: tempo card active state GREEN tint
# Repeat on /mafia/create — same elements show RED
```

### Commit message

```
style(create): apply --accent-faction to preset cards and selection states

Featured preset card left border, selected role tile border, and
active tempo card highlight now use faction accent. Wizard's
selection mechanics communicate faction at every interactive level.
```

---

## Commit 5 — Refresh visual baselines

After Commits 1-4 land AND manual side-by-side approval against `:3101`:

```bash
# Inspect every diff manually before update
pnpm visual --grep "create|werewolf-create|mafia-create|lobby"

# Expected diffs per screenshot:
# - /werewolf/create active step: GREEN instead of amber
# - /mafia/create active step: RED instead of amber
# - Validation tag in sticky preview: faction-tinted
# - Slider track: faction-tinted
# - Selected role tile border: faction-tinted
# - Featured preset card left border: faction-tinted

# After sign-off:
pnpm visual --grep "create|werewolf-create|mafia-create|lobby" --update-snapshots
```

### Commit message

```
test(visual): refresh create baselines after M28.2 faction accent visibility
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

For each:
- ✅ `/werewolf/create` shows clearly GREEN accents in StepNav, validation, slider, selection states
- ✅ `/mafia/create` shows clearly RED accents in same locations
- ✅ `/create` (default, no faction) shows GOLD accents (fallback works)
- ✅ Switching between werewolves and mafia preset in default `/create` updates accents dynamically
- ✅ Wizard reducer state preserved — no functional regression
- ✅ End-to-end game creation works on all 3 routes

### Architectural invariants

- ✅ `pnpm regression` all 16 contracts pass
- ✅ Anti-pattern guard remains FAIL mode
- ✅ Motion file count = 3
- ✅ globals.css size within ±20 LOC tolerance (small token additions only)
- ✅ No new dependencies
- ✅ Bulgarian copy unchanged
- ✅ `--accent-faction` token defined in 3 places: `:root` (gold fallback), werewolves block (moss), mafia block (blood)

### Cross-page faction verification

Verify faction-themed pages outside /create still look correct:

| Page | Expected |
|---|---|
| `/werewolf` home | Unchanged (didn't reference --accent-faction) |
| `/mafia` home | Unchanged |
| `/werewolf/roles` | Unchanged unless rules referenced gold ambiently |
| `/mafia/roles` | Unchanged |
| `/play` game shell | Unchanged unless game shell uses --accent-faction |

If any of these visually changes unexpectedly, investigate — token shouldn't affect pages that don't reference it.

---

## Failure modes

| Symptom | Fix |
|---|---|
| `color-mix()` unsupported in target browser | Replace with hardcoded rgba per faction (write paired rules per `:where()` selector) |
| Active step appears washed out | `--accent-faction-tint` too low alpha; bump from 0.18 to 0.24 |
| Werewolves green too dark | Use `--moss` lighter shade: `#7a8a4f` for `--accent-faction-bright` |
| Mafia red too dark | Adjust to brighter shade: `#9e342d` for `--accent-faction-bright` |
| Focus ring invisible on light theme | Bump outline width to 3px or use `--accent-faction-bright` for higher contrast |
| Selected role tile border barely visible | Bump from 2px to 3px solid border |
| globals.css size budget fails | New tokens added 3 lines per block × 3 blocks = 9 LOC; well under any budget |
| Visual baseline diff massive | Intentional — accent color change is the point; review manually then update |
| Submit button changes color | Submit uses `--blood` not `--accent-faction` — verify selector not accidentally caught |

---

## Operator notes

- **Commit 1 is foundation** — touches globals.css with token additions. Verify exact location of `:where(...)` selector blocks before adding to ensure new tokens are scoped correctly.
- **Commit 2 has highest visible impact** — first thing user sees on opening wizard.
- **Commits 3 + 4 are progressive layering** — each adds another faction-distinct surface.
- **Side-by-side with `:3101`** isn't required for visual fidelity (pre-primitives also used amber). Compare against **mockup OR user's mental model** — clear faction distinction.
- **Sequential commits** — don't batch into one. Easy bisect if any layer breaks.
- **Visual baselines update LAST** (Commit 5) — only after all 4 style commits land and manual approval.
- **NO new dependencies, fonts, Motion imports.** CSS-only change.
- **Functional verification per commit**: `pnpm playtest` after each — wizard must still work end-to-end.

---

## After M28.2 lands

User opens `/werewolf/create` → immediate visual signal: GREEN.
User opens `/mafia/create` → immediate visual signal: RED.
Wizard becomes self-identifying without reading text.

Optional follow-up M28.3 (defer unless requested):
- Extend `--accent-faction` to `/play` room phase indicators
- Update `/werewolf` and `/mafia` home pages to use `--accent-faction` for hero CTA glow
- Add `--accent-faction` to history/leaderboard filter chips (faction-based filter)
- Sound cues per faction (out of scope — visual only)

---

## TL;DR for handoff

> Execute M28.2 at `docs/frontend-audit-v3/codex-prompt-create-faction-accent-visibility-pr-m28-2.md`. 5 atomic commits, ~45 minutes. (1) Introduce `--accent-faction` token in globals.css (werewolves green moss, mafia burgundy red, fallback gold). (2) Apply to StepNav active state. (3) Apply to validation tag, slider, focus rings. (4) Apply to preset cards and selection states. (5) Refresh visual baselines after manual sign-off. `pnpm playtest` after every commit. Manual visual comparison required before baseline update — wizard should show distinct GREEN on /werewolf/create and RED on /mafia/create at first glance.
