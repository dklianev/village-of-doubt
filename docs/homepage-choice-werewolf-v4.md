# Homepage Werewolf Theme Art V4

Created on 2026-09-07 in **built-in imagegen edit mode** using the built-in
`image_gen` tool and
`C:/Users/Administrator/.codex/skills/.system/imagegen/SKILL.md`.
No CLI/API fallback, API key, explicit model version, or seed was used or
claimed. Every call requested 1536x1024 landscape and returned that size.

The latest request superseded the initial light-v3-only brief: this handoff
contains two newly generated v4 theme sources and this document. No light-v3
file was created. The original dark v3 source was used as the first edit
target and remains byte-identical. The new dark v4 is a generative night
edit of the new light composition, followed by one lighting refinement;
it is not the original dark source re-encoded.

## Owned Deliverables

Only these three new repository files were written:

- `E:/werewolf_mafia/assets/game-art-source/homepage/choice-werewolf-light-v4.png`
- `E:/werewolf_mafia/assets/game-art-source/homepage/choice-werewolf-dark-v4.png`
- `E:/werewolf_mafia/docs/homepage-choice-werewolf-v4.md`

| Source | Dimensions | Bytes | PNG Palette Quality | SHA-256 |
| --- | --- | ---: | ---: | --- |
| choice-werewolf-light-v4.png | 960 x 640 | 471566 | 70 | d42a78fb660f53466f09c16641af0b2fd9eecb12fffe47283f191bb5998294f5 |
| choice-werewolf-dark-v4.png | 960 x 640 | 470689 | 90 | 0c3b01188b83b36a5fef6603fd82a6c9399d157126188065c58f74eb6d03f7fe |

Both sources are compact 3:2 PNGs below 500 KiB. No WebP, mobile derivative,
public asset, optimizer, component, stylesheet, test, or other asset was
written by this handoff. No commit or goal was created.

## Intentional Invariants

- The same middle-distance Bulgarian village story: one ordinary fully
  human adult man with a lantern and one impossible wolf-headed cast shadow.
- Same face and identity, wary expression, hair, body proportions, stance,
  two connected arms, two natural hands, two legs, clothes and lantern grip.
- Same camera, 3:2 framing, perspective, relative scale and subject locations.
  The face remains near x=48%, y=27%; lantern near x=55%, y=51%; feet near
  y=81%. The shadow remains on the center-left plaster panel, approximately
  x=24-39%, y=24-69%.
- Same wall, carved timber posts, eaves, roofs, lane, village buildings,
  mountain silhouette and vegetation layout. Background illumination and
  material values change; the scene is not replaced.
- A single flat wolf-headed shadow with pointed ears, long snout, human-height
  shoulders and downward connection toward the man's feet. No separate solid
  wolf, mural, doubled shadow, floating head, or human transformation.
- Historical Bulgarian folk-horror oil-and-gouache painterly realism, natural
  materials, muted burgundy sash, localized warm lantern flame and quiet
  suspense. No cheerful/cartoon treatment, extra figures, extra limbs,
  lettering, logo, watermark, frame, neon or decorative glow.
- Existing center-left focal placement and uncropped full frame are retained
  for the main task's mobile treatment. This is visual compositional
  preservation, not a claim of pixel-identical geometry from generative edits.

## Theme Direction And Visual Review

The light original was inspected with `view_image` at `detail: original`,
then its encoded 960 x 640 source was inspected again. It has cool clear
late-afternoon illumination, pale limestone plaster, readable moss, timber
and stone, and silver-sage mountain layers. The lantern is a restrained warm
accent against daylight. The wolf-headed shadow remains distinct. This is
not an exposure filter or uniform yellow wash.

The first dark candidate was also inspected at original resolution. Its wall
and face were too subdued for the requested strong, readable moonlight, so it
was not selected. One targeted built-in edit strengthened selective moonlit
planes without applying a global brightness operation.

The accepted dark original was inspected with `view_image` at
`detail: original`, then its encoded 960 x 640 source was inspected again.
The final version has luminous silver-green plaster, modelled face and shirt,
selected silver-lit paving and distant rock, dark layered village roofs and
forest, and a small warm lantern accent. Roof recesses remain dark, while the
focal wall, man and shadow remain legible.

Visual inspection checked the face, shoulder-to-elbow-to-wrist connections,
relaxed hanging hand, lantern grip, two legs and feet, plus the single flat
wolf-headed shadow. No malformed anatomy, additional hands, confused shadow,
new figure, text or frame was observed in the accepted images. Encoding
preserved the scene and material detail without obvious banding at source
size. Hashes establish file identity, not anatomical correctness.

