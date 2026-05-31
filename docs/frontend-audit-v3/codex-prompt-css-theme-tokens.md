# Codex prompt — Migrate `html[data-theme="light"]` selectors to CSS variables

`apps/web/app/globals.css` has **292** `html[data-theme="light"]` selectors. Each adds to style-recalc cost on theme toggle (~80-150ms INP on mid-range mobile). This prompt migrates the **5 highest-impact + lowest-risk shells** to CSS variable tokens.

**Target**: Reduce ~93 selectors (faq + privacy + status + terms + report) → migrate to shared `--legal-shell-*` tokens. Net: 292 → ~199 selectors (-32%).

**Working directly on `main`.** ~7 atomic English commits, ~2 hours Codex work. No new dependencies, no behavior changes, **visual parity required**.

---

## Pre-flight check

```bash
# Confirm we're starting from a clean state
pnpm regression
pnpm typecheck
pnpm build

# Verify current selector counts (numbers Codex will validate against)
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css
# Expect: 292

for shell in faq privacy status terms report; do
  count=$(grep -c "html\[data-theme=\"light\"\] \.${shell}" apps/web/app/globals.css)
  echo "$shell-shell: $count"
done
# Expect:
#   faq-shell: 47
#   privacy-shell: 13
#   status-shell: 10
#   terms-shell: 10
#   report-shell: 13
```

If counts differ, the file has been edited — adjust expectations accordingly.

---

## Per-shell scope (locked targets)

| Shell | Selectors to migrate | Risk | Estimated commit |
|---|---|---|---|
| `.faq-shell` (incl. `.faq-hearth-*`) | 47 | Low — settled, atomic | Stage 2 |
| `.privacy-shell` | 13 | Low — text-heavy | Stage 3 |
| `.status-shell` | 10 | Low — diagnostic page | Stage 4 |
| `.terms-shell` | 10 | Low — text-heavy | Stage 5 |
| `.report-shell` | 13 | Low — form-heavy | Stage 6 |
| **Total** | **93** | | |

**Excluded (high-risk, future PR)**:
- `.landing-shell` / `.game-home-shell` — touched recently with theatre backdrop
- `.lobby-shell` / `.game-shell` / `.play-shell` — active flows
- `.tutorial-shell` — recent fixes from `b545da9 fix(tutorial)`
- `.account-shell` — recent typed-confirmation modal
- Role-detail panels — touched by recent role-card overhaul

These 5 chosen shells share a **parchment + blood-accent** aesthetic and are mostly text-content pages — perfect token candidates.

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Token namespace | `--legal-*` for shared parchment colors, plus per-shell accent tokens where needed |
| Token location | In existing `:root { ... }` block (line 3) and `html[data-theme="light"] { ... }` block (line 237) |
| Light theme overrides | Consolidate ALL light overrides per shell into ONE block under `html[data-theme="light"]` shell-vars |
| Visual parity tolerance | **Pixel-identical** — if anything looks different, revert and re-check token values |
| Class names | Untouched — same as before |
| Behavior changes | **None** — pure refactor |
| Verification per stage | `pnpm regression && pnpm typecheck && pnpm build` + visual diff dark+light |
| Branch | Directly on `main`, atomic English commits |

---

## Stage 1 — Define shared `--legal-*` tokens + pattern doc

The 5 shells share these color families:
- **Background**: cream `rgba(252, 246, 236, X)` (light) ↔ dark `rgba(13, 9, 8, 0.92)` etc.
- **Surface tint**: blood `rgba(132, 47, 43, X)` (light) ↔ amber `rgba(209, 154, 66, X)` (dark)
- **Text body**: `#2a1b10` (light) ↔ `#f5e8c8` (dark)
- **Text muted**: `rgba(79, 56, 41, X)` (light) ↔ `rgba(245, 232, 200, X)` (dark)
- **Accent strong**: `#842f2b` (light) ↔ `#d19a42` (dark)

### Step 1a: Create `docs/css-tokens.md`

