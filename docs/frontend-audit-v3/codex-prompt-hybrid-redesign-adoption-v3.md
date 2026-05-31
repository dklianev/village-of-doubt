# Codex master prompt — Hybrid `/redesign` adoption v3

Tightened from v2 after architecture review. Key corrections:

| v2 → v3 change | Why |
|---|---|
| `@storybook/nextjs` → **`@storybook/react-vite`** + `vite` | `packages/ui` is React-only. No `next/image`, no `next/link`, no App Router context. Faster Storybook. |
| `@storybook/test@8.6.15` → **`storybook/test`** (built-in) | SB10 ships test utilities. No separate dep. |
| Motion in all primitives → **Motion only in `Dialog`, `Sheet`, `Toast`** | Bundle discipline. PaperCard/Pill/EmptyState use CSS transitions. |
| `next/image` in packages/ui → **SVG components only; `ArtifactImage` wrapper in `apps/web`** | UI pkg stays React-pure. Next coupling stays in app. |
| `plaiceholder` dep → **removed** | No AtmosphericImage in scope. |
| `@radix-ui/react-tooltip` dep → **removed** | Not in the 11-primitive list. |
| 13 imagen artifacts in foundation PR → **geometric SVGs only; imagen as optional follow-up PR** | Asset generation must not block design-system landing. |
| 5 pilots in one PR → **`/status` first; legal-shell sweep gated as follow-up PR** | Validate primitives on one page before applying to 4 more. |
| `@theme` in `packages/ui/tokens.css` → **`@theme` in `apps/web/app/globals.css`** | Tailwind pipeline lives in the app, not the UI pkg. |
| AGENTS.md update in Phase 1 → **AGENTS.md update in finalization PR** | Don't touch source of truth until system is proven. |

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
# Recent landed work intact
wc -l apps/web/components/play-room-client.tsx       # ≤1438
test -f apps/web/hooks/use-timer-countdown.ts        && echo "✓ Phase A"
test -f apps/web/lib/use-modal.ts                    && echo "✓ useModal"
test -f apps/web/lib/auth-errors.ts                  && echo "✓ auth-errors"
test -f apps/web/lib/clipboard.ts                    && echo "✓ clipboard"
grep -q "^\s*--legal-shell-bg" apps/web/app/globals.css && echo "✓ legal tokens"

# packages/ui must NOT exist yet
ls packages/ui 2>&1 | grep -q "No such file" && echo "✓ clean slate" || { echo "ABORT"; exit 1; }

# Motion is the correct package name (not framer-motion)
npm view motion version                              # 12.40.0

# imagen skill available
test -f ~/.codex/skills/.system/imagegen/SKILL.md    && echo "✓ imagen available"

# Regression + visual baseline
pnpm regression 2>&1 | tail -3
ls apps/web/__visual__/__baseline__/ | head -5
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
- `--legal-shell-*` tokens in globals.css (Phase C)
- `--hero-card-*` tokens (theatre backdrop)
- All 50+ `--art-*`, `--texture-*`, `--faction-*` image-set tokens
- Production Bulgarian copy (changed only via dedicated migration PR — not this one)
- **`AGENTS.md`** — updated only in PR 5 (finalization)

## §0.3 — Dictionary policy (audit-only)

Same as v2 §0.3:
- `docs/dictionary.md` lists 48 spec terms + 10 legacy-OK overrides (Постижения, История, FAQ, Класация, Приятели, Профил, Доклад, Tutorial, Lobby, Status)
- `scripts/check-dictionary.mjs` warns but exits 0
- Wired as `pnpm check:dict`; NOT in `pnpm verify`

## §0.4 — New dependencies (verified latest 2026-05-23)

| Package | Version | Where | Purpose | Notes |
|---|---|---|---|---|
| **`motion`** | `^12.40.0` | `packages/ui` dep | Animation for Dialog/Sheet/Toast | Import `motion/react`. NEW name; `framer-motion` is legacy alias. |
| **`storybook`** | `^10.4.1` | `packages/ui` devDep | Component browser | |
| **`@storybook/react-vite`** | `^10.4.1` | `packages/ui` devDep | React + Vite integration | NOT `@storybook/nextjs` — UI pkg is React-only |
| **`vite`** | `^8.0.14` | `packages/ui` devDep | Bundler for Storybook | |
| `@storybook/addon-a11y` | `^10.4.1` | `packages/ui` devDep | axe-core in Storybook | Test utilities import from `storybook/test` (built into SB10) |
| `tsup` | `^8.5.1` | `packages/ui` devDep | Library build | esm+cjs+dts |
| `tslib` | `^2.8.1` | `packages/ui` dep | TS runtime |
| `@radix-ui/react-dialog` | `^1.1.15` | `packages/ui` dep | Dialog + Sheet portal/ARIA | Only this Radix package |
| `@axe-core/react` | `^4.11.3` | `packages/ui` devDep | Runtime a11y in Storybook |
| `@axe-core/playwright` | `^4.11.3` | root devDep | a11y in visual specs |
| `tsx` | `^4.22.3` | root devDep | Run TS scripts |

