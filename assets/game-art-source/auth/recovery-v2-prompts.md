# Recovery Auth Art V2

## Scope and Provenance

- Generated separately with the built-in image_gen tool; no API/CLI fallback.
- Six final scenes for forgot-password, reset-password and verify-email, each in light and dark.
- Both approved references were visually inspected first: `assets/game-art-source/auth/bg-sign-in-light-v2.png` and `assets/game-art-source/auth/bg-sign-in-dark-v2.png`.
- Final PNG masters are byte-for-byte copies of the chosen generated outputs. No source recompression, resizing, upscaling or color processing.
- The reset light candidate's fully detached shackle was corrected with a targeted image edit before deriving its dark companion.
- Composition: quiet left 45%, right-side objects, green felt, carved door edge, antique brass, restrained red stitching; no text or private data.
- Generation directory: `C:/Users/Administrator/.codex/generated_images/01a0af79-7a25-7aa2-a281-0ede0b1294ec/`.

## Selected Outputs

| Final Source | Selected Generated File |
| --- | --- |
| `assets/game-art-source/auth/bg-forgot-password-light-v2.png` | `exec-b1c736cc-0a84-446f-9398-531bb21744d9.png` |
| `assets/game-art-source/auth/bg-forgot-password-dark-v2.png` | `exec-09f57720-ee7e-4f1b-82e1-93e195bc8e48.png` |
| `assets/game-art-source/auth/bg-reset-password-light-v2.png` | `exec-ae715a98-1681-4e75-960b-4d45b0f1b5e8.png` |
| `assets/game-art-source/auth/bg-reset-password-dark-v2.png` | `exec-3b453a3d-6540-4d8b-846c-5ef9a69f8d3c.png` |
| `assets/game-art-source/auth/bg-verify-email-light-v2.png` | `exec-32d73b73-cef4-44d9-965a-b63c5771871a.png` |
| `assets/game-art-source/auth/bg-verify-email-dark-v2.png` | `exec-6168b620-3ed3-471c-91e3-841b2eb91477.png` |

## Runtime Generation

Final runtime assets use the repository pipeline with recovery-only caps: desktop WebP 270 KiB, AVIF 180 KiB, mobile WebP 100 KiB. The existing quality floors and native dimensions are unchanged:

```powershell
& 'E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe' scripts/optimize-assets.mjs --only auth/bg-forgot-password-light-v2.png --only auth/bg-forgot-password-dark-v2.png --only auth/bg-reset-password-light-v2.png --only auth/bg-reset-password-dark-v2.png --only auth/bg-verify-email-light-v2.png --only auth/bg-verify-email-dark-v2.png
```

Source and desktop dimensions are 1672 x 941, the generated native resolution (approximately 16:9). Mobile is the full scene at 960 x 540, intended for right-center cover positioning. Desktop AVIF/WebP pairs must match. The current script's generic background width cap is 2560, but `withoutEnlargement: true` retains these native dimensions. No global pipeline settings were changed.

## Final File Inventory

All sizes below are exact bytes. Paths are workspace-relative to `E:/werewolf_mafia`.

