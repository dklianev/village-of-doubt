# Codex master prompt — Hybrid `/redesign` adoption v3 (standalone)

This is the **complete standalone** prompt. Nothing is referenced externally — everything needed is inline.

**Total scope**: ~46 atomic English commits across **5 PRs**, with an **optional PR 6** for imagen painterly polish. ~12-16 hours Codex work at high reasoning.

**Goal**: Beautiful, stable, measurable. The good kind of brutal — premium primitives, locked Bulgarian copy, no dependency bloat, every commit revertable, every page improved incrementally.

> **Operating rules** (non-negotiable):
> 1. Validate after every commit: `pnpm regression && pnpm typecheck && pnpm build`. If red → revert.
> 2. Visual regression (`pnpm visual`) green or explicitly updated in same commit.
> 3. Bulgarian-only user-facing copy. Invoke `bg-copy-reviewer` agent after every commit touching JSX text or `.md`.
> 4. **No `prefers-reduced-motion` guards anywhere.** Project convention.
> 5. **No font swap.** Noto Serif Display + Noto Serif + Iowan Old Style stay.
> 6. New deps pinned to §0.4 versions. Verified latest 2026-05-23.
> 7. Sacred preservation list (§0.2) — DO NOT TOUCH.
> 8. PR-gating: PR 4 (legal-shell sweep) starts ONLY after PR 3 (/status pilot) merges + visual diff approved.
> 9. PR 6 (imagen) is optional polish — only run if user explicitly requests.
> 10. Atomic commits, no folding.

---

# §0 — Pre-flight, locked decisions, version table, skills

## §0.1 — Pre-flight verification

```bash
wc -l apps/web/components/play-room-client.tsx       # ≤1438
test -f apps/web/hooks/use-timer-countdown.ts        && echo "✓ Phase A"
test -f apps/web/lib/use-modal.ts                    && echo "✓ useModal"
test -f apps/web/lib/auth-errors.ts                  && echo "✓ auth-errors"
test -f apps/web/lib/clipboard.ts                    && echo "✓ clipboard"
grep -q "^\s*--legal-shell-bg" apps/web/app/globals.css && echo "✓ legal tokens"
ls packages/ui 2>&1 | grep -q "No such file" && echo "✓ clean slate" || { echo "ABORT"; exit 1; }
npm view motion version                              # must report 12.40.x
test -f ~/.codex/skills/.system/imagegen/SKILL.md    && echo "✓ imagen available"
pnpm regression 2>&1 | tail -3
```

If any fail → STOP, document in `audit-v3/blocked-items.md`.

## §0.2 — Sacred preservation list (DO NOT TOUCH)

- `apps/web/components/play-room-client.tsx` (≤1438 lines, post-Phase-B)
- `apps/web/components/play/*.tsx` (24 files)
- `apps/web/lib/play/*.ts` (8 modules)
- `apps/web/hooks/use-timer-countdown.ts`
- `apps/web/lib/use-modal.ts`
- `apps/web/lib/auth-errors.ts`
- `apps/web/lib/clipboard.ts`
- `apps/web/components/account/AccountDangerZone.tsx` (typed-confirm)
- `apps/game-server/src/rooms/GameRoom.ts` (security work)
- `apps/web/app/history/[gameId]/replay/page.tsx`
- `apps/web/app/create/page.tsx`
- `--legal-shell-*` tokens in globals.css
- `--hero-card-*` tokens (theatre backdrop)
- All 50+ `--art-*`, `--texture-*`, `--faction-*` image-set tokens
- Production Bulgarian copy (changed only via dedicated migration PR — not this one)
- **`AGENTS.md`** — updated only in PR 5 (finalization)

## §0.3 — Dictionary policy (audit-only)

- `docs/dictionary.md` lists 48 spec terms + 10 legacy-OK overrides
- `scripts/check-dictionary.mjs` warns but exits 0
- Wired as `pnpm check:dict`; NOT in `pnpm verify`

## §0.4 — New dependencies (verified latest 2026-05-23)

| Package | Version | Where | Purpose |
|---|---|---|---|
| `motion` | `^12.40.0` | `packages/ui` dep | Animation for Dialog/Sheet/Toast (import `motion/react`) |
| `storybook` | `^10.4.1` | `packages/ui` devDep | Component browser |
| `@storybook/react-vite` | `^10.4.1` | `packages/ui` devDep | React + Vite integration (NOT `@storybook/nextjs`) |
| `vite` | `^8.0.14` | `packages/ui` devDep | Bundler for Storybook |
| `@storybook/addon-a11y` | `^10.4.1` | `packages/ui` devDep | axe-core in Storybook |
| `tsup` | `^8.5.1` | `packages/ui` devDep | Library build (esm+cjs+dts) |
| `tslib` | `^2.8.1` | `packages/ui` dep | TS runtime |
| `@radix-ui/react-dialog` | `^1.1.15` | `packages/ui` dep | Dialog + Sheet portal/ARIA |
| `@axe-core/react` | `^4.11.3` | `packages/ui` devDep | Runtime a11y in Storybook |
| `@axe-core/playwright` | `^4.11.3` | root devDep | a11y in visual specs |
| `tsx` | `^4.22.3` | root devDep | Run TS scripts |
| `@vitejs/plugin-react` | `^5.0.3` | `packages/ui` devDep | Vite React plugin |
| `@testing-library/react` | `^16.3.2` | `packages/ui` devDep | Component tests |
| `@testing-library/jest-dom` | `^6.9.1` | `packages/ui` devDep | DOM matchers |
| `jsdom` | `^25.0.1` | `packages/ui` devDep | Vitest DOM |
| `vitest` | `^4.0.2` | `packages/ui` devDep | Test runner |

**Test utilities import from `storybook/test` (built into SB10)** — NOT a separate dep.

## §0.5 — Skills, agents, MCPs

| Tool | When | Why |
|---|---|---|
| `bg-copy-reviewer` agent | After EVERY commit with user-facing strings | Bulgarian-only, natural phrasing |
| `frontend-design` skill | Phase 4 end, Phase 6 end, Phase 10 | Polished, distinctive code |
| `context7` MCP | Phase 1 (Storybook + Vite), Phase 4 (Motion 12, Radix) | Latest API docs |
| `imagegen` skill | PR 6 ONLY (optional) | Painterly artifacts |
| `WebSearch` | When API unclear, context7 lacks coverage | Recent breaking changes |

## §0.6 — PR strategy

| PR # | Phases | Commits | Hours | User-visible |
|---|---|---|---|---|
| **PR 1** Foundation | §1 + §2 + §3 | 12 | ~4 | No |
| **PR 2** Primitives library | §4 | 14 | ~5 | Storybook only |
| **PR 3** /status pilot | §5 + §6 | 8 | ~3 | Yes — /status polished |
| **PR 4** Legal-shell sweep (gated) | §7 | 6 | ~3 | Yes — 4 more pages |
| **PR 5** Docs + acceptance + finalization | §8 + §9 + §10 | 6 | ~2 | No |
| **PR 6** (optional) Painterly artifacts | §11 | 3 | ~1 | Yes |

---

# §1 — PHASE 1: Foundation infrastructure (~2 hours, 5 commits)

## §1.1 — Scaffold `packages/ui`

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── test-setup.ts
│   ├── tokens.css           # plain CSS variables (Phase 2)
│   ├── styles/              # Phase 4+
│   ├── primitives/          # Phase 4+
│   │   └── artifacts/       # Phase 5
│   ├── states/              # Phase 5 catalog
│   └── docs/                # Phase 8 MDX
├── .storybook/
│   ├── main.ts
│   ├── preview.ts
│   └── preview.css
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
    "./styles/*.css": "./src/styles/*.css",
    "./artifacts/*": {
      "types": "./dist/primitives/artifacts/*.d.ts",
      "import": "./dist/primitives/artifacts/*.mjs",
      "require": "./dist/primitives/artifacts/*.js"
    },
    "./states": {
      "types": "./dist/states/empty-states.d.ts",
      "import": "./dist/states/empty-states.mjs",
      "require": "./dist/states/empty-states.js"
    }
  },
  "files": ["dist", "src/tokens.css", "src/styles"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "motion": "^12.40.0",
    "tslib": "^2.8.1"
  },
  "peerDependencies": {
    "react": ">=19",
    "react-dom": ">=19"
  },
  "devDependencies": {
    "@axe-core/react": "^4.11.3",
    "@storybook/addon-a11y": "^10.4.1",
    "@storybook/react-vite": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.0.3",
    "jsdom": "^25.0.1",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "storybook": "^10.4.1",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
    "vite": "^8.0.14",
    "vitest": "^4.0.2"
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
  entry: [
    "src/index.ts",
    "src/primitives/artifacts/*.tsx",
    "src/states/empty-states.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "motion",
    "motion/react",
    "@radix-ui/react-dialog",
  ],
  treeshake: true,
  splitting: false,
});
```

### `packages/ui/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
```

### `packages/ui/src/test-setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

### `packages/ui/src/index.ts`

```ts
// Re-export point. Populated in Phase 4.
// Tokens imported via "@werewolf/ui/tokens.css".
export {};
```

### `packages/ui/README.md`

```md
# @werewolf/ui

React-only design system for Върколак · Мафия. No Next.js coupling.

## Quick start

```css
@import "@werewolf/ui/tokens.css";
```

```tsx
import { Surface, PaperCard, Pill } from "@werewolf/ui";
```

## Commands

- `pnpm --filter @werewolf/ui storybook` — Dev server on port 6006
- `pnpm --filter @werewolf/ui build` — Production library build (esm+cjs+dts)
- `pnpm --filter @werewolf/ui test` — Vitest
- `pnpm --filter @werewolf/ui build-storybook` — Static Storybook build

From root: `pnpm ui:dev`, `pnpm ui:build`, `pnpm ui:storybook:build`.
```

**Commit 1**: `feat(ui): scaffold packages/ui workspace (React-only, tsup, Vite-Storybook)`

## §1.2 — Install + verify clean build

```bash
pnpm install
pnpm --filter @werewolf/ui typecheck
pnpm --filter @werewolf/ui build
pnpm --filter @werewolf/ui test
```

**Commit 2**: `chore(ui): install dependencies for @werewolf/ui workspace`

