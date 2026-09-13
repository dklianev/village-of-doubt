# Homepage Choice Art V3

Generated on 2026-09-07 using the built-in `image_gen` tool and
`C:/Users/Administrator/.codex/skills/.system/imagegen/SKILL.md`.
The initial handoff used two independent text-to-image calls, one per game.
The user subsequently rejected the Mafia image for malformed exchange arms
and hands that the initial review missed. One targeted built-in edit repaired
that original; the main task approved the repaired candidate after inspecting
it at 1536 x 1024. Werewolf is unchanged. No new scene, cast, collage, CLI/API
fallback, or dependency was introduced.

These replace the close-portrait art direction with two different narrative
scenes. Each game's composition is shared between the dark and light themes;
there are two illustrations, not four theme-specific artworks.

## Deliverables

Paths are relative to `E:/werewolf_mafia`.

| File | Dimensions | Bytes |
| --- | --- | ---: |
| assets/game-art-source/homepage/choice-werewolf-v3.png | 960 x 640 | 487643 |
| assets/game-art-source/homepage/choice-mafia-v3.png | 960 x 640 | 314816 |
| apps/web/public/game-art/homepage/choice-werewolf-v3.webp | 960 x 640 | 90464 |
| apps/web/public/game-art/homepage/choice-mafia-v3.webp | 960 x 640 | 54502 |
| apps/web/public/game-art/mobile/homepage/choice-werewolf-v3.webp | 720 x 480 | 32476 |
| apps/web/public/game-art/mobile/homepage/choice-mafia-v3.webp | 720 x 480 | 19880 |

Application URLs:

- `/game-art/homepage/choice-werewolf-v3.webp`
- `/game-art/homepage/choice-mafia-v3.webp`
- `/game-art/mobile/homepage/choice-werewolf-v3.webp`
- `/game-art/mobile/homepage/choice-mafia-v3.webp`

All outputs preserve 3:2 without cropping. Each desktop is below 160 KiB;
each mobile is below 55 KiB. The desktop pair totals 144966 bytes and the
mobile pair totals 52356 bytes. Combined output size is 197322 bytes;
a normal viewport fetches the selected candidate for each game only.

## Visual Review

Werewolf: an ordinary adult villager carries a lantern along a Bulgarian
mountain village lane. His cast shadow has a distinct wolf-shaped head on
pale plaster. Carved timber, a red woven sash, cool mountain moonlight and a
restrained warm window support the setting. This is an environmental scene
with a full human figure, not a wolf-head or human-head portrait. The face,
wolf-shaped shadow head and lantern are in the upper portion. Lower legs
continue below that focal area into relatively quiet stone paving.

Mafia: two suited adults exchange one small playing card resting flat on a
cafe table, seen through a partly open etched-glass doorway. The older man's
forearm rests on the table, with the two relaxed hands at opposite ends of
the card rather than pinching it in midair. The older man looks toward
the opening. Rainy old-city architecture beyond the window provides depth;
petrol upholstery and muted burgundy support the silver-lit noir scene. Both
main faces, the hands and the exchanged card are in the upper half. Near
furniture, doorway and floor provide a quieter lower field. Small distant
street silhouettes are background context, not additional exchange subjects.

The initial full-scene and mobile reviews did not catch the Mafia arm/hand
defect reported by the user. The previous blanket claim that the hands and
card interaction were plausible was incorrect and is withdrawn. Encoder
checks and SHA equality do not establish anatomical correctness.

For the repair, the rejected original was viewed first, then the edited
1536 x 1024 output was inspected using native-resolution crops, without
thumbnail reduction: x=620, y=240, width=620, height=360 for both connected
arms; x=675, y=380, width=290, height=150 for the hands and card. The review
traced shoulder, elbow, sleeve, cuff and wrist connections, and checked the
separated hands/fingers around the flat card. The main task independently
reviewed the full-resolution edit and approved it before publication.
The staged desktop and mobile WebPs were also inspected before replacement.

The human-versus-shadow contrast and repaired card exchange remain readable
after encoding. No embedded text, logo, watermark, gore, prominent weapon,
collage or duplicated table composition was observed. These are original illustrative
settings, not documentary depictions of a particular village or cafe.

