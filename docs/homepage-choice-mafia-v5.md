# Homepage Mafia Choice Art V5

Created on 2026-09-08 for the explicitly approved warm/gold/ink palette
refinements of both Mafia homepage themes. This is an art-source-only handoff.

Execution: built-in `image_gen__imagegen` EDIT calls using
`referenced_image_paths`. No CLI/API fallback, new-scene generation,
external color grading, optimizer, or public-asset generation was used.
The tool did not expose a model version or seed; neither is claimed.

## Deliverables

| Final source path | Format | Dimensions | Bytes |
| --- | --- | --- | ---: |
| E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-light-v5.png | PNG | 960 x 640 | 440510 |
| E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-dark-v5.png | PNG | 960 x 640 | 309500 |

Both are below 500 KiB (512000 bytes). The main task was notified separately
when each source was ready, then notified that both were ready. The main task
also reported reviewing and accepting the compact light-v5 palette and
flat-card hand interaction. The main task owns CSS warmth, theme-pair
integration, derivatives, and browser/test acceptance.

### Final Source SHA-256

- Light-v5: `c5296e847f6a6951f8b5a5e3d455f01792e344645704ad88e420fb8c63ae1162`
- Dark-v5: `fdc2b8194ef019a3bbeb3bf5a500df8d945bf51f26a5455a323de2ee88b36678`

## Edit Targets

Both respective v4 files were inspected with `view_image` at original
resolution before any edit. Every generation used its respective v4 source
directly, not the other theme or a new composition. The accepted light
refinement was also generated directly from light-v4, not from the rejected
first candidate.

| Edit target | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-light-v4.png | 960 x 640 | 465130 | cf18dac8e420055ebc090bd606a97404bea5d39ad685113d693adbb6d51c4123 |
| E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-dark-v4.png | 960 x 640 | 335875 | cc689d2e89bfde79138efe84885fc53c35d561da67dbd65f305d42ef7ebae9ea |

Both v4 SHA-256 values were checked again after the v5 sources were created
and remained identical. Existing assets and earlier provenance documents
were not edited.

## Generated Originals

All full generated originals remain unchanged at the following built-in
output paths. There were three successful edit calls: two light candidates
and one dark candidate.

Every prompt requested exactly **1536 x 1024**. The built-in tool actually
returned **1537 x 1023** for all three. This native-output deviation is
recorded rather than represented as exact 1536 x 1024 generation. The
accepted outputs were resized directly to exact 960 x 640 final sources.

### Accepted Light Original

`C:/Users/Administrator/.codex/generated_images/01a07dad-4309-7660-a272-6eee3e1c15b5/exec-9b249627-a5e0-4c35-8a8e-441e246e34a3.png`

- Parent: `choice-mafia-light-v4.png`.
- Actual dimensions: 1537 x 1023.
- Bytes: 2685627.
- SHA-256: `16d39c92c863a9dc7579b2039ec453b0cb6963761355741b41cf5cc67c067d9b`.

### Accepted Dark Original

`C:/Users/Administrator/.codex/generated_images/01a07dad-4309-7660-a272-6eee3e1c15b5/exec-2afdb2a2-0c7d-4bec-8de5-6f90771393eb.png`

- Parent: `choice-mafia-dark-v4.png`.
- Actual dimensions: 1537 x 1023.
- Bytes: 2247170.
- SHA-256: `2a4da6993bb35850f6fed50774978b079cf35e42103907d38c0040bc5886b792`.

### Rejected First Light Candidate

`C:/Users/Administrator/.codex/generated_images/01a07dad-4309-7660-a272-6eee3e1c15b5/exec-1be4fc40-3a42-4a1c-9d6d-baa4bbb08eea.png`

- Parent: `choice-mafia-light-v4.png`.
- Actual dimensions: 1537 x 1023.
- Bytes: 2659339.
- SHA-256: `f87ad326bfeb36dd6fea45f916c74feddf2781426fe76046425a6ad0ca1f53cc`.
- Inspected with `view_image`; rejected because the broad beige/brown warmth
  was stronger than the requested restrained neutral treatment.
- Not copied into the repository or used as an edit target.

## Source Normalization

Runtime: `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`.
Sharp: 0.35.4, resolved from `E:/werewolf_mafia/apps/web`.

Only standard Sharp resizing and PNG encoding were performed. The full
1537 x 1023 image was resized to 960 x 640 with `fit: "fill"`; this applies
less than 0.2% aspect correction without cropping or adding a border.
Palette quantization is part of the PNG encoder settings below. No manual
painting, compositing, anatomy repair, sharpening, filters, tint, brightness,
contrast, saturation, gamma, or other color-editing operation was applied
outside the built-in image edit.

