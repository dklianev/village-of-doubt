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

Both regular variable files together are 119,236 bytes (116.4 KiB), independently
cached and preloaded by `next/font/local`. They do not contribute to JavaScript.
Do not add more weights as separate files. Review font transfer and rendered
Cyrillic glyphs with `typography-contract.spec.ts` when changing these assets.