The source previews were shared as soon as the 960 x 640 masters were ready.
The main task owns responsive framing, overlays, themes, copy and integrated
browser acceptance. This handoff does not claim that arbitrary cover crops
or later scrims have been validated.

## Provenance

All original and edited 1536 x 1024 generated PNGs remain unchanged under:

`C:/Users/Administrator/.codex/generated_images/01a07c1e-3af0-78d1-8e00-46ccf5c1416a/`

| Image Lineage | Generated File |
| --- | --- |
| Werewolf, current and unchanged | exec-7737bb31-82c5-4441-b957-4374796a22c2.png |
| Mafia original, rejected for arm/hand defects | exec-35cdd3bf-88b6-4c8c-b4f6-8468d16fc043.png |
| Mafia repaired, current and approved | exec-6d5e9ba3-c270-4095-8eac-a3eeb7921c3f.png |

The two initial calls used only their own text prompts, with no image
references. The repair used only the rejected Mafia original as its edit
target after viewing it; no Werewolf or other image was included. The tool
did not expose an explicit model version or seed; neither
is claimed. Replaying a prompt creates a new image. Deterministic asset
reproduction starts from the stored accepted PNGs.

| File | SHA-256 |
| --- | --- |
| Source Werewolf PNG | 582f0fd74653569eb98891b637ee33777bff1574df420763f6933843da55e516 |
| Source Mafia PNG | eaf37d132b035ebd118b01ee98d9c5fb78406bae8d8df887f4503e8ffd2347e4 |
| Desktop Werewolf WebP | 459f7b4bf615268f350efe18d0fc9b15ed9c4e3fbe660386a6f4a3e89508fdb9 |
| Desktop Mafia WebP | 99fb9d631956b9bc97122256efb2c99f7be2a1ad24d91cc5e4b6649c4d25da06 |
| Mobile Werewolf WebP | 2a37d01eccead6fad5b80f6afad1e36b220feff18598fe380716c7395c86a5ce |
| Mobile Mafia WebP | 3c740057f37f39f3aaa3a7a7b1ee34649090cb9beb7bd4f34942d9230d78d798 |

The replaced, rejected Mafia files had SHA-256 values
`086ca15165756f004fe88bb4c863b60bbfcd03f3a10642e58f0f916bae4e1dac`
(source), `6add4a70c92eb64c26ca53cd92064b84335212cd150d5d5a4c983c185cfee26c`
(desktop), and `a711d4ef035af500faf0d4d091ef93744b46149c75c5bcffbd1cbaaf1424371e`
(mobile). These historical hashes identify the rejected art, not the current
deliverables.

Native-resolution review crops remain outside the repository under
`C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/`:

- `mafia-v3-rejected-hands-native.png`
- `mafia-v3-repaired-arms-native.png`
- `mafia-v3-repaired-hands-native.png`

## Source Normalization

Native normalization used Node 24.20.0 at
`E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe` and workspace
Sharp 0.35.4. Both accepted originals fit the 500 KiB source budget using
palette quality 90, so no lower-quality fallback was needed:

```js
sharp.concurrency(1);
const normalized = await sharp(acceptedOriginal)
  .rotate()
  .resize({ width: 960, withoutEnlargement: true })
  .png({
    compressionLevel: 9,
    palette: true,
    quality: 90,
    effort: 10,
    adaptiveFiltering: true,
  })
  .toBuffer();
```

Write each buffer to the corresponding new source path in the deliverables
table. No crop, compositing, additional color grading, or mobile PNG is used.
Both source masters remain below 500 KiB, so the optimizer does not trim them.

## Canonical Reproduction

The main task owns the optimizer and test changes. This artwork task did not
edit either shared file. Its updated rules give the exact v3 source names the
existing compact choice-art policy:

- Desktop: maximum width 960, 160 KiB budget, default WebP quality 82.
- Mobile: width 720, 55 KiB budget, preferred WebP quality 70.
- Existing WebP effort 6, smart subsampling and budget fallback.
- No public PNG, AVIF, thumbnail or separate theme duplicate.

Initial reproduction was isolated to a temporary root containing only the two
source PNGs, an empty `apps/web/public/game-art` directory, and a copy of
`scripts/optimize-assets.mjs` for the canonical runner.