```js
sharp.concurrency(1);
const output = await sharp(acceptedOriginal)
  .resize({
    width: 960,
    height: 640,
    fit: "fill",
    withoutEnlargement: true,
  })
  .png({
    compressionLevel: 9,
    palette: true,
    quality: 90,
    effort: 10,
    adaptiveFiltering: true,
  })
  .toBuffer();

const metadata = await sharp(output).metadata();
if (
  metadata.format !== "png" ||
  metadata.width !== 960 ||
  metadata.height !== 640 ||
  output.length >= 500 * 1024
) {
  throw new Error("Invalid normalized source");
}
fs.writeFileSync(finalSourcePath, output, { flag: "wx" });
```

Each destination was created exclusively, without overwriting an existing
file. Replaying generation is nondeterministic; reproducible normalization
starts from the stored accepted original and the settings above.

## Visual Review

Both v4 inputs, all three generated originals, and both final 960 x 640
source PNGs were inspected with `view_image`, `detail: "original"`.

- Same overall composition, camera, doorway, etched glass, rainy city,
  standing younger man on the left, and seated older man on the right.
  The two principal identities, expressions, gaze and body poses remain
  visually recognizable and consistent with the edit targets.
- Both exchange arms were visually traced through shoulder, upper arm,
  elbow, sleeve, cuff, wrist and hand. No conspicuous detached or doubled
  limb, broken joint, or overlapping hand was observed.
- The single small card remains flat on the tabletop. Separate natural
  hands remain on its opposite sides with a visible gap; no floating card
  or shared pinching grip was observed.
- Light: neutral limestone/silver rain exterior, warm-neutral gray wall,
  ivory daylight, dark ink suits and wood, restrained wine-red fabric and
  small brass accents. The accepted image avoids the first candidate's
  broad beige cast and has no white fog.
- Dark: graphite/charcoal exterior replaces the dominant blue sky and cyan
  glazing. Oxblood fabric and subtle dark-green/charcoal interior undertones
  remain restrained. Street reflections read silver, with localized brass
  warmth around the existing practical and nearby floor.
- The dark source retains the existing small rear-right shaded lamp.
  The light source has no added lamp. No additional principal person,
  new foreground prop, logo, readable text or decorative frame was observed.
- Dark faces, hands, card, wool folds, chair texture, wall and foreground
  floor remain discernible, without obvious featureless clipped-black
  regions at the inspected sizes. Actual display brightness and integrated
  scrims can affect this and remain part of main-task acceptance.

This is a visual inspection, not a pixel-identical preservation claim or an
automated anatomical guarantee. Generative edits can change fine painted
detail. Full originals are retained for independent inspection. No integrated
crop, mobile viewport, CSS surface, scrim, theme switching or performance
acceptance is claimed here.

## Validation And Scope

- PNG encoding, exact final dimensions, sizes and SHA-256 were verified.
- Both v4 inputs remain byte-identical to their starting fingerprints.
- Only the two v5 PNG sources and this document were created in the
  repository by this task.
- No optimizer, public assets, UI, tests, goals or commits were changed.
- Per the explicit art-only instruction, no project test suite, browser
  test, agent-guidance command, performance-budget command or integration
  check was run. These remain with the main task.
- No color processing was applied after imagegen beyond standard PNG
  palette encoding during the required resize.

## Exact Accepted Light Prompt

