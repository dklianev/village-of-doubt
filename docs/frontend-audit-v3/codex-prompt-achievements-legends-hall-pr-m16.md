# Codex prompt — PR M16: /achievements Legends Hall identity polish

**Scope**: inject "Hall of Legends" personality into `/achievements`. Currently it reads as generic SaaS achievement dashboard with dusty shelf empty state. Target: museum trophy hall with mounted plaques, distinct tiers, family backing plates, atmospheric body bg.

**Effort**: ~3 hours (+30 min if imagegen needed), 8 atomic commits.

**Goal**: opening `/achievements` feels like entering a **trophy hall** — wood/stone walls, plaques mounted with realistic shadows, candle light, curator's tally engraved in brass. Currently it's "achievement list with laurel wreath counter".

**Scope LIMIT**: `/achievements` index only. No related routes affected. Internal `AchievementPlaque` + `AchievementIcon` + `AchievementProgressWreath` components untouched except for data attribute additions.

---

## Operating rules (inherit v2 conservative)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. Revert if red.
2. Visual diff review manually before `pnpm visual --update-snapshots`.
3. **NO `:global()` selectors overriding primitive identity.** Anti-pattern guard stays FAIL.
4. **NO new dependencies.** No new fonts. No Motion imports. Motion file count stays 3.
5. **NO `prefers-reduced-motion` guards.** Project convention.
6. **Bulgarian copy unchanged.** All visible text stays. `bg-copy-reviewer` only if new JSX text introduced.
7. **Sacred files frozen** — primitives' existing API, game-server, play-room-client, AchievementIcon SVGs.
8. **Scope LIMITED**: `apps/web/components/achievements/*` + `apps/web/components/achievements-client.tsx` + `apps/web/app/achievements/page.tsx` body backdrop only.
9. **Mobile + dark + light theme verified** per commit.
10. **Imagegen optional** — see Commit 0. Sample-first workflow strict.

---

## Pre-flight context

```bash
# Verify current state
test -f apps/web/components/achievements/AchievementPlaque.tsx && echo "✓ M14/M15 baseline intact"
grep -nE "art-achievements" apps/web/app/globals.css | head -5
grep -nE "achievement-shell|plaque-wall|achievement-wreath" apps/web/components/achievements/Achievements.module.css | head -10

# Sanity check assets
ls apps/web/public/game-art/og/og-achievements.* 2>&1   # current "art" points here (OG image, not page art)
ls apps/web/public/game-art/achievements/ 2>&1 || echo "no dedicated achievements art directory yet"

# Verify M15 patterns we'll mirror
grep -nE "body:has\\(\\.history-shell\\)::before|ambient-drift-light" apps/web/app/globals.css | head -5

# Baseline
rg ":global\(.*\.(paper-card|scene-card|pill|medallion|surface)" apps/web | wc -l   # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l               # MUST be 3
pnpm regression 2>&1 | tail -3                                                         # green
```

Document deviations in PR description.

---

## Design philosophy (creative direction)

`/achievements` is **a hall of legends** — physical trophy room with mounted plaques on warm walls, candle light flickering, a curator's tally engraved in brass framing the laurel wreath. The user feels: *„аз стоя в музей на победите ми"*, not *„аз преглеждам progress list"*.

Per-element mood:

| Element | Now | Target |
|---|---|---|
| Page bg | Flat warm parchment fade | Full-bleed gallery hall — wood/stone walls, candle warmth, drift |
| Hero | Dark SceneCard with OG image | Entrance plaque — ornate frame + inscribed dedication |
| Counter wreath | Plain text in laurel | Curator's tally — engraved brass plate framed by wreath |
| Empty state | Generic EmptyState (dusty shelf) | Empty wall + ghost plaque outlines + dust light beam |
| Plaque grid | Unstyled grid | Wood/stone wall texture, plaques mounted with shadow |
| Bronze tier | Tinted plaque | Patinated bronze with verdigris hints |
| Silver tier | Tinted plaque | Polished silver with engraved border |
| Gold tier | Tinted plaque | Lacquered gold with laurel corners |
| Werewolves family | Color tint | Walnut wood backing plate |
| Mafia family | Color tint | Brushed brass backing plate |
| Universal family | Color tint | Granite stone backing plate |
| Locked | Greyed out | Dusty + cobwebbed pseudo, faded glyph, lower opacity |
| Unlocked | Normal | Subtle inner gold glow, polished metal feel |

---

## Commits

### Commit 0 — OPTIONAL: Imagegen trophy hall asset (sample-first)

**Skip this commit if**:
- After Commits 1-7 land with CSS-only treatment, `/achievements` feels "premium enough"
- User wants to ship M16 without imagegen iteration

**Execute this commit if**:
- After Commit 1 (CSS-only wall textures) lands, hero still feels weak
- Hero needs a real gallery hall scene as page bg

**Workflow** (sample-first, strict):

```bash
# Generate 3 variants to TEMPORARY dir, do NOT commit yet
mkdir -p /tmp/m16-imagegen-samples

# Use system imagegen skill — paste prompt:
# "Bulgarian folk-style trophy hall interior at candle light, warm wood
# wall paneling with mounted brass plaques in soft focus, laurel wreath
# garland over arched stone doorway, dust motes in slanted window light,
# central negative space at warm tone for page text overlay, painterly
# premium board-game key art, no people, no text, no logos, no UI."

# Save 3 variants:
# /tmp/m16-imagegen-samples/hall-v1.png
# /tmp/m16-imagegen-samples/hall-v2.png
# /tmp/m16-imagegen-samples/hall-v3.png

# Show variants to user for selection (DO NOT commit any to repo)
```

