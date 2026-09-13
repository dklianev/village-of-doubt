# Homepage Choice Werewolf V5

Date: 2026-09-08

## Scope and Direction

Art-only source handoff for the explicitly approved homepage redesign.
New composition generated with built-in `image_gen`, dark first; no v4 image
was supplied as a generation or edit input. No CLI fallback was used.

A narrow historical Bulgarian village passage is viewed through a partly
open carved timber gate. One ordinary man holds a small amber lantern.
The adjacent gate carries an understated, almost-human cast shadow.
Rough stone, modest houses, timber carving and forest foliage replace
the dominant white wall and blue-gray night treatment from the prior direction.

Only these three repository files belong to this handoff:

- `assets/game-art-source/homepage/choice-werewolf-dark-v5.png`
- `assets/game-art-source/homepage/choice-werewolf-light-v5.png`
- `docs/homepage-choice-werewolf-v5.md`

No v4 files, optimizer, components, CSS, public derivatives, tests, goals or
commits were changed by this task. Existing unrelated work was preserved.
Main owns integration, CSS warmth/border, theme loading, public derivatives,
actual card crops and integration tests. Main was notified when both source
PNGs were ready and has now integrated both images. The integration outcome
and approved mobile encoding are recorded below; neither source was changed.

## Delivered Sources

Both sources are opaque sRGB PNG images, 960x640, 3:2, below 500 KiB
(512000 bytes). Each compact PNG was visually inspected after encoding.

| Theme | Repository path | Dimensions | Bytes | KiB | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| Dark | `assets/game-art-source/homepage/choice-werewolf-dark-v5.png` | 960x640 | 478476 | 467.26 | `9ef3194f15799a323d112c11d7d51ceba25e93fc2471b4f7da644ff88c65b13b` |
| Light | `assets/game-art-source/homepage/choice-werewolf-light-v5.png` | 960x640 | 501456 | 489.70 | `95c949c7c0030a823db9c507228170cf53a729b7f8d9f677b5a0ad62249b29c4` |

## Original Image Provenance

All built-in originals remain at the paths returned by the tool, unchanged.
All three originals are opaque 1536x1024 PNG images, 3:2.

### 1. Initial Dark Generation, Superseded

- Mode: new generation; no reference image.
- Original: `C:/Users/Administrator/.codex/generated_images/01a07dad-40a0-76f0-9e96-6fd55b6f5a11/exec-61fe79e9-8a4c-46ad-9010-1c6c9870ec54.png`
- Dimensions: 1536x1024.
- Bytes: 2862950.
- SHA-256: `9113aa2e3d79a9479ad8974e4ef38ba271188149c6a92dee742b9d5091825e9f`.
- Inspection: suitable gate composition and focal placement, but the cast
  shadow read too clearly as an animal head and the timber was too brown.
  Not used as a delivered compact source.

### 2. Refined Dark, Selected

- Mode: built-in edit of original 1.
- Edit input: `C:/Users/Administrator/.codex/generated_images/01a07dad-40a0-76f0-9e96-6fd55b6f5a11/exec-61fe79e9-8a4c-46ad-9010-1c6c9870ec54.png`
- Original: `C:/Users/Administrator/.codex/generated_images/01a07dad-40a0-76f0-9e96-6fd55b6f5a11/exec-5551ee7e-b767-4002-800e-1b16bb1dd037.png`
- Dimensions: 1536x1024.
- Bytes: 2925173.
- SHA-256: `99d0d8577d7080b83b5f92852cc6c996781855872f2ec877b84213a2dd484183`.
- Inspection: subtler low-contrast gate shadow; less orange-brown timber;
  retained face, hand, lantern, gate and passage positions. Original and
  compact both inspected. Main subsequently accepted the compact dark
  composition and requested no further dark changes pending actual card crop.
  The accepted dark source has not been modified afterward.

### 3. Matching Light, Selected

- Mode: built-in lighting edit of selected original 2, not of the compact PNG.
- Edit input: `C:/Users/Administrator/.codex/generated_images/01a07dad-40a0-76f0-9e96-6fd55b6f5a11/exec-5551ee7e-b767-4002-800e-1b16bb1dd037.png`
- Original: `C:/Users/Administrator/.codex/generated_images/01a07dad-40a0-76f0-9e96-6fd55b6f5a11/exec-28399e67-00d8-4406-be50-6bd66f36a064.png`
- Dimensions: 1536x1024.
- Bytes: 3688729.
- SHA-256: `c859a1aa901fe0c70d942b7eb140a6ee6b4ffae0f924cc2dd08cc995e81e5025`.
- Inspection: same camera, gate, man, face, hands, lantern and subtle shadow
  placement. Gentle afternoon illumination, warm neutral limestone,
  weathered gray timber and muted olive foliage, without added blue sky.
  Original and compact both inspected.

