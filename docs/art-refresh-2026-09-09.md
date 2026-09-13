# Targeted art refresh - 2026-09-09

## Scope

- Eight play environments: Werewolves and Mafia, day/night, landscape/portrait.
  Lighting follows the game phase, not the UI theme. Paused uses the documented
  day fallback because the public state does not expose the previous phase.
- Two Mafia tabletop inlays: restrained Art Deco brass and green felt. The
  Werewolves wooden folk ornament remains unchanged.
- One dedicated portrait Mafia family hero for dark mode.
- Seven role illustrations: Werewolf, Vampire, Insomniac, Doctor, Detective,
  Maniac and Lovers. Preserve their established characters and card framing.
  The rejected Lovers draft is not installed; the selected image has a visible
  umbrella grip and connected shaft.
- Quieter exterior scenery without blurring or dimming the framed game stage.
- More visible rules/tutorial artwork and correct cover-image density in the
  family-page phase previews.

Homepage choice illustrations, avatars and the other role illustrations were
retained. This is not a global art replacement or gameplay change.

## Sources And Delivery

`assets/game-art-source/refresh-20260909.json` records all 18 selected masters,
their prompts and generation identifiers. The built-in image tool chooses the
model; no explicit model or variant selection was exposed.

Sources remain full-resolution PNGs. Runtime assets use bounded WebP/AVIF
exports. The four dedicated mobile play environments use matching 960x1440
derivatives of 1024x1536 masters to preserve the existing quality floor and
400 KiB WebP cap. They are separate portrait compositions, not desktop crops.

The optimizer supports repeated `--only <source-relative PNG>` arguments for
targeted export. Unknown selections fail before writing. Four existing v1
inlay AVIFs were also repaired to match their WebP dimensions.

Changed role and thumbnail URLs use `?v=2` to invalidate optimized-image caches.
Next's local image allowlist permits that exact query only under `/game-art/`;
arbitrary queries remain rejected. CSS role artwork uses the same revision.

## Verification

- Asset pipeline: 58 tests passed, including isolated exports, source-byte
  preservation, quality floors, bounded sizes and exact path selection.
- Read-only paired-format check: all 95 WebP/AVIF pairs have matching dimensions.
- Role art and image configuration: 60 targeted tests passed. The lobby artwork
  test was updated to inspect the URL pathname, then passed all five cases.
- Full web suite initially reported 1,588 passed, 16 skipped and one stale URL
  assertion. That assertion is the five-case targeted rerun above; the whole
  web suite was not repeated after the test-only correction.
- Rules, tutorial and family artwork: 20 browser tests passed, including
  image density, rendered text contrast and interaction checks.
- Play environments: 20 browser tests plus eight exterior-contrast A/B tests
  passed. Table-surface/security targeted tests: nine passed.
- Integrated role-modal review: 28 desktop/mobile and light/dark scenarios.
- Final play/hero review: 34 captures at widths 390, 872, 1440 and 2560, covering
  both families and themes. No horizontal overflow, image HTTP errors or
  uncaught browser errors in these scenarios.
- Final web production build, workspace typecheck and 24 regression contracts
  passed. Scoped whitespace checks passed. No screenshot baselines changed.

## Initial Performance Result

At the end of the art pass, `pnpm perf:budget` was NOT green. No budgets or
baselines were increased. The follow-up below resolves these JS violations:

- Total JavaScript gzip is 558.5 KiB: +6.1 KiB against the 552.4 KiB baseline,
  exceeding its allowed +5 KiB delta. Before this pass it measured 558.3 KiB;
  this pass adds approximately 0.2 KiB.
- Play route JavaScript is 131.6 KiB rounded, marginally above its +3 KiB delta
  allowance against 128.6 KiB. Both JS absolute hard caps remain satisfied.
- The complete deployment art corpus is 71,150.1 KiB, above its 70,000 KiB
  warning but below its 75,000 KiB hard cap. This is not one page's transfer.
  Existing route CSS and individual-art warnings also remain.

Broader bundle optimization and review of the accumulated working-tree changes
were still required before claiming all release gates pass. Full `verify`,
`verify:heavy` and the repository-wide regenerating `verify:assets` command were
not run for this scoped art pass. No commit, push or deployment was performed.

## Scroll Lock And Bundle Follow-up

Opening Rules or Signals exposed two related CSS defects: horizontal `hidden`
overflow created a scrolling ancestor for the sticky navbar, and Radix's body
scrollbar compensation was applied while the viewport still had its scrollbar.
Using horizontal `clip`, locking the root during Radix dialogs and keeping the
body out of the scrolling-ancestor chain preserves page geometry and scroll.
Radix retains focus trapping, wheel/touch isolation and scrollbar compensation.

The regression test first reproduced the 15px width shift and displaced navbar.
It now passes 20 combinations of family, theme, viewport and scrollbar width,
including repeated opening, closing, focus restoration and blocked background
scrolling. Six Firefox and six WebKit geometry probes also passed. Broader
create, homepage, play-tools and draft/selection checks passed 51 tests. Four
role-art browser checks passed after separating the URL pathname from `?v=2`
when reading the source file; the image density assertions were not weakened.

For JavaScript, static game metadata was separated from configuration/role data,
retaining the existing shared exports. Phase vocabulary no longer loads that
heavy dependency graph. Repeated single-target night-action buttons now share
one renderer, preserving labels, icons, target validation and command payloads.
Multi-target actions remain explicit.

| Gzip Measurement | Before | After |
|---|---:|---:|
| All JavaScript chunks | 571,934 bytes | 570,726 bytes |
| Play declared client JavaScript | 134,768 bytes | 134,593 bytes |

`pnpm perf:budget` passes with unchanged limits and baselines. Its eight tests
also cover exact-limit acceptance and a 10-byte overage diagnostic. Total JS
has only about 52 bytes left against the baseline-plus-delta allowance; this
is a tight review threshold, not substantial growth capacity. Existing CSS and
art warnings remain below their hard caps. No new dependency or artwork was
needed for this follow-up.

Verification: production web build, workspace typecheck, 24 regression contracts,
143 shared tests and the full web suite (1,608 passed, 16 skipped). Another 38
play geometry, accessibility and interaction browser gates passed, covering
night actions, exhausted resources, two-target selection and private-state
boundaries. This does not
claim that full `verify` or `verify:heavy` ran, or certify the entire dirty tree
for release. No commit, push or deployment was performed.