```md
# CSS theme token pattern

## Goal
Replace `html[data-theme="light"] .X { property: value }` selectors with CSS
variable definitions, so theme toggle changes ONLY the variables (not 292+
distinct selectors). This dramatically reduces style-recalc cost on toggle.

## Pattern

### Before (selector-based)
```css
.faq-shell {
  background: rgba(13, 9, 8, 0.92);
  color: #f5e8c8;
}
html[data-theme="light"] .faq-shell {
  background: rgba(252, 246, 236, 0.94);
  color: #2a1b10;
}
```

### After (token-based)
```css
:root {
  --legal-shell-bg: rgba(13, 9, 8, 0.92);
  --legal-shell-text: #f5e8c8;
}
html[data-theme="light"] {
  --legal-shell-bg: rgba(252, 246, 236, 0.94);
  --legal-shell-text: #2a1b10;
}
.faq-shell {
  background: var(--legal-shell-bg);
  color: var(--legal-shell-text);
}
```

## Naming convention

- `--legal-shell-*` — shared across faq/privacy/terms/status/report (parchment + blood accent)
- `--legal-text-*` — typography tokens (body, muted, accent)
- `--legal-surface-*` — interior cards, items, callouts
- `--legal-border-*` — outlines, dividers
- Per-shell unique tokens use shell name: `--faq-search-bg`, `--report-success-tint`, etc.

## Migration steps per section

1. List all `html[data-theme="light"] .X { … }` selectors for the section
2. Identify color groups (background tints, text shades, border colors)
3. Define dark defaults as `:root` tokens
4. Define light overrides in single block under `html[data-theme="light"]`
5. Replace inline color values in `.X { ... }` with `var(--token)`
6. Delete `html[data-theme="light"] .X { … }` selectors
7. Run `pnpm build` to catch typos
8. Visual diff: dark + light themes pixel-identical to before

## Verification

```bash
# Count reduction
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css

# Performance test
# 1. pnpm dev
# 2. Chrome DevTools → Performance, CPU 4× throttle
# 3. Record 5s while clicking theme toggle 3 times
# 4. Compare "Recalculate Style" duration to baseline
```
```

### Step 1b: Add shared tokens to `globals.css`

In the existing `:root { ... }` block (around line 3), add at the end:

```css
:root {
  /* … existing tokens … */

  /* Shared chrome tokens for text-content shells (faq, privacy, terms, status, report) */
  --legal-shell-bg: rgba(13, 9, 8, 0.92);
  --legal-shell-border: rgba(245, 232, 200, 0.14);
  --legal-shell-shadow: 0 32px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(245, 232, 200, 0.06);
  --legal-text: #f5e8c8;
  --legal-text-muted: rgba(245, 232, 200, 0.78);
  --legal-text-soft: rgba(245, 232, 200, 0.62);
  --legal-text-accent: #d19a42;
  --legal-text-accent-strong: #f0b45d;
  --legal-surface: rgba(245, 232, 200, 0.06);
  --legal-surface-active: rgba(209, 154, 66, 0.18);
  --legal-border-soft: rgba(245, 232, 200, 0.14);
  --legal-border-strong: rgba(209, 154, 66, 0.42);
}
```

In the existing `html[data-theme="light"] { ... }` block (around line 237), add overrides:

```css
html[data-theme="light"] {
  color-scheme: light;
  background: #f5e7cc;

  /* Legal-shell light theme overrides */
  --legal-shell-bg: rgba(252, 246, 236, 0.94);
  --legal-shell-border: rgba(83, 52, 31, 0.18);
  --legal-shell-shadow: 0 32px 60px rgba(40, 26, 16, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  --legal-text: #2a1b10;
  --legal-text-muted: rgba(42, 27, 16, 0.78);
  --legal-text-soft: rgba(79, 56, 41, 0.6);
  --legal-text-accent: #842f2b;
  --legal-text-accent-strong: #842f2b;
  --legal-surface: rgba(252, 246, 236, 0.6);
  --legal-surface-active: rgba(132, 47, 43, 0.18);
  --legal-border-soft: rgba(132, 47, 43, 0.16);
  --legal-border-strong: rgba(132, 47, 43, 0.6);
}
```