## §1.3 — Storybook 10 + Vite configuration

### `packages/ui/.storybook/main.ts`

```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    check: true,
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  docs: { autodocs: "tag" },
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
      options: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
      manual: false,
    },
    layout: "centered",
    viewport: {
      viewports: {
        mobile: { name: "Mobile (375)", styles: { width: "375px", height: "812px" } },
        tablet: { name: "Tablet (768)", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop (1280)", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
  globalTypes: {
    theme: {
      description: "Theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = context.globals.theme as string;
      }
      return Story();
    },
  ],
  tags: ["autodocs"],
};

export default preview;
```

### `packages/ui/.storybook/preview.css`

```css
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Display:wght@600;800;900&display=swap");

body {
  font-family: "Noto Serif", "Iowan Old Style", Georgia, serif;
  color: var(--ds-ink-primary, oklch(0.22 0.018 60));
  background: var(--ds-surface-paper, oklch(0.94 0.022 78));
}

#storybook-root,
.docs-story {
  background: transparent;
}
```

**Commit 3**: `feat(ui): configure storybook 10 (react-vite) + a11y + viewport + theme decorator`

## §1.4 — Wire @werewolf/ui into apps/web

### Update `apps/web/package.json`

```diff
  "dependencies": {
    "@werewolf/database": "workspace:*",
    "@werewolf/shared": "workspace:*",
+   "@werewolf/ui": "workspace:*",
  }
```

### Update `apps/web/next.config.ts`

```diff
  const nextConfig: NextConfig = {
-   transpilePackages: ["@werewolf/shared", "@werewolf/database"],
+   transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
  };
```

**Commit 4**: `chore(web): wire @werewolf/ui workspace dependency`

## §1.5 — Root scripts + tsx + Playwright a11y

```diff
  "scripts": {
+   "ui:dev": "pnpm --filter @werewolf/ui storybook",
+   "ui:build": "pnpm --filter @werewolf/ui build",
+   "ui:storybook:build": "pnpm --filter @werewolf/ui build-storybook",
+   "check:dict": "tsx scripts/check-dictionary.mjs",
+   "visual:ui": "playwright test --config=playwright.config.ts --grep '@ui'",
  },
  "devDependencies": {
+   "tsx": "^4.22.3",
+   "@axe-core/playwright": "^4.11.3"
  }
```

**Commit 5**: `chore(scripts): wire ui:dev, ui:build, ui:storybook:build, check:dict, visual:ui`

---

# §2 — PHASE 2: OKLCH tokens + Tailwind `@theme` bridge in app (~2 hours, 4 commits)

## §2.1 — `packages/ui/src/tokens.css` (plain CSS variables, NO `@theme`)

```css
/**
 * @werewolf/ui — Design tokens (OKLCH)
 *
 * Plain CSS variables. NO Tailwind directives here — packages/ui is
 * Tailwind-agnostic. The `@theme` bridge to Tailwind utilities lives
 * in apps/web/app/globals.css (see Phase 2.2).
 *
 * Namespace: --ds-{category}-{role}-{modifier}
 * Contrast ratios verified WCAG AA against canonical surfaces.
 */

:where(:root, [data-ds]) {
  /* ─── Surface & ink ─── */
  --ds-surface-paper: oklch(0.94 0.022 78);
  --ds-surface-paper-deep: oklch(0.91 0.028 78);
  --ds-surface-paper-edge: oklch(0.86 0.035 75);
  --ds-surface-scene: oklch(0.18 0.012 60);
  --ds-surface-scene-deep: oklch(0.13 0.014 50);

  --ds-ink-primary: oklch(0.22 0.018 60);     /* 10.4:1 vs paper ✓ AAA */
  --ds-ink-soft: oklch(0.40 0.018 60);        /*  5.8:1 vs paper ✓ AA  */
  --ds-ink-faint: oklch(0.55 0.015 60);       /*  3.6:1 large-text only */
  --ds-ink-scene: oklch(0.92 0.022 80);       /* 12.1:1 vs scene ✓ AAA */
  --ds-ink-scene-soft: oklch(0.74 0.020 78);  /*  7.2:1 vs scene ✓ AA  */

  /* ─── Accents (theme-invariant) ─── */
  --ds-accent-blood: oklch(0.50 0.155 25);
  --ds-accent-blood-deep: oklch(0.42 0.155 25);
  --ds-accent-gold: oklch(0.78 0.115 75);
  --ds-accent-gold-deep: oklch(0.58 0.110 65);
  --ds-accent-gold-soft: oklch(0.85 0.085 80);
  --ds-accent-green: oklch(0.55 0.10 145);

  /* ─── Typography scale ─── */
  --ds-type-display: 4rem;
  --ds-type-h1: 2.75rem;
  --ds-type-h2: 2.125rem;
  --ds-type-h3: 1.5rem;
  --ds-type-h4: 1.25rem;
  --ds-type-body: 1rem;
  --ds-type-body-sm: 0.875rem;
  --ds-type-lede: 1.125rem;
  --ds-type-eyebrow: 0.72rem;
  --ds-type-meta: 0.78rem;

  /* ─── Spacing ─── */
  --ds-space-1: 4px;
  --ds-space-2: 8px;
  --ds-space-3: 12px;
  --ds-space-4: 16px;
  --ds-space-6: 24px;
  --ds-space-8: 32px;
  --ds-space-10: 40px;
  --ds-space-12: 48px;

  /* ─── Radii ─── */
  --ds-radius-card: 22px;
  --ds-radius-tile: 14px;
  --ds-radius-chip: 999px;

  /* ─── Shadows ─── */
  --ds-shadow-card:
    0 1px 0 oklch(1 0 0 / 0.45) inset,
    0 18px 40px -28px oklch(0.20 0.05 60 / 0.55);
  --ds-shadow-scene:
    0 1px 0 oklch(1 0 0 / 0.04) inset,
    0 30px 60px -30px oklch(0 0 0 / 0.65);

  /* ─── Motion (Dialog/Sheet/Toast only) ─── */
  --ds-duration-instant: 90ms;
  --ds-duration-quick: 180ms;
  --ds-duration-base: 280ms;
  --ds-duration-stage: 500ms;
  --ds-ease-candle: cubic-bezier(0.32, 0.72, 0, 1);
  --ds-ease-card: cubic-bezier(0.16, 1, 0.3, 1);

  /* ─── Focus ring ─── */
  --ds-focus-ring:
    0 0 0 2px oklch(0.94 0.022 78),
    0 0 0 4px oklch(0.50 0.155 25);
}

/* ─── Dark theme overrides ─── */
:where(html[data-theme="dark"], html[data-theme="dark"] [data-ds]) {
  --ds-surface-paper: oklch(0.18 0.012 60);
  --ds-surface-paper-deep: oklch(0.13 0.014 50);
  --ds-surface-paper-edge: oklch(0.25 0.014 55);
  --ds-ink-primary: oklch(0.92 0.022 80);
  --ds-ink-soft: oklch(0.74 0.020 78);
  --ds-ink-faint: oklch(0.55 0.015 60);
  --ds-focus-ring:
    0 0 0 2px oklch(0.18 0.012 60),
    0 0 0 4px oklch(0.78 0.115 75);
}

:where([data-ds]) *:focus-visible {
  outline: none;
  box-shadow: var(--ds-focus-ring);
  outline-offset: 2px;
}
```

**Commit 1**: `feat(ui): introduce 32 OKLCH design tokens (plain CSS variables)`

## §2.2 — Tailwind `@theme` bridge in `apps/web/app/globals.css` ONLY

```diff
  @import "tailwindcss";
+ @import "@werewolf/ui/tokens.css";
+
+ @theme {
+   --color-ds-paper: var(--ds-surface-paper);
+   --color-ds-paper-deep: var(--ds-surface-paper-deep);
+   --color-ds-paper-edge: var(--ds-surface-paper-edge);
+   --color-ds-scene: var(--ds-surface-scene);
+   --color-ds-scene-deep: var(--ds-surface-scene-deep);
+   --color-ds-ink-primary: var(--ds-ink-primary);
+   --color-ds-ink-soft: var(--ds-ink-soft);
+   --color-ds-ink-faint: var(--ds-ink-faint);
+   --color-ds-blood: var(--ds-accent-blood);
+   --color-ds-blood-deep: var(--ds-accent-blood-deep);
+   --color-ds-gold: var(--ds-accent-gold);
+   --color-ds-gold-deep: var(--ds-accent-gold-deep);
+   --color-ds-gold-soft: var(--ds-accent-gold-soft);
+   --color-ds-green: var(--ds-accent-green);
+   --radius-ds-card: var(--ds-radius-card);
+   --radius-ds-tile: var(--ds-radius-tile);
+   --radius-ds-chip: var(--ds-radius-chip);
+   --shadow-ds-card: var(--ds-shadow-card);
+   --shadow-ds-scene: var(--ds-shadow-scene);
+ }

  :root {
    --ink: #1b100c;
    /* existing tokens untouched */
  }
```

**Commit 2**: `feat(web): bridge --ds-* tokens to Tailwind v4 utilities via @theme (app-level)`

## §2.3 — Token reference stories

### `packages/ui/src/tokens.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/react";

