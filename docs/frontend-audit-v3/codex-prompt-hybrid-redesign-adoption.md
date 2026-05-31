# Codex master prompt — Hybrid adoption of `/redesign` spec (Path Б)

This prompt operationalises the **hybrid** path: adopt the high-value pieces of `/redesign/` spec (OKLCH tokens, primitives library, dictionary lock, empty/error catalog, acceptance criteria) while **preserving** the 67 commits of recent landed work (Phase A/B/C, theatre backdrop, play-room split, Bulgarian copy already in production).

**Explicit non-goals** (do NOT do these):
- ❌ Font swap to Cormorant Garamond / JetBrains Mono — keep Noto Serif + Iowan
- ❌ `prefers-reduced-motion` mandatory coverage — project convention forbids it
- ❌ Dictionary breaking renames (Постижения → Легенди, История → Архив) — defer to follow-up PR
- ❌ Re-split `play-room-client.tsx` — already done (3268 → 1438 lines)
- ❌ Re-build cinematic theatre backdrop — already landed
- ❌ Rebuild `useModal`, `useTimerCountdown`, `lib/clipboard`, `lib/auth-errors` — already shipped

**Explicit YES goals**:
- ✅ Create `packages/ui` workspace with Storybook 10
- ✅ Add OKLCH tokens **alongside** existing hex tokens (dual-track, non-breaking)
- ✅ Build 14 primitives one-by-one (Surface → PaperCard → … → Dialog)
- ✅ Lock dictionary as **audit-only** check (warns, doesn't fail) initially
- ✅ Adopt 22 empty + 9 error states with simple geometric artifact SVGs
- ✅ Migrate `/status` as pilot page (simplest, lowest risk)
- ✅ Add per-page acceptance criteria as `docs/acceptance/*.md`

**Total scope**: ~30 atomic English commits, **~10-14 hours Codex work at high reasoning**. Spread across **3 PRs** if shipping sequentially.

> **Operating rules** (non-negotiable):
> 1. Validate after every commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert.
> 2. Visual regression (`pnpm visual`) must stay green or be explicitly updated in same commit.
> 3. Bulgarian-only user-facing copy — invoke `bg-copy-reviewer` agent after every commit touching JSX text.
> 4. **No prefers-reduced-motion guards anywhere.** Project convention.
> 5. New dependencies pinned to the **exact versions** listed in §0.4 below — verified latest as of 2026-05-22.
> 6. **Tailwind v4 is already installed** — use its `@theme` directive when defining new tokens.
> 7. If a phase blocks for >2 commit attempts, document in `audit-v3/blocked-items.md` and skip to next independent phase.
> 8. Use available agents/skills/MCPs proactively where applicable. See §0.5.

---

# §0 — Pre-flight & locked decisions

## §0.1 — Current state to honour

Before making ANY changes, run this check and confirm output matches:

```bash
# Lines in main file (must be ≤1438; Phase B landed)
wc -l apps/web/components/play-room-client.tsx
# Expected: 1438 ± 10

# /redesign spec present
ls redesign/*.html | wc -l
# Expected: 8 files

# packages/ui MUST NOT exist yet
ls packages/ui 2>&1 | grep -q "No such file" && echo "OK: clean slate" || echo "ABORT: packages/ui already exists"

# Phase A landed
test -f apps/web/hooks/use-timer-countdown.ts && echo "OK: Phase A landed"
test -f apps/web/lib/use-modal.ts && echo "OK: useModal landed"

# Phase C landed
grep -q "^\s*--legal-shell-bg" apps/web/app/globals.css && echo "OK: legal tokens landed"

# Regression baseline
pnpm regression 2>&1 | tail -3
# Must end with: "Regression contract checks passed."
```

If any check fails, STOP and document in `audit-v3/blocked-items.md`.

## §0.2 — Existing CSS tokens to preserve (do NOT rename)

The current `:root` block (`apps/web/app/globals.css` lines 3-82) defines hex tokens used across **19,876 lines** of CSS:

```
--ink, --ink-soft, --paper, --paper-deep, --paper-muted,
--blood, --blood-dark, --wolf, --night, --gold, --ember,
--fog, --moss, --glass, --hairline, --shadow-deep, --shadow-gold,
--brass, --chrome-bg, --chrome-blur, --chrome-hairline,
--chrome-pill-bg, --chrome-z,
plus 50+ --art-*, --texture-*, --faction-*, --event-*, --screen-*, --empty-* image-set tokens,
plus the new --legal-shell-* family (Phase C),
plus --hero-card-* family (theatre backdrop)
```

**Rule**: Do NOT delete, rename, or shadow these. Add OKLCH equivalents under **new names** (`--ds-*` prefix for "design-system") in `packages/ui/tokens.css`. Existing CSS continues to use the legacy hex names. Migration is opt-in per-component.

## §0.3 — Dictionary: audit-only mode (no copy breakage)

The redesign spec's dictionary mandates terms like "Легенди" (achievements), "Архив на делата" (history), "Седни до огъня" (faq). These conflict with current production copy.

**Phase Б policy**:
- Step 1: Create `docs/dictionary.md` listing all 48 spec terms + the 10 **legacy-OK overrides** (terms we currently use that the spec dislikes — Постижения, История, Често задавани въпроси). Marked clearly as `legacy: true`.
- Step 2: Create `scripts/check-dictionary.mjs` that **warns** for spec violations but **does not exit non-zero**. Wire as `pnpm check:dict` (NOT into `pnpm verify` initially).
- Step 3: After Phase Б ships, a separate PR can flip the dictionary check to enforcing, but only after a copy-migration PR runs alongside it.

This way we get the lock without breaking the build.

## §0.4 — New dependencies (latest versions, verified 2026-05-22)

Add to `packages/ui/package.json` and `apps/web/package.json` as listed in stages:

| Package | Version | Where | Purpose |
|---|---|---|---|
| `storybook` | `^10.4.1` | `packages/ui` devDep | Component browser |
| `@storybook/nextjs` | `^10.4.1` | `packages/ui` devDep | Next.js integration |
| `@storybook/addon-a11y` | `^10.4.1` | `packages/ui` devDep | axe-core in Storybook |
| `@storybook/test` | `^8.6.15` | `packages/ui` devDep | Interaction testing |
| `framer-motion` | `^12.40.0` | `packages/ui` dep | Motion primitives only — opt-in import |
| `tsup` | `^8.5.1` | `packages/ui` devDep | Library build |
| `tslib` | `^2.8.1` | `packages/ui` dep | TS runtime helpers |
| `@radix-ui/react-dialog` | `^1.1.15` | `packages/ui` dep | Dialog + Sheet base |
| `plaiceholder` | `^3.0.0` | `apps/web` devDep | Image blurhash (lazy, for AtmosphericImage) |
| `@axe-core/react` | `^4.11.3` | `packages/ui` devDep | Runtime a11y in Storybook |
| `tsx` | `^4.22.3` | root devDep | Run TS scripts (e.g. dictionary check) |

**No other new dependencies.** Use Tailwind v4 (already at 4.2.4) for utility classes; use stock React 19.2.6 features.

## §0.5 — Skills / agents / MCPs to invoke

Use these proactively at the listed checkpoints:

| Tool | When | Purpose |
|---|---|---|
| `bg-copy-reviewer` agent | After every commit touching JSX text or `.md` user-facing copy | Verify Bulgarian-only and natural phrasing |
| `role-mechanics-reviewer` agent | Not needed in Path Б (no backend changes) | — |
| `frontend-design` skill | Phase 4 (Surface primitive) + Phase 9 (artifact SVGs) | Generate distinctive, production-grade visual code |
| `context7` MCP | When integrating new dep (Storybook 10, Framer Motion 12, Radix Dialog 1.1) — verify latest API | Pull current docs |
| Imagen via `Skill imagegen` if available | Phase 9 — generate 8 painterly artifact illustrations (optional polish) | High-quality artifact art |
| Postgres MCP | Not used in Path Б | — |

If a tool isn't available, document in `audit-v3/blocked-items.md` and proceed with fallback (e.g. simple geometric SVG instead of imagen art).

---

# §1 — PHASE 1: Foundation infrastructure (~2 hours, 5 commits)

**Goal**: Create `packages/ui` workspace with Storybook 10 and `tsup` build pipeline. **Zero UI changes visible to users.** Visual regression must stay 100% green.

## §1.1 — Scaffold `packages/ui`

### Create directory structure

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts          (re-exports)
│   ├── tokens.css        (OKLCH tokens, added in Phase 2)
│   └── primitives/       (added in Phase 4+)
├── .storybook/
│   ├── main.ts
│   ├── preview.ts
│   └── preview.css       (loads tokens.css)
└── README.md
```

### `packages/ui/package.json`

```json
{
  "name": "@werewolf/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./tokens.css": "./src/tokens.css",
    "./styles/*.css": "./src/styles/*.css"
  },
  "files": ["dist", "src/tokens.css", "src/styles"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "framer-motion": "^12.40.0",
    "tslib": "^2.8.1"
  },
  "peerDependencies": {
    "react": ">=19",
    "react-dom": ">=19"
  },
  "devDependencies": {
    "@axe-core/react": "^4.11.3",
    "@storybook/addon-a11y": "^10.4.1",
    "@storybook/nextjs": "^10.4.1",
    "@storybook/test": "^8.6.15",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "storybook": "^10.4.1",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3"
  }
}
```

### `packages/ui/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "tsBuildInfoFile": "node_modules/.cache/tsbuildinfo.json"
  },
  "include": ["src/**/*", ".storybook/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### `packages/ui/tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "framer-motion", "@radix-ui/react-dialog"],
  treeshake: true,
  splitting: false,
});
```

### `packages/ui/src/index.ts`

```ts
// Re-export point. Empty until Phase 4.
// Tokens are imported via "@werewolf/ui/tokens.css".
export {};
```

### `packages/ui/README.md`

```md
# @werewolf/ui