**Removed from v2** (dropped per architecture review):
- ~~`@storybook/nextjs`~~ (replaced by `@storybook/react-vite`)
- ~~`@storybook/test@8.6.15`~~ (use built-in `storybook/test` from SB10)
- ~~`@radix-ui/react-tooltip`~~ (not in primitive list)
- ~~`plaiceholder`~~ (no AtmosphericImage in scope)

## §0.5 — Skills, agents, MCPs — when to invoke

| Tool | Phase | Why |
|---|---|---|
| `bg-copy-reviewer` agent | After EVERY commit touching JSX text or `docs/**/*.md` | Bulgarian-only, natural phrasing |
| `frontend-design` skill | Phase 4 end (primitive API consistency), Phase 6 end (/status pilot review), Phase 10 (holistic final) | Polished, distinctive code |
| `context7` MCP | Phase 1 (Storybook 10 + Vite setup), Phase 4 (Motion 12 React API, Radix Dialog 1.1) | Latest API docs |
| `imagegen` skill | **PR 6 ONLY (optional)** — 8 painterly artifacts | Production-grade artwork, follow-up polish |
| `WebSearch` | Anytime dep API unclear and context7 lacks coverage | Recent breaking changes |
| `role-mechanics-reviewer` agent | NOT needed in Path Б | — |
| `Postgres` MCP | NOT needed | — |

## §0.6 — PR strategy

| PR # | Phases | Commits | Hours | User-visible |
|---|---|---|---|---|
| **PR 1** Foundation | §1 + §2 + §3 | 12 | ~4 | No |
| **PR 2** Primitives library | §4 | 14 | ~5 | Storybook only |
| **PR 3** /status pilot | §5 + §6 | 8 | ~3 | Yes — /status polished |
| **PR 4** Legal-shell sweep (gated) | §7 | 6 | ~3 | Yes — 4 more pages |
| **PR 5** Docs + acceptance + finalization | §8 + §9 + §10 | 6 | ~2 | No (infra + docs) |
| **PR 6** (optional) Painterly artifacts | §11 | 3 | ~1 | Yes — replaces SVGs with painterly |

**Gating**: PR 4 begins only after PR 3 merges and visual diff is approved by user.

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
│   ├── tokens.css           # plain CSS variables only (Phase 2)
│   ├── styles/              # Phase 4+ (sheet.css etc.)
│   ├── primitives/          # Phase 4+
│   │   └── artifacts/       # Phase 5 (SVG components only)
│   ├── states/              # Phase 5 (catalog)
│   └── docs/                # Phase 8 (MDX)
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

## Workspace commands

| Command | Purpose |
|---|---|
| `pnpm --filter @werewolf/ui storybook` | Dev server on port 6006 |
| `pnpm --filter @werewolf/ui build` | Production library build (esm+cjs+dts) |
| `pnpm --filter @werewolf/ui test` | Vitest |
| `pnpm --filter @werewolf/ui build-storybook` | Static Storybook build |

From repo root: `pnpm ui:dev`, `pnpm ui:build`, `pnpm ui:storybook:build`.
```

### Commit 1
```
feat(ui): scaffold packages/ui workspace (React-only, tsup, Vite-Storybook)
```

## §1.2 — Install + verify clean build

```bash
pnpm install
pnpm --filter @werewolf/ui typecheck    # zero source files — passes
pnpm --filter @werewolf/ui build        # produces empty dist/
pnpm --filter @werewolf/ui test         # passes with no tests
```

### Commit 2
```
chore(ui): install dependencies for @werewolf/ui workspace
```

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
/* Production-aligned fonts only — Noto Serif family.
   No Cormorant Garamond, no JetBrains Mono loaded here. */
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

### Verify

```bash
pnpm --filter @werewolf/ui storybook
# Starts on port 6006, empty (no stories yet)
```

### Commit 3
```
feat(ui): configure storybook 10 (react-vite) + a11y + viewport + theme decorator
```

## §1.4 — Wire @werewolf/ui into apps/web

### Update `apps/web/package.json`

```diff
  "dependencies": {
    /* existing */
    "@werewolf/database": "workspace:*",
    "@werewolf/shared": "workspace:*",
+   "@werewolf/ui": "workspace:*",
    /* existing */
  }
