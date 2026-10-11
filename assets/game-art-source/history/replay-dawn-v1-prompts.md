# REPLAY Dawn Hero V1

## Scope And Provenance

- Date: 2026-09-26.
- Generator: native `image_gen.imagegen`; opaque bitmap output. No CLI/API fallback.
- Approved reference: synthetic full-page REPLAY mockup, inspected with `view_image` before generation.
- Reference path: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-a71e96c8-bf1f-4a0c-a4ae-c85a5d7740a4.png`.
- Only the hero scenery was retained. UI, typography, logos and borders were removed.
- Final PNGs were copied byte-for-byte with PowerShell `Copy-Item`. No image editing or re-encoding was applied to these source files.
- Repository ownership: these two PNGs and this sidecar only. No app, scripts, tests or runtime asset files changed by this task.

## Final Sources

Both images are 2172 x 724 px, exactly 3:1, PNG, sRGB, 3 channels, no alpha. Requested generation size was 1920 x 640; the native generator returned 2172 x 724, preserved unchanged.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `replay-dawn-dark-v1.png` | 2450218 | `be2461c75cff190076fb354372c515b3333913da9d1bf48437799395640d52bd` |
| `replay-dawn-light-v1.png` | 3039309 | `3adb48216c0e0d944457f44b4db5d61c606d7d27c0f95a1b299b13273a5d5632` |

Native final dark output:
`C:/Users/Administrator/.codex/generated_images/01a0dce6-126c-7b43-9a84-c534bdb7be47/exec-10379eb6-1093-4eb3-9415-51fa1a3ff20b.png`

Native final light output:
`C:/Users/Administrator/.codex/generated_images/01a0dce6-126c-7b43-9a84-c534bdb7be47/exec-8b321da9-0385-4ad8-b95a-7c458ab9f1bd.png`

## Composition And Integration

- Same Bulgarian stone-and-timber village, forested mountains, right-hand stone bell tower, lane and parapet in both themes.
- Left approximately 45% is pine foreground, free of buildings or props competing with the main HTML heading. Foreground foliage is more visible in the light image; it is not a flat-color text panel.
- Folded blank paper and small smooth red seal at lower right. No lettering or emblem on either.
- Dark: deep pine and charcoal, localized muted dawn gold.
- Light: cooler blue morning sky, neutral stone and visible shadow detail; no beige wash.
- No inset frame, border, UI or baked-in text.
- Desktop starting point: `object-fit: cover; object-position: 50% 0%` at 1440 x 430. Top alignment protects the bell-tower finial; centered vertical cropping can clip it.
- Mobile starting point: `object-fit: cover; object-position: 100% 50%` at approximately 390 x 330. The full tower, right scenery and paper remain in the crop.
- Keep the uncropped 3:1 aspect ratio in the runtime derivative if using the same asset for desktop and mobile; perform the responsive crop in CSS.
- Mobile right-prioritized cropping necessarily excludes the left pine text area. Use the page's local contrast treatment for HTML copy and verify actual heading/metadata positions in both themes. Text contrast and final page integration are not certified by bare-image crop QA.

## Inspection And Budget Evidence

All three generated outputs were individually inspected with `view_image`. The first dark draft had an embossed seal symbol and was superseded by a targeted correction. Final images have a blank seal and paper, matched landmarks, distinct lighting, and no frame or UI.

An isolated local Chromium page rendered both themes using in-memory WebP derivatives, without changing app code or saving runtime derivatives. Desktop 1440 x 430 and mobile 390 x 330 crops were screenshot-inspected. Tower, village and paper remain visible in both recommended crops. Both images decoded successfully.

QA screenshots outside the repository:
- `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/replay-asset-desktop-qa.png`
- `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/replay-asset-mobile-qa.png`

Compression probe used the existing Sharp installation, in memory only:
`sharp(source).resize({ width: 1440 }).webp({ quality: 45, effort: 6 }).toBuffer()`

| Probe | Dark | Light | Pair |
| --- | ---: | ---: | ---: |
| 1440 x 480 WebP, quality 45, effort 6 | 71980 bytes | 118836 bytes | 190816 bytes / 186.34 KiB |
| 1440 x 480 WebP, quality 50, effort 6 | 76856 bytes | 125302 bytes | 202158 bytes / 197.42 KiB |
| 1440 x 480 WebP, quality 60, effort 6 | 87058 bytes | 140982 bytes | 228040 bytes / 222.70 KiB |

The inspected quality-45 pair is below the requested 190 KiB target and the stated 270 KiB free runtime budget. This is an optimization feasibility measurement, not a current-build budget gate. The integrating agent owns final format/quality selection, runtime asset generation, UI/text contrast checks and build-budget verification. Original PNG source sizes are not runtime sizes. No application test suite or build was run for this asset-only task.

## Exact Prompts

### 1. Initial Dark Hero Extraction

Reference input: approved synthetic REPLAY mockup above.
Settings: `referenced_image_paths` with that local path; `transparent_background: false`.

```text
Use case: precise-object-edit.
Asset type: hero-only landscape bitmap background for the approved REPLAY page redesign, dark theme.
Input image 1 is the synthetic approved full-page mockup and edit target. Extract and repaint ONLY its top village hero scenery into a clean full-bleed standalone landscape. Remove every UI element, all lettering, all navigation, all timeline content, all logos and all borders. Reconstruct the scenery behind them. Preserve the distinctive believable Bulgarian stone-and-timber mountain village, forested mountain setting, right-side bell tower and natural dawn mood of that hero, not the rest of the page.
Canvas: panoramic landscape, requested 1920 x 640 pixels (3:1). The entire canvas is one scene. No inset image, frame or graphic border.
Composition: left approximately 45% is low-detail deep pine foreground with quiet broad shadow shapes suitable for later HTML text. Still recognizable natural foliage, not a flat panel or blurry fog. Village clusters on the RIGHT, narrow stone lane, Bulgarian vernacular stone ground floors and dark timber upper stories, restrained plaster and dark tiled roofs. Stone bell tower with visible belfry near x=77%, with its complete top below the top 14% margin. Layered forested mountains behind it. Compact, readable architecture; no fantasy castle. Reserve clean breathable depth around the tower.
Bottom-right: a modest folded completely BLANK off-white paper resting on a low natural stone parapet, one small unmarked deep red wax seal on the paper. Keep this prop secondary, around x=86%, y=77%; leave bottom 10% as parapet margin. No writing, emblem, crest, logo or engraving on paper/seal. No other hero props, no people or animals.
Lighting: believable early dawn, light emerging behind the mountains; deep pine and neutral charcoal shadows, restrained muted dawn gold on stone edges and in the sky. Warm light is localized, not an orange or sepia color cast. Cool forest retains depth and natural material color. Cinematic painterly realism faithful to the selected mock, not a cartoon or a glossy 3D render.
Responsive framing: intended desktop cover crop 1440 x 430. Keep tower, village and paper within the central 80% of height. Mobile cover crop about 390 x 330 will prioritize the right scenery, so group tower and paper in the rightmost 40%, while its left edge and lower shadow areas remain visually quiet for actual HTML text. Do not render any example text.
Compression-aware finish: broad coherent tonal masses, restrained fine texture, simplified distant foliage, clean sky and soft atmospheric depth. No grain, noise, stippling, excessive microdetail, decorative particles, lens flare or synthetic gradient overlay.
Hard constraints: hero scenery only; no UI, text, numerals, letters, signatures, watermarks, logo, buttons, cards, inset border or frame. Opaque background.
```

Superseded native draft:
`C:/Users/Administrator/.codex/generated_images/01a0dce6-126c-7b43-9a84-c534bdb7be47/exec-e651438c-ae3b-4c9e-9464-ae2f9d133a0b.png`

### 2. Final Dark Seal Correction

Reference input: the inspected initial dark draft.
Settings: `referenced_image_paths` with the draft path; `transparent_background: false`.

```text
Use case: precise-object-edit. Input image 1 is the edit target, an approved dark panoramic village background. Make ONE small correction: on the folded blank paper at bottom right, replace the large embossed wax seal with a slightly smaller plain deep-red wax blob/seal, completely smooth in its center. It must have no letter, emblem, animal shape, crest, logo, engraving, mark or symbol. Preserve the blank folded paper and its exact placement. Preserve the entire rest of the image exactly: same 3:1 panoramic landscape canvas, same framing, architecture, bell tower, mountains, pine foreground, dawn lighting, colors, textures and geometry. No UI, text, new objects, frame or border. Opaque bitmap.
```

### 3. Light Companion

Reference input: the inspected final dark output.
Settings: `referenced_image_paths` with the final dark native path; `transparent_background: false`.

```text
Use case: lighting-weather.
Asset type: complementary light-theme hero-only bitmap background for the approved REPLAY page.
Input image 1 is the final dark-theme village hero, the edit target. Change ONLY the natural illumination, shadow exposure and color temperature to a lighter, cool, clear early morning. This must visibly be the EXACT SAME SCENE, viewpoint and framing, not a different village.
Keep identical 3:1 landscape dimensions, positions and geometry of every roof and building, stone-and-timber Bulgarian village, narrow lane, bell tower on the right, mountain silhouettes, foreground pine branches, stone parapet, blank folded paper and small plain red wax seal. Keep the seal completely smooth and unmarked, the paper completely blank.
Light palette: cool natural morning daylight; pale blue-gray open sky, fresh desaturated pine greens, neutral pale stone and subtly cool charcoal wood, with only restrained pale gold where low dawn sunlight catches edges. The left approximately 45% of pine foreground becomes visibly more legible and lighter through real cool sky fill, remaining low-contrast, low-detail natural foliage. Open shadows enough for a genuinely lighter companion, preserve dimensional depth and local contrast.
No beige, cream, sepia or white washed overlay; no flattening, no global fog, no artificial monochrome tint, no heavy bloom. The light version must feel like cooler daylight on the same place, not the dark version with a translucent layer over it.
Keep the scene crisp at focal architecture while retaining broad coherent tonal masses and restrained texture for efficient web compression. No added grain or high-frequency noise.
Keep the tower, village and paper composition fixed for matched desktop/mobile cover crops. Do not add UI, text, symbols, letters, numbers, logos, watermarks, animals, people, new props, inset border or frame. Opaque background. Change only lighting and color rendering, everything else invariant.
```

## Runtime Recipe And Delivery Metrics

Follow-up task, 2026-09-26: the approved masters above were exported through the existing targeted optimizer. This supersedes the earlier quality-45 feasibility suggestion for runtime delivery. The new allocation is at most 250 KiB for the pair, targeting at most 125 KiB per image.

Runtime: `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe` (Node v24.20.0), Sharp 0.35.4, libvips 8.18.6, libwebp 1.6.0.

Exact source recipe in `scripts/optimize-assets.mjs`:
- Matches only `history/replay-dawn-dark-v1.png` and `history/replay-dawn-light-v1.png`.
- Width 1440, original aspect ratio, `fit: "inside"`, `withoutEnlargement: true`; output 1440 x 480.
- Existing WebP encoder: `effort: 6`, `smartSubsample: true`.
- Tries quality `[65, 60, 55, 50, 49, 48, 47]` in descending order, retaining the first encoding at or below 125 KiB. Fails closed at the floor; no resolution reduction.
- No AVIF, mobile, thumbnail or public PNG output. No master modification.

Reproduction command, from `E:/werewolf_mafia`:

```powershell
& 'E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe' scripts/optimize-assets.mjs --only history/replay-dawn-dark-v1.png --only history/replay-dawn-light-v1.png
```

### Quality Probes

All probes used the production encoder settings above, in memory. The earlier feasibility table did not enable `smartSubsample`, so its byte counts are not interchangeable with this recipe.

| Quality | Dark bytes | Light bytes | Pair KiB | Per-file 125 KiB result |
| ---: | ---: | ---: | ---: | --- |
| 65 | 98016 | 155496 | 247.570 | Dark fits; light exceeds |
| 60 | 92740 | 147892 | 234.992 | Dark fits; light exceeds |
| 55 | 86388 | 139014 | 220.119 | Dark fits; light exceeds |

Light-only refinement: Q54 = 137354 bytes; Q53 = 135094; Q52 = 133976; Q51 = 132674; Q50 = 130664; Q49 = 130108; Q48 = 128054; Q47 = 126070. Q48 exceeds the 128000-byte per-file cap by 54 bytes. Q47 fits, so Q45 was not used. Dark remains at Q65.

### Published Pair

| Runtime file | Quality | Dimensions | Bytes | KiB |
| --- | ---: | --- | ---: | ---: |
| `apps/web/public/game-art/history/replay-dawn-dark-v1.webp` | 65 | 1440 x 480 | 98016 | 95.719 |
| `apps/web/public/game-art/history/replay-dawn-light-v1.webp` | 47 | 1440 x 480 | 126070 | 123.115 |
| Total | | | 224086 | 218.834 |

- Dark WebP SHA-256: `f0a9125e3913cd9d33fe97fb8ff2f185f95b2dbc90098aa5a19a7fd098d6955a`.
- Light WebP SHA-256: `66e69d6783f4a3e0c40d8fd81cb3bd56f3f059ef40591c921ef731bf01603a9f`.
- Both source SHA-256 values still match the original master metadata above.
- Read-only runtime art sum, using the same image extensions as `scripts/bundle-budget.mjs`: 76747011 bytes / 74948.253 KiB against 75000 KiB; remaining 51.747 KiB at measurement time. This is a filesystem measurement, not a new full build-budget gate. No global report/corpus file was updated.

### Runtime Verification

Eight focused tests passed under Node v24.20.0:

```powershell
& 'E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe' --test '--test-name-pattern=history (ledger|replay)|targeted optimizer|quality overrides|impossible delivery budget|encodes at the quality floor' scripts/optimize-assets.test.mjs
```

The new tests cover exact-path recipe scope, quality overrides, independent expected encodings, byte equality with the published runtime pair across two CLI passes, current-master preservation, 1440 x 480 WebP metadata, per-image and combined budgets, and an exact two-file output set with no extra formats or temporary artifacts. Adjacent tests cover the ledger recipe, targeted isolation, invalid selection, quality floors and fail-closed writes.

Actual published WebPs, not probe substitutes, were decoded and screenshot-inspected in isolated Chromium at desktop 1440 x 430 (`50% 0%`) and mobile 390 x 330 (`100% 50%`). Tower contours, roof shapes, stone lane and blank paper/seal remain readable without a soft wash. No source crop or sharpening was applied. Full page typography/contrast QA remains with the integrating agent.

Runtime QA screenshots outside the repository:
- `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/replay-runtime-desktop-qa.png`
- `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/replay-runtime-mobile-qa.png`

Follow-up changes are limited to the optimizer, its focused tests, the runtime WebP pair and this appended section. No app/UI edits, master edits or unrelated report updates.

## Q65 Quality Refinement Correction

Latest approved refinement, 2026-09-26: both runtime images now use Q65. This section supersedes the equal 125 KiB per-image allocation, Q65/Q47 runtime table, previous light WebP hash and previous corpus measurement above. Those entries record the earlier export and are not current delivery metrics.

Only the exact REPLAY pair recipe changed:
- Quality steps are now `[65]` only, including when a lower `WEBP_QUALITY` is supplied. Budget failure does not fall back to lower quality or smaller dimensions.
- Dark allocation: 100 optimizer KiB units (102400 bytes).
- Light allocation: 156 optimizer KiB units (159744 bytes).
- The separate combined test cap remains 250 KiB (256000 bytes), not the sum of the individual allocations.
- Width stays 1440, output stays 1440 x 480; `effort: 6` and `smartSubsample: true` are unchanged.
- No global/overall hard limit or older recipe was changed. No AVIF, mobile, PNG or thumbnail derivatives were added.

The same targeted reproduction command above was rerun with the specified Node v24.20.0 executable.

| Current runtime file | Quality | Dimensions | Bytes | KiB |
| --- | ---: | --- | ---: | ---: |
| `apps/web/public/game-art/history/replay-dawn-dark-v1.webp` | 65 | 1440 x 480 | 98016 | 95.719 |
| `apps/web/public/game-art/history/replay-dawn-light-v1.webp` | 65 | 1440 x 480 | 155496 | 151.852 |
| Total | | | 253512 | 247.570 |

- Dark SHA-256 remains `f0a9125e3913cd9d33fe97fb8ff2f185f95b2dbc90098aa5a19a7fd098d6955a`.
- Current light SHA-256: `92bad62116867633d74f8c71abf065b9483be6b325b23256e461e9580a6e4427`.
- Both master hashes remain unchanged from the original source metadata.
- Updated read-only art filesystem sum: 76776437 bytes / 74976.989 KiB against the unchanged 75000 KiB hard limit; 23.011 KiB headroom at measurement time. No global report file was updated; final production-build asset measurement remains with the main agent.
- Nine focused tests passed with the same test command above. The combined 250 KiB assertion is retained. The added failure test verifies that a light-image budget of 150 KiB rejects Q65 rather than falling back, while preserving the source, previous runtime output and temporary-file cleanup.
- Actual rebuilt Q65 WebPs were decoded and visually inspected in Chromium at desktop 1440 x 430 and mobile 390 x 330 with the same crop positions. Architectural detail, paper and seal remain clear. No source edits or crop changes were needed.

Updated Q65 crop evidence, outside the repository:
- `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/replay-runtime-q65-desktop-qa.png`
- `C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/replay-runtime-q65-mobile-qa.png`