Design system primitives for Върколак · Мафия.

## Tokens

```css
@import "@werewolf/ui/tokens.css";
```

## Primitives

```tsx
import { Surface, PaperCard } from "@werewolf/ui";
```

## Storybook

```bash
pnpm --filter @werewolf/ui storybook
```

## Build

```bash
pnpm --filter @werewolf/ui build
```
```

### Commit 1
```
feat(ui): scaffold packages/ui workspace with tsup + storybook 10
```

## §1.2 — Wire workspace + verify clean build

### Update root `package.json` (NO new scripts, just verify install)

```bash
pnpm install
```

Verify:
- `pnpm-lock.yaml` updated cleanly
- `node_modules/@werewolf/ui` symlink exists
- `pnpm --filter @werewolf/ui typecheck` → passes (zero source files yet — that's fine)
- `pnpm --filter @werewolf/ui build` → produces empty `dist/index.{js,mjs,d.ts}`

If install fails (peer dependency mismatch, etc.), STOP. Don't force-install.

### Commit 2
```
chore(ui): install dependencies for @werewolf/ui workspace
```

## §1.3 — Storybook configuration

### `packages/ui/.storybook/main.ts`

```ts
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  typescript: {
    check: true,
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
```

### `packages/ui/.storybook/preview.ts`

```ts
import type { Preview } from "@storybook/react";
import "../src/tokens.css";
import "./preview.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "paper",
      values: [
        { name: "paper", value: "oklch(0.94 0.022 78)" },
        { name: "scene", value: "oklch(0.18 0.012 60)" },
      ],
    },
    a11y: {
      element: "#storybook-root",
      config: {},
      options: {},
      manual: false,
    },
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default preview;
```

### `packages/ui/.storybook/preview.css`

```css
/* Storybook canvas styles — load Noto Serif from the same source as production. */
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Display:wght@600;800;900&display=swap");

body {
  font-family: "Noto Serif", "Iowan Old Style", Georgia, serif;
  color: oklch(0.22 0.018 60);
}
```

### Verify
```bash
pnpm --filter @werewolf/ui storybook
# Should start on port 6006, render empty browser (no stories yet)
# Ctrl-C to stop
```

### Commit 3
```
feat(ui): configure storybook 10 with @storybook/nextjs + a11y addon
```

## §1.4 — Wire @werewolf/ui into apps/web

### Update `apps/web/package.json` dependencies

```diff
  "dependencies": {
    "@colyseus/sdk": "^0.17.41",
    "@sentry/nextjs": "^10.51.0",
    "@t3-oss/env-nextjs": "^0.13.11",
    "@werewolf/database": "workspace:*",
    "@werewolf/shared": "workspace:*",
+   "@werewolf/ui": "workspace:*",
    "better-auth": "^1.6.11",
    /* … */
  }
```

### Update `apps/web/next.config.ts` to transpile the package

```diff
  const nextConfig: NextConfig = {
    output: "standalone",
-   transpilePackages: ["@werewolf/shared", "@werewolf/database"],
+   transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
    allowedDevOrigins: ["127.0.0.1"],
    experimental: {
      viewTransition: true,
    },
  };
```

### Verify
```bash
pnpm install
pnpm --filter @werewolf/web typecheck
pnpm --filter @werewolf/web build
# Both must remain green
```

### Commit 4
```
chore(web): add @werewolf/ui workspace dependency and transpile
```

## §1.5 — Add scripts to root

### Update root `package.json` scripts

```diff
    "perf:budget": "node scripts/bundle-budget.mjs",
+   "ui:dev": "pnpm --filter @werewolf/ui storybook",
+   "ui:build": "pnpm --filter @werewolf/ui build",
+   "check:dict": "tsx scripts/check-dictionary.mjs",
    "loadtest": "node scripts/loadtest.mjs",
```

(Note: `check:dict` script lands in Phase 3 — the entry here is forward declaration.)

### Add tsx to root dev deps

Update root `package.json`:
```diff
  "devDependencies": {
    /* existing */
+   "tsx": "^4.22.3"
  }
```

### Verify
```bash
pnpm install
pnpm ui:build
pnpm regression
pnpm typecheck
pnpm build
pnpm visual
# All green
```

### Commit 5
```
chore(scripts): wire ui:dev, ui:build, check:dict commands
```

**Phase 1 complete.** Foundation infrastructure ready. Storybook available at `pnpm ui:dev`. **Zero UI changes visible.**

---

# §2 — PHASE 2: OKLCH tokens parallel layer (~1.5 hours, 4 commits)

**Goal**: Add OKLCH tokens **under new names** in `packages/ui/src/tokens.css`. Existing hex tokens stay untouched. Visual regression must stay 100% green — this phase changes nothing visually because no consumer reads the new tokens yet.

## §2.1 — Create `packages/ui/src/tokens.css`

Define 32 OKLCH tokens with `--ds-*` prefix to namespace them away from the legacy `--ink`, `--paper`, etc.

```css
/**
 * @werewolf/ui design tokens.
 *
 * Naming convention: --ds-{category}-{role}-{modifier}
 *   ds  = design-system (prefix to avoid collisions with legacy tokens)
 *   category: surface | ink | accent | type | space | radius | shadow | focus
 *
 * Adopted from /redesign spec, 2026-05-22.
 *
 * All colors verified WCAG AA against their canonical surface.
 * Do NOT use these tokens YET in production CSS — they live in parallel with
 * legacy tokens until a per-component migration PR adopts them.
 */

:where(:root, [data-ds]) {
  /* === Surface & ink === */
  --ds-surface-paper: oklch(0.94 0.022 78);
  --ds-surface-paper-deep: oklch(0.91 0.028 78);
  --ds-surface-paper-edge: oklch(0.86 0.035 75);
  --ds-surface-scene: oklch(0.18 0.012 60);
  --ds-surface-scene-deep: oklch(0.13 0.014 50);

  --ds-ink-primary: oklch(0.22 0.018 60);    /* 10.4:1 vs paper */
  --ds-ink-soft: oklch(0.40 0.018 60);       /* 5.8:1 vs paper */
  --ds-ink-faint: oklch(0.55 0.015 60);      /* 3.6:1 — large text only */
  --ds-ink-scene: oklch(0.92 0.022 80);      /* 12.1:1 vs scene */
  --ds-ink-scene-soft: oklch(0.74 0.020 78); /* 7.2:1 vs scene */

  /* === Accents === */
  --ds-accent-blood: oklch(0.50 0.155 25);
  --ds-accent-blood-deep: oklch(0.42 0.155 25);
  --ds-accent-gold: oklch(0.78 0.115 75);
  --ds-accent-gold-deep: oklch(0.58 0.110 65);
  --ds-accent-gold-soft: oklch(0.85 0.085 80);
  --ds-accent-green: oklch(0.55 0.10 145);

  /* === Typography scale (rem, 16px root) === */
  --ds-type-display: 4rem;       /* 64px — hero only */
  --ds-type-h1: 2.75rem;         /* 44px */
  --ds-type-h2: 2.125rem;        /* 34px */
  --ds-type-h3: 1.5rem;          /* 24px */
  --ds-type-h4: 1.25rem;         /* 20px */
  --ds-type-body: 1rem;          /* 16px */
  --ds-type-body-sm: 0.875rem;   /* 14px */
  --ds-type-lede: 1.125rem;      /* 18px */
  --ds-type-eyebrow: 0.72rem;    /* 11.5px — mono, letter-spaced */
  --ds-type-meta: 0.78rem;       /* 12.5px */

  /* === Spacing (px units, 4px base) === */
  --ds-space-1: 4px;
  --ds-space-2: 8px;
  --ds-space-3: 12px;
  --ds-space-4: 16px;
  --ds-space-6: 24px;
  --ds-space-8: 32px;
  --ds-space-10: 40px;
  --ds-space-12: 48px;

  /* === Radii === */
  --ds-radius-card: 22px;
  --ds-radius-tile: 14px;
  --ds-radius-chip: 999px;

  /* === Shadows === */
  --ds-shadow-card:
    0 1px 0 oklch(1 0 0 / 0.45) inset,
    0 18px 40px -28px oklch(0.20 0.05 60 / 0.55);
  --ds-shadow-scene:
    0 1px 0 oklch(1 0 0 / 0.04) inset,
    0 30px 60px -30px oklch(0 0 0 / 0.65);

  /* === Focus ring (a11y-mandatory) === */
  --ds-focus-ring: 0 0 0 2px oklch(0.94 0.022 78), 0 0 0 4px oklch(0.50 0.155 25);
}

/* === Dark theme overrides === */
:where(html[data-theme="dark"], html[data-theme="dark"] [data-ds]) {
  /* Surfaces invert: dark base, lighter ink */
  --ds-surface-paper: oklch(0.18 0.012 60);
  --ds-surface-paper-deep: oklch(0.13 0.014 50);
  --ds-surface-paper-edge: oklch(0.25 0.014 55);
  --ds-ink-primary: oklch(0.92 0.022 80);
  --ds-ink-soft: oklch(0.74 0.020 78);
  --ds-ink-faint: oklch(0.55 0.015 60);
  --ds-focus-ring: 0 0 0 2px oklch(0.18 0.012 60), 0 0 0 4px oklch(0.78 0.115 75);
}

/* === Global focus-visible — only when ds-tokens are loaded === */
:where([data-ds]) *:focus-visible {
  outline: none;
  box-shadow: var(--ds-focus-ring);
}
```

### Commit 1
```
feat(ui): introduce 32 OKLCH design tokens in packages/ui/tokens.css
```

## §2.2 — Document token rationale

### Create `packages/ui/docs/tokens.md`

```md
# Design tokens — `--ds-*` namespace

These 32 OKLCH tokens replicate the `/redesign/tokens.html` spec.

## Naming