```text
Use case: lighting-weather.
Asset type: Mafia homepage LIGHT THEME v5, restrained warm-neutral palette refinement.
Output: one edited image, exactly 1536 pixels wide by 1024 pixels high.

Image 1 is the EDIT TARGET, the original choice-mafia-light-v4.png. Edit this exact source with the smallest possible palette-only change. Do NOT create a new composition or redesign anything.

PRIMARY EDIT: remove the blue/cyan cast from the cafe wall, glazed windows and chair upholstery while retaining the original restrained daylight atmosphere and luminance. Wall plaster should be medium warm-NEUTRAL GRAY, NOT beige, tan, sand, brown, ochre or yellow. Outside, preserve neutral silver-gray rain and pale gray limestone facades; the soft overcast cafe light is neutral ivory-white with only the slightest warm tendency. Keep exterior whites close to neutral, not cream/yellow. Keep all suit cloth true ink-black and charcoal-gray. Keep original dark wood DARK, without increasing its brown/orange brightness. Recolor only existing chair upholstery and existing curtain fabric to muted low-saturation wine-red/burgundy, subtle rather than vibrant. Preserve existing brass hardware with tiny muted gold highlights only. Skin remains naturally neutral and low-saturation, not amber. No added lamp.
The result must feel warm-neutral compared with the source's cold cast, but NOT warm-filtered. Do not give the entire painting a brown, beige, orange, golden, sepia or yellow grade. Most large surfaces stay neutral gray, ink and limestone, with localized wine-red and understated brass accents. Preserve the source's painterly contrast and fine rain/stone/glass texture. No white fog, milky veil, black crush or loss of detail.

ABSOLUTE COMPOSITION AND IDENTITY LOCK: keep exactly the same two men and their exact source facial geometry, expressions, eyes/gaze, hair, head tilt, positions, scale, poses and clothing folds. Same standing dark-haired man left, same seated silver-haired man right. Same camera, complete framing, doorway width, etched-glass designs, mullions, furniture, architecture, floor perspective, table objects and silhouettes. Preserve the tiny EXISTING pedestrians exactly; do not add, duplicate, move, enlarge or clarify extra people. No new faces or reflections. Do not crop, zoom, flip, shift the composition, move the table, relocate objects or add props. Every shape in the source should remain registered.

CRITICAL HANDS/ARMS/CARD LOCK: preserve every visible source shoulder, upper arm, elbow, forearm, sleeve, cuff, wrist, palm, finger and thumb shape and position. Do not redraw the anatomy. The younger man's continuous shoulder-to-elbow-to-cuff-to-wrist-to-hand path and the older man's continuous shoulder-to-bent-elbow-to-table-supported-forearm-to-cuff-to-neutral-wrist-to-hand path remain identical. The small pale card remains FLAT ON the tabletop, same position, size and perspective, with the two natural separate hands on opposite sides and their existing clear gap. No holding or hovering card, no overlapping hands, no new/doubled/missing/fused digits or limbs, no altered arm length, no extra joint or exposed hidden arm. Relight and recolor the existing geometry only.

Same original period oil/gouache medium, brushwork and texture. No text, writing, logos, watermark, decorative frame, border, collage, split scene, new lamp, new people, new scene, new object, purple, neon or colored glow. Return the single complete edited illustration.
```

## Exact Accepted Dark Prompt

```text
Use case: lighting-weather.
Asset type: Mafia homepage DARK THEME v5, warm/gold/ink palette refinement.
Output: one complete edited image, exactly 1536 pixels wide by 1024 pixels high, landscape 3:2.

Image 1 is the EDIT TARGET: E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-dark-v4.png. EDIT THIS EXACT IMAGE, the existing nocturnal rainy cafe painting. Change ONLY palette and the balance of existing light. This is not a new composition or scene.

PRIMARY EDIT: remove the dominant cold BLUE city sky and CYAN/blue-green window glazing from the existing dark scene. The night sky and architecture become neutral graphite/ink/charcoal with very subtle dark-green undertones in the deepest atmosphere, not blue. Keep rainy glass clear neutral gray. Wet street and floor reflections are restrained NEUTRAL SILVER, with small physically localized warm-brass accents from existing practical lights only. Keep an elegant suspenseful noir nighttime feeling, with clear tonal depth. Recolor EXISTING interior chair and curtain fabric to subtle low-saturation oxblood/burgundy; existing walls/panels become graphite charcoal with barely perceptible dark-green undertones, never teal or cyan. Suits remain ink-black and neutral charcoal. Existing dark wood remains subdued, not bright brown.
Keep the EXACT existing small shaded brass lamp at the rear right, same geometry, size and location. Its practical light is localized warm ivory/brass, giving natural muted warmth to the older man's temple, cheek and the nearby tabletop, while soft neutral bounce keeps both faces and both exchange hands readable. Do not add a new light fixture, lamp, prop or source of dramatic glow. Do not make the light an orange wash across the whole scene. Retain silver rain reflections, grayscale architectural planes and shadow separation. Keep visible details in skin, fingers, wool folds, upholstery, wall texture and foreground floor. NO BLACK CRUSH, no featureless dark masses, no obscured faces/hands, no yellow/sepia/brown filter. This remains NIGHT, not daytime or dusk blue.

ABSOLUTE COMPOSITION/IDENTITY LOCK: same exact full canvas framing, camera, perspective, scale and scene geometry. Same two adult men, their precise faces/identities/expressions/gaze/hair and head tilt, poses, garment folds and positions. Same standing younger dark-haired man left and seated older silver-haired man right looking toward viewer/open doorway. Preserve the exact etched-glass door and handle, frame width, window mullions, curtain folds, rain, buildings, tiny EXISTING street silhouettes, table, glasses, chairs, existing rear-right lamp and floor lines. Do not zoom, crop, flip, move, restage, add/remove people or objects, invent reflected faces, change architecture or increase the background population.

CRITICAL REPAIRED ANATOMY AND CARD LOCK: preserve the exact shapes/positions of all visible shoulders, upper arms, elbows, forearms, sleeves, cuffs, wrists, palms, thumbs and fingers. The younger man's continuous shoulder-to-upper-arm-to-elbow-to-forearm-to-cuff-to-wrist-to-hand path stays unchanged. The older man's continuous shoulder-to-bent-elbow-to-table-supported-forearm-to-cuff-to-neutral-wrist-to-hand path stays unchanged. Keep ONE small pale card FLAT ON the tabletop in its original position, size and perspective, and TWO separate natural relaxed hands on opposite sides of it with the existing visible gap. Do not pick up or float the card, overlap or fuse hands, change joints, lengthen arms, add/fuse/miss/double fingers or limbs, or reveal hidden arms. Recolor and relight existing geometry ONLY.

Preserve the same period oil/gouache painterly medium, detail and texture. Avoid new composition, new scene, new people, new lamp props, added objects, logos, text, writing, watermark, borders, decorative frames, collage, split view, purple, neon, cyan glazing, blue cast, glossy CGI, white fog, bokeh, flare, sepia, black crush or blown-out practical light. Return only the single complete edited illustration.
```