## Exact Built-In Prompts

The following blocks reproduce the prompt strings sent to `image_gen`.
For edits, `referenced_image_paths` contained only the edit-input path
recorded above. `num_last_images_to_include` was omitted on every call.

### Initial Dark Generation

```text
Use case: historical-scene
Asset type: premium painterly homepage choice-card artwork for the Bulgarian social deduction game Werewolf; DARK THEME source, no typography.
Primary request: Generate a completely NEW composition, a single 3:2 landscape image, exactly 1536 x 1024 pixels. A narrow historical Bulgarian mountain-village passage seen through a partly open carved timber gate. This is intimate Balkan folk-horror and human intrigue, not a monster poster or stock fantasy.
Scene/backdrop: The foreground threshold and open, weathered oak gate establish strong layered perspective into a crooked cobbled passage between modest rough-limestone houses, dark timber structural beams and small stone-tile roofs. Subtle traditional geometric carving on the gate, forged iron hinges, distinct wood grain, moss in stone joints. Receding muted olive trees and forest silhouettes. Little or no exposed sky. No broad plaster facade.
Subject: Exactly ONE ordinary adult Bulgarian villager, a quietly wary middle-aged man with short dark hair, light stubble, natural facial proportions, a plain charcoal wool vest over a muted undyed linen shirt, ordinary trousers. No hood, cape, armor or weapon. He is standing just past the gate, turned three-quarter toward the viewer, holding ONE SMALL lit amber lantern up at chest height in one anatomically correct hand. Other hand rests naturally down at his side. His expression suggests that he has heard something off frame.
Composition/framing: Position the important story tightly within central horizontal 40-62% and vertical 15-42% of the entire image. His whole head/face sits near x48%, y23%; the raised holding hand near x51%, y32%; the small complete lantern near x52%, y37%. A barely uncanny human-sized shadow on the wooden gate or narrow stone return immediately behind him sits near x59%, y23-39%, WITHIN the same central upper safe zone. The shadow almost matches the man, except for a faintly lengthened muzzle and two small ambiguous ear-like points that could be timber irregularities. It is a surface-bound cast shadow, not a second person, creature, hovering silhouette or focal wolf head. Keep all these details legible when the sides are cropped. The man is not a close-up portrait; show enough of his body and the layered setting to feel like an encountered moment. Lower 45-100% is quieter passage and threshold suitable for future overlaid card copy, but DO NOT draw text, UI or a synthetic gradient overlay. Avoid a huge empty foreground or any giant vertical wall.
Lighting/mood: Night, but clear material visibility. Soft neutral moon-bounce allows inspection of face, anatomy, carved wood and warm mineral stone. Localized amber lantern light on hand, cheek and adjacent gate only. Pale neutral moonlight accents only, never cold cyan. Controlled soft shadows with readable dark midtones, not crushed blacks.
Color palette: Charcoal and restrained deep forest/olive greens, warm gray limestone undertones, a very small amber light. Separate hues and material colors, not a brown wash. No blue sky, blue-gray night palette, teal/cyan grading, orange overall tint, enormous white wall, white floodlight, sepia or yellow filter.
Style/medium: Bespoke, sophisticated narrative painting with tactile detailed materials, subtle visible brushwork, grounded believable architecture and human anatomy, intimate suspense and social deduction. Crisp focal detail without glossy 3D, excessive fog, bloom, decorative particles or concept-art cliches.
Constraints: One image only, full bleed, landscape 1536x1024, no borders, no lettering, no logos, no watermark, no moon disc, no animal or literal monster. No giant wolf head. The subtle shadow is the only uncanny element.
```

### Dark Refinement