The main task owns live light/dark switching, borders, scrims, derivative
encoding, responsive mobile crops, browser/visual tests and performance
acceptance. No integrated browser or arbitrary cover-crop validation is
claimed here.

## Full Generated Originals

The generated PNGs remain unchanged at their built-in save paths. The rejected
dark candidate is retained for provenance, not delivered as a source.

### Accepted Light

Edit target:
`E:/werewolf_mafia/assets/game-art-source/homepage/choice-werewolf-v3.png`

Full generated path:
`C:/Users/Administrator/.codex/generated_images/01a07d8d-547d-7751-a78c-5d50811a9588/exec-5609d00e-e6ec-4571-8680-930be5b7e03a.png`

- Dimensions: 1536 x 1024 PNG.
- Bytes: 3653582.
- SHA-256: `4e85f796ee368293a1b9728a1715402ad30bd70db3a50ce058018e4c4206c7af`.

### First Dark, Not Selected

Edit target: the accepted light original above.

Full generated path:
`C:/Users/Administrator/.codex/generated_images/01a07d8d-547d-7751-a78c-5d50811a9588/exec-7cc4062c-0a73-4822-9f06-ca9dfcd4c222.png`

- Dimensions: 1536 x 1024 PNG.
- Bytes: 3065963.
- SHA-256: `434d609394a4d6b253095e249ea8ac5baace7fc40bf167b5c68dfd6df1e0a5e9`.
- Reason not selected: insufficient selective moonlight on focal plaster and face.

### Accepted Dark

Edit target: the first dark candidate above.

Full generated path:
`C:/Users/Administrator/.codex/generated_images/01a07d8d-547d-7751-a78c-5d50811a9588/exec-e6bcf6ed-50ff-4750-9da1-90c9aec78330.png`

- Dimensions: 1536 x 1024 PNG.
- Bytes: 3300834.
- SHA-256: `dc9850e32d1c472a3e0584d04bfffe7d2f93d0f597dc1df65fa1b60d5ff77097`.

## Standard Source Encoding

Runtime:
`E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`

Sharp 0.35.4 was resolved from `E:/werewolf_mafia/apps/web`. Only standard
resizing and PNG palette encoding were performed. There was no crop,
compositing, pixel retouching, sharpening, color grading or post-generation
lighting operation outside imagegen.

The light source's detailed daylight texture exceeded 500 KiB at palette
qualities 90, 85, 80 and 75. Those attempts remained in memory and wrote no
file. Quality 70 passed the budget and visual inspection. Dark passed at 90.

For each accepted original, the exact normalization pipeline was:

```js
sharp.concurrency(1);
const normalized = await sharp(acceptedOriginal)
  .resize({
    width: 960,
    height: 640,
    fit: "inside",
    withoutEnlargement: true,
  })
  .png({
    compressionLevel: 9,
    palette: true,
    quality, // Light: 70. Dark: 90.
    effort: 10,
    adaptiveFiltering: true,
  })
  .toBuffer();
```

Before writing, dimensions and the 500 KiB budget were asserted. Source paths
were created exclusively with `fs.writeFileSync(output, normalized, { flag: "wx" })`.
Reproduction starts from the retained accepted originals; rerunning a
generative prompt is not deterministic. The optimizer was not invoked.

## Verification And Scope

- Read-back Sharp metadata and SHA-256 checks verified both 960 x 640 PNG
  sources and all three generated 1536 x 1024 PNG originals.
- The existing v3 source was hashed before generation and after both v4
  sources were written. It remains 960 x 640, 487643 bytes, SHA-256
  `582f0fd74653569eb98891b637ee33777bff1574df420763f6933843da55e516`.
- The repository's `check:agents` script passed for all 10 guidance files,
  invoked directly with the required Node runtime:
  `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe scripts/check-agent-guidance.mjs`.
- No product copy changed, so dictionary validation was not needed.
- Browser/visual tests, `pnpm perf:budget`, derivative/canonical encoder checks,
  application tests and build were not run in this bounded source-only task.
  Those integrated checks remain with the main task.
- Other pre-existing and concurrent working-tree changes were left untouched.

## Exact Light Edit Prompt