| Path | Dimensions | Bytes |
| --- | --- | ---: |
| `assets/game-art-source/auth/bg-forgot-password-light-v2.png` | 1672 x 941 | 3073243 |
| `apps/web/public/game-art/auth/bg-forgot-password-light-v2.avif` | 1672 x 941 | 179724 |
| `apps/web/public/game-art/auth/bg-forgot-password-light-v2.webp` | 1672 x 941 | 273466 |
| `apps/web/public/game-art/mobile/auth/bg-forgot-password-light-v2.webp` | 960 x 540 | 99292 |
| `assets/game-art-source/auth/bg-forgot-password-dark-v2.png` | 1672 x 941 | 2641309 |
| `apps/web/public/game-art/auth/bg-forgot-password-dark-v2.avif` | 1672 x 941 | 171489 |
| `apps/web/public/game-art/auth/bg-forgot-password-dark-v2.webp` | 1672 x 941 | 223460 |
| `apps/web/public/game-art/mobile/auth/bg-forgot-password-dark-v2.webp` | 960 x 540 | 74084 |
| `assets/game-art-source/auth/bg-reset-password-light-v2.png` | 1672 x 941 | 2918531 |
| `apps/web/public/game-art/auth/bg-reset-password-light-v2.avif` | 1672 x 941 | 173676 |
| `apps/web/public/game-art/auth/bg-reset-password-light-v2.webp` | 1672 x 941 | 234832 |
| `apps/web/public/game-art/mobile/auth/bg-reset-password-light-v2.webp` | 960 x 540 | 101584 |
| `assets/game-art-source/auth/bg-reset-password-dark-v2.png` | 1672 x 941 | 2520149 |
| `apps/web/public/game-art/auth/bg-reset-password-dark-v2.avif` | 1672 x 941 | 155212 |
| `apps/web/public/game-art/auth/bg-reset-password-dark-v2.webp` | 1672 x 941 | 191956 |
| `apps/web/public/game-art/mobile/auth/bg-reset-password-dark-v2.webp` | 960 x 540 | 62156 |
| `assets/game-art-source/auth/bg-verify-email-light-v2.png` | 1672 x 941 | 2925729 |
| `apps/web/public/game-art/auth/bg-verify-email-light-v2.avif` | 1672 x 941 | 173033 |
| `apps/web/public/game-art/auth/bg-verify-email-light-v2.webp` | 1672 x 941 | 237404 |
| `apps/web/public/game-art/mobile/auth/bg-verify-email-light-v2.webp` | 960 x 540 | 99920 |
| `assets/game-art-source/auth/bg-verify-email-dark-v2.png` | 1672 x 941 | 2590979 |
| `apps/web/public/game-art/auth/bg-verify-email-dark-v2.avif` | 1672 x 941 | 162911 |
| `apps/web/public/game-art/auth/bg-verify-email-dark-v2.webp` | 1672 x 941 | 201698 |
| `apps/web/public/game-art/mobile/auth/bg-verify-email-dark-v2.webp` | 960 x 540 | 68956 |

- Source total: 16669940 bytes (16279.24 KiB), excluded from runtime budgets.
- Runtime total across all 18 AVIF/WebP/mobile files: 2884853 bytes (2817.24 KiB), saving 264616 bytes versus the first standard export.
- Dark variants retain WebP Q82 / AVIF Q60 / mobile WebP Q78. Light variants use desktop WebP Q78; AVIF Q55 (forgot) or Q56 (reset/verify); mobile WebP Q74 (forgot) or Q78 (reset/verify). Effort 6, WebP smartSubsample, no upscaling.
- An AVIF cap of 160 KiB could not preserve the existing Q55 floor for forgot-light and reset-light, so 180 KiB is used. No quality floor or corpus gate was lowered or raised.
- After removal of the three obsolete recovery masters and their six unused derivatives, the observed runtime corpus leaves about 313 KiB below the 75000 KiB hard limit. Corpus values are inventory snapshots; fresh build budgets are checked separately.

## Verification and Handoff

- All six selected sources were visually inspected, including the corrected open lock.
- All six PNG masters are byte-for-byte identical to their selected built-in image_gen outputs.
- The exact standard `--only` command above was run twice. SHA-256 comparisons proved all 18 runtime files unchanged after the second run, and all six masters remained unchanged.
- `node scripts/verify-optimized-assets.mjs --check-pairs` passed: 103 AVIF/WebP pairs had matching dimensions, including all six new pairs. No global mutating regeneration was run.
- Chromium visual QA used a separate temporary local HTML page, not application forms: all six themes at desktop width 1440 (AVIF), and all six mobile WebP scenes in 390 x 260 and 320 x 260 right-center cover banners. All subjects remain fully visible and identifiable; both light/dark retain material detail. The reset lock has one attached and one free shackle end.
- QA screenshots: `E:/codex-temp/recovery-art-v2-desktop-qa.png`, `E:/codex-temp/recovery-art-v2-mobile390-qa.png`, `E:/codex-temp/recovery-art-v2-mobile320-qa.png`.
- Mobile assets intentionally preserve the whole 960 x 540 scene. Use right-center cover, and select mobile WebP at the parent's <=800px breakpoint. No extra pre-cropped variants were added.
- The recovery-only pipeline policy and unchanged quality floors have focused tests in `scripts/optimize-assets.test.mjs`. Application browser QA also covers the actual forms, both themes, responsive layouts and all three browser engines. No commit was made.

