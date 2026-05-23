# Acceptance criteria

Per-page checkboxes. Used during PR review.

## Cross-cutting

- All pages: Bulgarian-only copy per `docs/dictionary.md`
- All pages: primitives from `packages/ui`, no raw chrome
- All pages: visual regression at 3 viewports x 2 themes

## Status of enforcement

Aspirational; CI does not block PRs on them. As infrastructure matures
(Lighthouse runner, axe-runner, dictionary enforcer), items will graduate.
