# Scripts

## Dictionary check

Run `pnpm check:dict` before opening a PR. Warns only and exits 0.

Policy: hard `[warn]` items (English in JSX, anglicisms) must be fixed.
`[legacy]` items (Постижения vs Легенди) are accepted in Phase Б.

Future: this script may flip to enforcing after a parallel copy-migration PR.