**User selects** preferred variant. ONLY after explicit user pick, copy to repo:

```bash
mkdir -p apps/web/public/game-art/achievements
cp /tmp/m16-imagegen-samples/hall-vN.png \
   apps/web/public/game-art/achievements/bg-legends-hall-v1.png

# Optimize (existing pipeline)
pnpm optimize:assets

# Add tokens to globals.css (alongside existing --art-* tokens, NOT in new section)
```

```diff
 :where(:root, [data-ds]) {
   /* ...existing --art-* tokens... */

-  --art-achievements: image-set(url("/game-art/og/og-achievements.webp") type("image/webp"), url("/game-art/og/og-achievements.png") type("image/png"));
+  --art-achievements: image-set(
+    url("/game-art/achievements/bg-legends-hall-v1.webp") type("image/webp"),
+    url("/game-art/achievements/bg-legends-hall-v1.png") type("image/png")
+  );
+
+  /* Mobile variant if generated separately */
 }

 @media (max-width: 720px) {
+  --art-achievements: image-set(
+    url("/game-art/mobile/achievements/bg-legends-hall-v1.webp") type("image/webp")
+  );
 }
```

Light theme variant: if asset generated separately for light theme, add `--art-achievements-light`. Otherwise reuse same image (gallery scenes work in both themes).

**Commit message** (only if executed):
```
feat(achievements): add selected trophy hall art for page hero backdrop

Replaces OG-image fallback in --art-achievements token with dedicated
hall key art generated via system imagegen and selected from 3 variants.
Mobile + desktop optimized through existing asset pipeline.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm perf:budget  # verify new asset stays within bundle/asset budgets
```

---

### Commit 1 — Full-bleed gallery hall body backdrop

**Goal**: `/achievements` page bg becomes atmospheric like `/werewolf`, `/mafia`, `/history`. Currently `.achievement-shell::before` may exist but provides minimal atmosphere.

**File**: `apps/web/app/globals.css`

Add `.achievement-shell` to the existing body backdrop rule chain:

```diff
 body:has(.landing-shell)::before,
 body:has(.lobby-shell)::before,
 body:has(.history-shell)::before,
 body:has(.game-home-shell)::before,
 body:has(.rules-shell)::before,
+body:has(.achievement-shell)::before,
 body:has(.utility-shell)::before {
   position: absolute;
   inset: -4vh -4vw;
   display: block;
   z-index: -2;
   background: var(--page-art, var(--art-landing)) center / cover no-repeat;
   animation: ambient-drift 48s ease-in-out infinite alternate;
   mask-image: none;
   transform: translate3d(-1%, 0, 0) scale(1.035);
   will-change: transform;
 }

 .achievement-shell {
+  --page-art: var(--art-achievements);
+  z-index: 0;
+  isolation: isolate;
 }

 /* Light theme: slower drift, brighter filter */
 html[data-theme="light"] body:has(.achievement-shell)::before {
   filter: saturate(0.92) brightness(1.06);
   animation: ambient-drift-light 72s ease-in-out infinite alternate;
 }

 /* Dark theme: standard */
 html[data-theme="dark"] body:has(.achievement-shell)::before {
   display: block;
   filter: saturate(0.95) brightness(0.86);
 }

 /* Vignette focusing center */
 body:has(.achievement-shell)::after {
   display: block;
   position: fixed;
   inset: 0;
   z-index: -1;
   pointer-events: none;
   background: radial-gradient(
     ellipse 72vw 60vh at 50% 38%,
     transparent 0%,
     oklch(0.08 0.012 60 / 0.18) 55%,
     oklch(0.08 0.012 60 / 0.62) 100%
   );
 }

 html[data-theme="light"] body:has(.achievement-shell)::after {
   background: radial-gradient(
     ellipse 72vw 60vh at 50% 38%,
     transparent 0%,
     oklch(0.94 0.022 78 / 0.22) 55%,
     oklch(0.94 0.022 78 / 0.62) 100%
   );
 }
```

**Hero SceneCard adjustment** in `apps/web/app/achievements/page.tsx`:

```diff
 <SceneCard
   eyebrow="ЛЕГЕНДИ"
   density="lg"
   background={{
     image: "var(--art-achievements)",
-    overlay: "scrim",
+    overlay: "veil",   // body has its own backdrop; hero stops being isolated dark island
     focalY: 40,
     minHeight: "var(--ds-scene-hero-min-cinematic)",
   }}
 >
```

Pre-flight QA: verify hero text "Малките легенди след всяка игра" remains AA contrast on veil overlay. If contrast borderline, keep `scrim` in this commit (note in PR body).

**Commit message**:
```
feat(achievements): full-bleed gallery hall body bg with ambient drift

Achievements page now joins /werewolf, /mafia, /history atmospheric
depth. Body ::before renders --art-achievements with drift animation.
Hero SceneCard softens overlay to veil so hall atmosphere stays
visible. Light theme uses slower drift (72s) matching M9 pattern.
Centered vignette focuses eyes at plaque area.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
# Manual: gallery hall visible behind hero + plaque grid, drift subtle, no clipped edges
```

---

### Commit 2 — Wall texture behind plaque grid