const TOKEN_GROUPS = {
  surfaces: [
    { name: "--ds-surface-paper", contrast: "—" },
    { name: "--ds-surface-paper-deep", contrast: "—" },
    { name: "--ds-surface-paper-edge", contrast: "—" },
    { name: "--ds-surface-scene", contrast: "—" },
    { name: "--ds-surface-scene-deep", contrast: "—" },
  ],
  inks: [
    { name: "--ds-ink-primary", contrast: "10.4:1 ✓ AAA" },
    { name: "--ds-ink-soft", contrast: "5.8:1 ✓ AA" },
    { name: "--ds-ink-faint", contrast: "3.6:1 (large)" },
    { name: "--ds-ink-scene", contrast: "12.1:1 ✓ AAA" },
    { name: "--ds-ink-scene-soft", contrast: "7.2:1 ✓ AA" },
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

function TokenSwatch({ name, contrast }: { name: string; contrast?: string }) {
  return (
    <div style={{
      display: "grid", gap: "8px", padding: "12px",
      border: "1px solid oklch(0.86 0.035 75)", borderRadius: "14px",
    }}>
      <div style={{
        height: "64px", borderRadius: "8px",
        background: `var(${name})`,
        border: "1px solid oklch(0.20 0.05 60 / 0.1)",
      }} />
      <code style={{ fontSize: "11px", fontFamily: "ui-monospace, monospace" }}>{name}</code>
      {contrast && <small style={{ fontSize: "10px", color: "oklch(0.40 0.018 60)" }}>{contrast}</small>}
    </div>
  );
}

const meta: Meta = {
  title: "Foundation/Tokens",
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: "32px", padding: "32px", maxWidth: "900px" }}>
      {Object.entries(TOKEN_GROUPS).map(([group, tokens]) => (
        <section key={group}>
          <h3 style={{ fontFamily: "Noto Serif", margin: "0 0 16px", textTransform: "capitalize" }}>{group}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {tokens.map((t) => <TokenSwatch key={t.name} name={t.name} contrast={"contrast" in t ? t.contrast : undefined} />)}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const Typography: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: "24px", padding: "32px" }}>
      {["display", "h1", "h2", "h3", "h4", "lede", "body", "body-sm", "eyebrow", "meta"].map((scale) => (
        <div key={scale} style={{ display: "flex", alignItems: "baseline", gap: "16px", borderBottom: "1px solid oklch(0.86 0.035 75)", paddingBottom: "8px" }}>
          <code style={{ width: "180px", fontSize: "11px", color: "oklch(0.40 0.018 60)" }}>--ds-type-{scale}</code>
          <span style={{ fontSize: `var(--ds-type-${scale})`, fontFamily: '"Noto Serif", serif' }}>
            Селото оцеля
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Spacing: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: "8px", padding: "32px" }}>
      {[1, 2, 3, 4, 6, 8, 10, 12].map((step) => (
        <div key={step} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <code style={{ width: "120px", fontSize: "11px", color: "oklch(0.40 0.018 60)" }}>--ds-space-{step}</code>
          <div style={{ height: "16px", width: `var(--ds-space-${step})`, background: "var(--ds-accent-gold)", borderRadius: "2px" }} />
        </div>
      ))}
    </div>
  ),
};

export const Motion: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: "16px", padding: "32px", maxWidth: "600px" }}>
      <h3 style={{ fontFamily: "Noto Serif", margin: 0 }}>Durations</h3>
      {[
        ["instant", "90ms — button press, focus glow"],
        ["quick", "180ms — toast slide, dropdown"],
        ["base", "280ms — modal open"],
        ["stage", "500ms — phase transition"],
      ].map(([tier, desc]) => (
        <div key={tier} style={{ borderTop: "1px solid oklch(0.86 0.035 75)", paddingTop: "12px" }}>
          <code style={{ fontSize: "11px" }}>--ds-duration-{tier}</code>
          <p style={{ margin: "4px 0", fontSize: "14px" }}>{desc}</p>
        </div>
      ))}
    </div>
  ),
};
```

**Commit 3**: `feat(ui): tokens reference stories (colors + typography + spacing + motion)`

## §2.4 — Documentation

### `packages/ui/docs/tokens.md`

```md
# Design tokens — `--ds-*` namespace

32 OKLCH tokens. Plain CSS variables in `packages/ui/src/tokens.css`.

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
| `--ds-duration-{tier}` | `--ds-duration-base` | Motion |
| `--ds-ease-{name}` | `--ds-ease-candle` | Easing curves |
| `--ds-focus-ring` | (single) | Universal focus indicator |

## Why OKLCH?

OKLCH is perceptually uniform — changing `L` (lightness) by 0.05 looks
visually the same regardless of hue. This lets us mechanically derive
hover/active variants and a future "Carnival" skin (just shift hue).

## Theme override

`html[data-theme="dark"]` overrides `--ds-surface-*` and `--ds-ink-*`. Accents
are theme-invariant by design.

## Tailwind bridge — IN APP, NOT IN UI PACKAGE

The `@theme { --color-ds-paper: var(--ds-surface-paper); ... }` block lives in
`apps/web/app/globals.css`, NOT here. Reason: Tailwind pipeline runs in the app,
and `packages/ui` must stay Tailwind-agnostic for future portability.

## Migration policy

Legacy hex tokens (`--ink`, `--paper`, `--blood`, …) live in
`apps/web/app/globals.css:3-82` and serve 19,876 lines of CSS. They are NOT
replaced. The `--ds-*` tokens live in `packages/ui/src/tokens.css` and are
imported INTO `apps/web/app/globals.css`.

New primitives in `packages/ui/primitives/` consume `--ds-*`. Existing
components keep their legacy tokens until a per-component migration PR.

## WCAG check

- `--ds-ink-primary` on `--ds-surface-paper`: 10.4:1 ✓ AAA
- `--ds-ink-soft` on `--ds-surface-paper`: 5.8:1 ✓ AA
- `--ds-ink-faint` on `--ds-surface-paper`: 3.6:1 (large text only)
- `--ds-ink-scene` on `--ds-surface-scene`: 12.1:1 ✓ AAA
- `--ds-ink-scene-soft` on `--ds-surface-scene`: 7.2:1 ✓ AA
- `--ds-accent-blood` on `--ds-surface-paper`: 4.5:1 ✓ AA
```

**Commit 4**: `docs(ui): document --ds-* token namespace, theme + migration policy`

---

# §3 — PHASE 3: Dictionary audit (~1 hour, 3 commits)

## §3.1 — `docs/dictionary.md`

```md
# Речник на масата · Bulgarian copy dictionary

Source of truth for Bulgarian user-facing text. Locked.

When in doubt, open this file. Codex grep-s violations during PR review.

## Legacy compatibility note (Path Б, 2026-05-23)

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

## 01 · Геймплей

| Концепт | Правилно (✓) | Никога (✗) | Бележка |
|---|---|---|---|
| Една сесия от игра | Вечер · Дело | Game · Match · Session · Раунд | „Вечер" в наратив, „Дело №X" в архив |
| Площта за играчи | Масата | Room · Lobby · Game board | Лоби е валидно само за списък от маси |
| Запис в архива | Дело №4821 | Match #4821 · Game ID | Винаги с „№", винаги 4+ цифри |
| Времеви интервал | Фаза | Phase · Step · Turn · Ход | „Ход" е твърде шахматно |
| Тъмният период | Нощ | Night phase · Тъмнина | Просто „Нощ" |
| Светлият период | Ден | Day · Day phase | „Утро" — само в наратив |
| Гласуване | Глас | Voting · Vote phase · Гласоподаване | Кратко, едносрично |
| Лична карта | Роля | Card · Character · Класа | Никога „характер" |
| Групировка | Фракция · Отбор | Team · Side · Faction | „Отбор" в casual, „Фракция" в правила |
| Победа | Селото оцеля · Мафията владее · Равенство | Village wins · Victory | Винаги перфект |
| Краен резултат на играч | Жив · Мъртъв · Прокълнат | Alive · Dead · Active | „Прокълнат" — специфично |
| Игра приключи равенство | Селото си легна тихо | Draw · Tie | Метафора, не математика |
| Тайни действия | Будиш се · Действаш | Active turn · Special ability | Никаква геймърска терминология |
| Защита от смърт | Спасен · Защитен | Saved · Protected · Healed | „Лекуван" — само за Лечител |

## 02 · Роли и фракции

| Роля | ед. ч. | мн. ч. | Фракция | Свят |
|---|---|---|---|---|
| Selyanin | Селянин | Селяни | Селото | общо |
| Werewolf | Върколак | Върколаци | Звяра | Върколак |
| Vampire | Вампир | Вампири | Кръвта | Върколак |
| Mafia member | Мафиот | Мафията | Мафията | Мафия |
| Don | Дон | — | Мафията | Мафия |
| Seer | Ясновидка | — | Селото | Върколак |
| Witch | Вещица | — | Селото | Върколак |
| Healer | Лечител | Лечители | Селото | Върколак |
| Priest | Свещеник | — | Селото | Върколак |
| Hunter | Ловец | — | Селото | Върколак |
| Cupid | Купидон | — | самостоятелен | Върколак |
| Jester | Шут | — | самостоятелен | Върколак |
| Thief | Крадец | — | самостоятелен | общо |
| Inspector | Комисар | — | Селото | Мафия |
| Doctor | Доктор | — | Селото | Мафия |
| Godfather (alt) | Кръстник | — | Мафията | Мафия |
| Narrator | Разказвач | — | водещ | общо |

## 03 · Интерфейс

| Концепт | Правилно (✓) | Никога (✗) | Бележка |
|---|---|---|---|
| Профил на играч | Досие (spec) / Профил (legacy-OK) | Profile · Account | — |
| История на игрите | Архив на делата (spec) / История (legacy-OK) | History · Past games | — |
| Класация | Вечерен брой (spec) / Класация (legacy-OK) | Leaderboard · Rankings | — |
| Постижения | Легенди (spec) / Постижения (legacy-OK) | Achievements · Badges | — |
| Социална мрежа | Познати на масата (spec) / Приятели (legacy-OK) | Friends · Network | — |
| Помощ и въпроси | Седни до огъня (spec) / Често задавани въпроси (legacy-OK) | FAQ · Help · Support | — |
| Доклад за злоупотреба | Сигнал (spec) / Доклад (legacy-OK) | Report · Abuse · Flag | — |
| Технически статус | Състояние | Status · Uptime | „Селото работи" / „Селото е тихо" |
| Поверителност | Поверителност | Privacy · Privacy policy | — |
| Юридическо | Условия | Terms · ToS · Legal | — |
| Настройки | Настройки | Settings · Preferences | — |

## 04 · Действия

| Действие | Правилно (✓) | Никога (✗) | Бележка |
|---|---|---|---|
| Влизам в система | Влез / Влизане | Login / Sign in | — |
| Излизам | Излез | Logout / Sign out | — |
| Нов профил | Нов профил | Sign up / Register | — |
| Запазване | Запази | Save / Submit | — |
| Изтриване | Изтрий | Delete / Remove | — |
| Потвърждение | Потвърди | Confirm | — |
| Отказ | Откажи / Затвори | Cancel / Close | — |
| Продължи | Продължи | Continue / Next | — |
| Зареждане | Зареждаме… / Чакайте малко… | Loading… | — |
| Започни играта | Хайде! / Започвам | Start game | — |
| Виж повече | Виж повече | Show more / Read more | — |

