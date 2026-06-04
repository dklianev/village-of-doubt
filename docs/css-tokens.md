# CSS theme token pattern

## Goal

Replace `html[data-theme="light"] .X { property: value }` selectors with CSS
variable definitions, so theme toggle changes only variables instead of many
distinct selectors. This reduces style-recalc work on theme changes.

## Pattern

### Before

```css
.faq-shell {
  background: rgba(17, 12, 10, 0.92);
  color: #f5e8c8;
}

html[data-theme="light"] .faq-shell {
  background: rgba(252, 246, 236, 0.94);
  color: #2a1b10;
}
```

### After

```css
:root {
  --legal-shell-bg: rgba(17, 12, 10, 0.92);
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

## Naming

- `--legal-shell-*` is shared by faq/privacy/terms/status/report frames.
- `--legal-hero-*` is for text that sits over the shared image hero.
- Existing per-page variables stay scoped to the page shell when they express
  page semantics, but their light values should come from theme tokens instead
  of `html[data-theme="light"] .page-shell` selectors.
- Page-specific tokens use the page name, for example `--legal-faq-*` or
  `--legal-status-*`.

## Migration Steps

1. List all `html[data-theme="light"] .X { ... }` selectors for the section.
2. Move light values into `html[data-theme="light"]` custom properties.
3. Replace base declarations with `var(--token, original-dark-value)`.
4. Delete the section-specific light selectors.
5. Run `pnpm regression`, `pnpm typecheck`, and `pnpm build`.
6. Check the page in dark and light themes for visual parity.

## Verification

```bash
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css

for shell in faq privacy status terms report; do
  grep -c "html\[data-theme=\"light\"\] \.${shell}" apps/web/app/globals.css
done
```
