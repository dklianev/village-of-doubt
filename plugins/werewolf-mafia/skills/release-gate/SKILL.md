---
name: release-gate
description: Use before a final merge/PR handoff, after commits are ready, or when the user asks whether the branch is safe to ship.
---

# Release Gate

Use this skill before final branch handoff.

## Minimum Gate

```bash
pnpm typecheck && pnpm test && pnpm regression
git diff --check
```

## Full Frontend/Game Gate

```bash
pnpm typecheck && pnpm test && pnpm regression && pnpm playtest && pnpm build && pnpm check:dict && pnpm perf:budget
git diff --check
```

## Optional Heavy Gate

Use when release risk is high and local services are available:

```bash
pnpm smoke
pnpm frontend:e2e
pnpm e2e:auth
pnpm visual
pnpm verify:heavy
```

## Review Checklist

- Worktree contains only intentional files.
- No `.env*` files are staged.
- No generated Next type-path churn remains in `apps/web/next-env.d.ts`.
- No unrelated snapshot updates are included.
- Commits are atomic and have English messages.
- `AGENTS.md` invariants are still true.
