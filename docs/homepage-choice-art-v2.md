# Homepage Choice Art V2

Generated on 2026-09-07 with the built-in `image_gen` tool using the user-requested
`C:/Users/Administrator/.codex/skills/.system/imagegen/SKILL.md` workflow.
Two independent text-to-image calls produced two complete illustrations, not a
collage. One additional targeted built-in edit refined the Mafia envelope
placement and lower field. No API/CLI fallback, downloaded references, or new
dependencies were used.

V2 replaces the paired group-at-a-table scenes on the homepage. Werewolf uses
a village threshold and one concealed threat; Mafia uses a single figure,
a sealed envelope, and a rainy city. Both keep important details above the
HTML copy. The previous v1 files remain available and unchanged.

`ModeChoiceCards.tsx` selects the desktop or mobile WebP through a picture
source. The artwork is shared between themes; contrast comes from the card's
own background and scrim. The page backdrop still selects only the requested
theme. The first card loads eagerly and the second lazily.

## Deliverables

Paths below are relative to `E:/werewolf_mafia`.

| File | Dimensions | Bytes |
| --- | --- | ---: |
| assets/game-art-source/homepage/choice-werewolf-v2.png | 960 x 640 | 239553 |
| assets/game-art-source/homepage/choice-mafia-v2.png | 960 x 640 | 309177 |
| apps/web/public/game-art/homepage/choice-werewolf-v2.webp | 960 x 640 | 57984 |
| apps/web/public/game-art/homepage/choice-mafia-v2.webp | 960 x 640 | 83356 |
| apps/web/public/game-art/mobile/homepage/choice-werewolf-v2.webp | 720 x 480 | 17946 |
| apps/web/public/game-art/mobile/homepage/choice-mafia-v2.webp | 720 x 480 | 27134 |

Application URLs:

- `/game-art/homepage/choice-werewolf-v2.webp`
- `/game-art/homepage/choice-mafia-v2.webp`
- `/game-art/mobile/homepage/choice-werewolf-v2.webp`
- `/game-art/mobile/homepage/choice-mafia-v2.webp`

Desktop pair: 141340 bytes. Mobile pair: 45080 bytes. Each desktop is below
160000 bytes and each mobile is below 55000 bytes, including the stricter
decimal interpretation of the requested KB targets.

## Provenance

The original 1536 x 1024 PNG outputs remain unchanged under:

`C:/Users/Administrator/.codex/generated_images/01a07c1e-3af0-78d1-8e00-46ccf5c1416a/`

| Role | Generated File |
| --- | --- |
| Accepted Werewolf original | exec-f652715b-9eca-471b-8895-3d9ed72691ff.png |
| Mafia initial generation, not published | exec-38058e9a-fdce-4077-a439-c800ea712db2.png |
| Accepted Mafia refined output | exec-5956e7da-f749-4c55-9a86-5a2c7cd7a1c2.png |

The two initial calls had no reference images. Only the Mafia initial output
was passed as the target of the refinement; it was inspected first. The
Werewolf output was not passed to the Mafia generation or edit. The v1
provenance document was workflow context, not an image-generation reference.
The tool did not expose a seed or explicit model version; neither is claimed.
Re-running the prompts is a new generation, not a deterministic reproduction.
Deterministic reproduction here starts from the accepted stored PNGs.

Published SHA-256 values:

| File | SHA-256 |
| --- | --- |
| source/choice-werewolf-v2.png | c29a07b90aef64629acc3cd5d6582e644c94afa02d7a7085c638e7c136c50b74 |
| source/choice-mafia-v2.png | 03363e3f1cdd7dd30d1c37457907d622baee676130d00b95ccea8cf1669e6e61 |
| desktop/choice-werewolf-v2.webp | 37f49b1c82b3dc16facee301c16b4822b8bff589c41ea1cdf4a50b7fed0972d2 |
| desktop/choice-mafia-v2.webp | e7d0c5d50e9eda0f152d633629ff5170352a1f2926f838e019876ea0670693f5 |
| mobile/choice-werewolf-v2.webp | deb695f4c64fad94effba21a4b7b78eb4a09076f072c1617a21ffbea2e922203 |
| mobile/choice-mafia-v2.webp | e434fa4fe0a841cf204505f480950fd4bf6488f05116b7f3f76c7ec991bfc1cf |

