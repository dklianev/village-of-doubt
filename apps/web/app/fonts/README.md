# Product Typography

Self-hosted variable WOFF2 fonts. No browser or build-time requests to a font CDN.

- Display and editorial reading: [Literata](https://github.com/googlefonts/literata), weight 400-700, optical size 36.
- Interface and functional text: [Sofia Sans](https://github.com/lettersoup/Sofia-Sans), weight 400-700.
- Licenses: adjacent original SIL Open Font License files.

Downloaded from the Google Fonts CSS2 service on 2026-09-05. The delivery subsets
include U+0020-007E, U+00A0-00FF, U+0400-045F, U+2000-206F, U+20AC, U+2116,
U+2190, U+2192 and U+2212. Other scripts in user names retain system fallbacks.
Keep `lang="bg"` on the document so Bulgarian localized forms can be selected.

Use `--font-display`, `--font-reading` and `--font-body` in the app; UI primitives
consume `--ds-font-display` and `--ds-font-body`, with independent Storybook
fallbacks. Do not declare an unshipped font by name in a page stylesheet.
Monospace room codes and identifiers remain monospace.

Both regular variable files together are 93,720 bytes (91.5 KiB), independently
cached and preloaded by `next/font/local`. They do not contribute to JavaScript.
Do not add more weights as separate files. Review font transfer and rendered
Cyrillic glyphs with `typography-contract.spec.ts` when changing these assets.

## Reproducible Delivery Optimization

The unchanged original delivery files are in `assets/font-source/`, covered by
the adjacent font licenses here. Install the pinned Python tooling in a virtual
environment outside the checkout, then run from the repository root:

```sh
python -m pip install -r assets/font-source/requirements.txt
python assets/font-source/optimize.py --check
python assets/font-source/optimize.py --write
```

`--check` (also the default) regenerates in memory, verifies exact output bytes,
and checks all font tables, active outline variations, sampled outlines, and
Bulgarian/Latin shaping at every integer weight from 400 through 700. Source
hashes and tool versions are checked before generating either output.

Literata is losslessly repacked from 58,000 to 52,300 bytes. Sofia Sans is repacked
from 61,236 to 41,420 bytes after removing 398 outline-variation tuples that
contribute exactly zero throughout the CSS face's 400-700 range. No characters,
glyphs, shaping features, hinting, metric tables or active variation data are
removed. All tables except `gvar` encoding and the `head` checksum remain
byte-identical. The original variation-axis normalization is retained to avoid
rounding changes introduced by rebasing a restricted axis.

Keep both declarations in `fonts.ts` at 400-700, without explicit out-of-range
`font-variation-settings`. The optimized Sofia file is not a general-purpose
replacement for the original at weights below 400. Expanding the CSS range
requires regenerating from the preserved originals and reviewing the new range.
Preload, display behavior and fallback adjustment remain unchanged.

DOM pixel comparisons in Chromium, Firefox and WebKit confirm unchanged output
at the app's higher CSS weights: 720, 740, 750, 760, 780, 800, 850, 900 and 950.
With the 400-700 face descriptor, those normal `font-weight` requests render
identically to 700. Explicit `font-variation-settings: "wght" ...` can bypass
that clamp; the tested higher values still match the originals because their
positive-axis variation data is retained. The app and UI source currently have
no explicit variation settings. These comparisons cover both fonts, light/dark
surfaces and 1x/2x rendering; they do not permit overrides below 400.
