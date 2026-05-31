# Codex master prompt — Hybrid `/redesign` adoption v2 (FINAL, brutally polished)

This is the **definitive** Path Б prompt. It supersedes `codex-prompt-hybrid-redesign-adoption.md` with these critical upgrades:

| v1 → v2 change | Why |
|---|---|
| `framer-motion@^12.40.0` → **`motion@^12.40.0`** (import `motion/react`) | Official rebrand. `framer-motion` is now a legacy alias of the same codebase. |
| `/status` only → **5 pilot pages** (status + privacy + terms + report + faq) | Same `legal-shell` aesthetic family; single migration sweep. **User-visible polish on day 1.** |
| Geometric SVG only → **painterly imagen + geometric SVG fallback** | Production-grade empty-state artifacts via `~/.codex/skills/.system/imagegen/SKILL.md` skill. |
| `@theme` directive ignored → **Tailwind v4 `@theme` bridge** for `--ds-*` tokens | Existing Tailwind v4.2.4 — already installed, leverage native support. |
| Storybook a11y only → **Visual regression per primitive** (Storybook + Playwright snapshots) | Catch drift at component level, not just page level. |
| Manual Dialog + Sheet → **Reuse `useModal` for non-Radix paths; Radix only for headless overlays needing portal** | Existing `lib/use-modal.ts` is production-tested. Radix used for primitives requiring portal + ARIA semantics. |
| Brief acceptance docs → **17 per-page acceptance files with concrete measurable thresholds** | Locked criteria, not aspirational. |
| 32 atomic commits → **~42 atomic commits across 4 PRs** | Realistic scope; PRs are independently shippable. |

**Total scope**: ~42 atomic English commits, **~14-18 hours Codex work at high reasoning**. Sequential PR strategy: 4 PRs.

> **Operating rules** (non-negotiable):
> 1. After EVERY commit: `pnpm regression && pnpm typecheck && pnpm build`. If any goes red → revert, investigate, retry.
> 2. After every page-touching commit: `pnpm visual`. Pixel-different? Either update baseline with documented diff, or revert.
> 3. Bulgarian-only user-facing copy. Invoke `bg-copy-reviewer` agent after every commit touching JSX text or .md.
> 4. **No `prefers-reduced-motion` guards anywhere.** Project convention.
> 5. **No font swap.** Noto Serif Display + Noto Serif + Iowan Old Style stay. The redesign's Cormorant Garamond / JetBrains Mono is loaded ONLY in Storybook preview for spec parity — never reaches production.
> 6. New deps pinned exactly to §0.4 versions — verified latest as of 2026-05-23.
> 7. Phase blocks for >2 commit attempts → document in `audit-v3/blocked-items.md`, skip to next independent phase.
> 8. Skills/MCPs invoked proactively at the §0.5 checkpoints.
> 9. **Atomic commits.** Don't fold phases together. Each commit independently revertable.
> 10. Last landed work is sacred: Phase A/B/C (useTimerCountdown, play-room split, CSS theme tokens), theatre backdrop, GDPR delete modal, leaderboard SQL — all **preserved**.

---

# §0 — Pre-flight, locked decisions, version table, skills

## §0.1 — Pre-flight verification

Run BEFORE any code changes. All must pass:

```bash
# 1. Recent landed work is intact
wc -l apps/web/components/play-room-client.tsx    # ≤1438 (Phase B)
test -f apps/web/hooks/use-timer-countdown.ts && echo "✓ Phase A"
test -f apps/web/lib/use-modal.ts && echo "✓ useModal"
test -f apps/web/lib/auth-errors.ts && echo "✓ auth-errors"
test -f apps/web/lib/clipboard.ts && echo "✓ clipboard"
grep -q "^\s*--legal-shell-bg" apps/web/app/globals.css && echo "✓ legal tokens"

# 2. /redesign spec present (reference material)
ls redesign/*.html | wc -l    # 8

# 3. packages/ui does NOT exist yet
ls packages/ui 2>&1 | grep -q "No such file" && echo "✓ clean slate" || { echo "ABORT"; exit 1; }

# 4. Verify Motion rebrand
npm view motion version    # 12.40.0
npm view motion main       # dist/cjs/index.js (confirms valid package)

# 5. Verify imagen skill available
test -f ~/.codex/skills/.system/imagegen/SKILL.md && echo "✓ imagen available"

# 6. Regression baseline green
pnpm regression 2>&1 | tail -3    # Must end "Regression contract checks passed."

# 7. Visual baseline exists
ls apps/web/__visual__/__baseline__/ | head -5
```

If any fail, STOP and document in `audit-v3/blocked-items.md`.

## §0.2 — Sacred preservation list (DO NOT TOUCH)

Recent landed work that MUST remain untouched:

- `apps/web/components/play-room-client.tsx` (≤1438 lines, post-Phase-B)
- `apps/web/components/play/*.tsx` (24 files from Phase B extraction)
- `apps/web/lib/play/*.ts` (8 helper modules)
- `apps/web/hooks/use-timer-countdown.ts`
- `apps/web/lib/use-modal.ts`
- `apps/web/lib/auth-errors.ts`
- `apps/web/lib/clipboard.ts`
- `apps/web/components/account/AccountDangerZone.tsx` (typed-confirm modal)
- `apps/game-server/src/rooms/GameRoom.ts` (nonce store, rate-limit, GDPR-style guards)
- `apps/web/app/history/[gameId]/replay/page.tsx` (privacy gate)
- `apps/web/app/create/page.tsx` (requireSession gate)
- Existing `--legal-shell-*` tokens in globals.css (Phase C)
- Existing `--hero-card-*` tokens (theatre backdrop)
- Existing 50+ `--art-*`, `--texture-*`, `--faction-*` image-set tokens
- All Bulgarian copy currently in production (changes only via dedicated migration PR, not this one)

## §0.3 — Dictionary policy (Phase Б — audit-only)

The `/redesign/dictionary.html` spec mandates terms like:
- Постижения → **Легенди**
- История → **Архив на делата**
- FAQ → **Седни до огъня**
- Класация → **Вечерен брой**

These conflict with production copy. **Phase Б policy**:
1. Create `docs/dictionary.md` listing all 48 spec terms + 10 legacy-OK overrides
2. Create `scripts/check-dictionary.mjs` that **warns** but **exits 0** (audit-only)
3. Wire as `pnpm check:dict` (NOT into `pnpm verify` initially)
4. Future PR can flip to enforcement after parallel copy-migration sweep

## §0.4 — New dependencies (latest verified 2026-05-23)