```text
Use case: lighting-weather
Asset type: DARK THEME Bulgarian Werewolf homepage choice-card art, 1536x1024 landscape.
Input image: the attached NEW v5 night composition is the only edit target. It is not v4.
Primary request: A restrained finish correction of this exact image. Preserve the entire scene, camera, geometry, composition, carved gate, historical Bulgarian stone passage, forest silhouettes, ONE ordinary man's face, identity, stubble, clothing, proportions, pose, feet, BOTH hands and small lantern exactly. Keep the story's face, holding hand, lantern and adjacent shadow in the central upper 15-42% of the image. Do not add or move objects.
Correct the night light and shadow treatment only:
1. Increase the soft neutral ambient nighttime fill enough that carved timber, limestone, foliage, clothing and the man's anatomy are comfortably inspectable at small card size. It must still read unmistakably as night. Lift the existing dark midtones gently, retain deep charcoal occlusion in crevices and good depth.
2. Restore distinct restrained forest/olive greens to foliage and natural moss, and desaturated charcoal/olive-gray weathering to the gate. The gates should read as dark weathered wood, not an orange-brown mass. Keep subtle warm mineral undertones in neutral gray stone and natural skin. Neutral pale moonlight accents ONLY: remove the bluish/cyan sheen on the left stone return and paving. Local warm amber around the small lantern, hand and cheek only. No global brown or sepia wash, no teal grading, no blue sky, no white floodlit walls.
3. The existing cast shadow currently reads as a literal wolf head with two large ears. Make it MUCH more ambiguous and lower-contrast: almost an ordinary man's head and shoulder shadow cast onto the same wood, with only a tiny irregular pointed notch and barely extended nose contour, something noticed on a second look. Reduce its head silhouette to roughly the man's head size, soften edges slightly, let wood grain show through. No distinct animal muzzle, no recognizable pair of wolf ears, no black wolf-head emblem, no second creature or person.
Finish: premium tactile narrative painting, controlled painterly edgework and detailed materials rather than glossy photography. Preserve all placement and anatomical invariants; no text, UI, overlays, border, vignette, added sky, moon disc or new lights. Return one full-bleed 1536x1024 image.
```

### Light Companion Edit

```text
Use case: lighting-weather
Asset type: LIGHT THEME companion to the selected dark Bulgarian Werewolf homepage choice-card artwork.
Input image: The attached 1536x1024 night illustration is the sole edit target. Create its matching late-afternoon version, not a new composition.
Primary request: Change ONLY illumination, time of day and corresponding natural surface colors. Gentle late-afternoon daylight with subtle warmth, soft open shade beneath the gate and neutral bounce revealing limestone, wood carving, ironwork and the ordinary villager. The small lantern remains lit but its amber effect is naturally less dominant in daylight. Premium intimate Balkan folk-horror narrative painting, intrigue/social deduction, not a fantasy poster.
Color palette: Warm neutral limestone, weathered charcoal-gray timber with muted olive nuances, natural muted olive/forest foliage, very slight aged-gold accents in existing carved wood and iron highlights. Preserve distinct material colors and believable skin. The image should feel luminous and quietly inviting while retaining shaded depth. A neutral daylight balance, NOT yellow, sepia, orange, beige monochrome or a brown wash. No bright blue sky, no cyan/teal grade, no white floodlit plaster wall. Keep the existing small forest backdrop, not an added open sky.
Required exact invariants: Same full-bleed 3:2 framing, 1536x1024 dimensions, camera and perspective. Same partly open carved timber gate, all boards, carvings and hinges, modest historical Bulgarian stone houses, roofs, cobbled passage, thresholds, trees and moss. Exactly the SAME ONE man: identical face and identity, short dark hair, stubble, ordinary clothing, body, pose, anatomically correct hands, holding fingers, feet and lantern geometry. DO NOT move or resize him or the lantern. Preserve the faint slightly uncanny head-and-shoulder cast shadow on the same gate in exactly the same position and size; it should remain an ambiguous human shadow with a tiny irregular contour, NOT become a wolf head, large ears, animal or second person. Face, raised hand, lantern and subtle gate shadow all remain in the central upper 15-42% story band. The lower passage remains quiet for future card text.
Style: Preserve the painting's tactile high-detail material rendering and restrained brushwork. Soft directional afternoon light and believable occlusion, not hard orange sunset, not hazy bloom. No new people, objects, lights or architecture. No text, logos, watermark, border or UI. Return one single matching LIGHT image.
```

## Compact PNG Encoding

Runtime: `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`.
Sharp: `0.35.4`, resolved from `E:/werewolf_mafia/apps/web`.

Only standard Sharp resizing and PNG encoding were applied to selected
originals. No manual recoloring, gamma/exposure adjustment, compositing,
retouching, sharpening, masks or content edits were applied outside imagegen.
PNG palette quantization is part of the standard encoding step and is not
lossless relative to the full-color original.

Palette dithering was enabled at `0.5`. It can introduce fine quantization
noise and potentially increase subsequent WebP size; its contribution was
not measured separately. No independent texture/noise filter was applied.
The approved sources retain the exact encoding options and hashes above.

The input and output aspect ratios are both 3:2, so the resize removes no
source content.