## Exact Prompts

### Forgot Password Light

Approved sign-in light and dark sources are style references.

```text
Use case: stylized-concept.
Asset type: final bitmap background for Senkite forgot-password screen, LIGHT theme.
Input images: image 1 is the approved light sign-in STYLE / MATERIAL / ROOM reference; image 2 is the dark sign-in companion reference. These are references, not edit targets. Do not reproduce the playing cards.
Create one full-bleed wide 16:9 scene, ideally 1920x1080. Painterly realism with believable natural materials, closely matching the reference game's tactile aged green felt, subtly engraved dark wood, restrained antique brass and a small red-and-ivory stitched textile detail.
Scene: slightly elevated oblique view across a green-felt tabletop at the entrance of the same intimate old game room. A narrow subtly carved entry-door edge and dark wooden frame are visible at the far right/top-right, physically behind the table, with coherent perspective.
Subject: ONE naturally sized antique brass skeleton key resting flat on the felt near that door edge, upper-middle RIGHT, center around x=78%, y=42%. Key is a real small object roughly 9 cm long, not a giant prop, about 18-22% of frame width in this closer tabletop composition. Simple oval bow, single straight shaft, mechanically plausible clean bit, soft grounded contact shadow. No lock in this scene.
Composition: quiet uninterrupted low-contrast felt across LEFT 45% for an overlaid form; all hero object detail within x=62-90%, y=24-60% so the entire key survives a right-center mobile crop. Keep bottom mostly calm felt, a modest stitched corner at extreme lower-right only. Do not center the key or add clutter.
Lighting: naturally lit muted sage felt with soft window daylight, readable patina and warm brass highlights. Green stays green, not beige. Subtle painterly finish, detailed but not noisy textile texture.
Constraints: no people, no hands, no giant keys, no fire or forge, no modern UI, no text, no letters, no watermark, no logos, no playing cards. No fake blur or black vignette. Output ONE scene, not a diptych.
```

### Forgot Password Dark

Final forgot-password light source is the composition target; approved sign-in dark is the lighting reference.

```text
Use case: lighting-weather.
Asset type: final bitmap background for Senkite forgot-password screen, DARK theme.
Input images: image 1 is the generated forgot-password LIGHT composition to preserve; image 2 is the approved DARK sign-in reference for lighting, pine-green palette and painterly material treatment.
Create ONE dark companion scene in the same full-bleed wide 16:9 proportions, native resolution. Preserve the exact camera, the tabletop, the single small antique brass key's shape and right-upper-middle placement, grounded contact shadow, the subtly carved entry door at the far right, the tiny red-and-ivory stitch corner, and quiet LEFT 45% felt. Keep the whole key within x=59-85%, y=30-57%.
Change only the lighting and theme: rich pine-green felt under restrained warm grazing illumination with believable soft chiaroscuro, aged dark wood, gently gleaming naturally patinated brass. Match the approved dark sign-in aesthetic while retaining readable green felt and identifiable door, key bow, shaft and bit. Subject must not sink into crushed black. Left side is calm low contrast pine, not a black void. No oversaturated green, no gray wash, no hard spotlight circle, no dark overlay appearance.
Constraints: keep key naturally sized; one key only, no lock, no hands or people, no cards, no fire, no forge, no floating objects, no text, no letters, no logos, no watermark, no modern UI. Output one single scene, not paired panels.
```

### Reset Password Light: Initial Generation

Approved sign-in light and final forgot-password light are references. This candidate had a detached shackle and was rejected pending the correction below.