## 05 · Време и количества

| Концепт | Правилно (✓) | Никога (✗) |
|---|---|---|
| Скоро в миналото | „преди малко" · „току-що" | a few seconds ago |
| Минути назад | „преди 5 мин." | 5 minutes ago |
| Часове назад | „преди 3 ч." | 3 hours ago |
| Дни назад | „преди 2 д." | 2 days ago |
| Точно сега | „сега" · „в момента" | live · now |
| Брой играчи | „4 / 8 играчи" · „четирима играчи" | 4 of 8 |
| Един брой | „един човек" · „един играч" | 1 user |
| Нула брой | „никой" | 0 users |

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

**Commit 1**: `docs: lock 48-term Bulgarian dictionary with legacy-OK overrides`

## §3.2 — `scripts/check-dictionary.mjs`

```js
#!/usr/bin/env node
/**
 * Dictionary check (audit-only — non-fatal).
 * Scans .tsx/.ts for English JSX text + anglicisms.
 * Always exits 0. Run: pnpm check:dict
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

const RULES = [
  // High-severity: English in JSX text
  { pattern: />\s*Login\s*</g, hint: "→ „Влез" / „Влизане"", legacy: false },
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

  // Spec deviations (accepted in Phase Б)
  { pattern: /Постижения/g, hint: "spec: „Легенди" (legacy-OK)", legacy: true },
  { pattern: /Класация/g, hint: "spec: „Вечерен брой" (legacy-OK)", legacy: true },
  { pattern: /Често задавани въпроси/g, hint: "spec: „Седни до огъня" (legacy-OK)", legacy: true },
];

const SCAN_DIRS = ["apps/web/app", "apps/web/components"];
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
        const tag = rule.legacy ? "\x1b[33m[legacy]\x1b[0m" : "\x1b[31m[warn]\x1b[0m";
        const rel = path.replace(ROOT + "/", "").replace(ROOT + "\\", "");
        process.stdout.write(`${tag} ${rel}:${i + 1}  "${m[0]}" — ${rule.hint}\n`);
        if (rule.legacy) legacyHits++;
        else warnings++;
      }
    }
  }
}

console.log("\nDictionary check (audit-only) — Path Б\n");
for (const dir of SCAN_DIRS) walk(join(ROOT, dir));
console.log(`\nSummary: ${warnings} hard warnings, ${legacyHits} legacy-OK hits.\nExit code 0.\n`);
process.exit(0);
```

**Commit 2**: `feat(scripts): add audit-only dictionary check (exit 0, warns only)`

## §3.3 — `scripts/README.md` note

Add note documenting `pnpm check:dict` policy. (DO NOT touch `AGENTS.md` yet — that's PR 5.)

**Commit 3**: `docs(scripts): document check:dict policy in scripts/README.md`

**Run `bg-copy-reviewer` agent** on `docs/dictionary.md`.

---

# §4 — PHASE 4: 11 primitives (~5 hours, 14 commits)

**Motion discipline**: Only `Dialog`, `Sheet`, `Toast` import from `motion/react`. All others CSS-only.

## §4.1 — Surface (`packages/ui/src/primitives/Surface.tsx`)

```tsx
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export type SurfaceVariant = "paper" | "paper-deep" | "scene" | "scene-deep";
export type SurfaceRadius = "card" | "tile" | "none";
export type SurfaceElevation = "none" | "card" | "scene";
export type SurfaceAs = "div" | "section" | "article" | "aside";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  variant?: SurfaceVariant;
  radius?: SurfaceRadius;
  elevation?: SurfaceElevation;
  as?: SurfaceAs;
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
    expect((container.firstChild as HTMLElement).dataset.dsSurface).toBe("scene");
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

**Commit 1**: `feat(ui): Surface primitive (paper/scene × card/tile × elevation)`

## §4.2 — Eyebrow (`packages/ui/src/primitives/Eyebrow.tsx`)

```tsx
import type { ReactNode } from "react";

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
      fontFamily: "ui-monospace, 'Cascadia Mono', monospace",
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

Story + test follow Surface pattern.

**Commit 2**: `feat(ui): Eyebrow primitive with tone variants`

## §4.3 — Display (`packages/ui/src/primitives/Display.tsx`)

```tsx
import type { ReactNode } from "react";

export type DisplaySize = "hero" | "h1" | "h2" | "h3" | "h4";

const SIZE_FONT: Record<DisplaySize, string> = {
  hero: "var(--ds-type-display)",
  h1: "var(--ds-type-h1)",
  h2: "var(--ds-type-h2)",
  h3: "var(--ds-type-h3)",
  h4: "var(--ds-type-h4)",
};

const SIZE_TAG: Record<DisplaySize, "h1" | "h2" | "h3" | "h4"> = {
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

**Commit 3**: `feat(ui): Display primitive with size scale (Noto Serif Display)`

## §4.4 — PaperCard (CSS-only, no Motion)

```tsx
import { Surface } from "./Surface";
import { Eyebrow } from "./Eyebrow";
import type { ReactNode } from "react";

export interface PaperCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  children: ReactNode;
}

const DENSITY_PAD = { sm: "16px", md: "28px", lg: "48px" } as const;

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

**Commit 4**: `feat(ui): PaperCard primitive (Surface + eyebrow + meta + body, CSS-only)`

## §4.5 — SceneCard (CSS-only, no Motion)

```tsx
import { Surface } from "./Surface";
import { Eyebrow } from "./Eyebrow";
import type { ReactNode } from "react";

export interface SceneCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  children: ReactNode;
}

const DENSITY_PAD = { sm: "16px", md: "28px", lg: "48px" } as const;

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

**Commit 5**: `feat(ui): SceneCard primitive (dark cinematic, CSS-only)`

## §4.6 — Pill (CSS-only hover/active, no Motion)

```tsx
import type { CSSProperties, ReactNode, MouseEventHandler } from "react";

export type PillIntent = "primary" | "secondary" | "danger" | "ghost";
export type PillSize = "sm" | "md" | "lg";

export interface PillProps {
  intent?: PillIntent;
  size?: PillSize;
  as?: "button" | "a";
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
}

const INTENT_STYLES: Record<PillIntent, CSSProperties> = {
  primary: {
    background: "var(--ds-accent-blood)",
    color: "oklch(0.97 0.01 80)",
    border: "1px solid var(--ds-accent-blood-deep)",
  },
  secondary: {
    background: "var(--ds-surface-paper-deep)",
    color: "var(--ds-ink-primary)",
    border: "1px solid var(--ds-surface-paper-edge)",
  },
  danger: {
    background: "transparent",
    color: "var(--ds-accent-blood-deep)",
    border: "1px solid var(--ds-accent-blood)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ds-ink-soft)",
    border: "1px solid transparent",
  },
};

const SIZE_STYLES: Record<PillSize, CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: "0.86rem" },
  md: { padding: "10px 22px", fontSize: "1rem" },
  lg: { padding: "14px 28px", fontSize: "1.06rem" },
};

export function Pill({
  intent = "primary",
  size = "md",
  as = "button",
  children,
  ...rest
}: PillProps) {
  const Tag = as as "button";
  return (
    <Tag
      className={`ds-pill ds-pill--${intent}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        borderRadius: "var(--ds-radius-chip)",
        fontFamily: '"Noto Serif", serif',
        fontWeight: 700,
        cursor: "pointer",
        transition: "transform var(--ds-duration-quick) var(--ds-ease-candle), filter var(--ds-duration-quick) var(--ds-ease-candle), background var(--ds-duration-quick) var(--ds-ease-candle)",
        ...SIZE_STYLES[size],
        ...INTENT_STYLES[intent],
      }}
      {...(rest as object)}
    >
      {children}
    </Tag>
  );
}
```

### `packages/ui/src/styles/pill.css`

```css
.ds-pill:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.05);
}
.ds-pill:active:not(:disabled) {
  transform: scale(0.98);
}
.ds-pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Consumer imports via `@werewolf/ui/styles/pill.css`.

**Commit 6**: `feat(ui): Pill primitive (CSS transitions on hover/active, no Motion)`

## §4.7 — Medallion (CSS-only static)

```tsx
export interface MedallionProps {
  label: string | number;
  size?: number;
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

**Commit 7**: `feat(ui): Medallion primitive (gold circular badge)`

## §4.8 — Toast (uses Motion)

```tsx
import { motion, AnimatePresence } from "motion/react";

export type ToastTone = "info" | "success" | "error";

export interface ToastProps {
  open: boolean;
  tone?: ToastTone;
  message: string;
  onDismiss?: () => void;
}

const TONE_BG: Record<ToastTone, string> = {
  info: "var(--ds-surface-scene-deep)",
  success: "var(--ds-accent-green)",
  error: "var(--ds-accent-blood)",
};

export function Toast({ open, tone = "info", message, onDismiss }: ToastProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          style={{
            background: TONE_BG[tone],
            color: "oklch(0.97 0.01 80)",
            padding: "12px 18px",
            borderRadius: "var(--ds-radius-tile)",
            boxShadow: "var(--ds-shadow-scene)",
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            maxWidth: "min(92vw, 480px)",
          }}
        >
          <span>{message}</span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              aria-label="Затвори"
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.2em", padding: 0 }}
            >
              ×
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Commit 8**: `feat(ui): Toast primitive (Motion enter/exit, 3 tones)`

## §4.9 — Dialog (Radix + Motion)

```tsx
import * as RDialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const MotionContent = motion(RDialog.Content);
const MotionOverlay = motion(RDialog.Overlay);

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <MotionOverlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "fixed", inset: 0,
                background: "oklch(0 0 0 / 0.62)",
                backdropFilter: "blur(4px)",
                zIndex: 100,
              }}
            />
            <MotionContent
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "fixed",
                top: "50%", left: "50%",
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
              {description && (
                <RDialog.Description style={{
                  color: "var(--ds-ink-soft)",
                  margin: 0,
                  fontSize: "var(--ds-type-body)",
                }}>{description}</RDialog.Description>
              )}
              <div>{children}</div>
              {footer && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  {footer}
                </div>
              )}
            </MotionContent>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
```

**Commit 9**: `feat(ui): Dialog primitive (Radix + Motion + Noto Serif Display title)`

## §4.10 — Sheet (Radix + Motion)

```tsx
import * as RDialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
}