```

### Update `apps/web/next.config.ts`

```diff
  const nextConfig: NextConfig = {
    output: "standalone",
-   transpilePackages: ["@werewolf/shared", "@werewolf/database"],
+   transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
    /* … */
  };
```

### Verify
```bash
pnpm install
pnpm --filter @werewolf/web typecheck
pnpm --filter @werewolf/web build
pnpm verify
```

### Commit 4
```
chore(web): wire @werewolf/ui workspace dependency
```

## §1.5 — Root scripts + tsx + Playwright a11y

### Update root `package.json`

```diff
  "scripts": {
    /* existing */
+   "ui:dev": "pnpm --filter @werewolf/ui storybook",
+   "ui:build": "pnpm --filter @werewolf/ui build",
+   "ui:storybook:build": "pnpm --filter @werewolf/ui build-storybook",
+   "check:dict": "tsx scripts/check-dictionary.mjs",
+   "visual:ui": "playwright test --config=playwright.config.ts --grep '@ui'",
  },
  "devDependencies": {
    /* existing */
+   "tsx": "^4.22.3",
+   "@axe-core/playwright": "^4.11.3"
  }
```

### Verify
```bash
pnpm install
pnpm ui:build
pnpm verify
```

### Commit 5
```
chore(scripts): wire ui:dev, ui:build, ui:storybook:build, check:dict, visual:ui
```

**Phase 1 complete.**

---

# §2 — PHASE 2: OKLCH tokens + Tailwind v4 `@theme` bridge in app (~2 hours, 4 commits)

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
 * Adopted from /redesign/tokens.html spec, 2026-05-23.
 * Contrast ratios verified WCAG AA against canonical surfaces.
 *
 * Theme: html[data-theme="dark"] flips surfaces + ink. Accents are
 * theme-invariant (blood is blood, gold is gold).
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

  /* ─── Typography scale (rem; 16px root) ─── */
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

  /* ─── Spacing (px; 4px base) ─── */
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

  /* ─── Motion (used by Dialog/Sheet/Toast only) ─── */
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

/* ─── Global focus-visible (opt-in via [data-ds]) ─── */
:where([data-ds]) *:focus-visible {
  outline: none;
  box-shadow: var(--ds-focus-ring);
  outline-offset: 2px;
}
```

### Commit 1
```
feat(ui): introduce 32 OKLCH design tokens (plain CSS variables)
```

## §2.2 — Tailwind v4 `@theme` bridge — **in `apps/web/app/globals.css` ONLY**

### Update `apps/web/app/globals.css`

```diff
  @import "tailwindcss";
+ @import "@werewolf/ui/tokens.css";
+
+ /* Tailwind v4 @theme — expose --ds-* tokens as utility classes.
+    Lives HERE (apps/web) because Tailwind pipeline runs in the app, not UI pkg. */
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
+
+   --radius-ds-card: var(--ds-radius-card);
+   --radius-ds-tile: var(--ds-radius-tile);
+   --radius-ds-chip: var(--ds-radius-chip);
+
+   --shadow-ds-card: var(--ds-shadow-card);
+   --shadow-ds-scene: var(--ds-shadow-scene);
+ }

  :root {
    --ink: #1b100c;
    /* existing tokens untouched */
  }
```

Now `bg-ds-paper`, `text-ds-ink-primary`, `rounded-ds-card`, `shadow-ds-card` all work as Tailwind utilities in `apps/web` only. `packages/ui` consumes `var(--ds-*)` directly.

### Commit 2
```
feat(web): bridge --ds-* tokens to Tailwind v4 utilities via @theme (app-level)
```

## §2.3 — Token reference stories in Storybook

`packages/ui/src/tokens.stories.tsx` — Colors, Typography, Spacing, Motion grids. (Same content as v2 §2.3, unchanged.)

### Commit 3
```
feat(ui): tokens reference stories (colors + typography + spacing + motion)
```

## §2.4 — Documentation

`packages/ui/docs/tokens.md` — naming convention, theme override, migration policy. Same as v2 §2.2, with explicit note that **`@theme` lives in apps/web, NOT packages/ui**.

### Commit 4
```
docs(ui): document --ds-* token namespace, theme + migration policy
```

**Phase 2 complete.** Visual regression must stay 100% identical.

---

# §3 — PHASE 3: Dictionary audit (~1 hour, 3 commits)