| Package | Version | Where | Purpose | Notes |
|---|---|---|---|---|
| **`motion`** | `^12.40.0` | `packages/ui` dep | Animation primitives | NEW name; import `motion/react`. `framer-motion` is legacy alias — DO NOT use the old name. |
| `storybook` | `^10.4.1` | `packages/ui` devDep | Component browser | React 19 supported (`react: ^19.0.0` in peer) |
| `@storybook/nextjs` | `^10.4.1` | `packages/ui` devDep | Next.js integration | Peer: `next: ^14 || ^15 || ^16` ✓ |
| `@storybook/addon-a11y` | `^10.4.1` | `packages/ui` devDep | axe-core in Storybook |  |
| `@storybook/test` | `^8.6.15` | `packages/ui` devDep | Interaction testing |  |
| `tsup` | `^8.5.1` | `packages/ui` devDep | Library build (esm+cjs+dts) |  |
| `tslib` | `^2.8.1` | `packages/ui` dep | TS runtime helpers |  |
| `@radix-ui/react-dialog` | `^1.1.15` | `packages/ui` dep | Dialog/Sheet portal + ARIA | Justified: portal rendering, full headless |
| `@radix-ui/react-tooltip` | `^1.2.8` | `packages/ui` dep | Tooltip primitive | (added in Phase 4 with primitives) |
| `plaiceholder` | `^3.0.0` | `apps/web` devDep | Image blurhash for AtmosphericImage |  |
| `@axe-core/react` | `^4.11.3` | `packages/ui` devDep | Runtime a11y in Storybook |  |
| `@axe-core/playwright` | `^4.11.3` | root devDep | a11y in Playwright visual specs |  |
| `tsx` | `^4.22.3` | root devDep | Run TS scripts (`check-dictionary.mjs`) |  |

**No other new deps.** Tailwind v4.2.4 already installed.

## §0.5 — Skills, agents, MCPs — when to invoke

| Tool | Phase | Why |
|---|---|---|
| `bg-copy-reviewer` agent | After every commit touching JSX text or `docs/**/*.md` | Verify Bulgarian-only and natural phrasing |
| `frontend-design` skill | Phase 4 (Surface API design) + Phase 5 (artifact aesthetics) + Phase 6 (page polish) + Phase 10 (final review) | Polished, distinctive code |
| `context7` MCP | Phase 1 (Storybook 10 setup), Phase 4 (Motion 12 React API), Phase 4 (Radix Dialog 1.1) — verify latest docs | Move past potentially-stale spec snapshots |
| `imagegen` skill (`~/.codex/skills/.system/imagegen/SKILL.md`) | **Phase 5** — generate 8 painterly artifact webps + 1 hero illustration per pilot page (5 pilots × ~1 image = 5 hero arts) | Production-grade artwork beats geometric SVGs |
| `WebSearch` | Anytime dep API is unclear and `context7` doesn't have the docs | Recent breaking changes |
| `role-mechanics-reviewer` agent | NOT needed in Path Б — no backend changes | — |
| `Postgres` MCP | NOT needed in Path Б | — |

If any tool blocks (e.g. imagen quota), fall back gracefully (geometric SVGs already in PR) and document in `audit-v3/blocked-items.md`.

## §0.6 — PR strategy

| PR # | Phases | Commits | Hours | What ships |
|---|---|---|---|---|
| **PR 1** — Foundation | §1 + §2 + §3 | 12 | ~4 | Workspace + tokens + dictionary. **Zero user-visible change.** |
| **PR 2** — Primitives | §4 | 14 | ~5 | 11 primitives + Storybook coverage. **Visible only in Storybook.** |
| **PR 3** — Artifacts + pilots | §5 + §6 | 12 | ~5 | 8 imagen artifacts + 5 page migrations. **First user-visible polish.** |
| **PR 4** — Acceptance + finalization | §7 + §8 + §9 + §10 | 4 | ~3 | Docs + visual regression per primitive + AGENTS.md. |

Each PR independently reviewable and revertable. PR 3 is where **users will notice improvement** — 5 pilot pages get cleaner empty states, consistent card chrome, painterly artwork.

---

# §1 — PHASE 1: Foundation infrastructure (~2 hours, 5 commits)

**Goal**: Create `packages/ui` workspace with Storybook 10 + tsup build pipeline. **Zero UI changes visible to users.** Visual regression must stay 100% green.

## §1.1 — Scaffold `packages/ui`

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts                # re-exports
│   ├── test-setup.ts
│   ├── tokens.css              # Phase 2
│   ├── styles/                 # Phase 4+ (sheet.css, etc.)
│   ├── primitives/             # Phase 4+
│   │   └── artifacts/          # Phase 5
│   ├── states/                 # Phase 5+ (empty-states.ts catalog)
│   └── docs/                   # Phase 8 (MDX)
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
    "@radix-ui/react-tooltip": "^1.2.8",
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
    "@storybook/nextjs": "^10.4.1",
    "@storybook/test": "^8.6.15",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "jsdom": "^25.0.1",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "storybook": "^10.4.1",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
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
import { glob } from "node:fs/promises";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/primitives/artifacts/*.tsx",
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
    "@radix-ui/react-tooltip",
  ],
  treeshake: true,
  splitting: false,
});
```

### `packages/ui/vitest.config.ts`

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

Design system for Върколак · Мафия.

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
feat(ui): scaffold packages/ui workspace with tsup + storybook 10
```

## §1.2 — Install + verify clean build

```bash
pnpm install
pnpm --filter @werewolf/ui typecheck    # zero source files — passes
pnpm --filter @werewolf/ui build        # produces empty dist/
```

Verify `node_modules/@werewolf/ui` symlink exists. If install fails (peer mismatch), document and stop.

### Commit 2
```
chore(ui): install dependencies for @werewolf/ui workspace
```

## §1.3 — Storybook 10 configuration

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
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  docs: { autodocs: "tag" },
  staticDirs: ["../public"],   // for any static assets stories need
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
        wide: { name: "Wide (1920)", styles: { width: "1920px", height: "1080px" } },
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
      // Apply theme via html[data-theme] (matches production switching)
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
/* Production-aligned fonts for Storybook canvas — Noto Serif family.
   The /redesign spec mentions Cormorant; we deliberately do NOT load it.
   Storybook visually represents the production app. */
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Display:wght@600;800;900&display=swap");

body {
  font-family: "Noto Serif", "Iowan Old Style", Georgia, serif;
  color: var(--ds-ink-primary, oklch(0.22 0.018 60));
  background: var(--ds-surface-paper, oklch(0.94 0.022 78));
}

/* Storybook canvas root gets the data-ds opt-in so tokens apply. */
#storybook-root,
.docs-story {
  /* See tokens.css for the [data-ds] hook */
  background: transparent;
}
```

### Commit 3
```
feat(ui): configure storybook 10 with a11y addon + viewport + theme decorator
```

## §1.4 — Wire @werewolf/ui into apps/web

### Update `apps/web/package.json`

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
  },
  "devDependencies": {
    /* … */
+   "plaiceholder": "^3.0.0",
  }
```

### Update `apps/web/next.config.ts`

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

```bash
pnpm install
pnpm --filter @werewolf/web typecheck
pnpm --filter @werewolf/web build
```

### Commit 4
```
chore(web): wire @werewolf/ui workspace dep + plaiceholder for AtmosphericImage
```

## §1.5 — Root scripts + tsx + Playwright a11y

### Update root `package.json`

