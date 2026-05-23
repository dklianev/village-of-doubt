# Design tokens - `--ds-*` namespace

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

## Radii rationale

`--ds-radius-card: 8px` and `--ds-radius-tile: 6px` are deliberately tight per
project frontend rules. The `/redesign/tokens.html` spec proposed 22/14, which
is more parchment-cardy. We chose tighter radii for portability: primitives
must work in non-parchment contexts, such as future utility pages.

If a specific page needs the parchment look, it can wrap a primitive with a
`style={{ borderRadius: "22px" }}` override or define a page-local class.

## Theme override

`html[data-theme="dark"]` overrides `--ds-surface-*` and `--ds-ink-*`. Accents
are theme-invariant.

## Tailwind bridge - in app, not in UI package

The `@theme { --color-ds-paper: var(--ds-surface-paper); ... }` block lives in
`apps/web/app/globals.css`, not here. Reason: the Tailwind pipeline runs in the
app, and `packages/ui` stays Tailwind-agnostic for portability.

## Migration policy

Legacy hex tokens (`--ink`, `--paper`, `--blood`, etc.) in
`apps/web/app/globals.css` serve the existing CSS surface. They are not
replaced. The `--ds-*` tokens live in `packages/ui/src/tokens.css` and are
imported into `apps/web/app/globals.css`.

New primitives consume `--ds-*`. Existing components keep their legacy tokens
until a per-component migration PR.

## WCAG check

- `--ds-ink-primary` on `--ds-surface-paper`: 10.4:1 AAA
- `--ds-ink-soft` on `--ds-surface-paper`: 5.8:1 AA
- `--ds-ink-faint` on `--ds-surface-paper`: 3.6:1, large text only
- `--ds-ink-scene` on `--ds-surface-scene`: 12.1:1 AAA
- `--ds-ink-scene-soft` on `--ds-surface-scene`: 7.2:1 AA
- `--ds-accent-blood` on `--ds-surface-paper`: 4.5:1 AA