Same as v2 §3 — `docs/dictionary.md` + `scripts/check-dictionary.mjs` + AGENTS.md note **deferred to Phase 10**.

### Commit 1: `docs: lock 48-term Bulgarian dictionary with legacy-OK overrides`
### Commit 2: `feat(scripts): add audit-only dictionary check (exit 0, warns only)`
### Commit 3: `docs(scripts): document check:dict policy in scripts/README.md` *(NOT AGENTS.md yet)*

**Invoke `bg-copy-reviewer` agent** on `docs/dictionary.md`.

---

# §4 — PHASE 4: 11 primitives (~5 hours, 14 commits)

**Motion discipline**: Only `Dialog`, `Sheet`, `Toast` import from `motion/react`. All other primitives use CSS transitions.

## §4.0 — Verify Motion import path

```tsx
// ✓ Correct (Dialog/Sheet/Toast only)
import { motion, AnimatePresence } from "motion/react";

// ✗ Legacy
import { motion } from "framer-motion";
```

If `motion/react` import fails:
1. Verify `pnpm --filter @werewolf/ui list motion` shows 12.40.x
2. Invoke `context7` MCP for Motion 12 React API

## §4.1 — Surface

`packages/ui/src/primitives/Surface.tsx` — forwardRef, data attribute, variant/radius/elevation/as props. **No Motion.** CSS-only.

(Implementation same as v2 §4.1, verbatim.)

### Commit 1
```
feat(ui): Surface primitive (paper/scene × card/tile × elevation)
```

## §4.2 — Eyebrow

CSS-only. Same as v2.

### Commit 2
```
feat(ui): Eyebrow primitive with tone variants
```

## §4.3 — Display

CSS-only. Same as v2.

### Commit 3
```
feat(ui): Display primitive with size scale (Noto Serif Display)
```

## §4.4 — PaperCard (CSS-only entrance optional via class)

**v3 change**: NO Motion. Optional CSS transition class if user opts in.

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

No Motion. If a consumer needs entrance animation, they wrap the card in their own Motion component.

### Commit 4
```
feat(ui): PaperCard primitive (Surface + eyebrow + meta + body, CSS-only)
```

## §4.5 — SceneCard

Same pattern, `variant="scene"`. CSS-only. Eyebrow tone="gold".

### Commit 5
```
feat(ui): SceneCard primitive (dark cinematic, CSS-only)
```

## §4.6 — Pill (CSS-only hover/active)

**v3 change**: CSS `:hover` + `:active` + `transition`. No Motion.

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

Add `packages/ui/src/styles/pill.css`:

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

Consumer imports the CSS via `@werewolf/ui/styles/pill.css`.

### Commit 6
```
feat(ui): Pill primitive (CSS transitions on hover/active, no Motion)
```

## §4.7 — Medallion

CSS-only static. Same as v2.

### Commit 7
```
feat(ui): Medallion primitive (gold circular badge)
```

## §4.8 — Toast (**uses Motion**)