## Exact Rejected Light Prompt

```text
Use case: lighting-weather.
Asset type: Mafia homepage choice artwork, LIGHT THEME v5 palette refinement.
Output: one complete edited landscape image at exactly 1536x1024 pixels, 3:2.

Input image 1 is the EDIT TARGET: E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-light-v4.png, the existing rainy daytime cafe painting. EDIT THIS EXACT IMAGE. This is a restrained palette refinement only, not a new composition, new scene, repaint of the people, or change of time/weather.

Change only the material colors and lighting color balance to match a warm/gold/ink site palette. Keep the rainy limestone street exterior naturally luminous in warm-neutral pale gray, limestone and ivory, without yellow tint. The cafe wall and diffuse light become warm-neutral gray/ivory rather than cold blue/cyan. Keep suits ink charcoal, wood restrained and dark, and introduce subtle brass highlights only on EXISTING metalwork. Recolor the existing curtain and chair fabric toward restrained desaturated wine-red fabric, with warm charcoal shadows. Natural neutral skin, readable faces and hands, nuanced period painting texture. Preserve the source's tonal separation, rainy architectural detail, and contact shadows. This remains overcast DAYLIGHT, not sunset. No blanket yellow/sepia treatment, amber wash, white fog, milky veil, flattened contrast, or washed-out doorway. Soften the cold blue/cyan cast without turning everything brown or beige. Warm highlights are subtle and physically localized.

LOCK EVERYTHING ELSE: same exact canvas framing, camera, perspective, scale and spatial composition. Same younger dark-haired man standing left, same older silver-haired man seated right looking toward the doorway/viewer. Preserve each identity, facial geometry and expression, hair, all body poses, garments and clothing folds. Door, etched-glass pattern, handles, mullions, rain, exterior buildings and existing tiny street silhouettes, curtain folds, chairs, table, glasses, floor lines and objects all stay exactly where they are. Do not crop, zoom, flip, restage, move figures, change depth, add a person, add reflected faces, or add any object. In particular do not introduce a lamp or new prop to the light scene.

CRITICAL REPAIRED ANATOMY LOCK: keep the already-repaired shapes of every shoulder, arm, elbow, sleeve, cuff, wrist, palm, thumb and finger exactly as in the input. Preserve the younger man's continuous shoulder-to-upper-arm-to-elbow-to-forearm-to-cuff-to-wrist-to-hand path and the older man's shoulder-to-bent-elbow-to-table-supported-forearm-to-cuff-to-neutral-wrist-to-hand path. ONE small pale card stays FLAT on the tabletop in the same position and perspective. The two separate natural relaxed hands remain on OPPOSITE sides of the card, with the existing visible gap. Do not pick it up, float it, pinch it, fuse the hands, move the hands, lengthen arms, alter joints, invent fingers, or reveal hidden arms. Color and relight the existing geometry only.

Preserve the same assured painterly period oil/gouache style and texture. No logos, text, lettering, watermark, border, decorative frame, split screen, collage, new scene, new people, new lamps, props, weapons, neon, cyan glow, purple, black crush or blown highlights. Return only the single edited illustration.
```