const MotionContent = motion(RDialog.Content);
const MotionOverlay = motion(RDialog.Overlay);

export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <MotionOverlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", zIndex: 100 }}
            />
            <MotionContent
              className="ds-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
            </MotionContent>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
```

### `packages/ui/src/styles/sheet.css`

```css
.ds-sheet {
  bottom: 0;
  left: 0;
  right: 0;
  border-top-left-radius: var(--ds-radius-card);
  border-top-right-radius: var(--ds-radius-card);
  padding: 28px;
  box-shadow: 0 -20px 40px oklch(0 0 0 / 0.4);
  max-height: 85vh;
  overflow-y: auto;
}

@media (min-width: 768px) {
  .ds-sheet {
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

**Commit 10**: `feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)`

## §4.11 — EmptyState (CSS-only)

```tsx
import { PaperCard } from "./PaperCard";
import { Display } from "./Display";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  artifact?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
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
        padding: "8px 0",
      }}>
        {artifact && (
          <div style={{ width: "144px", height: "144px", color: "var(--ds-ink-soft)" }}>
            {artifact}
          </div>
        )}
        <Display size="h3">{title}</Display>
        <p style={{
          color: "var(--ds-ink-soft)",
          fontSize: "var(--ds-type-body)",
          lineHeight: 1.6,
          margin: 0,
          maxWidth: "28rem",
        }}>
          {body}
        </p>
        {action}
      </div>
    </PaperCard>
  );
}
```

**Commit 11**: `feat(ui): EmptyState primitive (artifact + title + body + action, CSS-only)`

## §4.12 — Index exports

### `packages/ui/src/index.ts`

```ts
export { Surface } from "./primitives/Surface";
export type { SurfaceProps, SurfaceVariant, SurfaceRadius, SurfaceElevation, SurfaceAs } from "./primitives/Surface";
export { Eyebrow } from "./primitives/Eyebrow";
export type { EyebrowProps, EyebrowTone } from "./primitives/Eyebrow";
export { Display } from "./primitives/Display";
export type { DisplayProps, DisplaySize } from "./primitives/Display";
export { PaperCard } from "./primitives/PaperCard";
export type { PaperCardProps } from "./primitives/PaperCard";
export { SceneCard } from "./primitives/SceneCard";
export type { SceneCardProps } from "./primitives/SceneCard";
export { Pill } from "./primitives/Pill";
export type { PillProps, PillIntent, PillSize } from "./primitives/Pill";
export { Medallion } from "./primitives/Medallion";
export type { MedallionProps } from "./primitives/Medallion";
export { Toast } from "./primitives/Toast";
export type { ToastProps, ToastTone } from "./primitives/Toast";
export { Dialog } from "./primitives/Dialog";
export type { DialogProps } from "./primitives/Dialog";
export { Sheet } from "./primitives/Sheet";
export type { SheetProps } from "./primitives/Sheet";
export { EmptyState } from "./primitives/EmptyState";
export type { EmptyStateProps } from "./primitives/EmptyState";
```

**Commit 12**: `feat(ui): export all 11 primitives from packages/ui index`

## §4.13 — Stories + tests for all 11

Each primitive ships ≥4 stories (Default, AllVariants, Interactive where applicable, DarkTheme) + unit test (Surface pattern) + axe-clean.

Interaction tests use built-in `storybook/test`:

```tsx
import { expect, within, userEvent } from "storybook/test";

export const InteractiveClick = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
    await expect(button).toHaveFocus();
  },
};
```

**Commit 13**: `feat(ui): stories + tests for all 11 primitives (storybook/test, axe-clean)`

## §4.14 — Verify Storybook + a11y

```bash
pnpm --filter @werewolf/ui build
pnpm --filter @werewolf/ui test
pnpm --filter @werewolf/ui build-storybook
pnpm ui:dev   # http://localhost:6006
```

Walk every story → axe-core panel must show **0 violations**.

**Verify Motion discipline**:
```bash
grep -r "from \"motion/react\"" packages/ui/src/primitives | wc -l
# Expected: exactly 3 (Dialog, Sheet, Toast)
```

**Commit 14**: `chore(ui): verify all primitives pass axe-core (light + dark)`

**Invoke `frontend-design` skill** at this checkpoint:
> "Review packages/ui/src/primitives/* (11 components). Verify API consistency, prop naming, default values, story coverage. Motion is restricted to Dialog/Sheet/Toast only — confirm via grep. Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion, EmptyState are CSS-only. Suggest precise refinements only if substantive."

---

# §5 — PHASE 5: Geometric artifacts + state catalog (~2 hours, 4 commits)

**No imagen in this PR.** Geometric SVGs only.

## §5.1 — 8 geometric artifact SVG components

`packages/ui/src/primitives/artifacts/` — 8 files. Each ~30 lines, monochrome strokes + accent fill, `currentColor` inheritance, `size` prop (default 144).

Example (`sealed-letter.tsx`):

```tsx
export function SealedLetter({ size = 144 }: { size?: number }) {
  return (
    <svg viewBox="0 0 144 144" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="24" y="36" width="96" height="68" rx="3" fill="var(--ds-surface-paper-deep)" />
      <path d="M24 36 L72 78 L120 36" />
      <circle cx="72" cy="92" r="12" fill="var(--ds-accent-blood)" stroke="var(--ds-accent-blood-deep)" strokeWidth="2" />
      <path d="M67 88 L72 94 L77 88 M67 94 L77 94" stroke="oklch(0.94 0.022 78)" strokeWidth="1.5" />
    </svg>
  );
}
```

Build all 8 in same style: `empty-chair`, `closed-book`, `sealed-letter`, `open-door`, `dusty-shelf`, `unprinted-paper`, `balanced-scale`, `broken-candle`.

**Commit 1**: `feat(ui): 8 geometric SVG artifacts (empty-chair / closed-book / sealed-letter / open-door / dusty-shelf / unprinted-paper / balanced-scale / broken-candle)`

## §5.2 — Artifact metadata

### `packages/ui/src/primitives/artifacts/index.ts`

```ts
import type { ComponentType } from "react";
import { EmptyChair } from "./empty-chair";
import { ClosedBook } from "./closed-book";
import { SealedLetter } from "./sealed-letter";
import { OpenDoor } from "./open-door";
import { DustyShelf } from "./dusty-shelf";
import { UnprintedPaper } from "./unprinted-paper";
import { BalancedScale } from "./balanced-scale";
import { BrokenCandle } from "./broken-candle";

export type ArtifactKey =
  | "empty-chair" | "closed-book" | "sealed-letter" | "open-door"
  | "dusty-shelf" | "unprinted-paper" | "balanced-scale" | "broken-candle";

export const ARTIFACT_SVG: Record<ArtifactKey, ComponentType<{ size?: number }>> = {
  "empty-chair": EmptyChair,
  "closed-book": ClosedBook,
  "sealed-letter": SealedLetter,
  "open-door": OpenDoor,
  "dusty-shelf": DustyShelf,
  "unprinted-paper": UnprintedPaper,
  "balanced-scale": BalancedScale,
  "broken-candle": BrokenCandle,
};

export const ARTIFACT_PAINTERLY_PATH: Record<ArtifactKey, string> = {
  "empty-chair": "/empty-states/empty-chair.webp",
  "closed-book": "/empty-states/closed-book.webp",
  "sealed-letter": "/empty-states/sealed-letter.webp",
  "open-door": "/empty-states/open-door.webp",
  "dusty-shelf": "/empty-states/dusty-shelf.webp",
  "unprinted-paper": "/empty-states/unprinted-paper.webp",
  "balanced-scale": "/empty-states/balanced-scale.webp",
  "broken-candle": "/empty-states/broken-candle.webp",
};
```

**Commit 2**: `feat(ui): artifact metadata (SVG components + painterly path hints)`

## §5.3 — State catalog

### `packages/ui/src/states/empty-states.ts`

```ts
import type { ArtifactKey } from "../primitives/artifacts";

export type EmptyStateKey =
  | "home-no-rooms" | "home-no-last-story" | "lobby-list-empty" | "lobby-search-no-match"
  | "play-lobby-waiting" | "history-empty" | "history-filter-no-match"
  | "achievements-zero" | "achievements-locked" | "friends-empty" | "friends-pending"
  | "leaderboard-empty" | "leaderboard-week-empty"
  | "account-unverified" | "account-no-avatar"
  | "faq-no-results" | "report-no-reports"
  | "status-all-healthy" | "status-partial-outage" | "status-major-outage"
  | "search-global" | "notifications";

export interface EmptyStateDef {
  artifact: ArtifactKey;
  title: string;
  body: string;
  action?: { label: string; href?: string };
}

export const EMPTY_STATES: Record<EmptyStateKey, EmptyStateDef> = {
  "home-no-rooms": {
    artifact: "empty-chair",
    title: "Бъди първият на масата.",
    body: "Няма активни стаи в момента.",
    action: { label: "Създай стая", href: "/create" },
  },
  "home-no-last-story": {
    artifact: "closed-book",
    title: "Първите герои ще се появят тук.",
    body: "След първата завършена игра.",
  },
  "lobby-list-empty": {
    artifact: "empty-chair",
    title: "Тихо е. Започни ти.",
    body: "Никой не е създал стая в последния час.",
    action: { label: "Създай стая", href: "/create" },
  },
  "lobby-search-no-match": {
    artifact: "closed-book",
    title: "Не намерихме такава стая.",
    body: "Провери кода или потърси друга.",
    action: { label: "Изчисти търсенето" },
  },
  "play-lobby-waiting": {
    artifact: "open-door",
    title: "Първи влизаш — мястото е твое.",
    body: "Сподели кода с приятели.",
    action: { label: "Копирай код" },
  },
  "history-empty": {
    artifact: "sealed-letter",
    title: "Архивът чака първото си писмо.",
    body: "Завърши една игра и тя ще се появи тук.",
    action: { label: "Седни на маса", href: "/create" },
  },
  "history-filter-no-match": {
    artifact: "closed-book",
    title: "Не намерихме дело с тези критерии.",
    body: "Опитай с по-широко търсене.",
    action: { label: "Изчисти филтри" },
  },
  "achievements-zero": {
    artifact: "dusty-shelf",
    title: "Легендите още не са започнали.",
    body: "Първата победа отключва първата легенда.",
    action: { label: "Играй сега", href: "/create" },
  },
  "achievements-locked": {
    artifact: "closed-book",
    title: "Заключена легенда.",
    body: "Подсказка: спечели 3 нощи поредно.",
  },
  "friends-empty": {
    artifact: "empty-chair",
    title: "Покани първия си гост.",
    body: "Сподели линк с приятели.",
    action: { label: "Копирай покана" },
  },
  "friends-pending": {
    artifact: "sealed-letter",
    title: "Поканите чакат отговор.",
    body: "Изпрати напомняне, ако е минала седмица.",
  },
  "leaderboard-empty": {
    artifact: "unprinted-paper",
    title: "Изданието още не е тиражирано.",
    body: "Утрешният брой ще носи първото име. Завърши една игра.",
    action: { label: "Започни първото издание", href: "/create" },
  },
  "leaderboard-week-empty": {
    artifact: "unprinted-paper",
    title: "Тази седмица е без новини.",
    body: "Виж класирането от миналата седмица.",
    action: { label: "Виж миналата седмица" },
  },
  "account-unverified": {
    artifact: "sealed-letter",
    title: "Изпратихме ти писмо.",
    body: "Отвори имейла и потвърди адреса.",
    action: { label: "Изпрати отново" },
  },
  "account-no-avatar": {
    artifact: "empty-chair",
    title: "Покажи лицето си.",
    body: "Избери от 8 портрета от епохата.",
    action: { label: "Избери портрет" },
  },
  "faq-no-results": {
    artifact: "closed-book",
    title: "Огънят не познава този въпрос.",
    body: "Изпрати ни го — ще намерим отговор.",
    action: { label: "Дай ни бележка", href: "/report" },
  },
  "report-no-reports": {
    artifact: "closed-book",
    title: "Нямаш отворени сигнали.",
    body: "Когато подадеш, ще се появят тук.",
  },
  "status-all-healthy": {
    artifact: "balanced-scale",
    title: "Селото работи.",
    body: "Всички услуги отговарят нормално.",
  },
  "status-partial-outage": {
    artifact: "broken-candle",
    title: "Селото е тихо.",
    body: "Една услуга не отговаря — работим по нея.",
    action: { label: "Виж детайли" },
  },
  "status-major-outage": {
    artifact: "broken-candle",
    title: "Селото спи.",
    body: "Сериозен проблем. Опитай след малко.",
    action: { label: "Абонирай се за известия" },
  },
  "search-global": {
    artifact: "closed-book",
    title: "Не намерихме нищо за това.",
    body: "Опитай с по-кратък термин.",
  },
  "notifications": {
    artifact: "sealed-letter",
    title: "Никакви известия.",
    body: "Когато се случи нещо важно, ще намериш писмо тук.",
  },
};
```

**Commit 3**: `feat(ui): 22-entry empty-state catalog with structured Bulgarian copy`

## §5.4 — Storybook gallery

### `packages/ui/src/states/empty-states.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "../primitives/EmptyState";
import { ARTIFACT_SVG } from "../primitives/artifacts";
import { EMPTY_STATES, type EmptyStateKey } from "./empty-states";

const meta: Meta = {
  title: "States/EmptyStates",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

export const Gallery: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "32px", padding: "32px", maxWidth: "1200px" }}>
      {(Object.keys(EMPTY_STATES) as EmptyStateKey[]).map((key) => {
        const def = EMPTY_STATES[key];
        const Artifact = ARTIFACT_SVG[def.artifact];
        return (
          <div key={key}>
            <small style={{ fontFamily: "ui-monospace, monospace", fontSize: "11px", color: "oklch(0.40 0.018 60)" }}>
              {key}
            </small>
            <EmptyState
              artifact={<Artifact size={120} />}
              title={def.title}
              body={def.body}
            />
          </div>
        );
      })}
    </div>
  ),
};
```

**Invoke `bg-copy-reviewer` agent** on `empty-states.ts`.

**Commit 4**: `feat(ui): state-catalog storybook gallery (22 entries × geometric artifacts)`

---

# §6 — PHASE 6: /status pilot migration (~2 hours, 4 commits)

## §6.1 — Inspect current /status

```bash
cat apps/web/app/status/page.tsx
ls apps/web/components/status/ 2>&1
```

## §6.2 — Create `apps/web/components/ArtifactImage.tsx`

```tsx
"use client";