1. Run the repository's absolute optimizer script path with the temporary
   root as working directory, using native Node and
   `WEBP_QUALITY=82`, `ASSET_FILE_CONCURRENCY=1`. The absolute repository
   script path lets native Node resolve the workspace Sharp dependency.
2. Retain all four native output buffers.
3. Import the unchanged repository `runAssetGenerators` and invoke it against
   that same isolated root:

```js
runAssetGenerators({
  rootDirectory: isolatedRoot,
  sharpVersion: "0.35.4",
  generators: ["scripts/optimize-assets.mjs"],
});
```

On Windows this dispatches Docker with the pinned canonical Linux image:

`node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`

Sharp 0.35.4 is read from the repository manifest and installed by the existing
runner inside the container. Canonical desktop/mobile quality defaults match
the native run.

4. Assert the canonical output set is exactly the four WebPs listed above;
   check dimensions, budgets and each full-file SHA-256 against the native
   buffer. Assert both staged sources and repository masters are unchanged.
5. Only after all comparisons pass, copy the four canonical outputs into
   their new v3 runtime paths using exclusive creation. Read them back and
   confirm the published hashes also match.
6. Remove only the verified temporary tree. Never run the broad optimizer
   over the shared dirty repository for this bounded handoff.

The initial run processed exactly two source assets and produced four runtime
outputs, with matching native, canonical Linux and published SHA-256 values.
The Werewolf files still retain those verified values.

The approved Mafia repair repeated this pipeline in a fresh temporary tree
containing only the repaired Mafia master. Exactly one source and two WebPs
were generated. The native Windows and canonical Linux hashes matched for
both repaired WebPs, and the staged source remained byte-identical with no
trimming. The repaired PNG and WebPs were held in staging for main review.

After explicit approval, the three existing Mafia files were checked against
their rejected-original hashes to guard against intervening changes. Only
those three owned, uncommitted files were replaced with the verified staged
repair. Published dimensions, byte sizes and hashes were checked again.
All three Werewolf v3 hashes were verified unchanged before and after this
replacement. The temporary tree was then removed. No full-catalog run occurred.

## Validation And Scope

The five main-owned optimizer tests below passed at the initial handoff,
before the Mafia anatomy rejection; they were not rerun for the repair.
The agent-guidance check was rerun after the repair documentation update:

```powershell
$node = 'E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe'
& $node --test --test-name-pattern 'homepage choice|new story art|720x480' scripts/optimize-assets.test.mjs
& $node scripts/check-agent-guidance.mjs
```

- At initial handoff, five focused tests passed, including exact-path policy
  and real-master mobile regeneration with reproducible desktop/mobile output.
- Initial native/canonical Linux SHA comparison passed for all four outputs;
  the repair separately passed the same comparison for its two new Mafia WebPs.
- Image dimensions, source/runtime budgets and unchanged masters passed.
- The original Mafia review missed the reported defect; the repair received
  native-resolution arm/hand inspection and explicit main-task approval.
- Agent-guidance check passed.
- Initial owned changes were six v3 art files and this document. The repair
  replaced only the Mafia source/desktop/mobile files and updated this document.
- No optimizer/test, React, CSS, browser-test, invitation, Werewolf or unrelated
  source/runtime file was edited during the repair. No browser suite was run.
- No full build, full-catalog optimization, commit or goal creation was run.
  Integrated UI/browser/performance acceptance remains with the main task.

## Mafia Anatomy Repair Prompt

Edit target: `exec-35cdd3bf-88b6-4c8c-b4f6-8468d16fc043.png` from the generated
directory above. The resulting `exec-6d5e9ba3-c270-4095-8eac-a3eeb7921c3f.png`
was approved by the main task after full-resolution review.