```text
Use case: stylized-concept.
Asset type: final bitmap background for Senkite reset-password screen, LIGHT theme.
Input images: image 1 is the approved light sign-in STYLE / MATERIAL / ROOM reference; image 2 is the new forgot-password light scene as continuity reference for the key, door and viewpoint. Do not reproduce the playing cards from image 1.
Create ONE full-bleed wide 16:9 scene in the same room, naturally lit sage-green felt, slightly elevated oblique tabletop view with the subtle carved wooden door edge at far upper-right and a modest red-and-ivory stitched textile corner at extreme lower-right.
Subject: a small realistically OPEN antique brass padlock and its naturally sized skeleton key resting together on the felt in the RIGHT upper-middle. Key and lock must be believable matching everyday antique objects, not oversized sculpture: padlock body around 6 cm across, key around 8 cm long. The padlock lies flat with its front/keyhole visible. A single coherent curved metal shackle pivots out of one side, its free end clearly separated from the other socket by an unmistakable open gap; both sockets and shackle are mechanically plausible. No broken or melted metal, no extra loops. The key rests separately beside the lock, no insertion, no hand. Understated aged brass with simple restrained engraving.
Composition: object group centered x=77%, y=43%; complete group within x=61-92%, y=22-61%. Lock slightly above/right of key so both read clearly in a right-center mobile banner crop. The LEFT 45% remains quiet uninterrupted felt without objects or bright patterns; keep the rest uncluttered. Maintain realistic object-to-door/table scale.
Style/materials: painterly realism matching reference, tactile softly worn green felt, dark carved wood, mellow antique brass, modest red stitched detail, plausible contact shadows. Fine natural material detail but not busy ornament.
Lighting: gentle natural window daylight, muted sage green not beige, subject edges and open-lock gap plainly identifiable.
Avoid: closed lock, giant key or lock, hands, people, floating objects, fire/forge, glowing effects, cards, modern UI, writing, letters, text, watermark, logos. No collage or panels.
```

### Reset Password Light: Final Correction

Target: initial reset light candidate exec-fbdc94db-f62f-4198-9dea-494285ae7f73.png in the built-in generated-images directory. The corrected result is the only reset light PNG persisted as a workspace source.

```text
Use case: precise-object-edit.
Asset type: final corrected Senkite reset-password LIGHT background.
Input image: edit target, preserve the existing scene.
Correct ONLY the antique padlock. Its shackle is currently fully detached, which is mechanically wrong. Replace this padlock with an ordinary physically plausible antique brass padlock resting on its back on the same felt, front face and small keyhole visible. Modest rectangular body with softly rounded shoulders, restrained engraving, real everyday 6 cm size. At the body's upper LEFT shoulder one shackle leg is visibly inserted continuously into its socket, with a clear metal-to-body junction. That attached leg extends upward, curves over in ONE inverted U, and the RIGHT free leg ends above the upper RIGHT socket with a visibly open gap. A recognizable open padlock with ONE connected end and ONE free end, not two detached ends, not a loose horseshoe, not broken hardware. Keep a simple coherent silhouette and believable contact shadows. Reduce the lock slightly if needed so the entire object group is naturally sized.
Preserve everything else: native wide 16:9 frame, camera/viewpoint, sage-green felt, natural daylight, the single antique key beside it, carved door at far upper-right, red/ivory stitched corner, quiet LEFT 45%, all hero objects on the right. No hands, no additional objects, no text, no letters, no watermark, no panels.
```

### Reset Password Dark

Corrected final reset-password light source is the composition target; approved sign-in dark is the lighting reference.

```text
Use case: lighting-weather.
Asset type: final bitmap background for Senkite reset-password screen, DARK theme.
Input images: image 1 is the corrected reset-password LIGHT edit target for exact composition and mechanically correct padlock; image 2 is the approved DARK sign-in style and illumination reference.
Make ONE dark companion in exactly the same full-bleed wide 16:9 composition. Change only the lighting and theme. Preserve the camera, all object silhouettes and positions, small natural scale, quiet LEFT 45%, antique key on felt, door edge at upper-right, small red/ivory embroidered corner. Crucially preserve the OPEN padlock: the shackle's LEFT end is physically attached in the body, the RIGHT end has a clear open gap. Do not detach both ends, close the lock or invent extra parts.
Lighting and palette: rich pine-green felt, aged engraved dark wood, restrained warm grazing light revealing naturally patinated antique brass. Painterly realistic chiaroscuro matching the reference, with sufficient soft ambient fill that the key, lock body, open gap and nearby green felt stay identifiable. Left side low contrast pine green, not crushed black. No hard black vignette, no spotlight circle or fake digital dark overlay.
No people, no hands, no giant objects, no floating objects, no fire/forge, no cards, no text, no letters, no watermark, no logos, no modern UI, no paired panels.
```