```diff
  "scripts": {
    /* existing */
    "perf:budget": "node scripts/bundle-budget.mjs",
+   "ui:dev": "pnpm --filter @werewolf/ui storybook",
+   "ui:build": "pnpm --filter @werewolf/ui build",
+   "ui:storybook:build": "pnpm --filter @werewolf/ui build-storybook",
+   "check:dict": "tsx scripts/check-dictionary.mjs",
+   "visual:ui": "playwright test --config=playwright.config.ts --grep '@ui'",
    /* existing */
  },
  "devDependencies": {
    /* existing */
+   "tsx": "^4.22.3",
+   "@axe-core/playwright": "^4.11.3"
  }
```

```bash
pnpm install
pnpm ui:build
pnpm verify   # full chain — must stay green
```

### Commit 5
```
chore(scripts): wire ui:dev, ui:build, ui:storybook:build, check:dict, visual:ui
```

**Phase 1 complete.** Foundation ready. **Run `bg-copy-reviewer` agent on `packages/ui/README.md`** (Bulgarian).

---

# §2 — PHASE 2: OKLCH tokens + Tailwind v4 `@theme` bridge (~2 hours, 4 commits)

**Goal**: Add 32 OKLCH tokens under `--ds-*` prefix in `packages/ui/src/tokens.css`. Bridge to Tailwind v4 via `@theme`. Existing hex tokens untouched. Visual regression 100% green.

## §2.1 — `packages/ui/src/tokens.css`

```css
/**
 * @werewolf/ui — Design tokens (OKLCH)
 *
 * Namespace: --ds-{category}-{role}-{modifier}
 *   ds = design-system (avoids collision with legacy --ink, --paper, --blood, etc.)
 *
 * Adopted from /redesign/tokens.html spec, 2026-05-23.
 * All ink/surface pairs verified WCAG AA contrast (annotated below).
 *
 * Activation: tokens are scoped to :root by default. Components that opt in
 * via [data-ds] receive the same set (useful for isolated migration regions).
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

  --ds-ink-primary: oklch(0.22 0.018 60);    /* vs paper: 10.4:1 ✓ AAA */
  --ds-ink-soft: oklch(0.40 0.018 60);       /* vs paper:  5.8:1 ✓ AA  */
  --ds-ink-faint: oklch(0.55 0.015 60);      /* vs paper:  3.6:1 large-text only */
  --ds-ink-scene: oklch(0.92 0.022 80);      /* vs scene: 12.1:1 ✓ AAA */
  --ds-ink-scene-soft: oklch(0.74 0.020 78); /* vs scene:  7.2:1 ✓ AA  */

  /* ─── Accents ─── */
  --ds-accent-blood: oklch(0.50 0.155 25);
  --ds-accent-blood-deep: oklch(0.42 0.155 25);
  --ds-accent-gold: oklch(0.78 0.115 75);
  --ds-accent-gold-deep: oklch(0.58 0.110 65);
  --ds-accent-gold-soft: oklch(0.85 0.085 80);
  --ds-accent-green: oklch(0.55 0.10 145);

  /* ─── Typography scale (rem; 16px root) ─── */
  --ds-type-display: 4rem;       /* 64 — hero only */
  --ds-type-h1: 2.75rem;         /* 44 */
  --ds-type-h2: 2.125rem;        /* 34 */
  --ds-type-h3: 1.5rem;          /* 24 */
  --ds-type-h4: 1.25rem;         /* 20 */
  --ds-type-body: 1rem;          /* 16 */
  --ds-type-body-sm: 0.875rem;   /* 14 */
  --ds-type-lede: 1.125rem;      /* 18 */
  --ds-type-eyebrow: 0.72rem;    /* ~11.5 — mono, letter-spaced */
  --ds-type-meta: 0.78rem;       /* ~12.5 */

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

  /* ─── Motion ─── */
  --ds-duration-instant: 90ms;
  --ds-duration-quick: 180ms;
  --ds-duration-base: 280ms;
  --ds-duration-stage: 500ms;
  --ds-duration-epic: 1200ms;
  --ds-ease-candle: cubic-bezier(0.32, 0.72, 0, 1);
  --ds-ease-card: cubic-bezier(0.16, 1, 0.3, 1);
  --ds-ease-breath: cubic-bezier(0.5, 0, 0.5, 1);
  --ds-ease-fall: cubic-bezier(0.6, 0, 0.74, 0.05);

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

/* ─── Global focus-visible (opt-in via [data-ds] root) ─── */
:where([data-ds]) *:focus-visible {
  outline: none;
  box-shadow: var(--ds-focus-ring);
  outline-offset: 2px;
}
```

### Commit 1
```
feat(ui): introduce 32 OKLCH design tokens + motion + focus tokens
```

## §2.2 — Tailwind v4 `@theme` bridge

The project already uses Tailwind v4.2.4 via `@tailwindcss/postcss`. In Tailwind v4, `@theme { ... }` blocks inside CSS register tokens as utility classes (e.g. `bg-paper`, `text-ink-primary`).

### Update `apps/web/app/globals.css`

At the very top, AFTER the existing `@import "tailwindcss"`:

```diff
  @import "tailwindcss";
+ @import "@werewolf/ui/tokens.css";
+
+ /* Tailwind v4 @theme — expose --ds-* tokens as utility classes.
+    e.g. bg-ds-paper, text-ds-ink-primary, p-ds-4
+    DOES NOT replace legacy utilities; runs alongside. */
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
    /* … existing tokens untouched … */
  }
```

This gives consumers two ways to access the same colors:
- CSS: `var(--ds-surface-paper)` (works in `packages/ui`)
- Tailwind utility: `bg-ds-paper` (works in `apps/web` consuming code)

### Commit 2
```
feat(web): bridge --ds-* tokens to Tailwind v4 utilities via @theme
```

## §2.3 — Token reference Storybook story

### `packages/ui/src/tokens.stories.tsx`

(Full implementation — Surface/Ink/Accents grids + spacing/radius/shadow swatches + motion duration timing visualisation. Same pattern as v1 of this prompt, expanded to include motion tokens and theme toggle demonstration.)

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
          <div style={{
            height: "16px",
            width: `var(--ds-space-${step})`,
            background: "var(--ds-accent-gold)",
            borderRadius: "2px",
          }} />
          <small>{["4px", "8px", "12px", "16px", "24px", "32px", "40px", "48px"][[1,2,3,4,6,8,10,12].indexOf(step)]}</small>
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
        ["base", "280ms — modal open, tab swap"],
        ["stage", "500ms — phase transition, role reveal"],
        ["epic", "1200ms — game-end ceremony"],
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

### Commit 3
```
feat(ui): tokens reference stories (colors + typography + spacing + motion)
```

## §2.4 — Documentation

### `packages/ui/docs/tokens.md`