```text
Use case: precise-object-edit.
EDIT the attached existing 1536x1024 painterly 1930s Sofia cafe illustration. It has an anatomical defect in BOTH men's exchange arms/hands. Preserve the SAME setting, camera, doorway, etched glass, city rain window, chairs, both men's exact faces and identities, hair, expressions, body locations, suits, lighting, painterly oil/gouache style, color palette, and overall 3:2 composition. Do not invent a new scene or cast. Keep the lower quiet copy area unchanged.
Change ONLY the two exchange arms from their existing shoulders through elbows, sleeves, cuffs, wrists and hands, plus the small card and the immediate tabletop contact area. Make the anatomy unambiguously connected and easy to read. No stylized deformation.
SIMPLIFY THE GESTURE: place the ONE existing small playing card FLAT on the small table between them, its pale patterned back upward, rather than hanging between contorted grips. Both men lightly touch opposite ends of this same card with relaxed separated fingertips. Two distinct hands with a small clear gap, not overlapping each other.
Older man seated on the RIGHT: reconstruct the entire visible reaching arm with a clear normal upper arm descending from his existing shoulder to ONE elbow comfortably bent near the table edge. His forearm then runs naturally along the tabletop toward the card, supported by the table, with ordinary upper-arm/forearm proportions. Show the sleeve as one connected tube, a clean white cuff, a neutral straight wrist and ONE relaxed palm-down hand with four anatomically separate fingers and one thumb. No dislocated elbow, no floating forearm, no doubled sleeve, no reversed hand, no fused fingers. His fingertips lightly contact the right end of the flat card; don't clench or pinch in midair.
Younger man behind the LEFT side of the table: reconstruct his visible exchange arm as a connected shoulder, upper arm, one gently bent elbow, natural forearm, clean cuff and neutral wrist, ending in ONE relaxed palm-down hand reaching from his side of the table. His fingertips lightly contact the opposite left end of the card. Clearly separate fingers where visible, one natural thumb, five digits total, no broken wrist, no claw-like or mitten grip. Keep his other arm naturally obscured as before.
Keep the repaired hands and flat card in the upper half near the existing exchange location, not at the bottom. Preserve tabletop perspective and believable contact shadows. Glasses can shift minimally only if required to avoid intersecting an arm. Do not move or change the faces. No extra arms, hands, cards or people. No writing, logos, text, watermark, frame, guns or gore.
```

## Werewolf Prompt

```text
Use case: illustration-story.
Asset type: one original complete painterly Bulgarian folklore mystery scene for a homepage game-choice illustration. Landscape 3:2, 1536x1024. A narrative scene seen at middle distance, NOT a portrait or a huge wolf head. The same image must work in both light and dark site themes.
Scene/backdrop: twilight in an old Bulgarian mountain village, a descending irregular stone lane beside a pale white-plaster house with carved dark timber posts and a shallow wooden eave. A glimpse of forested mountains and neighboring vernacular houses above. Cool blue-green moonlight, restrained amber from one distant window, small red wool detail. Finely authored oil and gouache folk-storybook realism with crisp selected texture and deliberate brush shapes, not a photograph, not glossy CGI, not imitation of an existing IP.
Narrative subject: ONE ordinary adult male villager, fully human, about forty, in simple wool vest, linen shirt and dark trousers with a small muted red woven sash. Seen at middle distance in three-quarter side view, he carries a modest real oil lantern in one natural hand, ahead of his torso near the wall, pausing to glance warily down the lane. His posture, head, two arms and legs must be anatomically plausible. He is not a heroic model posing for a poster.
The secret: behind him on the pale village wall, his single cast shadow has an unmistakable WOLF-SHAPED HEAD with pointed ears and a long snout on human-height shoulders. This is a flat dark SHADOW on the plaster, attached naturally toward his feet, not an actual second creature, not a floating face or a painted wolf mural. The man looks entirely human; the impossible shadow quietly reveals a hidden identity. Make this human-versus-shadow contrast the clear visual story of social deduction. The lantern is low and forward enough that a shadow falls behind him onto the wall.
Composition: wide village-lane film still, never a close-up. Keep the entire meaningful story inside x=20-85% and principally the upper 55% of the image. Place the ordinary man's head near x=68%, y=21%, his full figure extending only to about y=60%; his head is SMALL, about 8% of total image height. The wolf-shaped cast shadow is clearly readable on white plaster around x=35-55%, y=17-51%. Lantern near x=59%, y=43%, with a real localized amber flame, no glow blob. Both man and shadow must survive small landscape mobile display. White wall provides measured light contrast without washing out.
Bottom 35%: quiet low-contrast dark cool stone paving and restrained material texture for later live HTML heading, copy and buttons, with no important face, hand or story prop down there. Not an artificial black overlay, not empty flat gradient. Texture is detailed where meaningful but never noisy wallpaper.
Mood/palette: intelligent concealed threat, cool moon-silver, deep evergreen and petrol, natural skin, pale plaster and one restrained amber light. Suspense and human uncertainty, not aggressive horror.
Exclude: close-up portraits, giant human heads, actual visible werewolves, giant wolf head in foreground, groups around a table, extra people, extra reflected faces, extra limbs, cartoon anatomy, blood, gore, weapons, glowing eyes, bokeh blobs, luminous orbs, heavy fog, giant moon, candles, letters, words, numbers, symbols resembling text, logos, watermark, border, collage, split scene.
```