The source, desktop, and mobile labels map to the corresponding directories
in the deliverables table.

## Encoding And Reproduction

Runtime used for this handoff:

- Node `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`.
- Workspace Sharp 0.35.4, libvips 8.18.6, libwebp 1.6.0, imagequant 2.4.1.
- Native Windows encoder, `WEBP_QUALITY=82`, `ASSET_FILE_CONCURRENCY=1`.

Each accepted original was normalized independently to its new source PNG
with the existing pipeline's palette settings, with no crop, compositing,
color grading, or intermediate mobile PNG:

```js
sharp.concurrency(1);
await sharp(original)
  .rotate()
  .resize({ width: 960, withoutEnlargement: true })
  .png({
    compressionLevel: 9,
    palette: true,
    quality: 78,
    effort: 10,
    adaptiveFiltering: true,
  })
  .toFile(newSourcePath);
```

Use the accepted original-to-source mappings above. Both masters are below
the existing 500 KiB source threshold, so the optimizer preserves their bytes.

The exact mobile-width rule now accepts only
`homepage/choice-(werewolf|mafia)-v[12].png`. Other directories, nested paths,
unknown families, other versions, suffixes, backup names, and recursive
mobile derivation remain excluded. Dedicated mobile-source precedence stays
unchanged.

Only the exact two v2 masters receive the new limits:

- Desktop maximum width 960; budget 160 KiB; default quality 82.
- Mobile width 720; budget 55 KiB; preferred quality 70.
- Existing WebP effort 6, smart subsampling, and quality fallback remain.
- Aspect ratio is preserved without enlargement, producing 960 x 640 and
  720 x 480 files directly from each master.
- No AVIF, public PNG, or role thumbnail is generated for these names.

V1 retains its pre-existing width/budget policy (desktop maximum 1400 and
360 KiB; mobile 720 and 180 KiB). Its six stored source/runtime files were
SHA-256 checked before and after this task, with no changes.

To reproduce without touching the shared catalog:

1. Create a new temporary root containing
   `assets/game-art-source/homepage` and `apps/web/public/game-art`.
2. Copy only the two v2 repository masters into its source directory.
3. Run the repository's absolute `scripts/optimize-assets.mjs` path with the
   Node executable above, the temporary root as the process working directory,
   `WEBP_QUALITY=82`, and `ASSET_FILE_CONCURRENCY=1`.
4. Check source bytes are unchanged. The only outputs must be the two desktop
   and two mobile WebPs listed above. Run again and compare all four buffers.
5. For a deliberate asset refresh, copy back only those four v2 WebPs. Do not
   run the full optimizer when only these assets need regeneration.

That exact isolated procedure produced the published files and passed
byte-for-byte repeatability. The regression test automates temporary-tree
reproduction for both v1 and v2; it additionally deletes mobile outputs before
the second run to prove they are recreated. It checks dimensions, budgets,
source preservation, byte equality across runs, and the exact output set.

```powershell
$node = 'E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe'
& $node --test scripts/optimize-assets.test.mjs scripts/run-asset-generators.test.mjs scripts/critical-mobile-assets.test.mjs scripts/asset-digest.test.mjs
```

The repository's canonical runner uses pinned Linux tooling. In addition to the
native Windows checks, the two v2 masters were copied into an isolated temporary
root and processed with `runAssetGenerators`, only `scripts/optimize-assets.mjs`,
and Sharp 0.35.4 in the pinned Node 24.20.0 Bookworm image. SHA-256 comparison
confirmed all four Linux WebPs are byte-identical to the published files. This
was a scoped check, not a regeneration of the unrelated catalog. No encoder
policy was changed.

## Visual Review

Both accepted generated files were inspected before normalization. Six
Chromium screenshots then checked the actual encoded desktop/mobile WebPs
in centered `object-fit: cover` slots:

- Desktop: 560 x 380.
- Mobile: 340 x 260.
- Extra center-crop stress check: 320 x 320.

All image decodes, natural dimensions, slot dimensions, and nonblank pixel
checks passed. All six screenshots were inspected.