**Goal**: `plaque-wall` section gains visible **wall material** behind plaques. CSS-only layered gradients give "wood paneling" or "stone wall" texture without new assets.

**File**: `apps/web/components/achievements/Achievements.module.css`

```css
/* Wall texture under plaque grid — CSS-only layered approach */
:global(.plaque-wall) {
  position: relative;
  isolation: isolate;
  padding: clamp(28px, 4vw, 56px);
  border-radius: var(--ds-radius-card);

  /* Wood paneling: warm wood gradient with horizontal grain lines */
  background:
    /* horizontal grain lines (faint) */
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 18px,
      oklch(0.32 0.04 60 / 0.04) 18px,
      oklch(0.32 0.04 60 / 0.04) 19px,
      transparent 19px,
      transparent 60px
    ),
    /* vertical wall panel divisions */
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 220px,
      oklch(0.18 0.03 60 / 0.08) 220px,
      oklch(0.18 0.03 60 / 0.08) 221px,
      transparent 221px,
      transparent 442px
    ),
    /* base wood color gradient */
    linear-gradient(
      135deg,
      oklch(0.28 0.045 50) 0%,
      oklch(0.22 0.05 55) 50%,
      oklch(0.20 0.05 60) 100%
    );

  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.05),
    inset 0 0 80px oklch(0 0 0 / 0.35),         /* inner vignette */
    0 36px 80px -40px oklch(0 0 0 / 0.55);      /* drop on world bg */
}

/* Light theme: wood goes warmer / lighter */
:global(html[data-theme="light"] .plaque-wall) {
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 18px,
      oklch(0.42 0.06 60 / 0.06) 18px,
      oklch(0.42 0.06 60 / 0.06) 19px,
      transparent 19px,
      transparent 60px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 220px,
      oklch(0.28 0.05 60 / 0.1) 220px,
      oklch(0.28 0.05 60 / 0.1) 221px,
      transparent 221px,
      transparent 442px
    ),
    linear-gradient(
      135deg,
      oklch(0.58 0.07 60) 0%,
      oklch(0.50 0.075 58) 50%,
      oklch(0.46 0.08 55) 100%
    );
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.18),
    inset 0 0 80px oklch(0 0 0 / 0.18),
    0 36px 80px -40px oklch(0 0 0 / 0.35);
}

/* Mobile: simpler texture (less GPU cost) */
@media (max-width: 640px) {
  :global(.plaque-wall) {
    padding: clamp(20px, 3vw, 32px);
    background: linear-gradient(
      135deg,
      oklch(0.28 0.045 50) 0%,
      oklch(0.22 0.05 55) 50%,
      oklch(0.20 0.05 60) 100%
    );
  }
  :global(html[data-theme="light"] .plaque-wall) {
    background: linear-gradient(
      135deg,
      oklch(0.58 0.07 60) 0%,
      oklch(0.50 0.075 58) 50%,
      oklch(0.46 0.08 55) 100%
    );
  }
}
```

**Anti-pattern note**: `:global(.plaque-wall)` is allowed because `.plaque-wall` is a **page-local class** (not a primitive class). Same pattern as M14/M15 history modules.

**Plaque shadow refresh** — plaques now sit on wall, need mount-shadow:

```css
:global(.achievement-plaque) {
  /* Existing rules + amplified mount shadow */
  box-shadow:
    0 2px 4px oklch(0 0 0 / 0.25),
    0 12px 28px -16px oklch(0 0 0 / 0.45),
    inset 0 1px 0 oklch(1 0 0 / 0.15);
  transition: box-shadow 280ms ease, transform 280ms ease;
}

:global(.achievement-plaque:hover) {
  transform: translateY(-3px);
  box-shadow:
    0 4px 6px oklch(0 0 0 / 0.32),
    0 18px 36px -16px oklch(0 0 0 / 0.55),
    inset 0 1px 0 oklch(1 0 0 / 0.18);
}
```

**Commit message**:
```
feat(achievements): wall texture behind plaque grid with mount shadows

CSS-only layered wood/stone wall gradient under plaque-wall section.
Repeating linear gradients give horizontal grain + vertical panel
divisions. Light theme uses warmer wood tone. Plaques get amplified
mount drop shadow so they read as "mounted on wall" rather than
"floating on parchment".
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
pnpm perf:budget  # verify CSS-only changes don't bloat
# Manual: gallery wall behind plaques visible; hover lifts plaques cleanly
```

---

### Commit 3 — Curator's tally: engraved brass plate inside wreath

**Goal**: laurel wreath counter stops being plain text and becomes **engraved brass plate** framed by the existing laurel branches.

**File**: `apps/web/components/achievements/Achievements.module.css`