| Pattern | Example | Meaning |
|---|---|---|
| `--ds-surface-{name}` | `--ds-surface-paper` | Backgrounds |
| `--ds-ink-{name}` | `--ds-ink-primary` | Text colors |
| `--ds-accent-{name}` | `--ds-accent-blood` | CTAs, accents |
| `--ds-type-{role}` | `--ds-type-h1` | Font sizes (rem) |
| `--ds-space-{step}` | `--ds-space-4` | Spacing (px) |
| `--ds-radius-{name}` | `--ds-radius-card` | Border radius |
| `--ds-shadow-{name}` | `--ds-shadow-card` | Box shadow |
| `--ds-focus-ring` | (single) | Universal focus indicator |

## Why OKLCH?

OKLCH is perceptually uniform — changing `L` (lightness) by 0.05 looks
visually the same regardless of hue. This lets us mechanically derive
hover/active variants and a future "Carnival" skin (just shift hue).

## Theme override

`html[data-theme="dark"]` overrides `--ds-surface-*` and `--ds-ink-*`. Accents
are theme-invariant by design (blood is blood, gold is gold).

## Migration policy (Phase Б)

The legacy hex tokens (`--ink`, `--paper`, `--blood`, …) are NOT replaced.
They live in `apps/web/app/globals.css:3-82` and serve 19,876 lines of CSS.

The `--ds-*` tokens live in `packages/ui/src/tokens.css` and are imported
INTO `apps/web/app/globals.css` via:

```css
@import "@werewolf/ui/tokens.css";
```

New primitives in `packages/ui/primitives/` consume `--ds-*`. Existing
components keep their legacy tokens until a per-component migration PR.

A future PR can map legacy → ds at the property level (`--ink: var(--ds-ink-primary)`)
but only after enough primitives ship to make the bridge meaningful.

## WCAG check

All ink/surface pairs verified ≥4.5:1 contrast:
- `--ds-ink-primary` on `--ds-surface-paper`: 10.4:1 ✓
- `--ds-ink-soft` on `--ds-surface-paper`: 5.8:1 ✓
- `--ds-ink-faint` on `--ds-surface-paper`: 3.6:1 (large text only)
- `--ds-ink-scene` on `--ds-surface-scene`: 12.1:1 ✓
- `--ds-ink-scene-soft` on `--ds-surface-scene`: 7.2:1 ✓
- `--ds-accent-blood` on `--ds-surface-paper`: 4.5:1 ✓ (AA pass)
```

### Commit 2
```
docs(ui): document --ds-* token namespace and migration policy
```

## §2.3 — Import tokens into apps/web (zero-impact)

### Update `apps/web/app/globals.css`

At the very top (before existing `:root` block):

```diff
  @import "tailwindcss";
+ @import "@werewolf/ui/tokens.css";

  :root {
    --ink: #1b100c;
    /* … existing tokens unchanged … */
  }
```

This makes `--ds-*` tokens available globally but **nothing consumes them yet**. Visual regression must stay 100% identical.

### Verify
```bash
pnpm --filter @werewolf/ui build   # ensure tokens.css is in dist
pnpm --filter @werewolf/web build  # ensure import resolves
pnpm visual                         # MUST stay green — no visual diff
pnpm regression
pnpm typecheck
```

### Commit 3
```
feat(web): import @werewolf/ui tokens into globals.css (no consumers yet)
```

## §2.4 — Add a token reference story (sanity check)

### `packages/ui/src/tokens.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/react";

const TOKENS = {
  surfaces: [
    { name: "--ds-surface-paper", contrast: "—" },
    { name: "--ds-surface-paper-deep", contrast: "—" },
    { name: "--ds-surface-paper-edge", contrast: "—" },
    { name: "--ds-surface-scene", contrast: "—" },
    { name: "--ds-surface-scene-deep", contrast: "—" },
  ],
  inks: [
    { name: "--ds-ink-primary", contrast: "10.4:1 ✓" },
    { name: "--ds-ink-soft", contrast: "5.8:1 ✓" },
    { name: "--ds-ink-faint", contrast: "3.6:1 (large only)" },
    { name: "--ds-ink-scene", contrast: "12.1:1 ✓ (vs scene)" },
    { name: "--ds-ink-scene-soft", contrast: "7.2:1 ✓ (vs scene)" },
  ],
  accents: [
    { name: "--ds-accent-blood" },
    { name: "--ds-accent-blood-deep" },
    { name: "--ds-accent-gold" },
    { name: "--ds-accent-gold-deep" },
    { name: "--ds-accent-gold-soft" },
    { name: "--ds-accent-green" },
  ],
};