import type { ComponentType } from "react";
import { ARTIFACT_SVG, type ArtifactKey } from "@werewolf/ui/artifacts";

type Props = {
  artifact: ArtifactKey;
  size?: number;
};

/**
 * Renders an artifact illustration via SVG component.
 * After optional PR 6 (imagen polish), this can be updated to prefer
 * painterly webps when they exist.
 */
export function ArtifactImage({ artifact, size = 144 }: Props) {
  const SVGComponent: ComponentType<{ size?: number }> = ARTIFACT_SVG[artifact];
  return <SVGComponent size={size} />;
}
```

**Commit 1**: `feat(web): ArtifactImage wrapper (Next-aware, currently SVG-only)`

## §6.3 — Migrate /status hero + cards

```diff
+ import { PaperCard, Display, Eyebrow, EmptyState, Pill } from "@werewolf/ui";
+ import { EMPTY_STATES } from "@werewolf/ui/states";
+ import { ArtifactImage } from "@/components/ArtifactImage";

  /* Service health card */
- <div className="status-card">
-   <span className="status-card-kicker">ИГРА-СЪРВЪР</span>
-   <h3 className="status-card-title">Селото работи</h3>
-   <p>Всички услуги отговарят нормално.</p>
- </div>
+ <PaperCard eyebrow="ИГРА-СЪРВЪР">
+   <Display size="h4">Селото работи</Display>
+   <p style={{ color: "var(--ds-ink-soft)", margin: 0 }}>Всички услуги отговарят нормално.</p>
+ </PaperCard>

  /* Major outage state */
  {majorOutage && (
+   <EmptyState
+     artifact={<ArtifactImage artifact={EMPTY_STATES["status-major-outage"].artifact} />}
+     title={EMPTY_STATES["status-major-outage"].title}
+     body={EMPTY_STATES["status-major-outage"].body}
+     action={<Pill intent="secondary" as="a" href="/notifications">Абонирай се за известия</Pill>}
+   />
  )}
```

**Leave the old `.status-card` CSS in `globals.css`** — dead code now, but cleanup is a separate PR.

**Commit 2**: `refactor(status): migrate service-health card to PaperCard + Display`

**Commit 3**: `feat(status): adopt EmptyState primitive for outage states`

## §6.4 — Visual regression

```bash
pnpm visual
# If intentional improvement → pnpm visual:update
```

**Invoke `bg-copy-reviewer` agent** on `apps/web/app/status/page.tsx`.

**Invoke `frontend-design` skill**:
> "Review /status page after migration to @werewolf/ui primitives. Check density choices, eyebrow tones, hierarchy. Flag any inconsistency."

**Commit 4**: `test(visual): update /status baselines + frontend-design polish applied`

**Phase 6 complete. STOP — wait for user approval before PR 4.**

---

# §7 — PHASE 7 (PR 4, gated): Legal-shell sweep (~3 hours, 6 commits)

**Only after PR 3 merges + user approves.**

## §7.1 — `/privacy`

Hero → `SceneCard`. Sections → `PaperCard` with eyebrow per section.

**Commit 1**: `refactor(privacy): migrate hero + sections to SceneCard + PaperCard primitives`

## §7.2 — `/terms`

Same pattern.

**Commit 2**: `refactor(terms): migrate hero + sections to primitives`

## §7.3 — `/report`

Hero → `SceneCard`. Success state → `EmptyState`. CTAs → `Pill`.

**Commit 3**: `refactor(report): migrate hero + success state to primitives`

**Commit 4**: `refactor(report): adopt Pill for primary CTA actions`

## §7.4 — `/faq`

**Preserve `FaqHearth.tsx` accordion + fixed-pseudo background fix.** Refactor only hero + section heads.

**Commit 5**: `refactor(faq): migrate hero + section heads to primitives (accordion preserved)`

## §7.5 — Verify all 5 pilots

```bash
pnpm verify
pnpm visual
pnpm check:dict
```

**Invoke `bg-copy-reviewer` agent** on all 4 page files.

**Invoke `frontend-design` skill**:
> "Holistic review of 5 migrated pages (/status, /privacy, /terms, /report, /faq). Verify primitives consistently used. Flag any drift from spec."

**Commit 6**: `chore(pilots): legal-shell sweep — frontend-design review applied`

---

# §8 — PHASE 8 (PR 5): Acceptance criteria docs (~1 hour, 2 commits)

## §8.1 — Create `docs/acceptance/` directory

17 files: `home.md`, `werewolf.md`, `mafia.md`, `sign-in.md`, `tutorial.md`, `lobby.md`, `play.md`, `history.md`, `achievements.md`, `leaderboard.md`, `friends.md`, `account.md`, `faq.md`, `privacy.md`, `terms.md`, `status.md`, `report.md`.

Each file follows this template:

```md
# /<route> — acceptance criteria

## Functional
- [ ] Loads in < 1.5s on slow-3G (Lighthouse mobile)
- [ ] Without JS, primary content visible (`view-source:`)
- [ ] All links keyboard-reachable
- [ ] ESC closes modals; clicking overlay closes too
- [ ] Errors surface via Toast or inline

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
- [ ] axe-core zero violations
- [ ] Focus ring visible on every interactive element
- [ ] Color contrast AA on every text/background pair

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

Add page-specific items per page based on what each route does.

**Commit 1**: `docs: per-page acceptance criteria for all 17 routes`

## §8.2 — Index README

### `docs/acceptance/README.md`

```md
# Acceptance criteria

This directory holds per-page acceptance criteria. Each file lists items
verified during PR review.

## How to use

When implementing or refactoring a page, open the matching file. Each item
is a checkbox — verify it during PR review.

## Cross-cutting

- All pages: Bulgarian-only copy per `docs/dictionary.md`
- All pages: Surface primitive at root, no raw `<main>` styling
- All pages: visual regression at 3 viewports × 2 themes

## Status of enforcement

These criteria are aspirational; CI does not block PRs on them. As
infrastructure matures (Lighthouse runner, axe-runner, dictionary enforcer),
items will graduate to "CI gate".
```