```css
/* Wreath counter wrapper — frame the brass plate properly */
:global(.achievement-wreath) {
  display: grid;
  grid-template-columns: auto minmax(220px, 360px) auto;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin: clamp(36px, 5vw, 64px) auto 0;
  padding: 16px 24px;
  max-width: 640px;
}

/* The brass plate at center */
:global(.achievement-wreath-count) {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 18px 32px;
  border-radius: 8px;
  background:
    radial-gradient(circle at 30% 25%, oklch(0.78 0.115 75 / 0.95), oklch(0.58 0.110 65 / 0.85) 70%);
  box-shadow:
    inset 0 2px 4px oklch(1 0 0 / 0.5),     /* top highlight (polished) */
    inset 0 -2px 4px oklch(0 0 0 / 0.3),    /* bottom shadow (recess) */
    inset 0 0 24px oklch(0.42 0.08 65 / 0.4),  /* inner bevel */
    0 4px 12px oklch(0 0 0 / 0.35),         /* drop on wall */
    0 1px 0 oklch(1 0 0 / 0.6);             /* engraved edge */
  border: 1px solid oklch(0.42 0.08 65);
  color: oklch(0.18 0.04 50);  /* dark engraved letters */
  font-family: "Noto Serif Display", "Noto Serif", serif;
}

:global(.achievement-wreath-count strong) {
  font-size: clamp(2.4rem, 4vw, 3.2rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  /* Engraved text effect via text-shadow */
  text-shadow:
    0 1px 0 oklch(1 0 0 / 0.5),    /* top highlight */
    0 -1px 0 oklch(0 0 0 / 0.35);  /* bottom shadow — recessed look */
}

:global(.achievement-wreath-count span) {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-top: 4px;
  color: oklch(0.22 0.05 55);
}

/* Wreath branches — adjust color to look like aged bronze */
:global(.achievement-wreath-branch) {
  color: oklch(0.58 0.10 65 / 0.78);
  filter: drop-shadow(0 1px 1px oklch(0 0 0 / 0.4));
}

/* Light theme: brass plate slightly lighter */
:global(html[data-theme="light"] .achievement-wreath-count) {
  background:
    radial-gradient(circle at 30% 25%, oklch(0.82 0.115 78 / 0.96), oklch(0.62 0.115 70 / 0.9) 70%);
  color: oklch(0.22 0.05 55);
}

:global(html[data-theme="light"] .achievement-wreath-count strong) {
  text-shadow:
    0 1px 0 oklch(1 0 0 / 0.55),
    0 -1px 0 oklch(0 0 0 / 0.28);
}
```

**Commit message**:
```
style(achievements): elevate wreath counter to engraved brass plate

Laurel wreath branches keep their position. Counter at center becomes
ornate brass plate: polished radial gradient, inset bevel shadow,
engraved text-shadow on numerals (top highlight + bottom recess).
Reads as "curator's tally engraved in brass", not as text in laurel.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
# Manual: counter reads as physical brass plate, numerals look engraved
```

---

### Commit 4 — Distinct bronze/silver/gold tier treatments

**Goal**: tier-based plaque treatment becomes visually meaningful — bronze is patinated, silver is polished etched, gold has laurel corners.

**File**: `apps/web/components/achievements/Achievements.module.css`

```css
/* Tier base treatments — replace existing data-tier rules */

/* Bronze: patinated metal with verdigris hints */
:global(.achievement-plaque[data-tier="bronze"]) {
  --plaque-frame-light: oklch(0.55 0.06 50);
  --plaque-frame-deep: oklch(0.38 0.05 50);
  --plaque-frame-shadow: oklch(0.20 0.05 50);
  --plaque-verdigris: oklch(0.55 0.08 165 / 0.12);
}

:global(.achievement-plaque[data-tier="bronze"])::before {
  /* Verdigris patina hint at corners */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 0% 0%, var(--plaque-verdigris) 0%, transparent 18%),
    radial-gradient(circle at 100% 100%, var(--plaque-verdigris) 0%, transparent 16%);
  pointer-events: none;
  z-index: 1;
}

/* Silver: polished metal with etched border */
:global(.achievement-plaque[data-tier="silver"]) {
  --plaque-frame-light: oklch(0.78 0.012 60);
  --plaque-frame-deep: oklch(0.55 0.015 60);
  --plaque-frame-shadow: oklch(0.32 0.015 60);
}

:global(.achievement-plaque[data-tier="silver"])::before {
  /* Etched border pattern */
  content: "";
  position: absolute;
  inset: 6px;
  border: 1px double oklch(0.62 0.015 60 / 0.45);
  border-radius: calc(var(--ds-radius-card) - 6px);
  pointer-events: none;
  z-index: 1;
}

/* Gold: lacquered with laurel corner accents (CSS-only) */
:global(.achievement-plaque[data-tier="gold"]) {
  --plaque-frame-light: oklch(0.82 0.13 78);
  --plaque-frame-deep: oklch(0.58 0.115 70);
  --plaque-frame-shadow: oklch(0.32 0.08 65);
}

:global(.achievement-plaque[data-tier="gold"])::before {
  /* Laurel corner accents — small SVG-like CSS shapes */
  content: "";
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background:
    radial-gradient(circle at 50% 50%, oklch(0.82 0.13 78 / 0.7) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
  /* Diagonal stripes simulating laurel leaves */
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0px,
    transparent 2px,
    oklch(0.82 0.13 78 / 0.3) 2px,
    oklch(0.82 0.13 78 / 0.3) 3px
  );
  mask-image: radial-gradient(circle at 50% 50%, black 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(circle at 50% 50%, black 0%, transparent 70%);
}

/* Apply tier frame to plaque background */
:global(.achievement-plaque) {
  background: linear-gradient(
    135deg,
    var(--plaque-frame-light) 0%,
    var(--plaque-frame-deep) 100%
  );
  border: 1px solid var(--plaque-frame-shadow);
}
```

Note: existing `data-tier="silver"` and `data-tier="gold"` rules in `Achievements.module.css` lines 252-274 should be **replaced or merged** with the new rules. Audit them first; preserve any working positioning/sizing and only swap color/decoration values.

