---
name: frontend-polish-gate
description: Use before completing frontend visual polish, page identity work, CSS changes, visual fixtures, or accessibility fixes.
---

# Frontend Polish Gate

Use this skill before calling frontend work done.

## Guardrails

- Scope CSS to page-local classes.
- Do not override primitive identity with `:global(.paper-card)`, `:global(.scene-card)`, `:global([data-ds-*])`, or similar.
- Do not add dependencies, fonts, or Motion imports.
- Do not add `@media (prefers-reduced-motion)`.
- Use Bulgarian UI copy.
- Verify desktop and mobile, dark and light when relevant.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm regression
pnpm build
pnpm check:dict
git diff --check
```

For asset or large visual work:

```bash
pnpm perf:budget
pnpm visual --grep "<route-or-feature>"
```

Before snapshot updates, manually inspect the diffs.

## Output

List:

- routes/viewports checked
- command results
- known residual risks