## Initial Mafia Prompt

```text
Use case: illustration-story.
Asset type: one original complete painterly 1930s Bulgarian noir narrative scene for a homepage game-choice illustration. Landscape 3:2, 1536x1024, shared unchanged between light and dark site themes. A distinctive clandestine film still seen at middle distance, NOT a headshot, not a close-up woman with an envelope.
Scene: view from an old-city cafe corridor THROUGH a partly open etched-glass doorway into an intimate elegant 1930s Sofia backroom. A narrow strip of patterned translucent etched glass and dark wooden door is visible near the left edge, revealing a layered view inside, not an opaque screen across the people. Subtle period geometric glass etching, worn petrol upholstery, restrained dark wood. Beyond the people, a sharply drawn rain-streaked city window with early twentieth-century stone facades and wet silver reflections. The setting is urban, secretive and inhabited, not a rustic tavern.
Narrative subjects: exactly TWO adult men in plausible 1930s tailored suits, seen at middle distance across a small cafe table. One dark-haired man about thirty-five in a charcoal suit and waistcoat is half-standing behind the far side of the table, leaning in slightly to pass ONE small face-down playing card with a simple pale geometric back. An older silver-haired man about fifty in a muted grey suit sits obliquely on the right, reaching naturally to accept the card while casting a guarded glance toward the half-open doorway. Their faces and hand positions tell a secret exchange rather than generic conversation. The card is an actual clearly bounded small paper rectangle between the hands, not an envelope. Anatomically credible shoulders, elbows, wrists, hands and adult faces, no extra limbs. No other person or face in reflections.
Composition: a real environmental story scene viewed through the opening, with doorway depth and a strong diagonal sightline to the exchange. Keep BOTH men, their faces, both relevant hands, and the exchanged card within x=25-82% and the UPPER 55% of the picture. Heads near y=20-32%, each head no more than about 9% of image height; action/card around x=53%, y=45-53%. Keep the viewer a few meters away, never crop a giant face into the foreground. Place the tabletop sufficiently high that the paper exchange remains above the lower copy area. No symmetrical lineup or staged poster pose.
Bottom 35%: quiet low-contrast petrol-charcoal door threshold, dark near furniture and floor material, with restrained visible painted texture and no important face, hand, or story prop. This is space for later HTML h2, copy, and buttons; do not embed any UI or artificial black gradient. Meaningful scene details stay above it.
Style: original finely authored oil and gouache 1930s noir storybook illustration, painterly realism with controlled edges, expressive credible small faces, crisp tactile wool, glass, paper and wood. Rich atmosphere with selective detail, not noisy wallpaper, not photography, not glossy CGI, not a copy of any film, franchise, character or known IP.
Lighting/palette: readable silver rain-window illumination and petrol-green shadows, a muted burgundy curtain or upholstery accent, warm neutral skin and small pale card; elegant restrained suspense, not dominant brown/gold and not murky black. No direct lamp or candle in view.
Exclude: close-up woman, envelope, huge heads, generic group portrait, four people around table, extra people, extra hands, face reflections, giant dramatic shadow creature, guns or weapons, gore, blood, cigarettes or smoke clouds, bokeh blobs, glowing orbs, candles, luminous fog, any writing, text, letters, numbers, signage, logos, watermarks, decorative frame, collage or split scene.
```