**Commit message**:
```
style(achievements): distinct bronze/silver/gold tier treatments

Tiers stop being color tints and gain physical character:
- Bronze: patinated metal with verdigris hints at corners
- Silver: polished surface with etched double-border inset
- Gold: lacquered with laurel-leaf radial mask in top-right corner

CSS-only via :global() page-local classes + pseudo-elements. No new
SVGs; CSS gradients and masks simulate the materials.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
# Manual: bronze/silver/gold plaques visually distinct from each other
```

---

### Commit 5 — Family backing plates (walnut/brass/stone)

**Goal**: `data-family` (werewolves / mafia / universal) gives each plaque a subtle backing material readable as wood/brass/stone.

**File**: `apps/web/components/achievements/Achievements.module.css`

```css
/* Family backing materials — wrapper-context via data-family attribute */

/* Werewolves: walnut wood backing */
:global(.achievement-plaque[data-family="werewolves"]) {
  --plaque-backing: linear-gradient(
    135deg,
    oklch(0.32 0.045 60) 0%,
    oklch(0.22 0.05 55) 100%
  );
}

:global(.achievement-plaque[data-family="werewolves"])::after {
  /* Wood grain pseudo-layer */
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--ds-radius-card) + 3px);
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 6px,
      oklch(0.18 0.03 55 / 0.18) 6px,
      oklch(0.18 0.03 55 / 0.18) 7px,
      transparent 7px,
      transparent 14px
    ),
    var(--plaque-backing);
  z-index: -1;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.12),
    0 2px 6px oklch(0 0 0 / 0.4);
}

/* Mafia: brushed brass backing */
:global(.achievement-plaque[data-family="mafia"])::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--ds-radius-card) + 3px);
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      oklch(0.42 0.08 65 / 0.15) 2px,
      oklch(0.42 0.08 65 / 0.15) 3px,
      transparent 3px,
      transparent 6px
    ),
    linear-gradient(
      135deg,
      oklch(0.55 0.08 65) 0%,
      oklch(0.40 0.085 60) 100%
    );
  z-index: -1;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.2),
    0 2px 6px oklch(0 0 0 / 0.35);
}

/* Universal: granite stone backing */
:global(.achievement-plaque[data-family="universal"])::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--ds-radius-card) + 3px);
  background:
    radial-gradient(
      circle at 30% 20%,
      oklch(0.55 0.012 60 / 0.18) 0%,
      transparent 40%
    ),
    radial-gradient(
      circle at 70% 80%,
      oklch(0.42 0.012 60 / 0.22) 0%,
      transparent 35%
    ),
    linear-gradient(
      135deg,
      oklch(0.42 0.012 60) 0%,
      oklch(0.32 0.012 60) 100%
    );
  z-index: -1;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.1),
    0 2px 6px oklch(0 0 0 / 0.4);
}

/* Light theme: brighten backing plates */
:global(html[data-theme="light"] .achievement-plaque[data-family="werewolves"])::after {
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 6px,
      oklch(0.28 0.05 55 / 0.2) 6px,
      oklch(0.28 0.05 55 / 0.2) 7px,
      transparent 7px,
      transparent 14px
    ),
    linear-gradient(135deg, oklch(0.52 0.06 60), oklch(0.42 0.065 55));
}

:global(html[data-theme="light"] .achievement-plaque[data-family="mafia"])::after {
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      oklch(0.55 0.08 65 / 0.18) 2px,
      oklch(0.55 0.08 65 / 0.18) 3px,
      transparent 3px,
      transparent 6px
    ),
    linear-gradient(135deg, oklch(0.65 0.085 70), oklch(0.50 0.09 65));
}

:global(html[data-theme="light"] .achievement-plaque[data-family="universal"])::after {
  background:
    radial-gradient(circle at 30% 20%, oklch(0.68 0.012 60 / 0.2) 0%, transparent 40%),
    radial-gradient(circle at 70% 80%, oklch(0.52 0.012 60 / 0.25) 0%, transparent 35%),
    linear-gradient(135deg, oklch(0.62 0.012 60), oklch(0.48 0.012 60));
}

/* Ensure plaque container has position: relative so backing ::after works */
:global(.achievement-plaque) {
  position: relative;
  z-index: 1;  /* above the ::after backing */
}
```

**Important**: `::after` is now used for family backing AND existing `::after` from Commit 4 (gold laurel corners) — verify no conflict. If `::after` is taken for tier, family backing must use a wrapper div or `::before`. Audit existing pseudo-elements first:

```bash
grep -nE "\\.achievement-plaque(::before|::after)" apps/web/components/achievements/Achievements.module.css
```

If both `::before` and `::after` are needed for tier + family, restructure:
- Tier decoration → `::before` (sits ON the plaque)
- Family backing → wrap plaque in a div with `data-family-backing` and use that div's bg

Recommended: extend `AchievementPlaque.tsx` to wrap content in an inner div if both pseudos collide:

```tsx
<article className="achievement-plaque" data-tier={tier} data-family={family} data-locked={!isUnlocked}>
  <div className="achievement-plaque-backing" aria-hidden />  {/* NEW — family backing */}
  <div className="achievement-plaque-inner">
    {/* existing content */}
  </div>
</article>
```

Then CSS targets `.achievement-plaque-backing` for family treatments.

**Commit message**:
```
style(achievements): family backing plates (walnut/brass/stone)

Each plaque gains a subtle material backing based on data-family:
- Werewolves: walnut wood with horizontal grain repeating gradient
- Mafia: brushed brass with vertical line pattern
- Universal: granite stone with mottled radial gradients

Backing extends 3px beyond plaque edges (visible as "mounted on
material"). Light/dark theme tones tuned. Anti-pattern guard
preserved — all selectors are page-local class context.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
# Manual: each family visually distinct from base plaque; backing peeks out 3px
```

