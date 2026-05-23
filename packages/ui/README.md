# @werewolf/ui

React-only design system for Върколак · Мафия. No Next.js coupling.

## Quick start

```css
@import "@werewolf/ui/tokens.css";
```

```tsx
import { Surface, PaperCard, Pill } from "@werewolf/ui";
```

Use server-safe primitives from Server Components:

```tsx
import { Display, PaperCard, SceneCard } from "@werewolf/ui/server";
```

`Sheet` includes its required layout styles at runtime. `@werewolf/ui/styles/pill.css`
is optional for hover/active polish; disabled state styling is built into `Pill`.

## Commands

- `pnpm --filter @werewolf/ui storybook` - Dev server on port 6006
- `pnpm --filter @werewolf/ui build` - Production library build
- `pnpm --filter @werewolf/ui test` - Vitest
- `pnpm --filter @werewolf/ui build-storybook` - Static Storybook build

From root: `pnpm ui:dev`, `pnpm ui:build`, `pnpm ui:storybook:build`.