The Werewolf has one coherent head and shoulder silhouette, a closed mouth,
and visible face detail high and central. The lantern and village threshold
support the story, with dark foreground material below. The Mafia image has
one woman, credible face/neck/arm anatomy and a plausible single visible
hand holding one sealed envelope. The refinement raised the gesture below
the chin, leaving the lower coat/cafe materials quieter. Both the face and
envelope survive the mobile and square crops.

No crowd, group at a table, extra reflected person, text, watermark, border,
gun, or gore was observed. The urban architecture is an illustrative Sofia
setting, not a documentary claim about a particular historic cafe.

Local review screenshots remain outside the repository under:

`C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/`

- `homepage-choice-v2-werewolf-desktop.png`
- `homepage-choice-v2-werewolf-mobile.png`
- `homepage-choice-v2-werewolf-square.png`
- `homepage-choice-v2-mafia-desktop.png`
- `homepage-choice-v2-mafia-mobile.png`
- `homepage-choice-v2-mafia-square.png`

These are isolated asset crop checks. Integrated homepage acceptance is covered
by `homepage-polish.spec.ts`, `homepage-character.spec.ts`, and the homepage
cases in `visual-regression.spec.ts`: both themes, responsive layouts, public
navigation, image delivery, and the separation of card artwork from copy.

## Validation

- The focused new tests first failed because v2 had no mobile derivative rule
  and retained the generic desktop width. They passed after the scoped change.
- The four narrow asset test files in the command above passed: 19 tests.
- The isolated two-master staging run preserved source bytes and reproduced
  all four published v2 WebPs identically on a second run.
- Six Chromium crop/decode/pixel checks passed and screenshots were reviewed.
- `node scripts/check-agent-guidance.mjs` passed. Scoped `git diff --check`
  passed for the optimizer and test changes.
- Final integrated checks passed: 64 landing unit tests, 36 browser tests
  (including 14 visual comparisons), typecheck, regression contracts, and a
  fresh production build. Six homepage baselines changed after visual review;
  the eight separate family-home comparisons remained unchanged.
- `pnpm perf:budget` passed against the fresh build: homepage declared client
  JS 20.1 KiB, CSS 57.1 KiB, art corpus 42185.2 KiB. The existing homepage CSS
  warning is 56 KiB and its hard limit is 62 KiB. No budget was raised.
- The canonical Linux check reproduced all four v2 WebPs byte-for-byte. It
  does not claim verification of the full unrelated asset catalog.

## Generation Prompts

### Werewolf Original

```text
Use case: illustration-story.
Asset type: original premium homepage game-choice artwork, one complete landscape image in 3:2 aspect ratio, 1536x1024. A finely authored painterly dark-fantasy storybook still, suitable for the front of a beautiful Bulgarian folk-mystery board-game box.
Scene/backdrop: an old Bulgarian mountain village threshold at blue dusk. Weathered pale plaster, heavy dark timber doorway, glimpses of stone-roofed mountain houses and a forested ridge beyond. One small real hanging oil lantern on the doorpost, its flame a restrained warm accent against emerald forest and silver moonlight.
Subject: ONE compelling imposing werewolf, standing quietly just inside the open village doorway, its powerful upper torso and fully visible noble lupine head emerging from the shadow. Concealed intent rather than attack. Closed mouth, no bared teeth, believable wolf muzzle, natural ears and eyes, credible neck and broad shoulder anatomy. Dark ash fur with finely painted silver guard hairs; head subtly turned, intent gaze just past the viewer. No other figure, human, animal, face, or crowd.
Style/medium: authored oil and gouache book illustration with deliberate brush shapes, exquisite edge control, nuanced fur and timber texture, elegant chiaroscuro, limited jewel-toned palette. Painterly realism, not photorealism, not glossy CGI, not a generic fantasy poster. The important face must be readily readable, not lost in blackness.
Composition/framing: a single continuous scene, landscape 3:2. The large main head is in the UPPER CENTRAL third, approximately x=38-62%, y=15-38%; ears entirely within the canvas, face and shoulders strongly legible after a centered narrow mobile crop. Upper chest extends to about 60% height. The bottom 35% is naturally quiet dark painted material: subdued coat-like fur and weathered threshold foreground, restrained texture, little contrast and no important anatomy or prop, for later HTML copy. No embedded overlay or text panel. Keep the entire story and small lantern above this lower field.
Lighting/mood: luminous blue dusk and moon-silver edge light reveal the face, deep emerald surroundings, restrained lantern gold, suspense and intelligent concealed threat, not aggressive horror.
Avoid: groups at a table, table scenes, empty tavern, generic crowds, additional characters, glowing neon eyes, gore, wounds, guns, weapons, bokeh blobs, oversized moon, excessive smoke, collage, diptych, split scene, text, letters, numbers, logos, watermark, border, frame.
```