---

### Commit 6 — Dusty/cobwebbed locked + unlocked glow

**Goal**: `data-locked="true"` plaques look DUSTY and faded. `data-locked="false"` plaques have subtle inner gold glow.

**File**: `apps/web/components/achievements/Achievements.module.css`

```css
/* Locked state: dusty + cobwebbed + faded */
:global(.achievement-plaque[data-locked="true"]) {
  opacity: 0.6;
  filter: saturate(0.55);
}

:global(.achievement-plaque[data-locked="true"]) :global(.achievement-icon) {
  opacity: 0.5;
  filter: grayscale(0.5);
}

:global(.achievement-plaque[data-locked="true"])::before {
  /* Cobweb mesh pattern via repeating-conic-gradient */
  content: "";
  position: absolute;
  top: -2px;
  right: -2px;
  width: 64px;
  height: 64px;
  background:
    repeating-conic-gradient(
      from 0deg at 0% 0%,
      transparent 0deg,
      oklch(0.78 0.005 60 / 0.18) 1deg,
      transparent 2deg,
      transparent 15deg
    );
  mask-image: radial-gradient(circle at 0% 0%, black 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(circle at 0% 0%, black 0%, transparent 75%);
  pointer-events: none;
  z-index: 2;
}

/* Hover on locked: cobweb temporarily lifts (decorative tease) */
:global(.achievement-plaque[data-locked="true"]:hover)::before {
  opacity: 0.3;
  transition: opacity 320ms ease;
}

:global(.achievement-plaque[data-locked="true"]:hover) {
  opacity: 0.75;
}

/* Unlocked state: subtle inner gold glow */
:global(.achievement-plaque[data-locked="false"]) {
  box-shadow:
    0 0 0 1px oklch(0.78 0.115 75 / 0.18),    /* gold hairline outline */
    inset 0 0 24px oklch(0.78 0.115 75 / 0.08),  /* inner gold glow */
    0 2px 4px oklch(0 0 0 / 0.25),
    0 12px 28px -16px oklch(0 0 0 / 0.45);
}

:global(.achievement-plaque[data-locked="false"]:hover) {
  box-shadow:
    0 0 0 1px oklch(0.78 0.115 75 / 0.32),
    inset 0 0 32px oklch(0.78 0.115 75 / 0.18),  /* glow expansion on hover */
    0 4px 6px oklch(0 0 0 / 0.32),
    0 18px 36px -16px oklch(0 0 0 / 0.55);
}

/* Pseudo conflict resolution: Commit 4 used ::before for tier decorations.
   Locked cobweb also wants ::before. Resolution: locked cobweb uses
   the FAMILY backing's free pseudo or a small inline span.
   ALTERNATIVE: ALL tier decorations move to inner span in AchievementPlaque.tsx.

   Choose approach during implementation based on actual collision check. */
```

**Pseudo-element collision check**: Commits 4 (tier), 5 (family), 6 (locked cobweb + unlocked glow) all use pseudo-elements. Verify:

```bash
grep -cE "(::before|::after)" apps/web/components/achievements/Achievements.module.css | tail -5
```

If too many pseudos collide on `.achievement-plaque`, extend JSX to add decoration spans:

```tsx
<article className="achievement-plaque" data-tier={tier} data-family={family} data-locked={!isUnlocked}>
  <span className="achievement-plaque-tier-deco" aria-hidden />     {/* tier */}
  <span className="achievement-plaque-family-backing" aria-hidden />  {/* family */}
  <span className="achievement-plaque-lock-deco" aria-hidden />       {/* locked cobweb */}
  <div className="achievement-plaque-inner">
    {/* existing content */}
  </div>
</article>
```

This keeps each decoration as its own absolute-positioned span. Cleaner than 3-way pseudo collision.

**Commit message**:
```
style(achievements): dusty cobweb locked + inner gold glow unlocked

Locked plaques get 60% opacity + 55% saturation + cobweb mesh
pattern in top-right corner (repeating-conic-gradient masked).
Hover on locked: cobweb fades, opacity bumps to 75% (decorative tease).

Unlocked plaques get gold hairline outline + inner gold glow that
expands on hover. Reads as "lit by hall spotlight when achieved".
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
# Manual: locked plaques visibly faded with cobweb; unlocked have subtle glow
# Verify mobile maintains differentiation without performance hit
```

---

### Commit 7 — Custom empty hall ghost plaques

**Goal**: empty state stops being generic `EmptyState` primitive with dusty shelf glyph. Becomes **empty trophy hall** with ghost plaque outlines on the wall.

**File**: `apps/web/components/achievements-client.tsx` + `Achievements.module.css`

**JSX update** in `achievements-client.tsx`:

```diff
   if (unlockedCount === 0) {
-    return (
-      <div className="achievement-empty-state">
-        <EmptyState
-          artifact={<ArtifactImage artifact={zeroState.artifact} />}
-          title={zeroState.title}
-          body={zeroState.body}
-          action={
-            zeroState.action?.href ? (
-              <Pill as="a" href={zeroState.action.href}>
-                {zeroState.action.label}
-              </Pill>
-            ) : null
-          }
-        />
-      </div>
-    );
+    return (
+      <section className="achievement-empty-hall mt-8" aria-label="Празна стена на легендите">
+        <div className="achievement-empty-hall-wall" aria-hidden>
+          {Array.from({ length: 6 }).map((_, i) => (
+            <div key={i} className="achievement-ghost-plaque" data-slot={i + 1} aria-hidden />
+          ))}
+        </div>
+        <div className="achievement-empty-hall-copy">
+          <ArtifactImage artifact={zeroState.artifact} />
+          <h2>{zeroState.title}</h2>
+          <p>{zeroState.body}</p>
+          {zeroState.action?.href ? (
+            <Pill as="a" href={zeroState.action.href} intent="primary" shimmer tracked size="lg">
+              {zeroState.action.label}
+            </Pill>
+          ) : null}
+        </div>
+      </section>
+    );
+  }
```

**CSS** in `Achievements.module.css`:

```css
:global(.achievement-empty-hall) {
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  gap: 32px;
  padding: clamp(32px, 5vw, 56px);
  border-radius: var(--ds-radius-card);
  /* Wall texture — same as plaque-wall but darker (empty hall) */
  background:
    linear-gradient(
      135deg,
      oklch(0.22 0.04 55) 0%,
      oklch(0.16 0.045 55) 100%
    );
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.04),
    inset 0 0 80px oklch(0 0 0 / 0.45),
    0 36px 80px -40px oklch(0 0 0 / 0.6);
  overflow: hidden;
}

/* Dust beam diagonal — decorative pseudo */
:global(.achievement-empty-hall)::before {
  content: "";
  position: absolute;
  top: -20%;
  right: -10%;
  width: 60%;
  height: 140%;
  background: linear-gradient(
    -55deg,
    transparent 30%,
    oklch(0.92 0.04 78 / 0.06) 50%,
    transparent 70%
  );
  pointer-events: none;
}

/* Ghost plaque grid (3x2 placeholders) */
:global(.achievement-empty-hall-wall) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(14px, 2vw, 24px);
  padding-bottom: 24px;
  border-bottom: 1px dashed oklch(0.78 0.04 60 / 0.22);
}

@media (max-width: 640px) {
  :global(.achievement-empty-hall-wall) {
    grid-template-columns: repeat(2, 1fr);
  }
}

:global(.achievement-ghost-plaque) {
  position: relative;
  aspect-ratio: 3 / 2;
  border: 1.5px dashed oklch(0.78 0.04 60 / 0.32);
  border-radius: var(--ds-radius-card);
  background: oklch(0.20 0.04 55 / 0.4);
  opacity: 0.65;
}

/* Vary opacity per slot for organic feel */
:global(.achievement-ghost-plaque[data-slot="1"]) { opacity: 0.7; }
:global(.achievement-ghost-plaque[data-slot="2"]) { opacity: 0.55; }
:global(.achievement-ghost-plaque[data-slot="3"]) { opacity: 0.62; }
:global(.achievement-ghost-plaque[data-slot="4"]) { opacity: 0.5; }
:global(.achievement-ghost-plaque[data-slot="5"]) { opacity: 0.68; }
:global(.achievement-ghost-plaque[data-slot="6"]) { opacity: 0.58; }

/* Empty hall copy section */
:global(.achievement-empty-hall-copy) {
  display: grid;
  place-items: center;
  gap: 14px;
  text-align: center;
  color: oklch(0.86 0.04 78);
}

:global(.achievement-empty-hall-copy h2) {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800;
  margin: 0;
}

:global(.achievement-empty-hall-copy p) {
  max-width: 50ch;
  margin: 0;
  font-size: var(--ds-type-body);
  line-height: 1.55;
  color: oklch(0.74 0.03 78);
}

/* Light theme: empty hall lighter */
:global(html[data-theme="light"] .achievement-empty-hall) {
  background: linear-gradient(
    135deg,
    oklch(0.52 0.055 55) 0%,
    oklch(0.42 0.06 55) 100%
  );
}

:global(html[data-theme="light"] .achievement-empty-hall-copy) {
  color: oklch(0.94 0.03 78);
}

:global(html[data-theme="light"] .achievement-ghost-plaque) {
  background: oklch(0.40 0.055 55 / 0.45);
  border-color: oklch(0.85 0.05 60 / 0.32);
}
```

**Commit message**:
```
feat(achievements): empty trophy hall with ghost plaque outlines

Replace generic EmptyState component with custom "empty hall" treatment:
6 ghost plaque outlines (dashed borders) in a 3x2 grid suggest what
will fill the wall. Diagonal dust beam pseudo across the panel.
Existing empty-state copy + artifact + CTA preserved underneath the
ghost wall. Primary Pill is now shimmer + tracked + size lg matching
landing hero rhythm.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "achievement"
# Manual: empty hall feels intentional, not "page failed to load achievements"
# Verify aria-hidden on ghost plaques (screen readers don't announce them)
```

---

### Commit 8 — Refresh visual baselines

```bash
# Inspect every diff before update
pnpm visual --grep "achievement"

# Expected diffs:
# - body backdrop with hall art (if Commit 0 imagegen executed) or warm parchment fade with vignette (if skipped)
# - hero veil overlay instead of scrim
# - wall texture under plaque grid
# - brass curator's tally counter
# - distinct bronze/silver/gold treatments
# - family backing peeks 3px beyond plaque
# - locked plaques faded with cobweb
# - unlocked plaques with gold glow + hairline
# - empty state: ghost plaque wall

# Only after manual sign-off:
pnpm visual --grep "achievement" --update-snapshots
```

