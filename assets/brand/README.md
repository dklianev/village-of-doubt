# Senkite Production Logo

The outlined wordmark reads **Сенките**. This is the approved iteration 3.4,
mechanically vectorized from the large wordmark in the lower/light panel of
`senkite-approved-3.4.png`. It is not a replacement font or an embedded bitmap.

## Assets

| Public file | Dimensions / viewBox | Use |
| --- | --- | --- |
| `brand/senkite-wordmark.svg` | `0 0 968 224` | Seven outlined glyphs, transparent black mask |
| `brand/senkite-mark.svg` | `0 0 181 204` | Only the canonical first glyph, transparent black mask |
| `favicon.svg` | `0 0 64 64` | Rounded dark-green backplate and pale-brass mark |
| `brand/apple-touch-icon.png` | 180 x 180 | Opaque square app icon; platform applies its own corner mask |
| `brand/icon-192.png` | 192 x 192 | Opaque square app icon |
| `brand/icon-512.png` | 512 x 512 | Opaque square app icon |

Use the same wordmark/mark SVG as an **alpha** CSS mask in both themes; the
consumer supplies its color, dimensions, aspect ratio and accessible name.
Do not create separate light/dark geometry. The icon colors are `#12251e`
(backplate) and `#e9d59a` (symbol). PNGs and favicon use the same symbol placement.
These are regular icons, not a dedicated maskable-icon safe-zone design.

## Provenance And Reproduction

- Source: approved raster `exec-8a482c69-a6f1-4bd8-967f-a7e45a38e7f1.png`,
  1536 x 1024. SHA-256:
  `2458298ad4d7c8a1721476803b514b3f1f1af190698d91d58f3fb6865ac7f1b9`.
- With the repository's Sharp 0.35.4, extract `{left:150, top:600,
  width:985, height:240}`, convert to grayscale and threshold at 128. Crop the
  binary result to `{left:9, top:7, width:968, height:224}`. This leaves about
  two source pixels around the actual contours.
- Trace the binary PNG with
  [node-potrace 2.1.8](https://github.com/tooolbox/node-potrace), using
  `threshold:128`, `blackOnWhite:true`, `turdSize:0`, `alphaMax:1`,
  `optCurve:true`, `optTolerance:0.3`, `turnPolicy:"minority"`.
  [Potrace's documented curve optimization](https://potrace.sourceforge.net/potrace.1.html)
  reduces nodes while preserving the outline. No speckle/counter deletion,
  morphological filtering or manual letter redesign was applied.
- Convert paths to absolute coordinates with svgpath 2.6.0; round to two
  decimal places and explicitly close each contour. Keep seven glyph paths
  with nine contours total and even-odd fill: the two enclosed counters of
  the lowercase e-shaped glyphs remain transparent. The flowing fourth glyph
  and the open inner contour of the first glyph are part of the traced paths.
- The mark is the first wordmark path verbatim, with a tighter viewport.
  This is the simplified icon, with no separate letterform or optical redraw.
  Place it on a 64-unit square with scale `52/204`, x translation
  `(64 - 181 * 52/204)/2`, and y translation `6`; round the transformed icon
  path to three decimal places. Render PNGs directly from that vector at
  their target sizes using Sharp, without alpha or an intermediate bitmap.

Only the final paths/PNGs ship. Temporary tracing dependencies, scripts and
visual QA are outside the repository in `E:/codex-temp/senkite-brand-vector/`.
No package manifest or lockfile changes are required.

## Verification And Limits

The trace retains 98.22% foreground intersection-over-union with its thresholded
source at native resolution. Boundary smoothing is an approximation of the
approved raster, not recovery of an unavailable original vector master.
At 16 px, antialiasing softens the thin inner detail; the principal silhouette
remains readable. Do not introduce a different theme-specific icon to compensate.
