# PR M29 — Faction atmosphere canvas on the create wizard (animated, CSS-only)

## Goal

Make `/create`, `/werewolf/create`, `/mafia/create` feel like a **place**, not a
dark settings form. Add a faction-specific animated atmospheric layer behind the
wizard:

- **Werewolf → „Лунна гора"**: cold moonlit glow + slow drifting fog + forest-green vignette.
- **Mafia → „Задимена стая"**: warm venetian-blind light + lamp glow + smoky oxblood vignette.

This is a **CSS-only** enhancement — no new image assets, no JSX changes, no new
deps. It layers *on top of* the existing painterly background, it does not replace it.

### Explicit owner decisions (do not "fix" these)
- **Animation IS wanted.** Subtle, slow keyframe motion is the point.
- **`prefers-reduced-motion` gating is intentionally OMITTED** per the project
  owner's instruction. Do **not** add a `@media (prefers-reduced-motion)` block.
  If any lint/regression rule *requires* one, **stop and report it** — do not
  silently gate. (The owner accepts the a11y tradeoff; mitigated by keeping motion
  low-amplitude and slow.)

---

## Verified structure (already audited — trust these, don't re-derive)

DOM chain on all three routes:
```
main.shell.lobby-shell[data-faction][data-family]      ← SHARED page shell
  └─ LobbyCreateClient
       └─ main.lobby-wizard[data-faction][data-family]  ← wizard root (create/lobby only)
            ├─ div.lobby-wizard-main (StepNav + .lobby-step-pane + steps)
            ├─ aside/div.sticky-preview
            ├─ .mobile-summary-chip
            └─ .lobby-confetti (conditional)
```

**Critical scoping facts:**
1. `.lobby-shell` is **SHARED** with `/lobby/[code]` (invite), `/werewolf/join`,
   `/mafia/join`. **Do NOT attach atmosphere to `.lobby-shell`** — it would leak
   into the join/invite pages.
2. There is already a `.lobby-shell::before` in `apps/web/app/globals.css`
   (~line 1331) — the shared full-viewport painterly page-art (`--art-lobby` +
   dark gradient, `z-index:-1`, dark-theme only). **Leave it untouched.**
   `.lobby-shell` already sets `z-index:0; isolation:isolate`.
3. **Anchor the atmosphere to `.lobby-wizard`** instead. It exists only where the
   wizard renders (create + `/lobby`; join pages use a different client, so no
   leak). Faction tokens resolve there (`data-faction`/`data-family` present).
4. **Home file = `apps/web/components/lobby/LegacyCreate.module.css`** (the island).
   It is imported only via `components/lobby-create-client.tsx`, so anything added
   there cannot leak to join/landing/history. Add the `.lobby-wizard` rules here.
5. **`@keyframes` must live in `apps/web/app/globals.css`**, NOT in the module —
   this is the island's own rule (see `LegacyCreate.module.css` line 2:
   *"Keyframes and root view-transition selectors stay in app/globals.css."*).
   The module references them by name.

Current `.lobby-wizard` rule (LegacyCreate.module.css, ~line 5) — you will extend it:
```css
:global(.lobby-wizard) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.34fr);
  gap: clamp(20px, 4vw, 44px);
  width: 100%;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 52px) 0 96px;
}
```
There is also a mobile override of `.lobby-wizard` (~line 1427) that switches to a
single column — verify the atmosphere still works there.

Faction tokens available on `.lobby-wizard` (added in M28.2):
`--accent-faction`, `--accent-faction-bright`, `--accent-faction-tint`,
plus base `--moss (#59633b)`, `--blood (#7b1f1b)`, `--ember`, `--fog`, `--ink`.

---

## Stacking / layout mechanics (get this exactly right)

`.lobby-wizard` is `display:grid`. A pseudo-element with default positioning
becomes a **grid item** and breaks the layout. So:

```css
:global(.lobby-wizard) {
  /* ...existing... */
  position: relative;
  isolation: isolate;            /* contains the negative-z pseudos */
}

:global(.lobby-wizard)::before,
:global(.lobby-wizard)::after {
  content: "";
  position: absolute;            /* removes it from grid flow */
  inset: clamp(-24px, -3vw, -8px); /* bleed slightly past the wizard box */
  z-index: -1;                   /* behind in-flow content, contained by isolation */
  pointer-events: none;
  border-radius: 32px;           /* match the panel feel; clip glow softly */
}
```
- `z-index:-1` + `isolation:isolate` → paints behind the wizard's cards but does
  NOT punch through to behind `.lobby-shell` (the painterly art stays visible).