```tsx
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

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

### Commit 8
```
feat(ui): Toast primitive (Motion enter/exit, 3 tones)
```

## §4.9 — Dialog (**Radix + Motion**)

Same as v2 §4.9. Radix portal + ARIA, Motion enter/exit.

### Commit 9
```
feat(ui): Dialog primitive (Radix + Motion + Noto Serif Display title)
```

## §4.10 — Sheet (**Radix + Motion**)

Same as v2 §4.10. Bottom-sheet mobile, centered desktop.

### Commit 10
```
feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
```

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

No Motion. Pure layout primitive.

### Commit 11
```
feat(ui): EmptyState primitive (artifact + title + body + action, CSS-only)
```

## §4.12 — Update `packages/ui/src/index.ts`

Same exports as v2 §4.12.

### Commit 12
```
feat(ui): export all 11 primitives from packages/ui index
```

## §4.13 — Stories + tests for all 11

Each primitive ships: ≥4 stories (Default, AllVariants, Interactive, DarkTheme), unit test using `@testing-library/react`, axe-clean.

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

### Commit 13
```
feat(ui): stories + tests for all 11 primitives (storybook/test, axe-clean)
```

## §4.14 — Verify Storybook + a11y

```bash
pnpm --filter @werewolf/ui build
pnpm --filter @werewolf/ui test
pnpm --filter @werewolf/ui build-storybook
pnpm ui:dev   # open http://localhost:6006
```

Walk every story → axe-core panel must show **0 violations**.

### Commit 14
```
chore(ui): verify all primitives pass axe-core (light + dark)
```

**Phase 4 complete.** **Invoke `frontend-design` skill**:

> "Review packages/ui/src/primitives/* (11 components). Verify API consistency, prop naming, default values, story coverage. Motion is restricted to Dialog/Sheet/Toast only — confirm. Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion, EmptyState are CSS-only. Suggest precise refinements only if substantive."

Apply highest-impact recommendations as polish commit if needed.

---

# §5 — PHASE 5: Geometric artifacts + state catalog (~2 hours, 4 commits)

**No imagen in this PR.** Geometric SVGs only. Painterly imagen is optional PR 6 polish.

## §5.1 — 8 geometric artifact SVG components

`packages/ui/src/primitives/artifacts/`:
- `empty-chair.tsx`, `closed-book.tsx`, `sealed-letter.tsx`, `open-door.tsx`
- `dusty-shelf.tsx`, `unprinted-paper.tsx`, `balanced-scale.tsx`, `broken-candle.tsx`

Each ~30 lines, monochrome strokes + one accent fill, `currentColor` inheritance, `size` prop (default 144).

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

All 8 in same style.

### Commit 1
```
feat(ui): 8 geometric SVG artifacts (empty-chair / closed-book / sealed-letter / open-door / dusty-shelf / unprinted-paper / balanced-scale / broken-candle)
```

## §5.2 — Artifact metadata (NO `next/image`, NO wrapper)

`packages/ui/src/primitives/artifacts/index.ts`:

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

/** Path hint for painterly versions (used by apps/web's ArtifactImage wrapper).
    Files don't exist yet — created in optional PR 6 via imagen. */
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

`packages/ui` exports `ARTIFACT_SVG` + `ARTIFACT_PAINTERLY_PATH`. Consumers in `apps/web` will optionally wrap with `next/image` (see Phase 6).

### Commit 2
```
feat(ui): artifact metadata (SVG components + painterly path hints)
```

## §5.3 — State catalog (`packages/ui/src/states/empty-states.ts`)

22 entries. Each maps key → artifact key + Bulgarian title + body + optional action.

(Full implementation same as v2 §5.4 — all 22 entries verbatim.)

### Commit 3
```
feat(ui): 22-entry empty-state catalog with structured Bulgarian copy
```

## §5.4 — Storybook coverage

`packages/ui/src/states/empty-states.stories.tsx` — gallery showing all 22 entries rendered via `EmptyState` + geometric SVG.

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

**Invoke `bg-copy-reviewer` agent** on `empty-states.ts` (22 Bulgarian copy entries).

### Commit 4
```
feat(ui): state-catalog storybook gallery (22 entries × geometric artifacts)
```

**Phase 5 complete.**

---

# §6 — PHASE 6: /status pilot migration (~2 hours, 4 commits)

**Single page**. Validate primitives in production before broader sweep.

## §6.1 — Inspect current /status

```bash
cat apps/web/app/status/page.tsx
ls apps/web/components/status/ 2>&1
```

Note which components render which sections.

## §6.2 — Create `apps/web/components/ArtifactImage.tsx`

The Next-aware wrapper that lives in `apps/web` (NOT in `packages/ui`):

```tsx
"use client";

import Image from "next/image";
import type { ComponentType, ReactNode } from "react";
import { ARTIFACT_SVG, ARTIFACT_PAINTERLY_PATH, type ArtifactKey } from "@werewolf/ui/artifacts";

type Props = {
  artifact: ArtifactKey;
  size?: number;
  /** If a painterly file exists at the expected path, prefer it. Otherwise fall back to SVG. */
  preferPainterly?: boolean;
};

/**
 * Renders an artifact illustration. Reaches for next/image if a painterly webp
 * exists, otherwise renders the geometric SVG component from @werewolf/ui.
 *
 * In v3 Phase 6, painterly files do NOT exist yet — wrapper always falls back
 * to SVG. After optional PR 6 (imagen polish), webps appear in
 * apps/web/public/empty-states/ and this wrapper picks them up automatically.
 */
export function ArtifactImage({ artifact, size = 144, preferPainterly = true }: Props) {
  const SVGComponent: ComponentType<{ size?: number }> = ARTIFACT_SVG[artifact];

  // For now, always render SVG. PR 6 will add webp detection.
  // (We could do this dynamically via fetch HEAD, but a static check is simpler.)
  if (!preferPainterly) {
    return <SVGComponent size={size} />;
  }

  // SVG fallback for v3 — webp may not exist yet
  return <SVGComponent size={size} />;
}
```

(Note: after PR 6 lands painterly webps, this wrapper can be updated to actually try the `<Image>` path. For v3 it's a placeholder that always returns SVG.)

### Commit 1
```
feat(web): ArtifactImage wrapper (Next-aware, currently SVG-only)
```

## §6.3 — Migrate /status hero + cards

```diff
+ import { PaperCard, Display, Eyebrow, EmptyState, Pill, EMPTY_STATES } from "@werewolf/ui";
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