```js
const pngOptions = {
  compressionLevel: 9,
  palette: true,
  quality: theme === 'dark' ? 95 : 79,
  effort: 10,
  dither: 0.5,
};

const compact = await sharp(originalPath)
  .resize(960, 640, { kernel: 'lanczos3', fit: 'cover' })
  .png(pngOptions)
  .toBuffer();
```

Encoding candidates were evaluated in memory. Higher-quality candidates
exceeded the byte cap. Selected candidates were written only after checking
`compact.length < 500 * 1024`; no oversized intermediate files were delivered.
In particular, the light quality-80 candidate was 512004 bytes and was
rejected. The delivered quality-79 light file is 501456 bytes.

## Visual QA and Integration Notes

- Both selected originals were inspected before/alongside their compact PNGs.
- One ordinary person only, with consistent face, clothing, body, visible
  hands, lantern geometry and pose across the pair. No duplicated figures
  or gross anatomical defects observed.
- The subtle head-and-shoulder shadow stays on the wooden gate. Its softened,
  slightly irregular contour is an ambiguous clue, not a detached creature
  or comical animal-head emblem.
- Approximate visually observed compact-image landmarks are shared across
  the pair: face center around (500, 145), raised holding hand around
  (553, 197), lantern around (552, 239), shadow head around (617, 201).
  These are inspection estimates, not detected pixel-exact coordinates.
- Face/head and focal hand/lantern/shadow contours occupy approximately
  y=106..266 of the 640px source, within the intended upper 15-42% story band.
  Focal details are grouped near the horizontal center; background framing
  and secondary stone returns occupy the outer sides.
- The lower passage remains available for card copy. No text or artificial
  UI overlay is baked into either PNG.
- Dark retains legible local face/hand/lantern detail and inspectable wood
  and stone. Light opens up those same materials without a white plaster wall.
- No actual application/card rendering, mobile crop screenshot, theme-loading
  check, optimizer run, performance-budget gate or application test was
  performed by this art-only task. Main handled integration and the mobile
  visual comparison documented below. Source inspection alone does not
  establish application-test or final card-crop acceptance.

## Integration Outcome

Main confirmed that both images are integrated and the light scene is
approved. `apps/web/components/landing/ModeChoiceCards.tsx` references the
dark and light v5 variants. These integration changes belong to main,
not to this art-only task.

Main reported that the light 720px WebP was 64592 bytes at the previous
last quality attempt of 54, exceeding the 55 KiB limit (56320 bytes).
Main approved the quality-42 derivative after a side-by-side visual
comparison and confirmed matching canonical Windows/Linux output of
54514 bytes. This leaves 1806 bytes below the limit. Cross-platform parity
and visual approval are main's reported checks, not reruns by this task.

The local canonical mobile files were independently read after integration:

| Theme | Public derivative | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Dark | `apps/web/public/game-art/mobile/homepage/choice-werewolf-dark-v5.webp` | 720x480 | 37596 | `22c34767b20cde72d2a33a86aa85c2bf82c6fac98485169d6bef04ba6e1a4574` |
| Light | `apps/web/public/game-art/mobile/homepage/choice-werewolf-light-v5.webp` | 720x480 | 54514 | `0aa58f9b88188ea48a20ac0161af97534332f8d8d9492c35df6ae838c8d6b15d` |

Main added a final WebP quality-42 attempt only for compact homepage choice
illustrations in `scripts/optimize-assets.mjs`. Existing quality attempts
retain their order, and budget-compliant candidates stop the loop before
that fallback. Existing output therefore retains its prior encoding unless
it is still over budget; this is not a global quality-floor change.
Main also confirmed that dark mobile and all desktop derivatives fit their
budgets. No derivative was generated or rewritten by this documentation
update, and no application-test result is implied here.

The original 1536x1024 masters and delivered 960x640 PNGs remain unchanged.
Both delivered source SHA-256 hashes were rechecked against the source table
before this documentation-only update. No re-compaction or art edit was
needed for integration.

## V4 Preservation Reference

Unchanged SHA-256 values checked at intake:

| Existing file | SHA-256 |
| --- | --- |
| `assets/game-art-source/homepage/choice-werewolf-dark-v4.png` | `0c3b01188b83b36a5fef6603fd82a6c9399d157126188065c58f74eb6d03f7fe` |
| `assets/game-art-source/homepage/choice-werewolf-light-v4.png` | `d42a78fb660f53466f09c16641af0b2fd9eecb12fffe47283f191bb5998294f5` |
| `docs/homepage-choice-werewolf-v4.md` | `4901d0dffcce98a741b33ec46b1522b196e1706a36fd0ec0930f42982480ad3d` |