```text
Use case: lighting-weather.
Asset type: LIGHT THEME homepage game-choice illustration, one half of a coherent day/night pair.
Input image 1 is the EDIT TARGET: the existing painterly Bulgarian village illustration. Edit this image, do not replace the scene. Request output 1536x1024 landscape, exactly 3:2.
Primary request: transform the scene into a distinctly light-theme, clear late-afternoon to early-evening COOL DAYLIGHT rendering. This is a carefully repainted illumination and material-color treatment, not an exposure filter, not a yellow wash. Keep the historical Bulgarian folk-horror oil-and-gouache painterly realism, with quiet suspense and natural human uncertainty.
Composition invariants: preserve the EXACT original camera, perspective, framing, positions, relative sizes, rooflines, buildings, plaster wall, carved timber posts, stone lane, mountain contours and vegetation. Do not zoom, crop, shift, or redesign the composition. Keep the SAME ordinary Bulgarian village man, exact face, age, hair, expression, fully human anatomy, pose, clothing construction, both arms, both hands, both legs, and lantern. His head remains around x=48%, y=27%; his feet end around y=81%; the lantern remains around x=55%, y=51%. Important subjects must stay in their existing area for the existing mobile crop.
The supernatural double identity is essential: keep the ONE clearly defined wolf-headed cast shadow in exactly the same place on the plaster wall to the man's left, around x=24-39%, y=24-69%, with its original pointed ears, long snout, human-height shoulders and body silhouette. It is a FLAT dark cast shadow, not a mural, not a second solid figure, not an actual wolf and not a floating head. Preserve its direction, scale, shape and natural connection toward his feet. Keep it clearly readable against pale plaster despite the lighter daylight.
Lighting and palette: pale cool limestone plaster with nuanced ivory-silver highlights, tactile grey-green moss, readable silver-grey cobblestone, naturally aged dark timber with visible grain. The distant mountains and trees become layered muted silver-sage, mineral grey and restrained cool green under a clear early-evening sky in the same background area, retaining cloud structure without a bright moon. Naturally lit skin and softly modelled linen, a muted BURGUNDY woven sash, charcoal wool clothing with legible folds. Localized warm amber from the SAME lantern flame, subdued against daylight, without a halo or glow blob. Give the light-theme image genuine brighter ambient illumination and selective clear edges, while retaining dimensional material shadows and a dark unmistakable uncanny shadow.
Keep the lighting controlled and polished, cool and atmospheric, neither cheerful nor decorative; not dominant brown, ochre or yellow. Preserve the lower stone-paving texture and existing quieter lower field without inserting UI or artificial scrims.
Avoid: any change to face, body, anatomy, pose, gesture or framing; extra fingers, hands, arms, legs, people, animals or objects; confused or doubled shadows; visible werewolf transformation; cartoon or glossy CGI style; neon, glowing eyes, bokeh, orbs, excessive fog; words, lettering, numbers, signs, logos, watermarks, borders, frames, collage, split panels. Change ONLY lighting, time of day and theme-appropriate material color values; all composition and story invariants remain unchanged.
```

## Exact First Dark Edit Prompt