**Leave the old `.status-card` CSS in `globals.css`** — dead code now, but cleanup is a separate PR. Don't expand scope here.

### Commit 2
```
refactor(status): migrate service-health card to PaperCard + Display
```

### Commit 3
```
feat(status): adopt EmptyState primitive for outage states
```

## §6.4 — Visual regression

```bash
pnpm visual
# Review apps/web/__visual__/__baseline__/visual-regression*status*.png diffs
# If intentional improvement → pnpm visual:update
# If regression → revert and adjust primitive density/padding
```

**Invoke `bg-copy-reviewer` agent** on `apps/web/app/status/page.tsx`.

**Invoke `frontend-design` skill**:
> "Review /status page after migration to @werewolf/ui primitives. Check: density choices, eyebrow tones, hierarchy. Compare to /redesign/acceptance.html status section. Flag any inconsistency."

### Commit 4
```
test(visual): update /status baselines + frontend-design polish applied
```

**Phase 6 complete.** **STOP — wait for user approval before PR 4.**

If user approves /status migration:
- Visual diff looks clean
- Primitives feel correct in production
- bg-copy-reviewer is green
- frontend-design feedback applied

Then proceed to PR 4 (legal-shell sweep).

---

# §7 — PHASE 7 (PR 4, gated): Legal-shell sweep (~3 hours, 6 commits)

**Only after PR 3 (/status) merges + user approves.**

Migrate `/privacy`, `/terms`, `/report`, `/faq` to primitives. Same pattern as /status. Each in its own commit.

## §7.1 — `/privacy`

Hero card → `SceneCard` (privacy promise hero is dark cinematic). Sections → `PaperCard` with eyebrow per section.

### Commit 1
```
refactor(privacy): migrate hero + sections to SceneCard + PaperCard primitives
```

## §7.2 — `/terms`

Same pattern as /privacy.

### Commit 2
```
refactor(terms): migrate hero + sections to primitives
```

## §7.3 — `/report`

Hero → `SceneCard`. Success state → `EmptyState`. Primary CTAs → `Pill`.

### Commits 3-4
```
refactor(report): migrate hero + success state to primitives
refactor(report): adopt Pill for primary CTA actions
```

## §7.4 — `/faq`

**Preserve `FaqHearth.tsx` accordion mechanic + fixed-pseudo background fix (Phase 3 of faq-bg-shift).** Only refactor hero + section heads.

### Commit 5
```
refactor(faq): migrate hero + section heads to primitives (accordion preserved)
```

## §7.5 — Verify all 5 pilots

```bash
pnpm verify
pnpm visual
pnpm check:dict
```

**Invoke `bg-copy-reviewer` agent** on all 4 newly-migrated page files.

**Invoke `frontend-design` skill**:
> "Holistic review of 5 migrated pages (/status, /privacy, /terms, /report, /faq). Verify primitives are used consistently. Check density choices, hierarchy, motion subtlety. Flag any drift from /redesign/acceptance.html spec."

### Commit 6
```
chore(pilots): legal-shell sweep — frontend-design review applied
```

**Phase 7 complete.**

---

# §8 — PHASE 8 (PR 5): Acceptance criteria docs (~1 hour, 2 commits)

Same as v2 §7. Create 17 `docs/acceptance/*.md` files using the comprehensive template from v2 §8.1.

### Commit 1: `docs: per-page acceptance criteria for all 17 routes`
### Commit 2: `docs: acceptance criteria index and policy`

---

# §9 — PHASE 9 (PR 5): Storybook MDX docs hub (~1 hour, 2 commits)

`packages/ui/src/docs/Introduction.mdx` + 11 per-primitive cheatsheets. Same as v2 §8.

### Commits
```
docs(ui): Introduction MDX with system overview
docs(ui): per-primitive MDX cheatsheets (11 files)
```

---

# §10 — PHASE 10 (PR 5): Visual regression per primitive + AGENTS.md (~2 hours, 2 commits)

## §10.1 — Per-primitive Playwright suite

Same approach as v2 §9.1. `pnpm visual:ui` runs against Storybook static build.

### Commit 1
```
test(visual): per-primitive Playwright suite + baselines (light + dark)
```

## §10.2 — Final AGENTS.md update + finalization

Now (and only now) update `AGENTS.md` with comprehensive design system section. (Content same as v2 §10.3.)