- After adding `position:relative`/`isolation`, **verify `.sticky-preview`
  (sticky) and `.lobby-confetti` still position correctly** (confetti's containing
  block may shift). Fix locally if needed; do not remove isolation.

---

## Performance rules ("оптимизирана") — mandatory

- **Animate ONLY `transform` and `opacity`.** These run on the compositor.
- **Never animate** `background-position`, `filter`, `box-shadow`, `width/height`,
  `top/left`, `background-size`, or `border-radius` (layout/paint thrash).
- Blur look = **pre-softened gradients** (wide color-stop falloff), not animated
  `filter: blur()`. A static `filter: blur()` on a pseudo is acceptable only if it
  is NOT animated; prefer gradient softness.
- `will-change: transform, opacity;` on the two animated pseudos only (not on
  `.lobby-wizard` itself).
- Loop seamlessly: use `infinite alternate` for breathing, or translate by exactly
  one tile period for repeating gradients so the loop has no visible jump.
- Durations are **slow** (7s–40s). Amplitudes are **small**. No strobing, no fast
  flicker.
- `backdrop-filter` stays `none` (project already disables it).

---

## Design spec

### Werewolf — `.lobby-wizard[data-faction="werewolves"]`
- **`::before` = moon glow** (cool silver-green), positioned top-right:
  `radial-gradient(circle at 80% 8%, rgba(214,232,200,0.16), rgba(120,150,110,0.06) 32%, transparent 62%)`
  - Animation: `wolf-moon-breathe` — `opacity .85→1`, `transform: scale(1)→scale(1.05)`, ~11s ease-in-out infinite alternate.
- **`::after` = drifting fog + forest vignette**:
  low soft band `linear-gradient(0deg, rgba(89,99,59,0.12), transparent 42%)` plus
  an inset forest-green vignette (use a large `radial-gradient` ring, not box-shadow animation). Make the layer ~124% wide.
  - Animation: `wolf-fog-drift` — `transform: translateX(-3%)→translateX(3%)`, ~38s ease-in-out infinite alternate.

### Mafia — `.lobby-wizard[data-faction="mafia"]`
- **`::before` = venetian-blind light** (warm thin slats):
  `repeating-linear-gradient(118deg, transparent 0 38px, rgba(255,226,180,0.055) 38px 42px)`
  - Animation: `mafia-blinds-drift` — `transform: translateX(0)→translateX(42px)` (exactly one period), ~26s linear infinite. (Seamless loop.)
- **`::after` = lamp glow + smoky oxblood vignette**:
  `radial-gradient(ellipse at 16% 6%, rgba(190,95,42,0.15), transparent 55%)` over an
  oxblood inset vignette (`radial-gradient` ring using `--blood`).
  - Animation: `mafia-lamp-flicker` — gentle `opacity .9→1` (and optional `scale(1)→scale(1.02)`), ~7.5s ease-in-out infinite alternate. **Subtle** — this is a warm lamp, not a fault light.

### Fallback (`/create` before a faction is chosen — defaults to werewolves)
`/create` mounts with `data-faction="werewolves"` by default, so it gets the
werewolf atmosphere automatically. No separate neutral state required. (Confirm the
default still reads `werewolves` — if a faction-less state exists, give it the
werewolf treatment via a base rule.)

---

## Commits (atomic, exact messages, gate each one)

**Per-commit gate (must pass before committing):**
`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm regression`
Anti-pattern guard must stay green (you only touch `.lobby-wizard` legacy classes
and `@keyframes`; you add NO `:global(.paper-card)` / `:global([data-ds-*])`).

### Commit 1 — `feat(create): scaffold wizard atmosphere layer`
- Add `position:relative; isolation:isolate` to `:global(.lobby-wizard)`.
- Add the base `::before`/`::after` structure (positioning, `z-index:-1`,
  `pointer-events:none`, bleed inset). No faction visuals, no animation yet —
  a transparent/near-transparent scaffold.