**Token values must match exact rgba values in current `html[data-theme="light"]` rules.** If a shell uses a slightly different alpha (e.g. `rgba(132, 47, 43, 0.22)` instead of `0.16`), add a more specific token like `--faq-border-soft`.

### Commit 1
```
feat(css): introduce shared legal-shell theme tokens with pattern doc
```

---

## Stage 2 — Migrate `.faq-shell` (pilot, 47 selectors)

This is the largest migration. Take it slow.

### Step 2a: Map current overrides

Locate all `html[data-theme="light"] .faq*` blocks. From audit, they span approximately lines 18864-18960.

For each, identify which existing token matches OR if it needs a new `--faq-*` token.

### Step 2b: Replace inline colors with tokens

For each `.faq-*` selector in the **base block** (NOT under `html[data-theme="light"]`), replace inline rgba/hex values:

Example diff for `.faq-hearth-search` (around line 17767-17780ish):

```diff
  .faq-hearth-search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
-   border: 1px solid rgba(245, 232, 200, 0.16);
+   border: 1px solid var(--legal-border-soft);
    border-radius: 18px;
    padding: 8px 14px;
-   background: rgba(13, 9, 8, 0.5);
+   background: var(--legal-shell-bg);
    transition: border-color 180ms ease, background 180ms ease;
  }
```

For values that DON'T have a shared token, add new `--faq-*` tokens at end of `:root` block:

```css
:root {
  /* … legal tokens … */
  /* FAQ-specific tokens */
  --faq-search-bg: rgba(13, 9, 8, 0.5);
  --faq-search-bg-focus: rgba(13, 9, 8, 0.7);
  --faq-item-bg: rgba(245, 232, 200, 0.08);
  --faq-item-bg-active: rgba(209, 154, 66, 0.12);
}

html[data-theme="light"] {
  /* … shared overrides … */
  --faq-search-bg: rgba(252, 246, 236, 0.65);
  --faq-search-bg-focus: rgba(252, 246, 236, 0.92);
  --faq-item-bg: rgba(252, 246, 236, 0.6);
  --faq-item-bg-active: rgba(252, 246, 236, 0.9);
}
```

### Step 2c: Delete all `html[data-theme="light"] .faq-*` selectors

After base `.faq-*` rules use `var(--token)`, delete every `html[data-theme="light"] .faq-*` block. The shared light token overrides handle everything.

Example deletion:

```diff
- html[data-theme="light"] .faq-hearth-search {
-   background: rgba(252, 246, 236, 0.65);
-   border-color: rgba(132, 47, 43, 0.2);
- }
```

This rule becomes redundant because `.faq-hearth-search` now uses `var(--faq-search-bg)` and `var(--legal-border-soft)`, which already have correct light-theme values.

### Step 2d: Visual parity check

```bash
pnpm dev
# Open http://localhost:3000/faq in both themes
# Compare to pre-migration screenshot
```

If pixels differ:
1. Inspect with DevTools — compute style on the differing element
2. Trace which token diverges
3. Adjust token value (most common: alpha mismatch)

### Step 2e: Verify selector count drop

```bash
grep -c 'html\[data-theme="light"\] \.faq' apps/web/app/globals.css
# Expect: 0 (was 47)

grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css
# Expect: 245 (was 292, -47)
```

### Commit 2
```
refactor(css): migrate .faq-shell to legal-shell theme tokens
```

---

## Stage 3 — Migrate `.privacy-shell` (13 selectors)

Same pattern as Stage 2, smaller scope. Privacy-shell shares much with faq-shell — many tokens already defined.

### Step 3a: Find privacy overrides

```bash
grep -n 'html\[data-theme="light"\] \.privacy' apps/web/app/globals.css
# Expect: 13 hits
```

### Step 3b: Replace + delete

For each `.privacy-*` rule, swap inline colors for tokens (reuse `--legal-*` first; add `--privacy-*` only if shell-specific).