Run final `bg-copy-reviewer` agent sweep on all touched docs.

Run final `frontend-design` skill holistic review.

### Commit 2
```
docs(agents): document design system, dictionary, acceptance — final adoption notes
```

---

# §11 — PHASE 11 (PR 6, OPTIONAL): Painterly imagen artifacts (~1 hour, 3 commits)

**Optional polish. Run only if user explicitly requests.**

## §11.1 — Generate 8 painterly artifacts via `imagegen` skill

Per `~/.codex/skills/.system/imagegen/SKILL.md`, generate webps:

| Key | Output path | Style guide |
|---|---|---|
| `empty-chair` | `apps/web/public/empty-states/empty-chair.webp` | Wooden tavern chair, candlelight, oak floorboards, painterly oil, no text, 1024×1024 |
| `closed-book` | `…/closed-book.webp` | Leather-bound book, brass clasp, dusty table, sepia, painterly oil, no readable text |
| `sealed-letter` | `…/sealed-letter.webp` | Parchment letter, red wax seal with wolf head, candle, painterly oil |
| `open-door` | `…/open-door.webp` | Heavy wooden door ajar, warm yellow light, misty courtyard, painterly oil |
| `dusty-shelf` | `…/dusty-shelf.webp` | Empty wooden library shelf, dust motes in light shaft, painterly oil |
| `unprinted-paper` | `…/unprinted-paper.webp` | Stack of clean newspaper sheets, typesetter's table, painterly oil |
| `balanced-scale` | `…/balanced-scale.webp` | Brass apothecary scale in balance, two empty pans, painterly oil |
| `broken-candle` | `…/broken-candle.webp` | Pewter candlestick, snapped wick, smoke trail, dark velvet, painterly oil |

### Commit 1
```
chore(art): generate 8 painterly empty-state artifacts via imagegen
```

## §11.2 — Update `ArtifactImage` to use next/image for painterly path

```diff
- if (!preferPainterly) {
-   return <SVGComponent size={size} />;
- }
- // SVG fallback for v3
- return <SVGComponent size={size} />;
+ if (!preferPainterly) {
+   return <SVGComponent size={size} />;
+ }
+ const painterly = ARTIFACT_PAINTERLY_PATH[artifact];
+ return (
+   <Image
+     src={painterly}
+     alt=""
+     width={size}
+     height={size}
+     style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain" }}
+   />
+ );
```

### Commit 2
```
feat(web): ArtifactImage uses painterly webp via next/image
```

## §11.3 — Visual regression update

The 5 migrated pages now render painterly artifacts instead of SVGs. Visual baselines for `/status`, `/privacy`, `/terms`, `/report`, `/faq` update.

```bash
pnpm visual:update
```

### Commit 3
```
test(visual): update pilot page baselines with painterly artifacts
```

**Phase 11 complete.** Optional polish landed.

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
22. ✅ No `@storybook/nextjs`, `@storybook/test`, `@radix-ui/react-tooltip`, `plaiceholder` deps (dropped from v2)
23. ✅ `frontend-design` skill review applied at Phase 4 end, Phase 6 end, Phase 10
24. ✅ Storybook builds for production

---

# §13 — Commit summary (~46 commits)