### Mafia Original

```text
Use case: illustration-story.
Asset type: original premium homepage game-choice artwork, one complete landscape image in 3:2 aspect ratio, 1536x1024. A finely authored painterly 1930s noir storybook still, suitable for the front of a beautiful Bulgarian urban-mystery board-game box.
Scene/backdrop: a rain-streaked tall cafe window in 1930s Sofia, stone city facades and a distant period tram clearly suggested beyond wet glass, silver rain and restrained teal city glow. Inside, a little elegant dark art-deco window woodwork and burgundy upholstery. No other people.
Subject: ONE compelling elegant adult woman in a tailored burgundy 1930s wool jacket over an ivory blouse, sculpted short dark finger-wave hair, mature expressive plausible face in three-quarter view, composed wary glance toward the street. She is standing close to the cafe window, torso angled slightly, holding a single small plain ivory envelope with a burgundy wax seal discreetly against her upper sternum as though choosing whether to conceal it inside her jacket. ONE visible anatomically credible hand gently grips the edge of the envelope with relaxed natural fingers and a clear thumb; the other hand is naturally hidden. The subtle envelope gesture must be meaningful and legible, not an incidental object on a table. No hat hiding the face.
Style/medium: finely authored oil and gouache historical storybook illustration, tactile brushwork, deliberate shapes and edge control, beautiful modeling of face, wool, paper and wet glass. Sophisticated painterly realism and cinematic noir lighting, not photography, not glossy CGI, not a generic movie-poster pose or costume parody. Atmospheric but clearly readable.
Composition/framing: one continuous landscape 3:2 scene. The large whole head is in the UPPER CENTRAL third around x=40-60%, y=12-36%; face and the envelope hand all within the central half of the canvas for center-cropped mobile slots. Envelope and hand directly under the face, roughly y=42-57%, not at the bottom. Keep the head, shoulders, hand and envelope large enough to read at card scale. The bottom 35% is a quiet naturally dark material field of subdued burgundy jacket, cafe sill and shadow, low contrast and uncluttered for later HTML copy. No table group, no embedded text overlay or blank panel.
Lighting/mood: sculpted silver window light makes the face and paper legible, deep burgundy balanced against blue-green teal glass and neutral charcoal, sparse warm cream city-window reflections painted as real architecture, sophisticated tension. Brighter than a murky black scene, no dominant brown/amber tavern palette.
Avoid: extra people, crowds, extra faces in reflections, extra arms or fingers, group around table, empty tavern, glamour photograph, guns, weapons, gore, violence, bokeh blobs, neon signs, text, letters, numbers, logos, watermarks, frame, border, collage, split composition. No writing on the envelope or seal.
```

### Mafia Targeted Refinement

Edit target: `exec-38058e9a-fdce-4077-a439-c800ea712db2.png` from the generated
directory above. No other image was included.

```text
Use case: precise-object-edit.
Refine this existing single 3:2 painterly 1930s Sofia noir illustration. Keep the same woman's identity, plausible anatomy, head position, expression, hairstyle, burgundy suit, silver/teal rainy city, architecture and tram, and the same oil/gouache painting style.
Change only the envelope gesture and lower-field visual emphasis: move the existing sealed envelope and its one anatomically credible holding hand about 10 percent of the image height upward, closer to the collar, keeping them just below rather than covering the chin. Make the envelope moderately smaller if needed. The hand must be natural with one thumb and four believable fingers, with the upper arm and elbow comfortably tucked in. The envelope seal, paper and hand should all fit above y=63% of image height, central horizontally.
The bottom 35% must then become a quieter darker natural field of burgundy jacket and low-contrast cafe sill/material. Subdue the bright reflected street streaks in that bottom band, preserving the recognizable wet city scene above. No digital black gradient, no blank panel.
Preserve everything else. Keep exactly one woman and one envelope. No text or writing, no logo, no watermark, no frame, no collage, no extra limbs, no extra people, no guns or gore.
```