**Commit 2**: `docs: acceptance criteria index and policy`

---

# §9 — PHASE 9 (PR 5): Storybook MDX docs hub (~1 hour, 2 commits)

## §9.1 — `packages/ui/src/docs/Introduction.mdx`

```mdx
import { Meta } from "@storybook/blocks";

<Meta title="Foundation/Introduction" />

# Върколак · Мафия design system

Този Storybook е каноничен източник на правда за всички primitive компоненти.

## Foundation

- **Tokens** — 32 OKLCH променливи (цветове, типография, spacing, radii, shadows, motion)
- **Theme** — `html[data-theme="dark"]` обръща surface + ink. Accents са theme-invariant.

## Primitives

11 компонента, всеки production-grade с stories + tests + a11y:

1. **Surface** — layout обвивка с paper/scene варианти
2. **Eyebrow** — small mono uppercase label
3. **Display** — semi-italic serif heading
4. **PaperCard** — стандартна светла card layout
5. **SceneCard** — тъмен cinematic вариант
6. **Pill** — бутон/линк/chip с 4 intent варианта
7. **Medallion** — кръгъл златен медальон
8. **Toast** — поведенчески feedback с 3 тона (Motion)
9. **Dialog** — Radix-backed модал (Motion)
10. **Sheet** — bottom-sheet mobile, centered desktop (Motion)
11. **EmptyState** — artifact + title + body + action

## Motion дисциплина

Само 3 primitives импортват `motion/react`: Dialog, Sheet, Toast.
Другите 8 ползват CSS transitions или нямат анимация.

## Naming

- Tokens: `--ds-{category}-{role}` (`--ds-surface-paper`, `--ds-accent-blood`)
- Components: PascalCase
- Data attributes: `data-ds-{primitive}` за инспекция

## Theme switching

Click "Theme" toolbar → light / dark. Tokens обръщат stack-а автоматично.

## Accessibility

Всеки story минава axe-core в `Accessibility` tab. Нула violations задължително.
```

## §9.2 — Per-primitive MDX cheatsheets

For each of the 11 primitives, add `<Primitive>.mdx` next to the .stories.tsx file:

```mdx
import { Meta, Story, ArgTypes } from "@storybook/blocks";
import * as Stories from "./PaperCard.stories";

<Meta of={Stories} />

# PaperCard

Стандартна светла card с optional eyebrow + meta + body.

## When to use

- Контентни блокове върху paper background
- Списъчни записи (history items, leaderboard rows)
- Sectioned content на informational pages

## When NOT to use

- В тъмни in-game scenes → ползвай `SceneCard`
- Само за padding → ползвай `Surface` директно

## Props

<ArgTypes of={Stories} />

## Usage

```tsx
<PaperCard
  eyebrow="ДОСИЕ"
  meta={<Eyebrow tone="muted">14.05</Eyebrow>}
>
  <Display size="h3">Селото оцеля</Display>
  <p>Една нощ без жертви.</p>
</PaperCard>
```

## Stories

<Story of={Stories.Default} />
<Story of={Stories.AllVariants} />
```

**Commit 1**: `docs(ui): Introduction MDX with system overview`

**Commit 2**: `docs(ui): per-primitive MDX cheatsheets (11 files)`

---

# §10 — PHASE 10 (PR 5): Visual regression per primitive + AGENTS.md (~2 hours, 2 commits)

## §10.1 — Per-primitive Playwright suite

Add to existing visual regression spec or new file:

```ts
import { test, expect } from "@playwright/test";

const PRIMITIVES = [
  { name: "Surface/Paper", url: "iframe.html?id=primitives-surface--paper" },
  { name: "Surface/Scene", url: "iframe.html?id=primitives-surface--scene" },
  { name: "PaperCard/Default", url: "iframe.html?id=primitives-papercard--default" },
  { name: "Pill/Primary", url: "iframe.html?id=primitives-pill--primary" },
  { name: "EmptyState/Default", url: "iframe.html?id=primitives-emptystate--default" },
  // ... all primitives
];

for (const p of PRIMITIVES) {
  test(`@ui ${p.name} matches snapshot`, async ({ page }) => {
    await page.goto(`http://localhost:6006/${p.url}&viewMode=story`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${p.name.replace("/", "-").toLowerCase()}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });
}
```

Wire into `pnpm visual:ui`.

```bash
pnpm ui:storybook:build
# Serve packages/ui/storybook-static, then:
pnpm visual:ui --update-snapshots
```

**Commit 1**: `test(visual): per-primitive Playwright suite + baselines (light + dark)`

## §10.2 — Final AGENTS.md update + finalization

Now (and only now) update `AGENTS.md` with:

```md
## Design system

`packages/ui` hosts primitives and tokens. Storybook at `pnpm ui:dev` (port 6006).

### Tokens

`--ds-*` OKLCH tokens live in `packages/ui/src/tokens.css`. They're parallel to
legacy `--ink`, `--paper`, etc. — new components consume `--ds-*`; existing
CSS keeps legacy until per-component migration.

The `@theme { ... }` Tailwind v4 bridge lives in `apps/web/app/globals.css`
(NOT in packages/ui — UI is Tailwind-agnostic).

### Primitives

11 components shipped:
- Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion (CSS-only)
- Toast, Dialog, Sheet (Motion via motion/react)
- EmptyState (CSS-only)

Motion is restricted to 3 primitives — verify with:
`grep "from \"motion/react\"" packages/ui/src/primitives | wc -l` → 3

When building new UI, **always** check `packages/ui` first. New primitives
get added there with Storybook story + unit test + axe-core verification.

### Empty states

22-entry catalog in `packages/ui/src/states/empty-states.ts`. Each entry maps
a route/state key to artifact + Bulgarian title + body + optional action.

Geometric SVG artifacts in `packages/ui/src/primitives/artifacts/`. Painterly
webp variants in `apps/web/public/empty-states/` (after optional PR 6).

The `ArtifactImage` wrapper lives in `apps/web/components/` (Next-aware, uses
`next/image` after PR 6 lands painterly variants).

### Dictionary

`docs/dictionary.md` is canonical for Bulgarian copy. Run `pnpm check:dict`
before opening a PR. Hard warnings (English in JSX) must be fixed; legacy
spec deviations (Постижения vs Легенди) are accepted until follow-up.

### Acceptance

`docs/acceptance/*.md` lists per-page acceptance criteria. Used as PR-review
checklist. Not yet CI-enforced.

### Storybook

Production-grade Storybook 10 (React-Vite). Every primitive has stories,
unit tests, axe-core a11y verification. MDX docs hub at Foundation/Introduction.
Per-primitive Playwright visual regression in `pnpm visual:ui`.
```

Run final `bg-copy-reviewer` agent on all touched docs.

Run final `frontend-design` skill holistic review:
> "Holistic review of @werewolf/ui after Path Б adoption. Walk all 11 primitives, all 22 empty-state entries, the 5 migrated pages. Look for inconsistencies, AI-generic patterns, over-engineering. Suggest 5-10 precise improvements ranked by impact."

Apply highest-impact 3-5 recommendations.

**Commit 2**: `docs(agents): document design system, dictionary, acceptance — final adoption notes`

---

# §11 — PHASE 11 (PR 6, OPTIONAL): Painterly imagen artifacts (~1 hour, 3 commits)

**Optional polish. Run only if user explicitly requests.**

## §11.1 — Generate 8 painterly artifacts via `imagegen` skill

Per `~/.codex/skills/.system/imagegen/SKILL.md`:

| Key | Output | Style |
|---|---|---|
| `empty-chair` | `apps/web/public/empty-states/empty-chair.webp` | Wooden tavern chair, candlelight, oak floorboards, painterly oil, no text, 1024×1024 |
| `closed-book` | `…/closed-book.webp` | Leather book, brass clasp, dusty table, sepia, painterly oil |
| `sealed-letter` | `…/sealed-letter.webp` | Parchment, red wax seal with wolf head, candle, painterly oil |
| `open-door` | `…/open-door.webp` | Wooden door ajar, warm yellow light, misty courtyard, painterly oil |
| `dusty-shelf` | `…/dusty-shelf.webp` | Empty library shelf, dust motes in light shaft, painterly oil |
| `unprinted-paper` | `…/unprinted-paper.webp` | Stack of newspaper sheets, typesetter's table, painterly oil |
| `balanced-scale` | `…/balanced-scale.webp` | Brass apothecary scale balanced, painterly oil |
| `broken-candle` | `…/broken-candle.webp` | Pewter candlestick, snapped wick, dark velvet, painterly oil |

**Commit 1**: `chore(art): generate 8 painterly empty-state artifacts via imagegen`

## §11.2 — Update `ArtifactImage` to prefer painterly via next/image

```diff
+ import Image from "next/image";
  import type { ComponentType } from "react";
- import { ARTIFACT_SVG, type ArtifactKey } from "@werewolf/ui/artifacts";
+ import { ARTIFACT_SVG, ARTIFACT_PAINTERLY_PATH, type ArtifactKey } from "@werewolf/ui/artifacts";

  type Props = {
    artifact: ArtifactKey;
    size?: number;
+   preferPainterly?: boolean;
  };