```
PR 1: Foundation (Phases 1+2+3) — 12 commits, ~4h
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

PR 2: Primitives library (Phase 4) — 14 commits, ~5h
  13. feat(ui): Surface primitive (paper/scene × card/tile × elevation)
  14. feat(ui): Eyebrow primitive with tone variants
  15. feat(ui): Display primitive with size scale (Noto Serif Display)
  16. feat(ui): PaperCard primitive (Surface + eyebrow + meta + body, CSS-only)
  17. feat(ui): SceneCard primitive (dark cinematic, CSS-only)
  18. feat(ui): Pill primitive (CSS transitions on hover/active, no Motion)
  19. feat(ui): Medallion primitive (gold circular badge)
  20. feat(ui): Toast primitive (Motion enter/exit, 3 tones)
  21. feat(ui): Dialog primitive (Radix + Motion + Noto Serif title)
  22. feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
  23. feat(ui): EmptyState primitive (artifact + title + body + action, CSS-only)
  24. feat(ui): export all 11 primitives from packages/ui index
  25. feat(ui): stories + tests for all 11 primitives (storybook/test, axe-clean)
  26. chore(ui): verify all primitives pass axe-core (light + dark)

PR 3: /status pilot (Phases 5+6) — 8 commits, ~3h
  27. feat(ui): 8 geometric SVG artifacts
  28. feat(ui): artifact metadata (SVG components + painterly path hints)
  29. feat(ui): 22-entry empty-state catalog with structured Bulgarian copy
  30. feat(ui): state-catalog storybook gallery
  31. feat(web): ArtifactImage wrapper (Next-aware, currently SVG-only)
  32. refactor(status): migrate service-health card to PaperCard + Display
  33. feat(status): adopt EmptyState primitive for outage states
  34. test(visual): update /status baselines + frontend-design polish

   ── GATE: wait for user approval before PR 4 ──

PR 4: Legal-shell sweep (Phase 7) — 6 commits, ~3h
  35. refactor(privacy): migrate hero + sections to SceneCard + PaperCard primitives
  36. refactor(terms): migrate hero + sections to primitives
  37. refactor(report): migrate hero + success state to primitives
  38. refactor(report): adopt Pill for primary CTA actions
  39. refactor(faq): migrate hero + section heads to primitives (accordion preserved)
  40. chore(pilots): legal-shell sweep — frontend-design review applied

PR 5: Docs + acceptance + finalization (Phases 8+9+10) — 6 commits, ~2h
  41. docs: per-page acceptance criteria for all 17 routes
  42. docs: acceptance criteria index and policy
  43. docs(ui): Introduction MDX with system overview
  44. docs(ui): per-primitive MDX cheatsheets (11 files)
  45. test(visual): per-primitive Playwright suite + baselines (light + dark)
  46. docs(agents): document design system, dictionary, acceptance — final adoption notes

OPTIONAL PR 6: Painterly imagen polish (Phase 11) — 3 commits, ~1h
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

# §14 — Failure modes (key additions over v2)

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

- `storybook/test` is the SB10 built-in. If it's not resolved:
  1. Check `storybook` version: must be `^10.4.1`
  2. Check tsconfig: ensure `moduleResolution: "Bundler"` to honor SB10's exports
  3. Fall back: import from `@testing-library/react` directly for non-interaction tests

## §14.3 — Tailwind `@theme` not generating utilities

- Verify Tailwind v4.2.4 in `apps/web/package.json`
- Verify `@tailwindcss/postcss` in `postcss.config.*` (already there)
- Tokens still work as plain CSS variables even if @theme doesn't generate utilities — fall back to `style={{ background: "var(--ds-surface-paper)" }}`

---

# §15 — Notes for ChatGPT 5.5 x-high / Codex

1. **React-only purity of `packages/ui`**. Zero Next imports. Zero `next/image`, `next/link`, `next/router`. If a primitive needs an image, it returns the bare element and lets `apps/web` wrap.
2. **Motion is precious**. Only 3 primitives import `motion/react`: Dialog, Sheet, Toast. Verify with grep after Phase 4.
3. **`@theme` in app only**. `packages/ui/tokens.css` is plain CSS. `apps/web/app/globals.css` bridges.
4. **PR 3 is the gate**. Don't queue PR 4 work until PR 3 lands + user explicitly approves /status visual diff.
5. **PR 6 is optional**. Don't run imagen unless user opts in. The geometric SVGs ARE the production artifacts in v3 baseline.
6. **`storybook/test` for interactions**. Don't add `@storybook/test` as a dep; it's the wrong package for SB10.
7. **AGENTS.md update — only in PR 5**. Don't touch in PR 1-4.
8. **`frontend-design` skill at 3 checkpoints**: Phase 4 end (API), Phase 6 end (/status review), Phase 10 (holistic). Apply highest-impact recommendations only.
9. **`bg-copy-reviewer` agent after every commit** with user-facing strings — don't batch.
10. **No font loads in production from new sources.** Storybook preview's Google Fonts import is dev-only.

---

# §16 — Sources

- [motion - npm](https://www.npmjs.com/package/motion) — Motion v12.40.0
- [Motion: JavaScript & React animation library](https://motion.dev/) — official docs
- [Framer Motion Becomes Independent: Introducing Motion](https://fireup.pro/news/framer-motion-becomes-independent-introducing-motion) — rebrand context
- [Storybook React-Vite framework docs](https://storybook.js.org/docs/get-started/install) — 10.4 setup
- [`storybook/test` built-in](https://storybook.js.org/docs/writing-tests/test-runner) — SB10 testing API
- [Radix UI react-dialog 1.1.15](https://www.npmjs.com/package/@radix-ui/react-dialog)
- [Tailwind CSS v4 @theme directive](https://tailwindcss.com/docs/theme)
- [Path Б architecture review feedback (this conversation, 2026-05-23)](docs/frontend-audit-v3/codex-prompt-hybrid-redesign-adoption-v2-final.md)

---

(End of master prompt)