```text
Use case: lighting-weather.
Asset type: NEW DARK THEME homepage game-choice illustration, the night companion of the supplied light-theme artwork.
Input image 1 is the EDIT TARGET: the accepted full-resolution light-theme Bulgarian village painting. Create a new, polished moonlit rendering by editing THIS image. Request output 1536x1024 landscape, exactly 3:2.
Primary request: an unmistakably NIGHTTIME silver-green Bulgarian mountain village, with sophisticated controlled illumination and layered background depth. This must be a newly rendered dark artwork, not a simple darkening filter, exposure reduction, or re-encoding. Retain historical Bulgarian folk-horror painterly oil-and-gouache realism, selective tactile brushwork, quiet suspense and a natural wary human expression.
STRICT composition and identity invariants: keep EXACTLY the same camera, perspective, framing, positions, relative sizes, house rooflines, wall, carved timber posts, cobblestone lane, mountain shapes and vegetation. Do not zoom, crop, shift, move or redesign anything. Preserve the SAME ordinary adult Bulgarian village man: same exact face, age, hair, expression, fully human anatomy, pose, garments, both arms, both hands, both legs, and same lantern with the same grip. Head stays around x=48%, y=27%, feet around y=81%, lantern around x=55%, y=51%. Important subjects must remain in their existing area so the existing mobile crop and the light/dark theme switch remain coherent.
Preserve ONE sharply intelligible wolf-headed CAST SHADOW on the plaster wall to his left, around x=24-39%, y=24-69%, in exactly its existing shape, direction, position and scale: pointed ears, long wolf snout, human-height shoulders and body, naturally connected downward toward the man's feet. The shadow is FLAT on plaster, not a painted mural, not a second physical figure, not a floating head, not a real wolf. The man remains entirely ordinary and human. This uncanny double identity is the focal narrative, and its dark silhouette must remain distinct from the wall.
Night lighting: believable strong but restrained directional MOONLIGHT grazes the limestone plaster, the man's face, linen sleeve and selected cobblestones. Pale mineral-silver plaster holds fine texture and a readable deep charcoal-green wolf shadow. Model his cheek, brow, nose, eyes, vest seams, wrists and hands with controlled moonlit planes and subtle natural warm bounce from the lantern. The SAME real lantern flame provides the small localized amber accent, brighter relative to night but with no halo, orb or exaggerated bloom. Avoid under-lighting horror faces.
Palette and depth: luminous SILVER-GREEN and sage-mineral moonlight, restrained charcoal and deep evergreen shadows, neutral limestone, naturally aged timber, cool stone, and the SAME muted BURGUNDY sash. Layer the distant forest and mountains through subtle atmospheric value separation; keep far ridges, roofs, moss and architectural timber readable. A dark clouded night sky with restrained moonlit cloud breaks, no oversized moon, no new object. Keep dark passages richly dimensional rather than crushed black. Do not make the whole image navy blue, brown, orange or teal. Warm lantern color occupies only a small accent area.
Polish: deliberate brush edges, luminous material highlights, believable fabric and stone, sophisticated night color relationships, environmental depth without clutter. Preserve the lower lane's quieter texture field with sufficient detail, not a black gradient, scrim, vignette or UI background.
Avoid any anatomy, pose, face, clothing-construction or composition change; extra fingers, hands, arms, legs, people, animals or props; confused/doubled shadows; actual werewolf transformation; cartoon styling, glossy CGI, cheerful mood; neon, glowing eyes, orbs, bokeh, thick fog; words, letters, numbers, signs, logos, watermarks, borders, frames, collage, split scene. Change ONLY illumination, time of day, color relationships and atmospheric depth. All structural and story invariants remain unchanged.
```

## Exact Accepted Dark Refinement Prompt

```text
Use case: lighting-weather.
Input image 1 is the EDIT TARGET: the newly generated DARK THEME Bulgarian village illustration. Output 1536x1024 landscape, exactly 3:2.
Make ONE targeted polish change: improve the selective MOONLIT KEY ILLUMINATION. The current plaster wall and the man's face are too dim for a readable homepage illustration. Repaint the existing moonlight as a broader, noticeably brighter silver-sage light falling across the central plaster panel behind the man and wolf shadow, the man's face and linen shirt, and selected lane stones near his feet. The lit plaster should read as pale mineral-silver stone IN NIGHT LIGHT, visibly lighter than the surrounding roof and timber, not merely a medium-dark blue wall. The wolf-headed shadow must therefore become much more distinct against it. Preserve rich dark-grey detail inside that shadow, with crisp pointed ears and a long snout.
Keep the sky and village genuinely nocturnal, with deep evergreen and charcoal shadows. Do NOT raise exposure uniformly and do not make it daytime or twilight. The extra readability comes from brighter SELECTIVE moonlit material planes, subtle moonlight bounce and controlled contrast, not a filter or grey wash. Strengthen delicate silver-sage edge light on the same distant mountain escarpment and existing stone roofs so the background has readable layers, while still darker than the focal plaster panel. Keep neutral skin, a small warm amber lantern accent, the muted burgundy sash and subdued aged timber; avoid dominant navy/blue and avoid crushing black detail.
STRICT INVARIANTS: preserve EXACT original camera, framing, perspective, relative sizes and every structural position. Same house, wall, posts, roofs, mountains, trees, lane. Same ONE ordinary fully human Bulgarian village man, exact face/identity, age, hair, expression, pose, garment construction, both connected arms, natural hands, both legs, feet, lantern and grip. Same ONE FLAT wolf-headed cast shadow in the EXACT original place, shape, size and direction, connected toward his feet: never a second physical figure or mural. The important subjects remain in their existing center-left area for mobile crops. Do not move any feature or change any anatomy.
Preserve the sophisticated historical Bulgarian folk-horror oil-and-gouache painterly realism and quiet suspense. No cartoon, glossy CGI, retouched photo, glow bloom, neon, orbs, fog, added figures or objects, extra limbs or digits, text, logo, watermark, frame, crop, new composition or split scene. Change ONLY this localized moonlit lighting balance and its physically plausible reflected light.
```