**Commit message**:
```
test(visual): refresh achievements baselines after M16 hall polish

Significant intentional diffs on /achievements empty + unlocked
states. Reviewed manually before snapshot update.
```

---

## Acceptance criteria

| Metric | Target |
|---|---|
| `--art-achievements` token target | `bg-legends-hall-v1` (if imagegen ran) or `og-achievements` (if skipped) |
| `body:has(.achievement-shell)::before` renders backdrop with drift | ✓ |
| Hero SceneCard overlay | `veil` (or `scrim` if contrast failed) |
| `plaque-wall` has CSS-only wood/stone texture | ✓ |
| Plaque mount shadow amplified | ✓ |
| Wreath counter has engraved brass plate | ✓ |
| Bronze/silver/gold tier visually distinct | ✓ |
| Family backing peeks 3px (`::after` or wrapper span) | ✓ |
| Locked plaques 60% opacity + cobweb | ✓ |
| Unlocked plaques gold glow + hairline | ✓ |
| Empty state replaced with ghost plaque hall | ✓ |
| `:global()` primitive overrides | 0 |
| Motion file count | 3 (unchanged) |
| New dependencies | 0 |
| New fonts | 0 |
| `pnpm regression` | green |
| `pnpm visual --grep "achievement"` | green after manual sign-off |
| Mobile: tilt/effects scaled, perf OK | ✓ |
| Bulgarian copy | unchanged |

### Qualitative

- Opening `/achievements` feels like entering a trophy hall, not loading an achievement dashboard
- Curator's tally reads as engraved brass plate
- Tiers visually communicate hierarchy (bronze → silver → gold progression)
- Family backings give plaques physical presence
- Locked plaques feel dusty, unlocked feel lit
- Empty state suggests "wall waiting to be filled", not "no data yet"
- Dark + light themes both intentional
- Mobile remains readable; ghost grid 2-col instead of 3-col

---

## Failure modes

| Symptom | Fix |
|---|---|
| Backdrop not visible | Verify `.achievement-shell` has `--page-art` set; check `z-index: -2` on `::before` |
| Hero contrast fails on veil | Keep `scrim` overlay in this commit; note in PR body |
| Wall texture too heavy on mobile | Mobile media query simplifies background (already in Commit 2) |
| Pseudo collision (tier `::before` + family `::after` + locked `::before`) | Restructure JSX with decoration spans (see Commit 6 alternative) |
| Brass plate looks flat | Verify both inset shadows: top highlight + bottom recess |
| Engraved text not legible | Increase text-shadow contrast; reduce strong color saturation |
| Bronze patina too aggressive | Lower radial-gradient alpha from 0.12 to 0.08 |
| Gold laurel corners look pixelated | Increase pseudo-element size or use SVG inline instead of CSS gradient |
| Family backing clips on hover | Verify `.achievement-plaque { position: relative; overflow: visible }` |
| Cobweb mesh too geometric | Increase conic gradient angle steps; mask gradient softer |
| Unlocked glow too strong | Lower inset shadow alpha from 0.08 to 0.05 |
| Empty hall ghost plaques announced by SR | Verify `aria-hidden` on `.achievement-empty-hall-wall` and each ghost |
| Anti-pattern guard fires | Check for `:global(.achievement-plaque)` is fine (page-local class). NOT allowed: `:global([data-ds-paper-card])` |
| Visual baseline diff massive | Inspect; if intentional, update snapshots after manual review |

---

## Operator notes

- **Sample-first imagegen workflow strict.** Don't commit any generated variant before explicit user approval.
- **All wrapper-context CSS.** `.achievement-plaque` is a page-local class; primitive identity is never overridden.
- **Pseudo-element budget**: tier + family + locked use 3 decorations. If `::before` and `::after` not enough, add JSX decoration spans (Commit 6 alternative).
- **Mobile: simplify textures.** Wall texture, cobweb mesh, dust beam — all can degrade gracefully on small viewports.
- **`bg-copy-reviewer` only if new JSX text added.** Current scope: zero new text, only structure + style.
- **`frontend-design` skill optional** at PR close-out — invoke if you want "does it feel like trophy hall" review.
- **One commit at a time, gate between each.**
- **Sacred files frozen**: AchievementIcon SVGs, ACHIEVEMENTS data, primitive APIs.

---

## After this PR lands

Production deploy → 1-2 day visual smoke → if `/achievements` feels intentional and museum-themed → next polish round can target `/leaderboard` (similar "evening newspaper" identity needs reinforcement) or other pages user flags.

Optional follow-up M16.1:
- Plaque unlock animation (Tier 3 motion, page-local) — celebrate unlock with brief shimmer
- Curator's tally numerals with crossfade on unlock (CSS-only)
- Family-specific ambient particles (very subtle — wood dust for werewolves, smoke wisps for mafia)

Defer all until M16 stabilizes in production.

---

## TL;DR for handoff

> Execute M16 at `docs/frontend-audit-v3/codex-prompt-achievements-legends-hall-pr-m16.md`. 8 atomic commits (Commit 0 optional imagegen, sample-first), ~3 hours. Identity injection on top of existing structure: gallery hall body bg, wood wall texture, brass curator's tally, distinct tier treatments, family backings, dusty locked + glow unlocked, ghost plaque empty hall. Stop at PR boundary. Manual visual review before baseline update.
