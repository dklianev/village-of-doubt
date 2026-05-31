# PR M28.2.1 — Keep the "valid setup" signal green (post-faction-accent fix)

## Why this exists

M28.2 introduced `--accent-faction` and wired it across the legacy `/create`
wizard island. That was correct for **neutral affordances** (step nav, primary
button, sliders, focus rings, role tiles, preset/recipe/tempo selection) — those
*should* carry the faction hue, and the green-vs-red split now reads clearly.

But one rule went too far. `.preview-warning.is-clean` is a **semantic success
signal**, not a neutral affordance. Its text is positive:

> „Тази комбинация от роли е валидна."

M28.2 re-tinted it to `var(--accent-faction-*)`, so on the **mafia** flow the
"your setup is valid" strip now renders **burgundy red** (`#9e342d`). Two problems:

1. **Breaks the 1:1 Legacy-Islands target.** The pre-primitives reference
   (`69bbcca8`, `globals.css` line ~10257) kept this state a fixed success-green
   for *both* factions:
   ```css
   .preview-warning.is-clean { background: rgba(44, 120, 74, 0.14); color: #1f6f47; }
   ```
2. **Semantic collision.** `.preview-warning.has-warnings` (the *error* state) is
   `#842f2b` red and was left unchanged. On the mafia page "valid" and "error"
   are now **both red** — the green↔red valid/error contrast is destroyed exactly
   where it matters most.

Fix: restore the success state to the fixed green. Leave every other M28.2 token
wiring in place — it is correct.

## Operating rules (inherited from M28.1 / M28.2 — do not relax)

- **No new dependencies.** No JSX changes. No primitives identity touched.
- **Scope:** only `apps/web/components/lobby/LegacyCreate.module.css` (Commit 1)
  and the visual snapshot dir (Commit 2). Nothing else.
- **Per-commit gate:** `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm regression`
  must pass before each commit. The anti-pattern guard must stay green (no
  `:global(.paper-card)` / `:global([data-ds-*])` etc. — you are not adding any).
- **Side-by-side check** against the pre-primitives reference on `:3101` before
  the baseline refresh (see Verification).
- Atomic commits, exact messages below. Do not squash.

---

## Commit 1 (REQUIRED) — restore the success-green validation state

`style(create): keep validation success state green`

In `apps/web/components/lobby/LegacyCreate.module.css`, find:

```css
:global(.preview-warning.is-clean) {
  background: var(--accent-faction-tint);
  color: var(--accent-faction-bright);
}
```

Replace with the pre-primitives values:

```css
:global(.preview-warning.is-clean) {
  background: rgba(44, 120, 74, 0.14);
  color: #1f6f47;
}
```

**Do NOT touch** `:global(.preview-warning.has-warnings)` — it is already the
correct error red (`#842f2b`) and matches pre-primitives.

This is the only change in Commit 1. One rule, two lines.

---

## Optional hunk — progress-bar gradient endpoint (judgment call, default: SKIP)

M28.2 also changed the preview progress bar (line ~1282) from
`var(--gold)` to `var(--accent-faction-bright)`:

```css
background: linear-gradient(90deg, var(--blood), var(--accent-faction-bright));
```

This is **not a bug** — the progress bar is a neutral affordance and a
faction-tinted endpoint is a defensible M28.2 enhancement. It only *deviates*
from strict pre-primitives fidelity (which was `var(--blood)` → `var(--gold)`).

- **Default: leave it as-is** (faction-tinted). Skip this hunk.
- **Only if** the operator explicitly wants strict pixel-fidelity with `:3101`,
  revert the endpoint to `var(--gold)` as a separate commit
  `style(create): restore gold progress-bar endpoint`.

Do not decide this yourself — default to SKIP unless told otherwise.

---

## Commit 2 — refresh visual baselines (only after manual sign-off)

`test(visual): refresh create validation baselines`

After Commit 1 passes the gate AND the side-by-side check below is signed off:

```
pnpm test:visual --update-snapshots
```

Commit only the snapshot deltas under
`apps/web/__visual__/__baseline__/visual-regression.spec.ts-snapshots/`.
Expect changes limited to the `create` / `werewolf-create` / `mafia-create`
frames (the validation strip recolor). If any *unrelated* frame changes, stop and
report — do not commit it.

---

## Verification (before Commit 2)

Both dev servers are already up: app on `:3000`, pre-primitives reference on `:3101`.

1. `:3000/mafia/create?visualAuth=1` — the bottom validation strip
   („Тази комбинация от роли е валидна.") must be **green**, visually distinct
   from a `has-warnings` red strip.
2. `:3000/werewolf/create?visualAuth=1` — same strip still green (unchanged for
   werewolves, since moss-green tint happened to look fine — but it must now be
   the *exact* success green `#1f6f47`, not the moss `--accent-faction-bright`).
3. Confirm step nav / „НАПРЕД" / sliders / role tiles **stay faction-tinted**
   (green for werewolf, red for mafia) — Commit 1 must NOT have disturbed them.
4. Compare each against `:3101` equivalents — the `is-clean` strip should now
   match the reference green on both factions.

## Acceptance criteria

- [ ] `.preview-warning.is-clean` is fixed green (`#1f6f47` / `rgba(44,120,74,0.14)`)
      on **both** factions; matches pre-primitives `:3101`.
- [ ] `.preview-warning.has-warnings` unchanged (`#842f2b` red).
- [ ] On mafia, "valid" (green) and "error" (red) are visually distinct again.
- [ ] All other M28.2 faction tinting intact (step nav, button, sliders, focus,
      role tiles, recipe/tempo/preset selection).
- [ ] Gate green per commit; anti-pattern guard green; `pnpm playtest` passes.
- [ ] Baseline deltas limited to the three create frames.

## Failure modes to watch

| Symptom | Cause | Fix |
|---|---|---|
| Werewolf "valid" strip looks slightly different green than before | You left it on `--accent-faction-bright` (moss) instead of `#1f6f47` | Use the literal pre-primitives values, not tokens |
| Faction tint disappeared from step nav after this PR | Over-reverted — you touched more than `.is-clean` | Scope Commit 1 to the single rule |
| Baseline diff touches `/play` or history frames | Snapshot run picked up unrelated drift | Stop, report, do not commit unrelated frames |