- export function ArtifactImage({ artifact, size = 144 }: Props) {
+ export function ArtifactImage({ artifact, size = 144, preferPainterly = true }: Props) {
    const SVGComponent: ComponentType<{ size?: number }> = ARTIFACT_SVG[artifact];
-   return <SVGComponent size={size} />;
+   if (!preferPainterly) {
+     return <SVGComponent size={size} />;
+   }
+   const painterly = ARTIFACT_PAINTERLY_PATH[artifact];
+   return (
+     <Image
+       src={painterly}
+       alt=""
+       width={size}
+       height={size}
+       style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain" }}
+     />
+   );
  }
```

**Commit 2**: `feat(web): ArtifactImage uses painterly webp via next/image`

## §11.3 — Visual regression update

```bash
pnpm visual:update
```

**Commit 3**: `test(visual): update pilot page baselines with painterly artifacts`

---

# §12 — Acceptance criteria for FULL adoption (PRs 1-5)

1. ✅ `packages/ui` workspace — React-only, `@storybook/react-vite` (NOT `@storybook/nextjs`)
2. ✅ `motion@12.40.0` imported via `motion/react` (NOT `framer-motion`)
3. ✅ Motion restricted to Dialog/Sheet/Toast only — verify by `grep "from \"motion/react\"" packages/ui/src/primitives` returns exactly 3 matches
4. ✅ 32 `--ds-*` OKLCH tokens with WCAG-verified contrasts
5. ✅ Tailwind `@theme` bridge in `apps/web/app/globals.css` (NOT in `packages/ui`)
6. ✅ 11 primitives shipped with stories (≥4 per), unit tests, axe-clean
7. ✅ 8 geometric SVG artifacts in `packages/ui/src/primitives/artifacts/` — no `next/image` in package
8. ✅ `ArtifactImage` wrapper lives in `apps/web/components/`, NOT in `packages/ui`
9. ✅ 22-entry empty-state catalog with Bulgarian copy
10. ✅ `docs/dictionary.md` + audit-only `check:dict` script (exit 0)
11. ✅ `docs/acceptance/*.md` — 17 page files + README
12. ✅ `/status` migrated and visual diff approved (PR 3)
13. ✅ `/privacy`, `/terms`, `/report`, `/faq` migrated (PR 4, gated on PR 3 approval)
14. ✅ Storybook MDX docs hub
15. ✅ Per-primitive Playwright visual regression baselines
16. ✅ `AGENTS.md` updated in PR 5 (NOT before)
17. ✅ `pnpm verify` green throughout
18. ✅ Bulgarian-only copy verified by `bg-copy-reviewer` agent
19. ✅ Legacy hex tokens (`--ink`, `--paper`, …) untouched
20. ✅ `play-room-client.tsx` ≤ 1438 lines (Phase B preserved)
21. ✅ No `prefers-reduced-motion` guards added
22. ✅ No `@storybook/nextjs`, `@storybook/test`, `@radix-ui/react-tooltip`, `plaiceholder` deps
23. ✅ `frontend-design` skill review applied at Phase 4 end, Phase 6 end, Phase 10
24. ✅ Storybook builds for production

---

# §13 — Commit summary

```
PR 1: Foundation (12 commits, ~4h)
  1. feat(ui): scaffold packages/ui workspace (React-only, tsup, Vite-Storybook)
  2. chore(ui): install dependencies for @werewolf/ui workspace
  3. feat(ui): configure storybook 10 (react-vite) + a11y + viewport + theme decorator
  4. chore(web): wire @werewolf/ui workspace dependency
  5. chore(scripts): wire ui:dev, ui:build, ui:storybook:build, check:dict, visual:ui
  6. feat(ui): introduce 32 OKLCH design tokens (plain CSS variables)
  7. feat(web): bridge --ds-* tokens to Tailwind v4 utilities via @theme (app-level)
  8. feat(ui): tokens reference stories (colors + typography + spacing + motion)
  9. docs(ui): document --ds-* token namespace, theme + migration policy
  10. docs: lock 48-term Bulgarian dictionary with legacy-OK overrides
  11. feat(scripts): add audit-only dictionary check (exit 0, warns only)
  12. docs(scripts): document check:dict policy in scripts/README.md

PR 2: Primitives library (14 commits, ~5h)
  13. feat(ui): Surface primitive (paper/scene × card/tile × elevation)
  14. feat(ui): Eyebrow primitive with tone variants
  15. feat(ui): Display primitive with size scale (Noto Serif Display)
  16. feat(ui): PaperCard primitive (CSS-only)
  17. feat(ui): SceneCard primitive (CSS-only)
  18. feat(ui): Pill primitive (CSS transitions, no Motion)
  19. feat(ui): Medallion primitive
  20. feat(ui): Toast primitive (Motion enter/exit)
  21. feat(ui): Dialog primitive (Radix + Motion)
  22. feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
  23. feat(ui): EmptyState primitive (CSS-only)
  24. feat(ui): export all 11 primitives from packages/ui index
  25. feat(ui): stories + tests for all 11 primitives (storybook/test, axe-clean)
  26. chore(ui): verify all primitives pass axe-core (light + dark)

PR 3: /status pilot (8 commits, ~3h)
  27. feat(ui): 8 geometric SVG artifacts
  28. feat(ui): artifact metadata (SVG components + painterly path hints)
  29. feat(ui): 22-entry empty-state catalog with Bulgarian copy
  30. feat(ui): state-catalog storybook gallery
  31. feat(web): ArtifactImage wrapper (Next-aware, currently SVG-only)
  32. refactor(status): migrate service-health card to PaperCard + Display
  33. feat(status): adopt EmptyState primitive for outage states
  34. test(visual): update /status baselines + frontend-design polish

   ── GATE: wait for user approval before PR 4 ──

PR 4: Legal-shell sweep (6 commits, ~3h)
  35. refactor(privacy): migrate hero + sections to SceneCard + PaperCard primitives
  36. refactor(terms): migrate hero + sections to primitives
  37. refactor(report): migrate hero + success state to primitives
  38. refactor(report): adopt Pill for primary CTA actions
  39. refactor(faq): migrate hero + section heads to primitives (accordion preserved)
  40. chore(pilots): legal-shell sweep — frontend-design review applied

PR 5: Docs + acceptance + finalization (6 commits, ~2h)
  41. docs: per-page acceptance criteria for all 17 routes
  42. docs: acceptance criteria index and policy
  43. docs(ui): Introduction MDX with system overview
  44. docs(ui): per-primitive MDX cheatsheets (11 files)
  45. test(visual): per-primitive Playwright suite + baselines (light + dark)
  46. docs(agents): document design system, dictionary, acceptance — final adoption notes

OPTIONAL PR 6: Painterly imagen polish (3 commits, ~1h)
  47. chore(art): generate 8 painterly empty-state artifacts via imagegen
  48. feat(web): ArtifactImage uses painterly webp via next/image
  49. test(visual): update pilot page baselines with painterly artifacts
```

**PR titles**:
- **PR 1**: `feat(ui): foundation — workspace + 32 OKLCH tokens + Bulgarian dictionary`
- **PR 2**: `feat(ui): 11 primitives — Surface/Card/Pill/Dialog/Sheet/EmptyState (Motion: 3 only)`
- **PR 3**: `feat: artifacts + state catalog + /status pilot migration`
- **PR 4**: `refactor: legal-shell sweep — privacy/terms/report/faq on primitives` *(gated)*
- **PR 5**: `docs+test: per-page acceptance + Storybook MDX + primitive visual regression`
- **PR 6** *(optional)*: `feat: painterly artwork via imagegen + next/image wrapper`

---

# §14 — Failure modes

## §14.1 — Storybook React-Vite framework setup

If `@storybook/react-vite` doesn't auto-detect Vite config:
1. Add `vite.config.ts` to `packages/ui/`:
   ```ts
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   export default defineConfig({ plugins: [react()] });
   ```
2. Storybook will pick it up via `framework.options.builder.viteConfigPath`

## §14.2 — `storybook/test` import fails

- `storybook/test` is the SB10 built-in. If not resolved:
  1. Check `storybook` version: must be `^10.4.1`
  2. Check tsconfig: `moduleResolution: "Bundler"` honors SB10's exports
  3. Fall back: import from `@testing-library/react` directly for non-interaction tests

## §14.3 — Tailwind `@theme` not generating utilities

- Verify Tailwind v4.2.4 in `apps/web/package.json`
- Verify `@tailwindcss/postcss` in postcss config
- Tokens still work as plain CSS variables even if @theme misfires — fall back to `style={{ background: "var(--ds-surface-paper)" }}`

## §14.4 — `motion/react` import fails

- Verify `pnpm --filter @werewolf/ui list motion` → 12.40.x
- Check `motion/react` export: `cat node_modules/motion/package.json | grep -A20 exports`
- Fallback: `import { motion } from "motion"` (default entry exports React API)
- If still broken: invoke `context7` MCP for Motion 12 docs

## §14.5 — Visual regression breaks on /status

- Open failed diff. Adjust PaperCard density or padding.
- If intentional improvement → `pnpm visual:update` with documented diff
- If regression → revert commit, adjust primitive

## §14.6 — `pnpm verify` red after commit

- Revert: `git reset --hard HEAD~1`
- Investigate failing sub-step (`regression` / `typecheck` / `build` / `smoke` / `e2e` / `visual` / `perf:budget`)
- Fix specifically; commit again

---

# §15 — Notes for ChatGPT / Codex

1. **React-only purity of `packages/ui`**. Zero Next imports. Zero `next/image`, `next/link`, `next/router`. If a primitive needs an image, it returns the bare element and lets `apps/web` wrap.
2. **Motion is precious**. Only 3 primitives import `motion/react`: Dialog, Sheet, Toast. Verify with grep after Phase 4.
3. **`@theme` in app only**. `packages/ui/tokens.css` is plain CSS. `apps/web/app/globals.css` bridges.
4. **PR 3 is the gate**. Don't queue PR 4 work until PR 3 lands + user explicitly approves /status visual diff.
5. **PR 6 is optional**. Don't run imagen unless user opts in.
6. **`storybook/test` for interactions**. Don't add `@storybook/test` as a dep.
7. **AGENTS.md update — only in PR 5**. Don't touch in PR 1-4.
8. **`frontend-design` skill at 3 checkpoints**: Phase 4 end (API), Phase 6 end (/status), Phase 10 (holistic).
9. **`bg-copy-reviewer` agent after every commit** with user-facing strings.
10. **No font loads in production from new sources.** Storybook preview's Google Fonts import is dev-only.

---

# §16 — Sources

- [motion - npm](https://www.npmjs.com/package/motion) — Motion v12.40.0
- [Motion: JavaScript & React animation library](https://motion.dev/) — official docs
- [Storybook React-Vite framework docs](https://storybook.js.org/docs/get-started/install)
- [`storybook/test` built-in](https://storybook.js.org/docs/writing-tests/test-runner)
- [Radix UI react-dialog 1.1.15](https://www.npmjs.com/package/@radix-ui/react-dialog)
- [Tailwind CSS v4 @theme directive](https://tailwindcss.com/docs/theme)

---

(End of master prompt)