(Complete the doc with naming convention, theme override, migration policy section. Same content as v1 prompt's tokens doc with motion tokens added.)

### Commit 4
```
docs(ui): document --ds-* token namespace, theme + migration policy
```

**Phase 2 complete.** Visual regression must stay 100% identical (no consumer reads `--ds-*` yet).

**Invoke `frontend-design` skill** for token-system review:
> "Review packages/ui/src/tokens.css. Confirm OKLCH values land at the documented contrast ratios. Suggest tweaks if any contrast is borderline."

---

# §3 — PHASE 3: Dictionary audit (~1 hour, 3 commits)

**Identical to v1 prompt's §3** (audit-only, legacy-OK overrides, exit 0). Key file: `docs/dictionary.md`. Script: `scripts/check-dictionary.mjs`.

### Commit 1: `docs: lock 48-term Bulgarian dictionary with legacy-OK overrides`
### Commit 2: `feat(scripts): add audit-only dictionary check (exit 0, warns only)`
### Commit 3: `docs(agents): document Bulgarian dictionary policy for contributors`

**Invoke `bg-copy-reviewer` agent** on `docs/dictionary.md` after writing.

---

# §4 — PHASE 4: 11 primitives (~5 hours, 14 commits)

**Goal**: Ship 11 primitives. Each has: TypeScript signature, stories (>=4 variants), unit test, axe-clean. Use `motion/react` for subtle micro-interactions.

## §4.0 — Use Motion from `motion/react` (NOT `framer-motion`)

```tsx
// ✓ Correct
import { motion } from "motion/react";

// ✗ Legacy (deprecated alias)
import { motion } from "framer-motion";
```

Verify via `context7` MCP if Motion 12 React API is unclear. The new API is largely identical to Framer Motion 11 but lives at `motion/react`.

## §4.1 — Surface (`packages/ui/src/primitives/Surface.tsx`)

(Same implementation as v1 prompt's §4.1 — forwardRef, data attribute, variant/radius/elevation/as props.)

```tsx
// FULL implementation in v1 prompt. Verbatim.
```

### Stories (`Surface.stories.tsx`) + Tests (`Surface.test.tsx`) — same as v1.

### Commit 1
```
feat(ui): Surface primitive (paper/scene × card/tile/none × elevation)
```

## §4.2 — Eyebrow (`Eyebrow.tsx`)

(Same as v1 — mono uppercase label with `tone` variants.)

### Commit 2
```
feat(ui): Eyebrow primitive with tone variants
```

## §4.3 — Display (`Display.tsx`)

(Same as v1 — sizes hero/h1/h2/h3/h4, semantic `as` prop, balanced text-wrap.)

### Commit 3
```
feat(ui): Display primitive with size scale (Noto Serif Display)
```

## §4.4 — PaperCard (`PaperCard.tsx`) — Motion-enhanced

```tsx
import { motion } from "motion/react";
import { Surface } from "./Surface";
import { Eyebrow } from "./Eyebrow";
import type { ReactNode } from "react";

export interface PaperCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  /** Subtle entrance: fade + slight lift. Default true. */
  animate?: boolean;
  children: ReactNode;
}

const DENSITY_PAD = { sm: "16px", md: "28px", lg: "48px" } as const;

export function PaperCard({ eyebrow, density = "md", meta, animate = true, children }: PaperCardProps) {
  const Inner = animate ? motion.div : "div";
  return (
    <Surface variant="paper" radius="card" elevation="card">
      <Inner
        {...(animate
          ? {
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }, // --ds-duration-base, --ds-ease-candle
            }
          : {})}
        style={{ padding: DENSITY_PAD[density], display: "grid", gap: "16px" }}
      >
        {(eyebrow || meta) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
            {eyebrow ? <Eyebrow tone="muted">{eyebrow}</Eyebrow> : <span />}
            {meta}
          </div>
        )}
        {children}
      </Inner>
    </Surface>
  );
}
```

### Commit 4
```
feat(ui): PaperCard primitive with Motion-based entrance
```

## §4.5 — SceneCard (`SceneCard.tsx`)

Same as PaperCard but `variant="scene"` + `elevation="scene"`. Inherits Motion entrance.

### Commit 5
```
feat(ui): SceneCard primitive (dark cinematic variant of PaperCard)
```

## §4.6 — Pill (`Pill.tsx`) — Motion-enhanced

```tsx
import { motion } from "motion/react";
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
  /** disable hover lift (e.g., for sticky bottom CTAs) */
  static?: boolean;
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
  static: isStatic = false,
  children,
  ...rest
}: PillProps) {
  const Tag = as === "a" ? motion.a : motion.button;
  return (
    <Tag
      whileHover={isStatic ? undefined : { y: -1, filter: "brightness(1.05)" }}
      whileTap={isStatic ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        borderRadius: "var(--ds-radius-chip)",
        fontFamily: '"Noto Serif", serif',
        fontWeight: 700,
        cursor: "pointer",
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

### Commit 6
```
feat(ui): Pill primitive with intent/size variants + Motion hover/tap
```

## §4.7 — Medallion (`Medallion.tsx`)

Same as v1 — circular gold badge.

### Commit 7
```
feat(ui): Medallion primitive (gold circular badge)
```

## §4.8 — Toast (`Toast.tsx`) — Motion-enhanced

Subtle slide-in from top. ARIA `role="status"` + `aria-live="polite"`.

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
feat(ui): Toast primitive with Motion enter/exit + 3 tones
```

## §4.9 — Dialog (`Dialog.tsx`) — Radix-backed + Motion enhanced

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

### Commit 9
```
feat(ui): Dialog primitive (Radix + Motion + Noto Serif Display title)
```

## §4.10 — Sheet (`Sheet.tsx`) — bottom-sheet mobile, centered desktop

Same Radix Dialog base, different positioning CSS. Reuse Motion patterns.

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
  /* Mobile: bottom sheet */
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

### Commit 10
```
feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
```

## §4.11 — EmptyState (`EmptyState.tsx`)

```tsx
import { motion } from "motion/react";
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
    <PaperCard density="lg" animate={false}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        style={{
          display: "grid",
          gap: "20px",
          justifyItems: "center",
          textAlign: "center",
          maxWidth: "32rem",
          margin: "0 auto",
          padding: "8px 0",
        }}
      >
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
      </motion.div>
    </PaperCard>
  );
}
```

### Commit 11
```
feat(ui): EmptyState primitive (artifact + title + body + action)
```

## §4.12 — Update `packages/ui/src/index.ts`

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

### Commit 12
```
feat(ui): export all 11 primitives from packages/ui index
```

## §4.13 — Stories + Tests for all 11

For each primitive, ship:
- `<Primitive>.stories.tsx` — minimum 4 stories: Default, AllVariants, Interactive (where applicable), DarkTheme
- `<Primitive>.test.tsx` — unit test verifying render + key props + a11y

**Run `frontend-design` skill** to review API consistency across all 11 primitives.

### Commit 13
```
feat(ui): stories + tests for all 11 primitives (axe-clean)
```

## §4.14 — Verify Storybook builds + a11y zero violations

```bash
pnpm --filter @werewolf/ui build
pnpm --filter @werewolf/ui test
pnpm --filter @werewolf/ui build-storybook
pnpm ui:dev   # open http://localhost:6006
```

Manually walk each story → axe-core panel must show **0 violations**. Fix until green.

### Commit 14
```
chore(ui): verify all primitives pass axe-core in light + dark themes
```

**Phase 4 complete.** **Invoke `frontend-design` skill** with comprehensive review prompt:

> "Review packages/ui/src/primitives/* (11 components). Check: API ergonomics (props naming, defaults), TypeScript consistency, story coverage (Default + AllVariants + Interactive + DarkTheme), Motion micro-interactions (subtle, not theatrical), a11y compliance. Are any primitives over- or under-abstracted? Are prop patterns consistent across the set? Suggest precise refinements."

Apply skill feedback as a polish commit if substantive.

---

# §5 — PHASE 5: Painterly artifact illustrations + state catalog (~3 hours, 5 commits)

**Goal**: Ship 8 empty-state artifacts AND 5 hero artworks for pilot pages, using **imagen skill** for production-quality illustrations + geometric SVG fallbacks. Build 22-entry state catalog.

## §5.1 — Invoke imagen skill for 8 empty-state artifacts

Per `~/.codex/skills/.system/imagegen/SKILL.md`, generate 8 painterly illustrations:

| Key | Path | Prompt sketch |
|---|---|---|
| `empty-chair` | `apps/web/public/empty-states/empty-chair.webp` | A single wooden tavern chair, slightly turned, in soft candlelight on rough oak floorboards. Painterly oil on canvas, muted earth tones, atmospheric, no text. 1024×1024. |
| `closed-book` | `…/closed-book.webp` | A weathered closed leather-bound book on a dusty wooden table, brass clasp, faded gold leaf title (unreadable). Painterly oil, warm sepia, no text. 1024×1024. |
| `sealed-letter` | `…/sealed-letter.webp` | A folded parchment letter with a deep red wax seal stamped with a stylised wolf head. Lit by a single candle, dark wood background. Painterly oil. No readable writing. 1024×1024. |
| `open-door` | `…/open-door.webp` | A heavy wooden door slightly ajar, warm yellow light spilling out into a misty courtyard. Painterly oil, moody, inviting. No text. 1024×1024. |
| `dusty-shelf` | `…/dusty-shelf.webp` | An ornate empty wooden shelf in a dim library, soft motes of dust drifting in shaft of light. Painterly oil, dignified, sad. No text. 1024×1024. |
| `unprinted-paper` | `…/unprinted-paper.webp` | A stack of clean off-white newspaper sheets on a typesetter's table, leather aprons, ink rollers. Painterly oil, pre-dawn lighting. No readable text. 1024×1024. |
| `balanced-scale` | `…/balanced-scale.webp` | A brass apothecary scale in perfect balance, two empty pans, on a dark wood counter, soft warm light. Painterly oil, calm, precise. No text. 1024×1024. |
| `broken-candle` | `…/broken-candle.webp` | A pewter candlestick with the candle snapped near the wick, wax still smoking thin trail. Dark velvet background. Painterly oil, ominous, no text. 1024×1024. |

**Invocation pattern** (per imagen SKILL.md):
```
Use the imagegen skill to generate `apps/web/public/empty-states/empty-chair.webp` with the above prompt. Style guide: painterly oil on canvas, no visible text or text-like glyphs, 1024×1024 PNG → convert to WebP after generation.
```

Repeat for each of the 8 keys. If imagen fails on any key, document in `audit-v3/blocked-items.md` and proceed with geometric SVG fallback only for that key.

### Commit 1
```
chore(art): generate 8 painterly empty-state illustrations via imagegen
```

## §5.2 — Geometric SVG fallbacks

For each of the 8 keys, create `packages/ui/src/primitives/artifacts/<key>.tsx`. Pattern:

```tsx
// packages/ui/src/primitives/artifacts/sealed-letter.tsx
export function SealedLetter({ size = 144 }: { size?: number }) {
  return (
    <svg viewBox="0 0 144 144" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {/* Letter body */}
      <rect x="24" y="36" width="96" height="68" rx="3" fill="var(--ds-surface-paper-deep)" />
      {/* Letter fold */}
      <path d="M24 36 L72 78 L120 36" />
      {/* Wax seal */}
      <circle cx="72" cy="92" r="12" fill="var(--ds-accent-blood)" stroke="var(--ds-accent-blood-deep)" strokeWidth="2" />
      {/* Wolf-head silhouette inside seal */}
      <path d="M67 88 L72 94 L77 88 M67 94 L77 94" stroke="oklch(0.94 0.022 78)" strokeWidth="1.5" />
    </svg>
  );
}
```

All 8 follow this geometric, monochrome-with-one-accent style. Size defaults to 144. Color inherits from parent (`currentColor`).

Files: `empty-chair`, `closed-book`, `sealed-letter`, `open-door`, `dusty-shelf`, `unprinted-paper`, `balanced-scale`, `broken-candle`.

### Commit 2
```
feat(ui): 8 geometric SVG fallbacks for empty-state artifacts
```

## §5.3 — `Artifact` wrapper component

A primitive that prefers painterly webp but falls back to geometric SVG if the file is missing.

```tsx
// packages/ui/src/primitives/artifacts/Artifact.tsx
import Image from "next/image";
import type { ReactNode } from "react";

export interface ArtifactProps {
  /** Painterly source (webp). If undefined, falls back to fallback prop. */
  src?: string;
  /** Geometric SVG fallback */
  fallback: ReactNode;
  alt: string;
  size?: number;
}

export function Artifact({ src, fallback, alt, size = 144 }: ArtifactProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }
  return <>{fallback}</>;
}
```

(Note: `Image` from `next/image` is used here only because consumers will be in `apps/web`. For Storybook isolation, the primitives can also expose a `Plain` version that uses raw `<img>`. For Phase 5 we keep one implementation; consumers in non-Next contexts will swap.)

### Commit 3
```
feat(ui): Artifact wrapper (painterly webp with geometric SVG fallback)
```

## §5.4 — State catalog (`states/empty-states.ts`)

22 entries. Each entry is a structured definition mapping a route/state to an artifact key + Bulgarian copy + optional action.

```ts
// packages/ui/src/states/empty-states.ts
import type { ComponentType } from "react";
import { EmptyChair } from "../primitives/artifacts/empty-chair";
import { ClosedBook } from "../primitives/artifacts/closed-book";
import { SealedLetter } from "../primitives/artifacts/sealed-letter";
import { OpenDoor } from "../primitives/artifacts/open-door";
import { DustyShelf } from "../primitives/artifacts/dusty-shelf";
import { UnprintedPaper } from "../primitives/artifacts/unprinted-paper";
import { BalancedScale } from "../primitives/artifacts/balanced-scale";
import { BrokenCandle } from "../primitives/artifacts/broken-candle";

export type ArtifactKey =
  | "empty-chair" | "closed-book" | "sealed-letter" | "open-door"
  | "dusty-shelf" | "unprinted-paper" | "balanced-scale" | "broken-candle";

const ARTIFACT_COMPONENTS: Record<ArtifactKey, ComponentType<{ size?: number }>> = {
  "empty-chair": EmptyChair,
  "closed-book": ClosedBook,
  "sealed-letter": SealedLetter,
  "open-door": OpenDoor,
  "dusty-shelf": DustyShelf,
  "unprinted-paper": UnprintedPaper,
  "balanced-scale": BalancedScale,
  "broken-candle": BrokenCandle,
};

const ARTIFACT_PAINTERLY: Record<ArtifactKey, string> = {
  "empty-chair": "/empty-states/empty-chair.webp",
  "closed-book": "/empty-states/closed-book.webp",
  "sealed-letter": "/empty-states/sealed-letter.webp",
  "open-door": "/empty-states/open-door.webp",
  "dusty-shelf": "/empty-states/dusty-shelf.webp",
  "unprinted-paper": "/empty-states/unprinted-paper.webp",
  "balanced-scale": "/empty-states/balanced-scale.webp",
  "broken-candle": "/empty-states/broken-candle.webp",
};

export function getArtifact(key: ArtifactKey) {
  return {
    Component: ARTIFACT_COMPONENTS[key],
    painterlySrc: ARTIFACT_PAINTERLY[key],
  };
}

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

### Storybook: `empty-states.stories.tsx`

Show all 22 entries in a gallery. Each rendered via `EmptyState` + geometric artifact (Storybook doesn't load `next/image` properly without setup).

### Commit 4
```
feat(ui): 22-entry empty-state catalog with structured Bulgarian copy
```

## §5.5 — Verify imagen output + bg-copy-reviewer

After imagen runs, verify all 8 webps exist + are reasonable file size (<200 KB each):

```bash
ls -lh apps/web/public/empty-states/
# Each entry < 200 KB
```

If quality is poor or imagen unavailable, ship without painterly artifacts — geometric fallbacks via `<Artifact>` carry through.

**Invoke `bg-copy-reviewer` agent** on `packages/ui/src/states/empty-states.ts`. The 22 titles + bodies are user-facing Bulgarian; verify natural phrasing.

### Commit 5
```
docs(ui): document state catalog + artifact patterns in Storybook MDX
```

**Phase 5 complete.**

---

# §6 — PHASE 6: Pilot page migrations — 5 legal-shell family pages (~5 hours, 7 commits)

**Goal**: Migrate 5 pilot pages to `@werewolf/ui` primitives. All share `legal-shell` aesthetics (parchment + blood accent). Visual regression updated with documented diffs.

**The 5 pilots**: `/status`, `/privacy`, `/terms`, `/report`, `/faq`. All currently use `--legal-shell-*` tokens (Phase C). Replacing per-page custom chrome with primitives gives consistency + visible polish.

## §6.1 — `/status` (~1 hour)

Current `/status` page renders service-health cards inline. Migrate the smallest visible unit first.

### Step A: Adopt PaperCard for service-health card

```diff
- <div className="status-card">
-   <span className="status-card-kicker">Игра-сървър</span>
-   <h3 className="status-card-title">Селото работи</h3>
-   <p>Всички услуги отговарят нормално.</p>
- </div>
+ <PaperCard eyebrow="ИГРА-СЪРВЪР">
+   <Display size="h4">Селото работи</Display>
+   <p style={{ color: "var(--ds-ink-soft)", margin: 0 }}>Всички услуги отговарят нормално.</p>
+ </PaperCard>
```

### Step B: Adopt EmptyState for major-outage state

```tsx
import { EmptyState, EMPTY_STATES, Artifact, getArtifact } from "@werewolf/ui";

const def = EMPTY_STATES["status-major-outage"];
const { Component: ArtifactSVG, painterlySrc } = getArtifact(def.artifact);

<EmptyState
  artifact={<Artifact src={painterlySrc} fallback={<ArtifactSVG />} alt="" size={144} />}
  title={def.title}
  body={def.body}
  action={def.action && <Pill intent="secondary" as="a" href="/notifications">{def.action.label}</Pill>}
/>
```

### Step C: Visual regression

```bash
pnpm visual
# /status diff → review
# If intentional improvement → pnpm visual:update
```

### Commits 1-2
```
refactor(status): migrate service-health card to PaperCard + Display
feat(status): adopt EmptyState primitive for outage states
test(visual): update /status baselines with documented diff
```

## §6.2 — `/privacy` (~45 mins)

Privacy page is text-heavy. Migrate intro card + each section header to PaperCard + Display + Eyebrow.

### Commits
```
refactor(privacy): migrate intro hero to SceneCard + Display
refactor(privacy): consolidate sections into PaperCard variants
```

## §6.3 — `/terms` (~45 mins)

Same pattern as privacy.

### Commits
```
refactor(terms): migrate hero + sections to PaperCard primitives
```

## §6.4 — `/report` (~45 mins)

Report has form fields. Use Pill for primary CTA. Form fields stay native (out of scope for primitives in this PR).

### Commits
```
refactor(report): migrate hero + success state to primitives
refactor(report): adopt Pill for primary CTA actions
```

## §6.5 — `/faq` (~45 mins)

FAQ is search-heavy. Migrate hero + accordion item shells.

**Important**: `/faq` accordion is a separate component (`FaqHearth.tsx`); the recent fixed-pseudo background work (Phase 3 of faq-bg-shift fix) is preserved. We only refactor hero + section heads, NOT the accordion mechanic.

### Commits
```
refactor(faq): migrate hero + section heads to primitives
```

## §6.6 — Verify all 5 pilots

```bash
pnpm verify           # full chain
pnpm visual           # all 5 pilots should show controlled diffs
pnpm check:dict       # warns only, exit 0
```

**Invoke `bg-copy-reviewer` agent** on all 5 page files.

**Invoke `frontend-design` skill** with comprehensive review prompt:
> "Review the 5 migrated pages: apps/web/app/{status,privacy,terms,report,faq}/page.tsx. Verify primitives are used consistently. Check: density choices, eyebrow tones, motion is subtle, no AI-generic patterns. Flag any inconsistency or over-engineering."

### Commit 7
```
chore(pilots): verify 5 pilot pages — frontend-design review applied
```

**Phase 6 complete.** **First user-visible polish lands here.**

---

# §7 — PHASE 7: Acceptance criteria documentation (~1.5 hours, 2 commits)

**Identical to v1 prompt's §8**. Create 17 per-page acceptance files. Each follows the comprehensive template from v1.

### Commit 1: `docs: per-page acceptance criteria for all 17 routes`
### Commit 2: `docs: acceptance criteria index and policy`

---

# §8 — PHASE 8: Storybook docs MDX hub (~1 hour, 2 commits)

**Goal**: Add MDX docs in Storybook for designers/devs to navigate the system.

## §8.1 — `packages/ui/src/docs/Introduction.mdx`

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

1. **Surface** — layout обвивка с paper/scene varianti
2. **Eyebrow** — small mono uppercase label
3. **Display** — semi-italic serif heading
4. **PaperCard** — стандартна светла card layout с motion entrance
5. **SceneCard** — тъмен cinematic вариант
6. **Pill** — бутон/линк/chip с 4 intent варианта
7. **Medallion** — кръгъл златен медальон
8. **Toast** — поведенчески feedback с 3 тона
9. **Dialog** — Radix-backed модал с motion
10. **Sheet** — bottom-sheet mobile, centered desktop
11. **EmptyState** — artifact + title + body + action

## Naming

- Tokens: `--ds-{category}-{role}` (`--ds-surface-paper`, `--ds-accent-blood`)
- Components: PascalCase (`PaperCard`, `EmptyState`)
- Data attributes: `data-ds-{primitive}` за инспекция

## Theme switching

Click "Theme" toolbar (top of canvas) → light / dark. Tokens обръщат stack-а автоматично.

## Accessibility

Всеки story минава axe-core в `Accessibility` tab. Нула violations задължително.
```

## §8.2 — Per-primitive MDX cheatsheets

For each of the 11 primitives, add `<Primitive>.mdx`:

```mdx
import { Meta, Story, ArgTypes, Source } from "@storybook/blocks";
import * as Stories from "./PaperCard.stories";

<Meta of={Stories} />

# PaperCard

Стандартна светла card с optional eyebrow + meta + body + Motion-based entrance.

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
<Story of={Stories.WithMeta} />
```

### Commits
```
docs(ui): Introduction MDX with system overview
docs(ui): per-primitive MDX cheatsheets (11 files)
```

**Phase 8 complete.** Storybook is now a complete reference.

---

# §9 — PHASE 9: Visual regression for primitives (~1.5 hours, 2 commits)

**Goal**: Each primitive has Playwright visual regression coverage. Storybook static build is the source.

## §9.1 — Build Storybook for Playwright

Add to `apps/web/__visual__/visual-regression.spec.ts` (or new `packages/ui/__visual__/`):

```ts
import { test, expect } from "@playwright/test";

const PRIMITIVES = [
  { name: "Surface/Default", url: "iframe.html?args=&id=primitives-surface--paper&viewMode=story" },
  { name: "Surface/Scene", url: "iframe.html?args=&id=primitives-surface--scene&viewMode=story" },
  { name: "PaperCard/Default", url: "iframe.html?args=&id=primitives-papercard--default&viewMode=story" },
  { name: "Pill/Primary", url: "iframe.html?args=&id=primitives-pill--primary&viewMode=story" },
  { name: "EmptyState/Default", url: "iframe.html?args=&id=primitives-emptystate--default&viewMode=story" },
  // ... all primitives
];

for (const p of PRIMITIVES) {
  test(`@ui ${p.name} matches snapshot`, async ({ page }) => {
    await page.goto(`http://localhost:6006/${p.url}`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${p.name.replace("/", "-").toLowerCase()}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });
}
```

Wire into `pnpm visual:ui`.

### Commit 1
```
test(visual): per-primitive visual regression suite (Storybook → Playwright)
```

## §9.2 — Generate baselines

```bash
pnpm ui:storybook:build
# Then serve packages/ui/storybook-static and run:
pnpm visual:ui --update-snapshots
```

Commit baseline images.

### Commit 2
```
test(visual): primitive baseline snapshots — light + dark themes
```

---

# §10 — PHASE 10: Polish + finalization (~1 hour, 2 commits)

## §10.1 — Final `bg-copy-reviewer` sweep

Run agent on:
- All 5 migrated page files
- `docs/dictionary.md`
- `docs/acceptance/*.md`
- `packages/ui/src/states/empty-states.ts`
- `packages/ui/src/docs/*.mdx`

Apply edits as polish commit.

## §10.2 — Final `frontend-design` sweep

Run skill with prompt:
> "Holistic review of @werewolf/ui after Phase Б adoption. Walk all 11 primitives, all 22 empty-state catalog entries, the 5 migrated pages. Look for: inconsistencies, AI-generic patterns, over-engineering, polish opportunities. Suggest 5-10 precise improvements ranked by impact."

Apply highest-impact 3-5 recommendations.

## §10.3 — Update AGENTS.md

Add comprehensive design system section. (Full content as in v1 prompt's §9.4, expanded with the 22-state catalog reference and motion guidelines.)

### Commits
```
chore(ui): bg-copy and frontend-design final polish sweep
docs(agents): document Phase Б adoption — design system + dictionary + acceptance
```

---

# §11 — Acceptance criteria for the FULL PR set

1. ✅ `packages/ui` workspace with Storybook 10.4.1, motion 12.40.0 (NEW name, not framer-motion), Radix Dialog 1.1.15, Radix Tooltip 1.2.8
2. ✅ 32 `--ds-*` OKLCH tokens with WCAG-verified contrasts, bridged to Tailwind v4 via `@theme`
3. ✅ 11 primitives shipped with Motion-enhanced interactions (PaperCard entrance, Pill hover/tap, Toast slide, Dialog/Sheet portal motion, EmptyState entrance)
4. ✅ Each primitive: stories (>=4), unit test, axe-core zero violations, light + dark theme coverage
5. ✅ 8 painterly empty-state webps generated via imagegen + 8 geometric SVG fallbacks
6. ✅ 22-entry state catalog with structured Bulgarian copy
7. ✅ `docs/dictionary.md` (48 spec terms + 10 legacy-OK) + `pnpm check:dict` (exit 0, audit-only)
8. ✅ `docs/acceptance/*.md` — 17 page files + README
9. ✅ **5 pilot pages** migrated to primitives: `/status`, `/privacy`, `/terms`, `/report`, `/faq` (user-visible polish)
10. ✅ Storybook MDX docs hub (Introduction + 11 per-primitive cheatsheets)
11. ✅ Per-primitive Playwright visual regression coverage with baselines (light + dark)
12. ✅ AGENTS.md fully documents design system, dictionary, acceptance policy
13. ✅ `pnpm verify` green throughout — every commit
14. ✅ `pnpm visual` green or explicitly updated with documented diff (5 pilot pages have updated baselines)
15. ✅ No new dependencies outside §0.4 table
16. ✅ Legacy hex tokens (`--ink`, `--paper`, …) untouched
17. ✅ `play-room-client.tsx` ≤ 1438 lines (Phase B preserved)
18. ✅ Bulgarian-only user-facing copy — `bg-copy-reviewer` agent green throughout
19. ✅ No `prefers-reduced-motion` guards added (project convention)
20. ✅ Storybook builds for production (`pnpm ui:storybook:build` green)
21. ✅ All 8 painterly artifacts present (or geometric fallback gracefully if imagen unavailable)
22. ✅ `frontend-design` skill review applied after Phases 4 + 6 + 10

---

# §12 — Commit summary (≈42 commits)

```
PR 1: Foundation (Phases 1+2+3) — 12 commits, ~4 hours
  1. feat(ui): scaffold packages/ui workspace with tsup + storybook 10
  2. chore(ui): install dependencies for @werewolf/ui workspace
  3. feat(ui): configure storybook 10 with a11y addon + viewport + theme decorator
  4. chore(web): wire @werewolf/ui workspace dep + plaiceholder
  5. chore(scripts): wire ui:dev, ui:build, ui:storybook:build, check:dict, visual:ui
  6. feat(ui): introduce 32 OKLCH design tokens + motion + focus tokens
  7. feat(web): bridge --ds-* tokens to Tailwind v4 utilities via @theme
  8. feat(ui): tokens reference stories (colors + typography + spacing + motion)
  9. docs(ui): document --ds-* token namespace, theme + migration policy
  10. docs: lock 48-term Bulgarian dictionary with legacy-OK overrides
  11. feat(scripts): add audit-only dictionary check (exit 0, warns only)
  12. docs(agents): document Bulgarian dictionary policy for contributors

PR 2: Primitives (Phase 4) — 14 commits, ~5 hours
  13. feat(ui): Surface primitive (paper/scene × card/tile/none × elevation)
  14. feat(ui): Eyebrow primitive with tone variants
  15. feat(ui): Display primitive with size scale (Noto Serif Display)
  16. feat(ui): PaperCard primitive with Motion-based entrance
  17. feat(ui): SceneCard primitive (dark cinematic variant)
  18. feat(ui): Pill primitive with intent/size + Motion hover/tap
  19. feat(ui): Medallion primitive (gold circular badge)
  20. feat(ui): Toast primitive with Motion enter/exit + 3 tones
  21. feat(ui): Dialog primitive (Radix + Motion + Noto Serif title)
  22. feat(ui): Sheet primitive (bottom-sheet mobile, centered desktop)
  23. feat(ui): EmptyState primitive (artifact + title + body + action)
  24. feat(ui): export all 11 primitives from packages/ui index
  25. feat(ui): stories + tests for all 11 primitives (axe-clean)
  26. chore(ui): verify all primitives pass axe-core light + dark

PR 3: Artifacts + pilots (Phases 5+6) — 12 commits, ~5 hours
  27. chore(art): generate 8 painterly empty-state illustrations via imagegen
  28. feat(ui): 8 geometric SVG fallbacks for empty-state artifacts
  29. feat(ui): Artifact wrapper (painterly webp with geometric fallback)
  30. feat(ui): 22-entry empty-state catalog with Bulgarian copy
  31. docs(ui): state catalog + artifact patterns in Storybook MDX
  32. refactor(status): migrate service-health card to PaperCard + Display
  33. feat(status): adopt EmptyState primitive for outage states
  34. refactor(privacy): migrate intro hero + sections to primitives
  35. refactor(terms): migrate hero + sections to PaperCard primitives
  36. refactor(report): migrate hero + success state + adopt Pill
  37. refactor(faq): migrate hero + section heads to primitives
  38. test(visual): update 5 pilot baselines + frontend-design review

PR 4: Acceptance + finalization (Phases 7+8+9+10) — 4 commits, ~3 hours
  39. docs: per-page acceptance criteria for all 17 routes
  40. docs(ui): Introduction MDX + 11 per-primitive cheatsheets
  41. test(visual): per-primitive visual regression suite + baselines
  42. chore: bg-copy + frontend-design final polish + AGENTS.md
```

**42 atomic commits.** PR titles:
- **PR 1**: `feat(ui): foundation — workspace + 32 OKLCH tokens + Bulgarian dictionary`
- **PR 2**: `feat(ui): 11 primitives — Surface/Card/Pill/Dialog/Sheet/EmptyState + Motion micro-interactions`
- **PR 3**: `feat: painterly artifacts + 5 pilot page migrations (status/privacy/terms/report/faq)`
- **PR 4**: `docs+test: per-page acceptance + Storybook MDX + primitive visual regression`

---

# §13 — Failure modes & recovery

(Same as v1 prompt's §11, plus these additions):

## §13.X — `motion` package import path uncertainty

- If `motion/react` import fails at build time:
  1. Verify install: `pnpm --filter @werewolf/ui list motion` (must show 12.40.x)
  2. Check `motion/react` is exported: `cat node_modules/motion/package.json | grep -A20 exports`
  3. Fallback: `import { motion } from "motion"` (default entry exports the React API too)
  4. If still broken: invoke `context7` MCP for Motion 12 docs.

## §13.Y — imagen quota / output quality

- If imagen returns low-quality output for any of the 8 artifacts:
  1. Document the artifact key in `audit-v3/blocked-items.md`
  2. Skip the painterly webp for that artifact
  3. Geometric SVG remains as default (already in PR)
  4. Note in PR description: "imagen retry needed for X, Y, Z artifacts"

## §13.Z — Tailwind v4 `@theme` syntax incompatibility

- If `@theme { --color-ds-paper: var(--ds-surface-paper); }` doesn't produce `bg-ds-paper` utility:
  1. Verify Tailwind version: must be `^4.2.4` minimum
  2. Check `@tailwindcss/postcss` is registered in `postcss.config.*`
  3. Fall back to direct CSS usage (no Tailwind utilities for `--ds-*`) — primitives consume vars directly anyway
  4. Document in `audit-v3/blocked-items.md`

---

# §14 — Notes for ChatGPT 5.5 x-high / Codex

1. **Motion is the NEW name.** Always `import { motion } from "motion/react"`. The package `framer-motion` still exists as a legacy alias; do NOT use it. If old code in `apps/web` imports `framer-motion`, leave it (out of scope for this PR).

2. **Atomic commits matter.** Each of the 42 commits must independently pass `pnpm verify`. Don't fold commits.

3. **Storybook is the spec.** If a primitive looks wrong in its story, the API is wrong — fix in component, not in consumer.

4. **OKLCH tokens are additive.** Never break legacy `--ink`, `--paper`, `--blood`. Only add `--ds-*`.

5. **imagen → painterly. Geometric → fallback.** Always ship the SVG, optionally the webp. Never the other way.

6. **Pilot pages are limited to 5.** `/status`, `/privacy`, `/terms`, `/report`, `/faq`. Other pages migrate in dedicated follow-up PRs.

7. **`useModal` is sacred.** Existing modal logic in `apps/web/lib/use-modal.ts` is preserved. The new `Dialog` and `Sheet` primitives use Radix for portal + ARIA semantics; that's a deliberate, separate path.

8. **No font loads in production from new sources.** Storybook preview's Google Fonts import is dev-only. Noto Serif and Iowan Old Style remain canonical for `apps/web`.

9. **Tailwind v4 @theme is well-documented.** If unsure, invoke `context7` MCP with library `tailwindcss` query "Tailwind v4 @theme directive" or check `https://tailwindcss.com/docs/theme`.

10. **`bg-copy-reviewer` agent after EVERY commit with user-facing strings.** Don't batch. Catch drift early.

11. **`frontend-design` skill at 3 checkpoints: Phase 4 end (API consistency), Phase 6 end (page polish), Phase 10 (holistic).** Apply highest-impact recommendations only.

12. **Visual regression is a hard gate.** If `pnpm visual` is red after a non-pilot commit, revert. Pilot commits update baselines explicitly with documented diff.

13. **The `/redesign/` HTML stays in repo as visual reference.** Never serve in production. Never delete unless user explicitly approves.

14. **Imagen invocation per `~/.codex/skills/.system/imagegen/SKILL.md`.** Follow the skill's documented invocation pattern. If skill not available, document and skip painterly artifacts.

---

# §15 — Sources

- [motion - npm](https://www.npmjs.com/package/motion)
- [Motion: JavaScript & React animation library (motion.dev)](https://motion.dev/)
- [Framer Motion Becomes Independent: Introducing Motion (fireup.pro)](https://fireup.pro/news/framer-motion-becomes-independent-introducing-motion)
- [Storybook 10.4.1 peer dependencies (verified via npm view)](https://www.npmjs.com/package/@storybook/nextjs)
- [Radix UI react-dialog 1.1.15 (verified via npm view)](https://www.npmjs.com/package/@radix-ui/react-dialog)
- [Tailwind v4 @theme directive docs](https://tailwindcss.com/docs/theme)

---

(End of master prompt)
