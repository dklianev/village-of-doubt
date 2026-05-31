# Legacy Visual Reference Harness

This directory is the output target for `pnpm visual:legacy-reference`.

The harness compares the current app on `http://localhost:3000` with the
pre-primitives worktree on `http://localhost:3101` for the legacy-island
restoration pages. It writes old/current screenshots for desktop, mobile,
light, and dark modes.

Use it only as a comparison aid. Do not commit temporary auth bypasses in the
old worktree.

```bash
pnpm visual:legacy-reference
pnpm visual:legacy-reference -- --routes status
```

For old `/history` fixture parity, start the old worktree with
`HISTORY_EVIDENCE_FIXTURE=1`.