- Verify sticky preview + confetti unaffected.

### Commit 2 — `feat(create): moonlit forest atmosphere for werewolves`
- Add `@keyframes wolf-moon-breathe` and `wolf-fog-drift` to `globals.css`.
- Add the werewolf `::before`/`::after` gradients + animations in the module.

### Commit 3 — `feat(create): smoky noir atmosphere for mafia`
- Add `@keyframes mafia-blinds-drift` and `mafia-lamp-flicker` to `globals.css`.
- Add the mafia `::before`/`::after` gradients + animations in the module.

### Commit 4 — `style(create): tune atmosphere readability and depth`
- Tune layer opacities so panel text/contrast is unaffected (atmosphere shows in
  gaps/margins, must not wash out cards). Confirm the validation strip
  (green/red), step nav, and role tiles still read clearly over the new backdrop.

### Commit 5 — `test(visual): refresh create atmosphere baselines`
- ONLY after the manual side-by-side sign-off below.
- `pnpm test:visual --update-snapshots`; commit only the `create` /
  `werewolf-create` / `mafia-create` snapshot deltas. If unrelated frames change
  (e.g. `/lobby`, history), stop and report before committing.

---

## Verification (before Commit 5)

Dev servers are up: app `:3000`, pre-primitives reference `:3101`.

1. `:3000/werewolf/create?visualAuth=1` — cool moon glow top-right, slow fog drift
   along the bottom, green-tinted edge vignette. Cards + text fully legible.
2. `:3000/mafia/create?visualAuth=1` — warm blind-light slats slowly drifting,
   lamp glow top-left, oxblood vignette. Subtle, not strobing.
3. The two factions must feel **clearly different in mood**, not just hue.
4. `:3000/lobby?visualAuth=1` — inherits the wizard atmosphere (same component);
   confirm it looks intentional there too.
5. `:3000/werewolf/join` + `:3000/mafia/join` — **must be UNCHANGED** (no leak).
6. `:3000/` landing + `/history` — unchanged (no `.lobby-shell::before` regression).
7. Performance: open DevTools Performance/Rendering, enable "Paint flashing" —
   the animated layers should NOT cause full-wizard repaints; only the composited
   pseudo layers move. No sustained layout/paint. Frame rate stays ~60fps idle.
8. `pnpm playtest` passes (full create→play flow still works).

## Acceptance criteria
- [ ] Werewolf and mafia create pages have distinct animated atmospheres.
- [ ] Animation uses only `transform`/`opacity`; no paint/layout thrash (verified).
- [ ] NO `prefers-reduced-motion` block added.
- [ ] No new image assets; no JSX changes; no new deps.
- [ ] `.lobby-shell::before` painterly art intact; join/landing/history unchanged.
- [ ] Atmosphere is `z-index:-1` behind content; text/cards fully legible; M28.2
      faction accents (step nav, validation, role tiles) still read clearly.
- [ ] Sticky preview + confetti still position correctly.
- [ ] Per-commit gate green; `pnpm playtest` green; baselines limited to 3 frames.

## Failure modes to watch
| Symptom | Cause | Fix |
|---|---|---|
| Wizard layout breaks / extra empty cell | Pseudo became a grid item | Ensure `position:absolute` on `::before/::after` |
| Atmosphere covers the cards | Pseudo at `z-index:auto`/positive | Use `z-index:-1` + `isolation:isolate` on `.lobby-wizard` |
| Painterly background disappeared | Touched `.lobby-shell::before` or negative-z punched through | Revert shell; keep isolation on `.lobby-wizard` |
| Atmosphere leaked into join/lobby-invite | Anchored to `.lobby-shell` | Re-anchor to `.lobby-wizard` only |
| Janky animation / fan spins up | Animated background-position/filter/box-shadow | Animate transform/opacity only; pre-soften gradients |
| Blinds loop visibly jumps | Translate ≠ one tile period | Translate by exactly the repeating period (42px) |
| Confetti or sticky preview mispositioned | New stacking/containing block | Adjust those locally; keep isolation |
| Lint demands reduced-motion | Project motion rule | STOP, report to owner — do not auto-gate |
