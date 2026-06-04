# Design tokens - `--ds-*` namespace

Plain CSS variables in `packages/ui/src/tokens.css`.

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

## Hero banners via SceneCard background

`SceneCard` supports an optional `background` slot for hero images. Consumers
pass a CSS image source, usually an app-level `--art-*` token:

```tsx
<SceneCard
  eyebrow="ДОСИЕ"
  density="lg"
  background={{ image: "var(--art-account)", overlay: "scrim", focalY: 35 }}
>
  <Display size="h1">{userName}</Display>
</SceneCard>
```

Overlay options:

- `scrim` - strong dark gradient for maximum text legibility
- `veil` - medium overlay for calm atmospheric banners
- `none` - minimal tint; use only when the artwork is already dark

`focalX` and `focalY` shift the background focal point from 0 to 100. Default is
50/50. Use them when the important part of the artwork sits off-center.

### Tall hero presence

Background-backed hero cards size to their content by default. Thin heroes can
use `background.minHeight` to give the artwork enough room while keeping the
text vertically centered:

```tsx
<SceneCard
  eyebrow="ПОВЕРИТЕЛНОСТ"
  density="lg"
  background={{
    image: "var(--art-privacy)",
    overlay: "scrim",
    minHeight: "var(--ds-scene-hero-min-standard)",
  }}
>
  <Display size="hero">Открит трезор за данните ти</Display>
</SceneCard>
```

Suggested height tokens:

| Token | Use |
|---|---|
| `--ds-scene-hero-min-compact` | Flow-first pages where the form or wizard remains dominant |
| `--ds-scene-hero-min-standard` | Typical page heroes with headline and short supporting copy |
| `--ds-scene-hero-min-cinematic` | Archive, legends, or other identity-heavy heroes where the artwork should breathe |

## Anti-pattern: `:global()` primitive overrides

CSS modules must not use `:global()` selectors to redefine primitive identity:

```css
/* Wrong - fights with PaperCard identity */
:global(.paper-card) {
  background: dark;
}

/* Wrong - fights with SceneCard identity */
:global([data-ds-scene-card]) {
  color: white;
}
```

Use the primitive that matches the surface intent, or extend the primitive with
an additive prop and tests. Wrapper-context accents are allowed when they add a
local cue without redefining the primitive:

```css
.caseFileShell[data-outcome="win"] [data-ds-scene-card] {
  border-left: 2px solid var(--ds-accent-green);
}
```

`pnpm regression` is a hard guard against direct primitive overrides.

## PaperCard / SceneCard interactive mode

`PaperCard` and `SceneCard` support two additive presentation props:

```tsx
<SceneCard interactive accent="win">
  <Display size="h3">Селото оцеля</Display>
</SceneCard>
```

| Prop | Values | Default | Purpose |
|---|---|---|---|
| `interactive` | `boolean` | `false` | Adds CSS hover lift and press feedback |
| `accent` | `neutral` / `win` / `loss` / `warning` / `info` | none | Adds a semantic left border |

Cards stay presentational. They do not accept an `as` prop and do not become
links or buttons by themselves. If a whole card should be clickable, the app
layer owns the real link/button semantics and can place a visible CTA inside
the card.

Use `accent` for outcome-coded lists such as history case files or achievement
states. Keep page-specific moods in page CSS modules; do not re-skin primitive
identity through `:global()` overrides.

## Pill primitive (enriched)

`Pill` is still framework-neutral: it renders either a `button` or an `a`
element. It does not accept Next.js `Link` or a generic `as={ElementType}`.

```tsx
<Pill intent="primary" shimmer tracked>
  Избери игра
</Pill>

<div data-faction="werewolves">
  <Pill intent="faction">Влез на масата</Pill>
</div>

<Pill as="a" href="/status" intent="ghost">
  Виж състояние
</Pill>
```

| Prop | Values | Default | Purpose |
|---|---|---|---|
| `intent` | `primary` / `secondary` / `ghost` / `danger` / `faction` | `primary` | Visual emphasis |
| `size` | `sm` / `md` / `lg` | `md` | Touch target and density |
| `shimmer` | `boolean` | `false` | CSS-only sheen on hover |
| `tracked` | `boolean` | `false` | Uppercase CTA treatment without changing DOM text |
| `as` | `button` / `a` | `button` | Native element choice |

`intent="faction"` reads `--ds-gradient-faction` from an ancestor. New code
should set `data-faction="werewolves"` or `data-faction="mafia"`. During the
restoration work, tokens also include a compatibility fallback for legacy
`data-theme="werewolves"` / `data-theme="mafia"` containers.

Shimmer is opt-in and CSS-only. Use it for primary CTAs in hero, create-flow, or
cinematic contexts. Avoid putting shimmer on every secondary action.