### Verify Email Light

Approved sign-in light and final forgot-password light are references.

```text
Use case: stylized-concept.
Asset type: final bitmap background for Senkite verify-email screen, LIGHT theme.
Input images: image 1 is the approved LIGHT sign-in STYLE / MATERIAL / ROOM reference including its eye/crescent visual signature; image 2 is the generated forgot-password LIGHT continuity reference for tabletop, door and viewpoint. References only; do NOT include the cards or key.
Create ONE full-bleed wide 16:9 scene in this same intimate old game room, slightly elevated oblique view of softly worn sage-green felt, narrow dark carved wooden table edge and subtle entry-door edge at upper-right, small red-and-ivory embroidered textile corner at extreme lower-right.
Subject: one believable small invitation envelope resting flat on the felt in the RIGHT upper-middle, back/flap facing up, slightly angled. Ordinary hand-sized envelope about 16 x 10 cm, warm pale natural rag paper with visible fibers and coherent folded triangular flap, no writing or invented marks. A modest dark-red wax seal around 2 cm diameter, about one eighth of the envelope width, firmly joins the flap to the envelope. Wax has a restrained shallow embossed eye with a crescent curve, simplified from the approved sign-in card signature if feasible; NO text. The seal is physically attached, gently irregular, flat and believable, not a giant medallion or hovering stamp.
Composition: envelope centered approximately x=76%, y=43%, entire envelope comfortably inside x=59-92%, y=23-63%. Keep LEFT 45% quiet uninterrupted low-contrast green felt behind an eventual form. Plenty of calm felt below. No extra props.
Style: painterly realistic natural materials matching the reference, folded paper thickness, soft believable contact shadow, modest wax sheen, wood engraving, reserved red stitch accent. Sharp enough to identify actual envelope folds and seal, not a blurry atmospheric suggestion.
Lighting: gentle natural window daylight, muted sage-green felt remains green, warm paper and red seal stand out without glare. No black vignette.
Constraints: no text, no letters, no address, no handwriting, no logos, no watermark, no hands or people, no giant floating seal/stamp, no key/lock, no playing cards, no fire/forge, no UI, no collage or panels.
```

### Verify Email Dark

Final verify-email light source is the composition target; approved sign-in dark is the lighting reference.

```text
Use case: lighting-weather.
Asset type: final bitmap background for Senkite verify-email screen, DARK theme.
Input images: image 1 is the generated verify-email LIGHT composition/edit target; image 2 is the approved DARK sign-in reference for pine-green palette, lighting and painterly material style.
Make ONE dark companion scene, same native wide 16:9 frame. Change only lighting and theme, preserving camera, ordinary hand-sized invitation envelope on the RIGHT upper-middle, correct paper folds, attached modest red wax seal with its shallow eye/crescent emblem, grounded contact shadows, carved wood/door edge at upper-right, restrained red/ivory stitch corner and quiet LEFT 45% felt.
Lighting: rich pine-green felt with gentle warm grazing illumination and believable soft chiaroscuro, dark natural engraved wood. The envelope remains identifiable warm pale rag paper, not metallic gold or unnaturally glowing. Wax stays deep red with restrained natural highlights; preserve seal's physical attachment and readable embossed eye/crescent without adding letters. Retain ambient green felt detail so shadowed areas are not crushed black, subject is readable in mobile right-center crop. Match approved dark sign-in mood without a black overlay or artificial vignette.
Constraints: no added objects, no hands or people, no keys/locks/cards, no giant floating seal/stamp, no fire/forge, no writing/text/letters, no watermark/logos, no modern UI, no split panels.
```