Delete `html[data-theme="light"] .privacy-*` blocks.

### Step 3c: Verify

```bash
grep -c 'html\[data-theme="light"\] \.privacy' apps/web/app/globals.css
# Expect: 0

# Visual: /privacy in dark + light
pnpm dev
```

### Commit 3
```
refactor(css): migrate .privacy-shell to legal-shell theme tokens
```

---

## Stage 4 — Migrate `.status-shell` (10 selectors)

Same pattern. Status page is diagnostic with charts/indicators.

### Step 4a-c: Same as Stage 3

```bash
grep -c 'html\[data-theme="light"\] \.status' apps/web/app/globals.css
# Expect: 0 after migration
```

If status uses unique colors for health indicators (red/amber/green), keep those as fixed values (NOT tokenized — they're semantic, not themed).

### Commit 4
```
refactor(css): migrate .status-shell to legal-shell theme tokens
```

---

## Stage 5 — Migrate `.terms-shell` (10 selectors)

Same pattern. Terms is plain text-heavy.

### Commit 5
```
refactor(css): migrate .terms-shell to legal-shell theme tokens
```

---

## Stage 6 — Migrate `.report-shell` (13 selectors)

Same pattern. Report has form fields + success state.

### Commit 6
```
refactor(css): migrate .report-shell to legal-shell theme tokens
```

---

## Stage 7 — Performance verification + final stats

### Step 7a: Measure theme toggle improvement

```bash
pnpm build
pnpm start
```

In another terminal, open Chrome at `http://localhost:3000/faq`:

1. DevTools → Performance, **CPU 4× throttle**
2. Record 5 seconds
3. Click theme toggle button 3 times
4. Stop recording
5. Note total "Recalculate Style" + "Layout" + "Paint" durations

Compare to baseline (record same trace BEFORE Phase C started — if no baseline saved, document the post-migration number as new baseline).

### Step 7b: Update audit doc

Add to `docs/frontend-audit-v3/findings-full-app-audit-v2.md` (or create followup doc):

```md
## Phase C — CSS theme tokens migration (closed YYYY-MM-DD)

Migrated 5 lowest-risk shells (faq + privacy + status + terms + report) to
shared `--legal-shell-*` CSS variable tokens. Reduced light-theme override
selector count from **292 → 199** (-93, -32%).

### Theme toggle performance

| Metric | Before | After | Delta |
|---|---|---|---|
| Recalculate Style (ms, summed over 3 toggles, 4× CPU throttle) | TBD | TBD | TBD |
| Total INP for toggle button click | TBD | TBD | TBD |

### Remaining work

166 light-theme overrides still inline. These are in higher-risk areas:
- Landing/game-home shells (recent theatre backdrop work)
- Lobby/play/game-shells (active flows)
- Tutorial/account shells (recent fixes)
- Role-detail panels (recent overhaul)

A future PR can address these once flow is stable enough.
```

### Step 7c: Final selector count

```bash
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css
# Expect: ≈199 (down from 292)
```

### Commit 7
```
docs(audit): close Phase C CSS theme tokens migration
```

---

## Acceptance criteria

1. ✅ `docs/css-tokens.md` exists with pattern documentation
2. ✅ `--legal-shell-*` tokens defined in `:root` and `html[data-theme="light"]`
3. ✅ `.faq-shell` light overrides: 0 (was 47)
4. ✅ `.privacy-shell` light overrides: 0 (was 13)
5. ✅ `.status-shell` light overrides: 0 (was 10)
6. ✅ `.terms-shell` light overrides: 0 (was 10)
7. ✅ `.report-shell` light overrides: 0 (was 13)
8. ✅ Total `html[data-theme="light"]` selectors: ≈199 (was 292)
9. ✅ **Visual parity** — `/faq`, `/privacy`, `/status`, `/terms`, `/report` pixel-identical in both themes pre/post migration
10. ✅ `pnpm regression` green
11. ✅ `pnpm typecheck` green
12. ✅ `pnpm build` green
13. ✅ Chrome DevTools Performance shows measurable Recalculate Style drop on theme toggle

---

## Verification commands

```bash
# Run after EVERY commit
pnpm regression
pnpm typecheck
pnpm build

# Selector counts
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css
for shell in faq privacy status terms report; do
  count=$(grep -c "html\[data-theme=\"light\"\] \.${shell}" apps/web/app/globals.css)
  echo "$shell-shell: $count"
done

# Token presence
grep -c "^\s*--legal-" apps/web/app/globals.css
# Expect: ≈30+ tokens (both :root and html[data-theme="light"] blocks)
```

---

## Не пипай

- `.landing-shell`, `.game-home-shell` — recent theatre backdrop
- `.lobby-shell`, `.game-shell`, `.play-shell` — active flows
- `.tutorial-shell`, `.account-shell` — recent fixes
- Role-detail panels — recent overhaul
- All non-shell CSS (animations, layouts, component-specific styles)
- JSX components — pure CSS-only PR
- Game-server / backend
- imagen assets

---

## Failure modes

### Visual diff after a stage

If `/faq` light theme looks different from baseline:

1. Open both versions in browser side-by-side (use git stash or branch comparison)
2. Inspect the differing element with DevTools
3. Compare `getComputedStyle()` between branches
4. Most common bug: token alpha drift (e.g., `0.16` vs `0.18`)
5. Fix the token in `html[data-theme="light"]` block
6. Recheck

### Token namespace collision

If a token like `--legal-text-accent` already exists in `:root` from prior work, use a more specific name (e.g., `--legal-text-accent-strong`). Verify with:

```bash
grep -n "^\s*--legal-text-accent" apps/web/app/globals.css
```

### `pnpm build` fails

Usually a CSS syntax error (forgot semicolon, mismatched bracket). Read the error line, fix in place.

### Stage 2 (faq) gets stuck

47 selectors is the largest single migration. If you hit a wall:

1. Stop and commit what's working
2. Continue with smaller stages (privacy, status, terms — easier)
3. Return to faq with fresh context

---

## Commit summary

7 atomic English commits, ~2 hours Codex work:

```
1. feat(css): introduce shared legal-shell theme tokens with pattern doc
2. refactor(css): migrate .faq-shell to legal-shell theme tokens
3. refactor(css): migrate .privacy-shell to legal-shell theme tokens
4. refactor(css): migrate .status-shell to legal-shell theme tokens
5. refactor(css): migrate .terms-shell to legal-shell theme tokens
6. refactor(css): migrate .report-shell to legal-shell theme tokens
7. docs(audit): close Phase C CSS theme tokens migration
```

PR title (if not direct push): `refactor(css): migrate 5 text shells to CSS variable theme tokens`

---

## Notes for ChatGPT 5.5 x-high / Codex

- **Visual parity is non-negotiable.** Pure refactor — pixels must match. If unsure, take screenshots before each migration and diff after.
- **Token reuse first, new tokens second.** Most light overrides use the same 8-10 rgba combinations. Try `--legal-*` shared tokens before reaching for shell-specific ones.
- **One shell per commit.** Don't fold migrations together — atomic = easy to revert if visual regresses.
- **`html[data-theme="light"]` overrides for ONE shell** should ALL go in the consolidated `html[data-theme="light"] { --legal-...: ...; --faq-...: ...; }` block — not scattered per-element.
- **Skip per-element variations.** If `.faq-hearth-item` and `.faq-hearth-item[data-open="true"]` both have backgrounds, use TWO tokens (`--faq-item-bg`, `--faq-item-bg-active`), don't try to compute one from the other.
- **`color-scheme` declarations** stay in the `html[data-theme]` blocks — these are CSS UA hints, not custom properties.
- **No CSS Layers (`@layer`) in this PR.** That's a separate architectural change. Stay focused on tokens.
- **No selector deletion outside the 5 target shells.** If you spot dead CSS elsewhere, note it for a future cleanup PR; don't expand scope here.

---

(End of prompt)
