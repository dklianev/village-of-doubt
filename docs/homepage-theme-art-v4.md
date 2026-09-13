# Homepage Theme Art V4

Implemented on 2026-09-07 for the request for new light and dark illustrations
for both homepage game choices, and a visible light-theme card border.

## Artwork

All four illustrations are new built-in imagegen edits, not CSS exposure
filters or re-encoded copies of v3. The day/night pairs preserve the story,
characters, and composition. Existing versions remain unchanged.

Exact prompts, original generated files, source hashes, and anatomy review:

- [Werewolf provenance](homepage-choice-werewolf-v4.md)
- [Mafia provenance](homepage-choice-mafia-v4.md)

Sources live in `assets/game-art-source/homepage/choice-{werewolf,mafia}-{light,dark}-v4.png`.
Runtime assets use the same names under `apps/web/public/game-art/homepage/`
and `apps/web/public/game-art/mobile/homepage/`, with the `.webp` extension.

| Illustration | Desktop bytes | Mobile bytes |
| --- | ---: | ---: |
| Werewolf light | 120746 | 51010 |
| Werewolf dark | 138280 | 51346 |
| Mafia light | 95546 | 36252 |
| Mafia dark | 52478 | 18052 |

Desktop images are 960 x 640; mobile images are 720 x 480. The existing
160 KiB desktop and 55 KiB mobile per-file budgets remain unchanged.

## Delivery And Presentation

`ModeChoiceCards` exposes both theme pictures in its initial markup. CSS
selects them through the app's `html[data-theme]`, not the OS preference.
Native lazy loading prevents CSS-hidden pictures from being fetched; the
visible first game retains high fetch priority. No theme observer, hydration
gate, additional dependency, or theme-specific client state was introduced.

The browser checks exercise an app theme opposite to the OS preference,
mobile and desktop candidates, theme switching, and keyboard navigation.
Only the selected theme's choice illustration is requested on initial load.

Light cards use stone-green and pearl-gray surfaces, dark typography, a
localized genre label backing, and opaque olive/stone borders. Their lower
scrim protects text without washing out the upper illustration. Dark cards
retain their existing surface and typography. Geometry and 8px corners are
unchanged; the invitation from the preceding task is unchanged.

## Reproduction

The exact four v4 paths are included in the existing compact-choice rules
in `scripts/optimize-assets.mjs`. Unrelated names retain their old policy.
An isolated staging tree containing only these four sources was optimized
with native Node, then with `runAssetGenerators` and its digest-pinned Linux
image using Sharp 0.35.4. All eight WebPs were byte-identical across both
runs before publication. No source PNG was modified by optimization.

`scripts/optimize-assets.test.mjs` covers path boundaries, dimensions,
per-file budgets, unchanged masters, and deterministic repeated generation.
Homepage browser tests sample actual background pixels beneath text and the
light card edge, in addition to geometry, accessibility, and navigation.
The development-only Next indicator is excluded only from pixel samples.