function TokenGrid() {
  return (
    <div style={{ display: "grid", gap: "32px", padding: "32px", maxWidth: "800px" }}>
      {Object.entries(TOKENS).map(([group, tokens]) => (
        <section key={group}>
          <h3 style={{ fontFamily: "Noto Serif", margin: "0 0 16px" }}>
            {group.charAt(0).toUpperCase() + group.slice(1)}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {tokens.map((t) => (
              <div key={t.name} style={{
                display: "grid",
                gap: "8px",
                padding: "12px",
                border: "1px solid oklch(0.86 0.035 75)",
                borderRadius: "14px",
              }}>
                <div style={{
                  height: "64px",
                  borderRadius: "8px",
                  background: `var(${t.name})`,
                  border: "1px solid oklch(0.20 0.05 60 / 0.1)",
                }} />
                <code style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}>{t.name}</code>
                {"contrast" in t && t.contrast && (
                  <small style={{ fontSize: "10px", color: "oklch(0.40 0.018 60)" }}>{t.contrast}</small>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: "Foundation/Tokens",
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Reference: StoryObj = {
  render: () => <TokenGrid />,
};
```

### Verify
```bash
pnpm ui:dev
# Open http://localhost:6006
# Navigate to Foundation > Tokens > Reference
# Verify all swatches render with correct colors
```

### Commit 4
```
feat(ui): add Tokens reference story for visual verification
```

**Phase 2 complete.** OKLCH parallel token layer live, documented, and visible in Storybook. Production CSS untouched.

---

# §3 — PHASE 3: Dictionary audit (~1 hour, 3 commits)

**Goal**: Lock the 48-term vocabulary as `docs/dictionary.md` and ship a non-enforcing audit script. Codex/devs gain a reference; CI doesn't break on legacy copy.

## §3.1 — Create `docs/dictionary.md`

This file is the canonical Bulgarian copy reference. Include:
- All 48 terms from `/redesign/dictionary.html` (categorized: Gameplay, Roles & Factions, UI / Navigation, Actions, Time & Quantities)
- An **explicit "legacy-OK" override** column for the 10 terms we don't migrate now

```md
# Речник на масата · Bulgarian copy dictionary

Source of truth for Bulgarian user-facing text. Locked.

When in doubt, open this file. Codex grep-s violations during PR review.

## Legacy compatibility note (Path Б, 2026-05-22)

Some terms in this dictionary differ from current production copy. Until a
follow-up migration PR ships, the following legacy terms remain **acceptable**:

| Current (in production) | Spec (future migration) | Status |
|---|---|---|
| Постижения | Легенди | legacy-OK |
| История | Архив на делата | legacy-OK |
| Често задавани въпроси | Седни до огъня | legacy-OK |
| Класация | Вечерен брой | legacy-OK |
| Приятели | Познати на масата | legacy-OK |
| Профил | Досие | legacy-OK |
| Доклад | Сигнал | legacy-OK |
| Tutorial | Първи стъпки | legacy-OK |
| Lobby | Лоби | legacy-OK |
| Status | Състояние | matches spec ✓ |

When ANY of these terms appear in code, the dictionary check warns but does
not fail. Other deviations from the dictionary DO warn loudly.

## 01 · Геймплей

| Концепт | Правилно (✓) | Никога (✗) | Бележка |
|---|---|---|---|
| Една сесия от игра | Вечер · Дело | Game · Match · Session · Раунд | „Вечер" в наратив, „Дело №X" в архив |
| Площта за играчи | Масата | Room · Lobby · Game board | Лоби е валидно само за списък от маси |
| Запис в архива | Дело №4821 | Match #4821 · Game ID | Винаги с „№", винаги 4+ цифри |
| Времеви интервал | Фаза | Phase · Step · Turn · Ход | „Ход" е твърде шахматно |
| Тъмният период | Нощ | Night phase · Тъмнина | Просто „Нощ", без „фаза" |
| Светлият период | Ден | Day · Day phase | „Утро" — само в наратив |
| Гласуване | Глас | Voting · Vote phase · Гласоподаване | Кратко, едносрично |
| Лична карта | Роля | Card · Character · Класа | Никога „характер" |
| Групировка | Фракция · Отбор | Team · Side · Faction | „Отбор" в casual, „Фракция" в правила |
| Победа | Селото оцеля · Мафията владее · Равенство | Village wins · Victory | Винаги перфект, никога абстрактно |
| Краен резултат на играч | Жив · Мъртъв · Прокълнат | Alive · Dead · Active | „Прокълнат" — специфично |
| Игра приключи равенство | Селото си легна тихо | Draw · Tie | Метафора, не математика |
| Тайни действия | Будиш се · Действаш | Active turn · Special ability | Никаква геймърска терминология |
| Защита от смърт | Спасен · Защитен | Saved · Protected · Healed | „Лекуван" — само за Лечител |

## 02 · Роли и фракции

[Full table — copy verbatim from /redesign/dictionary.html lines 100-121]

## 03 · Интерфейс

[Full table — copy verbatim from /redesign/dictionary.html UI section, with legacy-OK column markings]

## 04 · Действия

[Full table — copy verbatim]

## 05 · Време и количества

[Full table — copy verbatim]

## 06 · Никога

| Дума | Причина |
|---|---|
| Логин | Английски технически жаргон. Кажи „Влизане". |
| Аватар | Чуждица. Кажи „Портрет". |
| Чат | Английски жаргон. Кажи „Разговор". |
| Sign-up | Английски. Кажи „Нов профил". |
| Submit | Английски. Кажи „Прати" или „Запази". |
| OK / Continue | Кажи „Добре" / „Продължи". |
| Confirm | Кажи „Потвърди". |
| Cancel | Кажи „Откажи" или „Затвори". |
| Save | Кажи „Запази". |
| Delete | Кажи „Изтрий". |
| Loading… | Кажи „Зареждаме…" или „Чакайте малко…". |
| Error / Success | Кажи описателно („Грешка при влизане" / „Запазено"). |
```

### Commit 1
```
docs: lock 48-term Bulgarian dictionary with legacy-OK overrides
```

## §3.2 — Audit-only check script

### `scripts/check-dictionary.mjs`

```js
#!/usr/bin/env node
/**
 * Dictionary check (audit-only — non-fatal).
 *
 * Scans .tsx/.ts files for use of "✗ never" terms from docs/dictionary.md.
 * Prints warnings. Exit code is ALWAYS 0 — do not block CI.
 *
 * Run: pnpm check:dict
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

/**
 * Each entry: [search-regex, replacement-hint, whether-legacy-ok]
 * legacyOk=true means the term is currently accepted (Phase Б).
 */
const RULES = [
  // High-severity: English terms in JSX user-facing text
  { pattern: />\s*Login\s*</g, hint: "→ „Влизане" или „Влез"", legacy: false },
  { pattern: />\s*Logout\s*</g, hint: "→ „Излез"", legacy: false },
  { pattern: />\s*Sign[ -]?up\s*</g, hint: "→ „Нов профил"", legacy: false },
  { pattern: />\s*Submit\s*</g, hint: "→ „Прати" / „Запази"", legacy: false },
  { pattern: />\s*Cancel\s*</g, hint: "→ „Откажи"", legacy: false },
  { pattern: />\s*Confirm\s*</g, hint: "→ „Потвърди"", legacy: false },
  { pattern: />\s*Save\s*</g, hint: "→ „Запази"", legacy: false },
  { pattern: />\s*Delete\s*</g, hint: "→ „Изтрий"", legacy: false },
  { pattern: />\s*OK\s*</g, hint: "→ „Добре"", legacy: false },
  { pattern: />\s*Continue\s*</g, hint: "→ „Продължи"", legacy: false },
  { pattern: />\s*Loading\.{3}\s*</g, hint: "→ „Зареждаме…"", legacy: false },

  // Bulgarian anglicisms
  { pattern: /Логин(а|ът|и|ите)?/g, hint: "→ „Влизане"", legacy: false },
  { pattern: /Аватар(а|ът|и|ите)?/g, hint: "→ „Портрет"", legacy: false },
  { pattern: /\bЧат(а|ът|ове|овете)?\b/g, hint: "→ „Разговор"", legacy: false },

  // Spec deviations — currently accepted but listed for visibility (Phase Б)
  { pattern: /Постижения/g, hint: "spec: „Легенди" (legacy-OK)", legacy: true },
  { pattern: /Класация/g, hint: "spec: „Вечерен брой" (legacy-OK)", legacy: true },
  { pattern: /Често задавани въпроси/g, hint: "spec: „Седни до огъня" (legacy-OK)", legacy: true },
];

const SCAN_DIRS = [
  "apps/web/app",
  "apps/web/components",
];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "__visual__"]);
const SCAN_EXT = new Set([".tsx", ".ts"]);

let warnings = 0;
let legacyHits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (SCAN_EXT.has(extname(entry))) checkFile(full);
  }
}

function checkFile(path) {
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const m = line.match(rule.pattern);
      if (m) {
        const tag = rule.legacy ? "[33m[legacy][0m" : "[31m[warn][0m";
        const rel = path.replace(ROOT + "/", "").replace(ROOT + "\\", "");
        process.stdout.write(`${tag} ${rel}:${i + 1}  "${m[0]}" — ${rule.hint}\n`);
        if (rule.legacy) legacyHits++;
        else warnings++;
      }
    }
  }
}

console.log("\nDictionary check (audit-only) — Path Б\n");
for (const dir of SCAN_DIRS) {
  walk(join(ROOT, dir));
}
console.log(
  `\nSummary: ${warnings} hard warnings, ${legacyHits} legacy-OK hits.\n` +
  `Exit code 0 (audit-only). Fix hard warnings; legacy hits will be migrated in a follow-up PR.\n`,
);
// Always succeed in Phase Б
process.exit(0);
```

Make executable:
```bash
chmod +x scripts/check-dictionary.mjs 2>/dev/null
```

### Verify
```bash
pnpm check:dict
# Should print colored warnings, exit 0
# Expected output: a handful of "[legacy]" entries for Постижения/Класация, zero or few hard warnings
```

### Commit 2
```
feat(scripts): add audit-only dictionary check (exit 0, warns only)
```

## §3.3 — AGENTS.md note about dictionary

### Update `AGENTS.md` (final section)

Add a new subsection (before the existing "Skills" or similar):

```diff
+ ## Bulgarian copy reference
+
+ All user-facing strings should match `docs/dictionary.md`. Run `pnpm check:dict`
+ before opening a PR to see violations.
+
+ Current policy (Phase Б): hard violations (English in JSX, anglicisms like „Логин")
+ should be fixed. Legacy spec deviations (Постижения vs Легенди) are accepted
+ until a follow-up copy-migration PR ships.
+
+ When invoking the `bg-copy-reviewer` agent, pass the changed files; the agent
+ cross-references the dictionary automatically.
```

### Commit 3
```
docs(agents): document Bulgarian dictionary policy for contributors
```

**Phase 3 complete.** Dictionary locked, audit script live (non-fatal), AGENTS.md updated.

Run `bg-copy-reviewer` agent on `docs/dictionary.md` to verify the Bulgarian copy reads naturally.

---

# §4 — PHASE 4: Surface primitive (~1 hour, 2 commits)

**Goal**: Build the FIRST primitive — `Surface`. Foundation for all other layouts. Includes Storybook stories, unit test, a11y check.

Invoke `frontend-design` skill during this phase for polished CSS output if available.

## §4.1 — `Surface` component

### `packages/ui/src/primitives/Surface.tsx`

```tsx
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export type SurfaceVariant = "paper" | "paper-deep" | "scene" | "scene-deep";
export type SurfaceRadius = "card" | "tile" | "none";
export type SurfaceElevation = "none" | "card" | "scene";
export type SurfaceAs = "div" | "section" | "article" | "aside";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** Цветова семантика на повърхността */
  variant?: SurfaceVariant;
  /** Border radius — 'card' (22px), 'tile' (14px), 'none' (0) */
  radius?: SurfaceRadius;
  /** Сянка */
  elevation?: SurfaceElevation;
  /** HTML тагът */
  as?: SurfaceAs;
  /** Деца */
  children: ReactNode;
}

const VARIANT_BG: Record<SurfaceVariant, string> = {
  paper: "var(--ds-surface-paper)",
  "paper-deep": "var(--ds-surface-paper-deep)",
  scene: "var(--ds-surface-scene)",
  "scene-deep": "var(--ds-surface-scene-deep)",
};

const RADIUS_VALUE: Record<SurfaceRadius, string> = {
  card: "var(--ds-radius-card)",
  tile: "var(--ds-radius-tile)",
  none: "0",
};

const ELEVATION_VALUE: Record<SurfaceElevation, string> = {
  none: "none",
  card: "var(--ds-shadow-card)",
  scene: "var(--ds-shadow-scene)",
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  {
    variant = "paper",
    radius = "tile",
    elevation = "card",
    as = "div",
    children,
    style,
    ...rest
  },
  ref,
) {
  const composed: CSSProperties = {
    background: VARIANT_BG[variant],
    borderRadius: RADIUS_VALUE[radius],
    boxShadow: ELEVATION_VALUE[elevation],
    ...style,
  };

  // Render the chosen element. Using createElement avoids per-variant JSX duplication.
  const Tag = as as "div";
  return (
    <Tag ref={ref as never} data-ds-surface={variant} style={composed} {...rest}>
      {children}
    </Tag>
  );
});

Surface.displayName = "Surface";
```

### `packages/ui/src/primitives/Surface.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Surface } from "./Surface";

const meta: Meta<typeof Surface> = {
  title: "Primitives/Surface",
  component: Surface,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "select", options: ["paper", "paper-deep", "scene", "scene-deep"] },
    radius: { control: "select", options: ["card", "tile", "none"] },
    elevation: { control: "select", options: ["none", "card", "scene"] },
    as: { control: "select", options: ["div", "section", "article", "aside"] },
  },
};
export default meta;

type Story = StoryObj<typeof Surface>;

const Sample = ({ label }: { label: string }) => (
  <div style={{ padding: "40px 56px", fontFamily: "Noto Serif, serif", fontSize: "18px" }}>
    {label}
  </div>
);

export const Paper: Story = {
  args: { variant: "paper", radius: "card", elevation: "card", children: <Sample label="Paper card" /> },
};

export const PaperDeep: Story = {
  args: { variant: "paper-deep", radius: "card", elevation: "card", children: <Sample label="Paper deep" /> },
};

export const Scene: Story = {
  args: { variant: "scene", radius: "card", elevation: "scene", children: <Sample label="Scene card" /> },
  parameters: { backgrounds: { default: "scene" } },
};

export const SceneDeep: Story = {
  args: { variant: "scene-deep", radius: "card", elevation: "scene", children: <Sample label="Scene deep" /> },
  parameters: { backgrounds: { default: "scene" } },
};

export const Flat: Story = {
  args: { variant: "paper", radius: "tile", elevation: "none", children: <Sample label="Flat tile (no shadow)" /> },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(2, 1fr)", padding: "32px" }}>
      <Surface variant="paper" radius="card"><Sample label="paper · card" /></Surface>
      <Surface variant="paper-deep" radius="card"><Sample label="paper-deep · card" /></Surface>
      <Surface variant="scene" radius="card" elevation="scene"><Sample label="scene · card" /></Surface>
      <Surface variant="scene-deep" radius="card" elevation="scene"><Sample label="scene-deep · card" /></Surface>
    </div>
  ),
};
```

### `packages/ui/src/primitives/Surface.test.tsx`

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Surface } from "./Surface";

describe("Surface", () => {
  it("renders children", () => {
    const { getByText } = render(<Surface>Hello</Surface>);
    expect(getByText("Hello")).toBeDefined();
  });

  it("applies variant via data attribute", () => {
    const { container } = render(<Surface variant="scene">child</Surface>);
    expect(container.firstChild).toHaveProperty("dataset.dsSurface", "scene");
  });

  it("renders as different HTML element when as= is set", () => {
    const { container } = render(<Surface as="article">child</Surface>);
    expect(container.firstChild?.nodeName).toBe("ARTICLE");
  });

  it("forwards arbitrary HTML props", () => {
    const { getByRole } = render(<Surface as="article" role="region" aria-label="X">child</Surface>);
    expect(getByRole("region")).toBeDefined();
  });
});
```

### Export from index

```diff
// packages/ui/src/index.ts
- export {};
+ export { Surface } from "./primitives/Surface";
+ export type { SurfaceProps, SurfaceVariant, SurfaceRadius, SurfaceElevation, SurfaceAs } from "./primitives/Surface";
```

### Verify

```bash
pnpm --filter @werewolf/ui typecheck
pnpm --filter @werewolf/ui build
# Verify dist/ contains Surface

pnpm ui:dev
# Open http://localhost:6006, navigate to Primitives > Surface > All Variants
# Visually verify all 4 variants render correctly

pnpm --filter @werewolf/ui test  # If vitest is wired in packages/ui
# OR just run as-is from apps/web (the existing vitest)
```

If `packages/ui` doesn't have vitest yet, add to `packages/ui/package.json`:

```diff
  "devDependencies": {
+   "vitest": "^4.0.2",
+   "@testing-library/react": "^16.3.2",
+   "@testing-library/jest-dom": "^6.9.1",
+   "jsdom": "^25.0.1",
    /* existing */
  }
```

And add `packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

And `packages/ui/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

### Commit 1
```
feat(ui): Surface primitive with variants, stories, and tests
```

## §4.2 — Run a11y check

Invoke `frontend-design` skill (if available) to review the Surface implementation:

> "Review packages/ui/src/primitives/Surface.tsx + stories. Check: API ergonomics, prop naming, default values, Storybook story coverage. Confirm `data-ds-surface` is a useful introspection hook. Suggest precise improvements if any."

Apply skill's recommendations as separate sub-commit if substantive.

Run Storybook a11y addon — every Surface variant story must pass axe-core with **zero violations**.

```bash
pnpm ui:dev
# In Storybook: open each Surface story
# Check the "Accessibility" tab (a11y addon)
# Must show 0 violations per story
```

If any violation appears, fix in Surface.tsx and commit.

### Commit 2
```
chore(ui): verify Surface primitive passes axe-core in all variants
```

**Phase 4 complete.** First primitive shipped. Storybook is now the source of truth for component visual behaviour.

---

# §5 — PHASE 5: Remaining primitives (~3 hours, 8 commits)

Build 7 more primitives, one per commit. Same pattern as Surface: component + stories + tests + axe-clean.

Each commit also re-exports the new primitive from `packages/ui/src/index.ts`.

## §5.1 — Eyebrow

`packages/ui/src/primitives/Eyebrow.tsx` — small all-caps mono label.

```tsx
export type EyebrowTone = "default" | "muted" | "blood" | "gold";

export interface EyebrowProps {
  tone?: EyebrowTone;
  children: ReactNode;
}

const TONE_COLOR: Record<EyebrowTone, string> = {
  default: "var(--ds-ink-soft)",
  muted: "var(--ds-ink-faint)",
  blood: "var(--ds-accent-blood)",
  gold: "var(--ds-accent-gold-deep)",
};

export function Eyebrow({ tone = "default", children }: EyebrowProps) {
  return (
    <span data-ds-eyebrow={tone} style={{
      fontFamily: "JetBrains Mono, ui-monospace, monospace",
      fontSize: "var(--ds-type-eyebrow)",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: TONE_COLOR[tone],
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}
```

Story + test follow the Surface pattern.

**Note**: Eyebrow uses JetBrains Mono as fallback, but the production app uses system mono — which is fine for the eyebrow's role. We do NOT load Cormorant Garamond.

### Commit
```
feat(ui): Eyebrow primitive with tone variants
```

## §5.2 — Display

`packages/ui/src/primitives/Display.tsx` — large semi-italic serif heading.

```tsx
export type DisplaySize = "hero" | "h1" | "h2" | "h3" | "h4";

const SIZE_FONT: Record<DisplaySize, string> = {
  hero: "var(--ds-type-display)",
  h1: "var(--ds-type-h1)",
  h2: "var(--ds-type-h2)",
  h3: "var(--ds-type-h3)",
  h4: "var(--ds-type-h4)",
};

const SIZE_TAG: Record<DisplaySize, "h1" | "h2" | "h3" | "h4" | "h5"> = {
  hero: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
};

export interface DisplayProps {
  size?: DisplaySize;
  as?: keyof React.JSX.IntrinsicElements;
  children: ReactNode;
}

export function Display({ size = "h1", as, children }: DisplayProps) {
  const Tag = (as ?? SIZE_TAG[size]) as "h1";
  return (
    <Tag style={{
      fontFamily: '"Noto Serif Display", "Noto Serif", serif',
      fontSize: SIZE_FONT[size],
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: "-0.01em",
      margin: 0,
      textWrap: "balance",
    }}>
      {children}
    </Tag>
  );
}
```

### Commit
```
feat(ui): Display primitive with size scale (Noto Serif Display)
```

## §5.3 — PaperCard

Builds on `Surface`. Standard layout with optional eyebrow + meta slot + body.

```tsx
export interface PaperCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  children: ReactNode;
}

const DENSITY_PAD: Record<NonNullable<PaperCardProps["density"]>, string> = {
  sm: "16px",
  md: "28px",
  lg: "48px",
};

export function PaperCard({ eyebrow, density = "md", meta, children }: PaperCardProps) {
  return (
    <Surface variant="paper" radius="card" elevation="card">
      <div style={{ padding: DENSITY_PAD[density], display: "grid", gap: "16px" }}>
        {(eyebrow || meta) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
            {eyebrow ? <Eyebrow tone="muted">{eyebrow}</Eyebrow> : <span />}
            {meta}
          </div>
        )}
        {children}
      </div>
    </Surface>
  );
}
```

### Commit
```
feat(ui): PaperCard primitive (Surface + eyebrow + meta + body)
```

## §5.4 — SceneCard

Identical to PaperCard but `variant="scene"` + `elevation="scene"`. Likely a thin wrapper.

```tsx
export type SceneCardProps = PaperCardProps;

export function SceneCard({ eyebrow, density = "md", meta, children }: SceneCardProps) {
  return (
    <Surface variant="scene" radius="card" elevation="scene">
      <div style={{ padding: DENSITY_PAD[density], display: "grid", gap: "16px", color: "var(--ds-ink-scene)" }}>
        {(eyebrow || meta) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
            {eyebrow ? <Eyebrow tone="gold">{eyebrow}</Eyebrow> : <span />}
            {meta}
          </div>
        )}
        {children}
      </div>
    </Surface>
  );
}
```

### Commit
```
feat(ui): SceneCard primitive (dark cinematic variant of PaperCard)
```

## §5.5 — Pill

Button / link / chip with three intents.

```tsx
export type PillIntent = "primary" | "secondary" | "danger" | "ghost";
export type PillSize = "sm" | "md" | "lg";

export interface PillProps {
  intent?: PillIntent;
  size?: PillSize;
  as?: "button" | "a";
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

const INTENT_STYLES: Record<PillIntent, CSSProperties> = {
  primary: { background: "var(--ds-accent-blood)", color: "oklch(0.97 0.01 80)" },
  secondary: { background: "var(--ds-surface-paper-deep)", color: "var(--ds-ink-primary)", border: "1px solid var(--ds-surface-paper-edge)" },
  danger: { background: "transparent", color: "var(--ds-accent-blood-deep)", border: "1px solid var(--ds-accent-blood)" },
  ghost: { background: "transparent", color: "var(--ds-ink-soft)" },
};

const SIZE_STYLES: Record<PillSize, CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: "0.86rem" },
  md: { padding: "10px 22px", fontSize: "1rem" },
  lg: { padding: "14px 28px", fontSize: "1.06rem" },
};

export function Pill({ intent = "primary", size = "md", as = "button", children, ...rest }: PillProps) {
  const Tag = as as "button";
  return (
    <Tag
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        borderRadius: "var(--ds-radius-chip)",
        fontFamily: '"Noto Serif", serif',
        fontWeight: 700,
        cursor: "pointer",
        transition: "background 180ms cubic-bezier(0.32, 0.72, 0, 1), filter 180ms",
        ...SIZE_STYLES[size],
        ...INTENT_STYLES[intent],
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

### Commit
```
feat(ui): Pill primitive with intent and size variants
```

## §5.6 — Medallion

Circular gold medallion with number or glyph.

```tsx
export interface MedallionProps {
  /** Number or short text inside */
  label: string | number;
  size?: number;  /** px diameter; default 56 */
}

export function Medallion({ label, size = 56 }: MedallionProps) {
  return (
    <span style={{
      display: "inline-grid",
      placeItems: "center",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "999px",
      border: "1px solid oklch(0.58 0.110 65 / 0.95)",
      background: "radial-gradient(circle at 50% 38%, oklch(0.97 0.01 80) 0 34%, var(--ds-accent-gold) 68%, oklch(0.48 0.06 60) 100%)",
      boxShadow: "inset 0 0 0 3px oklch(0.97 0.01 80 / 0.78), 0 10px 22px oklch(0.18 0.012 60 / 0.22)",
      color: "var(--ds-ink-primary)",
      fontFamily: '"Noto Serif", serif',
      fontWeight: 800,
      fontSize: `${Math.round(size * 0.36)}px`,
      lineHeight: 1,
    }}>
      {label}
    </span>
  );
}
```

### Commit
```
feat(ui): Medallion primitive (gold circular badge)
```

## §5.7 — Toast

Simple positioned toast. Wraps existing `useToast` from `apps/web/lib/toast` to maintain consistency.

```tsx
export type ToastTone = "info" | "success" | "error";

export interface ToastProps {
  tone?: ToastTone;
  message: string;
  onDismiss?: () => void;
}

const TONE_BG: Record<ToastTone, string> = {
  info: "var(--ds-surface-scene-deep)",
  success: "var(--ds-accent-green)",
  error: "var(--ds-accent-blood)",
};

export function Toast({ tone = "info", message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: TONE_BG[tone],
        color: "oklch(0.97 0.01 80)",
        padding: "12px 18px",
        borderRadius: "var(--ds-radius-tile)",
        boxShadow: "var(--ds-shadow-scene)",
        display: "inline-flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Затвори"
          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.2em" }}
        >×</button>
      )}
    </div>
  );
}
```

### Commit
```
feat(ui): Toast primitive with info/success/error tones
```

## §5.8 — Dialog (Radix-backed)

Uses `@radix-ui/react-dialog` 1.1.15 for full focus-trap, ESC, scroll-lock, ARIA semantics — better than rolling our own.

```tsx
import * as RDialog from "@radix-ui/react-dialog";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onOpenChange, title, children, footer }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "oklch(0 0 0 / 0.62)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
          }}
        />
        <RDialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(92vw, 480px)",
            background: "var(--ds-surface-paper)",
            color: "var(--ds-ink-primary)",
            borderRadius: "var(--ds-radius-card)",
            boxShadow: "var(--ds-shadow-scene)",
            padding: "28px",
            zIndex: 101,
            display: "grid",
            gap: "16px",
          }}
        >
          <RDialog.Title style={{
            fontFamily: '"Noto Serif Display", serif',
            fontSize: "var(--ds-type-h3)",
            fontWeight: 800,
            margin: 0,
          }}>{title}</RDialog.Title>
          <RDialog.Description asChild>
            <div>{children}</div>
          </RDialog.Description>
          {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
```

### Commit
```
feat(ui): Dialog primitive (Radix-backed with focus trap + scroll lock)
```

After all 8 primitives ship, update `index.ts`:

```ts
export { Surface } from "./primitives/Surface";
export type { SurfaceProps } from "./primitives/Surface";
export { Eyebrow } from "./primitives/Eyebrow";
export { Display } from "./primitives/Display";
export { PaperCard } from "./primitives/PaperCard";
export { SceneCard } from "./primitives/SceneCard";
export { Pill } from "./primitives/Pill";
export { Medallion } from "./primitives/Medallion";
export { Toast } from "./primitives/Toast";
export { Dialog } from "./primitives/Dialog";
```

(Note: The 14-primitive list in `/redesign` also includes PhaseStrip, PlayerDiary, VoteCircle, EmptyState, Sheet. **PhaseStrip + PlayerDiary + VoteCircle are play-room-specific** — and play-room already has these as components in `apps/web/components/play/`. Defer to a future PR; current play components stay. EmptyState + Sheet ship in Phase 6.)

**Phase 5 complete.** 8 primitives in production. Storybook now demonstrates real design system.

---

# §6 — PHASE 6: EmptyState + Sheet primitives + state catalog (~2 hours, 4 commits)

## §6.1 — EmptyState primitive

```tsx
export interface EmptyStateProps {
  artifact?: ReactNode;   // SVG illustration
  title: string;
  body: string;
  action?: ReactNode;     // <Pill /> typically
}

export function EmptyState({ artifact, title, body, action }: EmptyStateProps) {
  return (
    <PaperCard density="lg">
      <div style={{
        display: "grid",
        gap: "20px",
        justifyItems: "center",
        textAlign: "center",
        maxWidth: "32rem",
        margin: "0 auto",
      }}>
        {artifact && <div style={{ width: "120px", height: "120px" }}>{artifact}</div>}
        <Display size="h3">{title}</Display>
        <p style={{ color: "var(--ds-ink-soft)", fontSize: "var(--ds-type-body)", lineHeight: 1.5, margin: 0 }}>
          {body}
        </p>
        {action}
      </div>
    </PaperCard>
  );
}
```

### Commit 1
```
feat(ui): EmptyState primitive (artifact + title + body + action)
```

## §6.2 — Geometric artifact SVGs

The redesign spec mentions 8 named artifacts: `empty-chair`, `closed-book`, `sealed-letter`, `open-door`, `dusty-shelf`, `unprinted-paper`, `balanced-scale`, `broken-candle`.

For Phase Б, ship **simple geometric SVG** versions. Detailed painterly versions can be generated later via imagen if desired.

Create `packages/ui/src/primitives/artifacts/`:

```
empty-chair.tsx    closed-book.tsx    sealed-letter.tsx    open-door.tsx
dusty-shelf.tsx    unprinted-paper.tsx    balanced-scale.tsx    broken-candle.tsx
```

Each file exports a single `<svg>` component, ~30 lines, geometric style. Example:

```tsx
// packages/ui/src/primitives/artifacts/sealed-letter.tsx
export function SealedLetter({ size = 120 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="20" y="30" width="80" height="56" rx="2" fill="var(--ds-surface-paper-deep)" />
      <path d="M20 30 L60 64 L100 30" />
      <circle cx="60" cy="76" r="10" fill="var(--ds-accent-blood)" stroke="var(--ds-accent-blood-deep)" />
      <path d="M55 73 L60 78 L65 73 M55 79 L65 79" stroke="oklch(0.94 0.022 78)" />
    </svg>
  );
}
```

Pattern: monochrome strokes, one optional accent fill, sized via prop, color inherits from parent (so it adapts to scene vs paper).

Build all 8 artifacts. Each in own file with default `size={120}`.

**Optional**: If `imagen` skill is available and the user opts in, generate higher-fidelity painterly versions. Path: `apps/web/public/empty-states/<artifact>.webp` (1024×1024). The geometric SVG remains as fallback for `<noscript>` and reduced-data scenarios. **Document with TODO(imagen):** comments in each artifact file if not generated.

### Commit 2
```
feat(ui): 8 geometric artifact SVGs for empty states
```

## §6.3 — Sheet primitive (bottom-sheet on mobile, centered on desktop)

```tsx
import * as RDialog from "@radix-ui/react-dialog";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", zIndex: 100 }} />
        <RDialog.Content
          className="ds-sheet"
          style={{
            position: "fixed",
            background: "var(--ds-surface-paper)",
            zIndex: 101,
            display: "grid",
            gap: "16px",
          }}
        >
          {title && (
            <RDialog.Title style={{
              fontFamily: '"Noto Serif Display", serif',
              fontSize: "var(--ds-type-h3)",
              margin: 0,
            }}>{title}</RDialog.Title>
          )}
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
```

And `packages/ui/src/styles/sheet.css`:

```css
.ds-sheet {
  /* Mobile: bottom sheet */
  bottom: 0;
  left: 0;
  right: 0;
  border-top-left-radius: var(--ds-radius-card);
  border-top-right-radius: var(--ds-radius-card);
  padding: 28px;
  box-shadow: 0 -20px 40px oklch(0 0 0 / 0.4);
}

@media (min-width: 768px) {
  .ds-sheet {
    /* Desktop: centered modal */
    bottom: auto;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(92vw, 600px);
    border-radius: var(--ds-radius-card);
    box-shadow: var(--ds-shadow-scene);
  }
}
```

Update `packages/ui/package.json` exports:
```diff
  "exports": {
    ".": { … },
    "./tokens.css": "./src/tokens.css",
+   "./sheet.css": "./src/styles/sheet.css",
    "./styles/*.css": "./src/styles/*.css"
  },
+ "files": ["dist", "src/tokens.css", "src/styles"],
```

### Commit 3
```
feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
```

## §6.4 — State catalog as data + stories

Create `packages/ui/src/states/empty-states.ts`:

```ts
import { EmptyChair } from "../primitives/artifacts/empty-chair";
import { ClosedBook } from "../primitives/artifacts/closed-book";
import { SealedLetter } from "../primitives/artifacts/sealed-letter";
import { OpenDoor } from "../primitives/artifacts/open-door";
import { DustyShelf } from "../primitives/artifacts/dusty-shelf";
import { UnprintedPaper } from "../primitives/artifacts/unprinted-paper";
import { BalancedScale } from "../primitives/artifacts/balanced-scale";
import { BrokenCandle } from "../primitives/artifacts/broken-candle";

export type EmptyStateKey =
  | "home-no-rooms"
  | "home-no-last-story"
  | "lobby-list-empty"
  | "lobby-search-no-match"
  | "play-lobby-waiting"
  | "history-empty"
  | "history-filter-no-match"
  | "achievements-zero"
  | "achievements-locked"
  | "friends-empty"
  | "friends-pending"
  | "leaderboard-empty"
  | "leaderboard-week-empty"
  | "account-unverified"
  | "account-no-avatar"
  | "faq-no-results"
  | "report-no-reports"
  | "status-all-healthy"
  | "status-partial-outage"
  | "status-major-outage"
  | "search-global"
  | "notifications";

interface EmptyStateDef {
  artifact: typeof EmptyChair;
  title: string;
  body: string;
  action?: { label: string; href?: string };
}

export const EMPTY_STATES: Record<EmptyStateKey, EmptyStateDef> = {
  "home-no-rooms": {
    artifact: EmptyChair,
    title: "Бъди първият на масата.",
    body: "Няма активни стаи в момента.",
    action: { label: "Създай стая", href: "/create" },
  },
  "home-no-last-story": {
    artifact: ClosedBook,
    title: "Първите герои ще се появят тук.",
    body: "След първата завършена игра.",
  },
  /* … all 22 entries from /redesign/states.html — verbatim … */
};
```

Add Storybook coverage at `packages/ui/src/states/empty-states.stories.tsx` showing each key's render.

### Commit 4
```
feat(ui): empty-state catalog with 22 entries (data + storybook)
```

**Phase 6 complete.** State catalog and overlay primitives ready.

---

# §7 — PHASE 7: Pilot page migration — /status (~1.5 hours, 3 commits)

**Goal**: Migrate `/status` to use `@werewolf/ui` primitives. Visual regression must stay green (or be explicitly updated with documented before/after).

`/status` is chosen because:
- Simplest layout (no dynamic data tables, no forms, no real-time)
- Few light-theme overrides
- Already migrated to `--legal-shell-*` tokens in Phase C
- Low blast radius if visual regresses

## §7.1 — Read current /status

```bash
cat apps/web/app/status/page.tsx
ls apps/web/components/status/ 2>&1
```

Document in `apps/web/app/status/MIGRATION.md` (temporary scratchpad, delete after PR):
- What components render the page
- Which `:has(.status-shell)` selectors fire
- Which legacy tokens used (`--legal-shell-*`, `--ink`, etc.)

## §7.2 — Migrate one section to primitives

Pick the smallest visual unit (e.g. a service-health card) and refactor:

```diff
- <div className="status-card">
-   <span className="status-card-kicker">Игра-сървър</span>
-   <h3 className="status-card-title">Селото работи</h3>
-   <p>Всички услуги отговарят нормално.</p>
- </div>
+ <PaperCard
+   eyebrow="Игра-сървър"
+   meta={<Eyebrow tone="muted">обновено преди 12с</Eyebrow>}
+ >
+   <Display size="h4">Селото работи</Display>
+   <p>Всички услуги отговарят нормално.</p>
+ </PaperCard>
```

The page becomes a thin shell of primitives.

**Don't delete the corresponding CSS yet** — leave the old `.status-card` selectors in `globals.css`. They become dead code, which the next CSS cleanup PR removes.

### Commit 1
```
refactor(status): migrate service-health card to PaperCard primitive
```

## §7.3 — Migrate empty state

If `/status` has a "no data" state (e.g. all services down), use the new `EmptyState` primitive:

```tsx
import { EmptyState } from "@werewolf/ui";
import { BrokenCandle } from "@werewolf/ui/artifacts/broken-candle";

<EmptyState
  artifact={<BrokenCandle />}
  title="Селото спи."
  body="Сериозен проблем. Опитай след малко."
/>
```

### Commit 2
```
feat(status): adopt EmptyState primitive for major-outage state
```

## §7.4 — Acceptance check

Run visual regression and compare:

```bash
pnpm visual
# Look at apps/web/__visual__/__baseline__/status*.png diffs
# If pixel-different, document why in PR description:
#   - intentional refactor → update baseline with pnpm visual:update
#   - unintentional → revert and re-investigate

pnpm regression
pnpm typecheck
pnpm build
pnpm --filter @werewolf/web test
```

If visual diff is intentional and acceptable, update baseline:

```bash
pnpm visual:update
```

Document the diff in the commit message.

### Commit 3
```
test(visual): update status page baselines after primitive migration
```

**Phase 7 complete.** First real page on `@werewolf/ui` primitives. Pattern validated.

---

# §8 — PHASE 8: Acceptance criteria documentation (~1 hour, 2 commits)

## §8.1 — Per-page acceptance docs

Create `docs/acceptance/` directory:

```
docs/acceptance/
├── README.md
├── home.md
├── werewolf.md
├── mafia.md
├── sign-in.md
├── tutorial.md
├── lobby.md
├── play.md
├── history.md
├── achievements.md
├── leaderboard.md
├── friends.md
├── account.md
├── faq.md
├── privacy.md
├── terms.md
├── status.md
└── report.md
```

Each file follows this template:

```md
# /<route> — acceptance criteria

## Functional
- [ ] Loads in < 1.5s on slow-3G (Lighthouse mobile)
- [ ] Without JS, primary content visible (`view-source:`)
- [ ] All links keyboard-reachable (Tab order natural)
- [ ] ESC closes modals; clicking overlay closes too
- [ ] Errors surface via Toast or inline (no console.error in happy path)

## Visual
- [ ] Hero uses `<SceneCard>` or `<PaperCard>` — no custom `<div>`
- [ ] Headings: Display primitive, no inline `<h1>` with inline styles
- [ ] CTAs: Pill primitive, never raw `<button>`
- [ ] Empty states use `EmptyState` primitive with artifact
- [ ] Cards never overflow viewport at 375px width

## Bulgarian copy
- [ ] No English in JSX text (hard fail)
- [ ] No anglicisms — „Логин", „Аватар", „Чат" — forbidden
- [ ] Page-specific terms match `docs/dictionary.md`

## Accessibility
- [ ] Lighthouse Accessibility ≥ 95
- [ ] axe-core zero violations on touched flow
- [ ] Focus ring visible on every interactive element
- [ ] Color contrast: AA on every text/background pair

## Performance
- [ ] Lighthouse Performance ≥ 85 desktop / 75 mobile
- [ ] No layout shift > 0.05 (CLS)
- [ ] No paint blocking from animation > 250ms
- [ ] Total JS for route < 200 KB gzipped

## Visual regression
- [ ] Baselines exist at 375 / 768 / 1280 viewports
- [ ] Dark + light themes both captured
- [ ] Diff with main < 1% pixels (or documented intentional)
```

Generate all 17 page acceptance files from this template. Per-page specifics (e.g. "/play has 4 phases, each must transition smoothly") added based on `/redesign/acceptance.html` content.

### Commit 1
```
docs: per-page acceptance criteria for all 17 routes
```

## §8.2 — Acceptance index

`docs/acceptance/README.md`:

```md
# Acceptance criteria

This directory holds per-page acceptance criteria. Each file mirrors
`/redesign/acceptance.html` and references current PR requirements.

## How to use

When implementing or refactoring a page, open the matching file. Each item is
a checkbox — verify it during PR review.

When `pnpm verify` is updated to run axe-core + Lighthouse via CI, these
files become the source of truth.

## Files

- [home.md](home.md)
- [werewolf.md](werewolf.md)
- … 17 total

## Cross-cutting requirements

- All pages: Bulgarian-only copy per `docs/dictionary.md`
- All pages: Surface primitive at root, no raw `<main>` styling
- All pages: visual regression baseline at 3 viewports × 2 themes

## What's NOT enforced yet

These criteria are aspirational; CI does not yet block PRs on them. As
infrastructure matures (Lighthouse runner, axe-runner, dictionary enforcer),
items will graduate from "manual review" to "CI gate".
```

### Commit 2
```
docs: acceptance criteria index and policy
```

**Phase 8 complete.** Acceptance framework documented.

---

# §9 — Verification & finalization (~30 minutes, 1 commit)

## §9.1 — Full verification suite

```bash
# Workspace integrity
pnpm install
pnpm --filter @werewolf/ui build
pnpm --filter @werewolf/ui typecheck
pnpm --filter @werewolf/ui test
pnpm --filter @werewolf/ui build-storybook  # ensure storybook builds for prod

# Project verify (full chain)
pnpm verify
# = optimize:assets && regression && typecheck && build && smoke && frontend:e2e && e2e:auth && playtest && test && visual && perf:budget
```

All must be green.

## §9.2 — `bg-copy-reviewer` agent

Run agent on all touched files. Specifically:
- `docs/dictionary.md`
- `docs/acceptance/*.md`
- `packages/ui/src/states/empty-states.ts`
- `apps/web/app/status/page.tsx` (and any other migrated)

Address any Bulgarian copy issues.

## §9.3 — `frontend-design` skill

Run skill on `packages/ui/src/primitives/Surface.tsx` (post-Phase-4 state) for final polish review:

> "Review packages/ui/src/primitives/*. Check API ergonomics, prop naming consistency, default values, story coverage. Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion, Toast, Dialog, EmptyState, Sheet. Are any of these over-abstracted? Any inconsistent prop patterns? Production-grade?"

Apply specific recommendations as polish commits.

## §9.4 — Update root README + AGENTS.md

`AGENTS.md` additions (after the existing structure):

```md
## Design system

`packages/ui` hosts primitives and tokens. Storybook at `pnpm ui:dev` (port 6006).

### Tokens

`--ds-*` OKLCH tokens live in `packages/ui/src/tokens.css`. They're parallel to
legacy `--ink`, `--paper`, etc. — new components consume `--ds-*`; existing
CSS keeps legacy until per-component migration.

### Primitives

11 components shipped in Phase Б adoption:
- Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion, Toast,
  Dialog, EmptyState, Sheet.

When building new UI, **always** check `packages/ui` first. If you need a new
primitive, add it there with a Storybook story + unit test + a11y verification.

### Dictionary

`docs/dictionary.md` is canonical for Bulgarian copy. Run `pnpm check:dict`
before opening a PR. Hard warnings (English text in JSX) must be fixed;
legacy warnings (Постижения vs Легенди) are accepted in Phase Б.

### Acceptance

`docs/acceptance/*.md` lists per-page acceptance criteria. Used during PR
review as a checklist.
```

### Commit 1
```
docs(agents): document design system, dictionary, and acceptance policy
```

---

# §10 — What this prompt explicitly does NOT do

These items are intentionally out of scope:

1. **Cormorant Garamond + JetBrains Mono swap** — not loaded; Noto Serif + Iowan remain. The Storybook preview hints at JetBrains Mono in Eyebrow but falls back to system mono if not available; that's acceptable.

2. **Dictionary breaking renames** (Постижения → Легенди, etc.) — only audit mode, no enforcement, no migration. Future PR can flip enforcement after migrating production strings.

3. **Re-split `play-room-client.tsx`** — already split (3268 → 1438 lines, 24 files in `components/play/`). Phase 5's PhaseStrip / PlayerDiary / VoteCircle primitives are NOT shipped; the play-room components remain in-place.

4. **Legacy CSS deletion** — old `.status-card`, `.faq-shell`, etc. selectors stay in `globals.css`. A future cleanup PR removes them after primitives fully replace them.

5. **Migrating all 17 pages** — only `/status` migrated as pilot. Other pages migrate in dedicated follow-up PRs.

6. **Backend / game-server changes** — Path Б is frontend-only.

7. **Imagen-generated empty-state artifacts** — geometric SVGs only. If user opts in, separate follow-up PR generates painterly art via imagen and swaps the SVG `<img>` src.

8. **CI enforcement of dictionary or acceptance** — audit-only / docs-only. Enforcement is a separate decision.

9. **Visual regression baseline overhaul** — existing baselines stay; only `/status` updates if needed.

10. **Token migration on existing pages** — legacy `--ink`, `--paper`, `--blood` continue to serve 19,876 lines of CSS. New `--ds-*` tokens are additive.

---

# §11 — Failure modes & recovery

## §11.1 — `packages/ui` install fails

- Likely cause: peer dep mismatch. Storybook 10 requires React 18+; we have 19.2 — should work, but verify.
- Recovery: `pnpm install --no-frozen-lockfile`. If still fails, downgrade to specific patch version of the failing dep.

## §11.2 — Storybook crashes on a story

- Likely cause: `@storybook/nextjs` incompatibility with React 19. Check `context7` MCP for the latest API docs.
- Recovery: Pin to `@storybook/nextjs@^10.4.1` (latest); if still failing, document in `audit-v3/blocked-items.md` and use `@storybook/react-vite` instead.

## §11.3 — Visual regression breaks on /status migration

- Likely cause: PaperCard default padding differs from old `.status-card`.
- Recovery: Open the failed diff. If intentional improvement → update baseline. If regression → adjust PaperCard density or wrap with custom padding.

## §11.4 — `pnpm verify` red after a commit

- Revert: `git reset --hard HEAD~1`
- Investigate which sub-step failed (`regression` / `typecheck` / `build` / `smoke` / `e2e` / `visual` / `perf:budget`)
- Fix specifically; commit again.

## §11.5 — Dictionary check finds 200+ legacy hits

- Expected — current production copy uses Постижения widely.
- These ARE `[legacy]` warnings, not `[warn]` hard warnings. Acceptable in Phase Б.
- If hard warnings appear (English in JSX), fix THOSE in same commit.

## §11.6 — Storybook a11y addon flags a contrast violation

- Check the violation: is it real, or false positive (e.g. axe doesn't understand OKLCH on Safari 17)?
- Real: fix the token or component until 0 violations.
- False positive: silence via `parameters.a11y.config.rules` per-story with a comment.

## §11.7 — Phase 6 imagen art unavailable

- Fall back to geometric SVGs (already in PR). Document in `apps/web/public/empty-states/TODO.md`.
- Future PR can swap when imagen is available.

---

# §12 — Acceptance criteria for THIS PR

1. ✅ `packages/ui` exists with Storybook 10.4.1, framer-motion 12.40.0, Radix 1.1.15
2. ✅ `packages/ui/src/tokens.css` defines 32 `--ds-*` OKLCH tokens with WCAG-verified contrasts
3. ✅ 11 primitives shipped: Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion, Toast, Dialog, EmptyState, Sheet
4. ✅ Each primitive has: TypeScript signature matching spec, Storybook story with All Variants, unit test, axe-core zero violations
5. ✅ 8 geometric artifact SVGs in `packages/ui/src/primitives/artifacts/`
6. ✅ Empty-state catalog with 22 entries in `packages/ui/src/states/empty-states.ts`
7. ✅ `docs/dictionary.md` with 48 spec terms + 10 legacy-OK overrides
8. ✅ `scripts/check-dictionary.mjs` runs, prints warnings, exits 0
9. ✅ `docs/acceptance/*.md` — 17 page files + README
10. ✅ `/status` migrated to PaperCard + EmptyState as pilot (visual regression updated if needed)
11. ✅ `AGENTS.md` documents design system, dictionary, acceptance policy
12. ✅ Storybook builds for production (`pnpm ui:build-storybook` green)
13. ✅ `pnpm verify` green throughout (every commit)
14. ✅ `pnpm visual` green or explicitly updated with documented diff
15. ✅ No new dependencies outside the §0.4 table
16. ✅ Existing legacy tokens (`--ink`, `--paper`, …) untouched
17. ✅ `play-room-client.tsx` line count ≤ 1438 (Phase B preserved)
18. ✅ Bulgarian-only user-facing copy (`bg-copy-reviewer` agent green)
19. ✅ Existing visual regression baselines intact except `/status` (documented)
20. ✅ No `prefers-reduced-motion` guards added (project convention)

---

# §13 — Commit summary

~30 atomic English commits across 9 phases:

```
Phase 1: Foundation infrastructure (5 commits)
  1. feat(ui): scaffold packages/ui workspace with tsup + storybook 10
  2. chore(ui): install dependencies for @werewolf/ui workspace
  3. feat(ui): configure storybook 10 with @storybook/nextjs + a11y addon
  4. chore(web): add @werewolf/ui workspace dependency and transpile
  5. chore(scripts): wire ui:dev, ui:build, check:dict commands

Phase 2: OKLCH tokens parallel layer (4 commits)
  6. feat(ui): introduce 32 OKLCH design tokens in packages/ui/tokens.css
  7. docs(ui): document --ds-* token namespace and migration policy
  8. feat(web): import @werewolf/ui tokens into globals.css (no consumers yet)
  9. feat(ui): add Tokens reference story for visual verification

Phase 3: Dictionary audit (3 commits)
  10. docs: lock 48-term Bulgarian dictionary with legacy-OK overrides
  11. feat(scripts): add audit-only dictionary check (exit 0, warns only)
  12. docs(agents): document Bulgarian dictionary policy for contributors

Phase 4: Surface primitive (2 commits)
  13. feat(ui): Surface primitive with variants, stories, and tests
  14. chore(ui): verify Surface primitive passes axe-core in all variants

Phase 5: Remaining primitives (8 commits)
  15. feat(ui): Eyebrow primitive with tone variants
  16. feat(ui): Display primitive with size scale (Noto Serif Display)
  17. feat(ui): PaperCard primitive (Surface + eyebrow + meta + body)
  18. feat(ui): SceneCard primitive (dark cinematic variant of PaperCard)
  19. feat(ui): Pill primitive with intent and size variants
  20. feat(ui): Medallion primitive (gold circular badge)
  21. feat(ui): Toast primitive with info/success/error tones
  22. feat(ui): Dialog primitive (Radix-backed with focus trap + scroll lock)

Phase 6: EmptyState + Sheet + catalog (4 commits)
  23. feat(ui): EmptyState primitive (artifact + title + body + action)
  24. feat(ui): 8 geometric artifact SVGs for empty states
  25. feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
  26. feat(ui): empty-state catalog with 22 entries (data + storybook)

Phase 7: /status pilot migration (3 commits)
  27. refactor(status): migrate service-health card to PaperCard primitive
  28. feat(status): adopt EmptyState primitive for major-outage state
  29. test(visual): update status page baselines after primitive migration

Phase 8: Acceptance criteria (2 commits)
  30. docs: per-page acceptance criteria for all 17 routes
  31. docs: acceptance criteria index and policy

Phase 9: Finalization (1 commit)
  32. docs(agents): document design system, dictionary, and acceptance policy
```

**Total**: 32 atomic commits.

PR strategy (recommended):
- **PR 1** = Phases 1+2+3 = workspace foundation + tokens + dictionary (12 commits, ~4 hours)
- **PR 2** = Phases 4+5+6 = primitives + state catalog (14 commits, ~6 hours)
- **PR 3** = Phases 7+8+9 = pilot migration + acceptance + docs (6 commits, ~3 hours)

Total reviewer load: 3 PRs, each independently reviewable and revertable.

---

# §14 — Notes for ChatGPT 5.5 x-high / Codex

1. **One PR per phase pair.** Don't fold multiple phases into a single PR — reviewers will choke.
2. **Verify after EVERY commit**, not just at phase end. `pnpm verify` is comprehensive; use it.
3. **Stories matter.** Each primitive's story is the visual spec — if it looks wrong in Storybook, the API is wrong.
4. **Don't migrate pages eagerly.** `/status` is the ONLY page migrated here. The rest is documentation + foundation. Other pages migrate in follow-up PRs.
5. **OKLCH tokens are additive.** Never break existing `--ink`, `--paper`, etc.
6. **Run `bg-copy-reviewer` agent** after every commit touching `.md` user-facing copy.
7. **Invoke `context7` MCP** if Storybook 10.4 API or Framer Motion 12 API is unclear — the spec snapshot is 2026-05-22, things move.
8. **`frontend-design` skill** during Phase 4 + Phase 9 — generates polished primitive code; let it shape API before locking it.
9. **Imagen** for artifact SVGs is optional. Geometric SVGs ship as default. Imagen variants are a follow-up PR.
10. **The `/redesign/` HTML files** stay as visual reference. Do NOT serve them in production; they're internal planning artifacts.
11. **If a phase blocks**, document in `audit-v3/blocked-items.md` with what was tried, why it didn't work, and which independent phase to skip to.
12. **No fonts loaded from Google CDN** in production (Cormorant). The Storybook preview's `@import` to Google Fonts is fine for the dev experience but never reaches users.

---

(End of master prompt)
