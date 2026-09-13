# Homepage Mafia Choice Art V4

Created on 2026-09-07 for the explicit homepage day/night theme-art request.
Execution mode: **built-in imagegen edit mode**, via `image_gen.imagegen`
(`image_gen__imagegen` in the tool harness). Two successful image edits were
made, one for daylight and one for evening. No CLI/API fallback was used.
The tool did not expose a model version or seed; neither is claimed.

The request changed from a light-only v3 variant to a new light/dark v4 pair
after the daylight generation returned. That output became light-v4. No
light-v3 source or light-v3 document was created by this task.

## Deliverables

| Final source path | Format | Dimensions | Bytes |
| --- | --- | --- | ---: |
| E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-light-v4.png | PNG | 960 x 640 | 465130 |
| E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-dark-v4.png | PNG | 960 x 640 | 335875 |

Both sources are below 500 KiB. They contain the same cafe story and
composition with independently generated daylight/evening illumination.
The dark variant is a new imagegen edit with a new rear brass practical
lamp and nocturnal city lighting, not a re-encode of the existing dark v3.

### Final Source SHA-256

- Light-v4: `cf18dac8e420055ebc090bd606a97404bea5d39ad685113d693adbb6d51c4123`
- Dark-v4: `cc689d2e89bfde79138efe84885fc53c35d561da67dbd65f305d42ef7ebae9ea`

## Provenance

The repaired source was inspected with `view_image` at original resolution
before editing:

`E:/werewolf_mafia/assets/game-art-source/homepage/choice-mafia-v3.png`

It is a 960 x 640 PNG, 314816 bytes. Its SHA-256 was checked before and after
this task and remained:

`eaf37d132b035ebd118b01ee98d9c5fb78406bae8d8df887f4503e8ffd2347e4`

### Light Original

Full generated original, retained unchanged:

`C:/Users/Administrator/.codex/generated_images/01a07d8d-5681-71b1-b669-62be99c8d281/exec-76004161-0c77-4f7f-96a1-67a3b59afd24.png`

- Edit target: the repaired source `choice-mafia-v3.png` above.
- Requested generation dimensions: 1536 x 1024.
- Actual generated dimensions: 1537 x 1023.
- Original bytes: 2548626.
- Original SHA-256: `1841b8afafdd7d871463218467ee2c7ad3c1180efe76c24face27a9b7a24519b`.

### Dark Original

Full generated original, retained unchanged:

`C:/Users/Administrator/.codex/generated_images/01a07d8d-5681-71b1-b669-62be99c8d281/exec-2024536a-e435-4af4-9024-47050c8abdaa.png`

- Edit target: the full light original immediately above, inspected first
  with `view_image`. Using it anchors the new night image to the day image.
- Requested generation dimensions: 1536 x 1024.
- Actual generated dimensions: 1537 x 1023.
- Original bytes: 2192902.
- Original SHA-256: `a5e829543bc6fe9b636344ae5a9d41a10ef59d1db5050eb33aa5e8aab861c893`.

The full light original is the direct parent of the full dark original.
Replaying the prompts produces new images; deterministic normalization
starts from these stored, accepted original files.

## Source Normalization

Runtime: `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`.
Sharp: workspace version 0.35.4, resolved from `E:/werewolf_mafia/apps/web`.

Only standard resizing and PNG encoding were used. Because the built-in
tool returned 1537 x 1023 for each requested 1536 x 1024 image, the complete
image was resized directly to the required 960 x 640 source dimensions.
`fit: "fill"` applies a less than 0.2% aspect correction with no crop, border,
or added pixels. No color grading, compositing, sharpening, anatomical
retouching, or manual painting was applied outside imagegen.

```js
sharp.concurrency(1);
const normalized = await sharp(acceptedOriginal)
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
```

The resulting buffers were written to their respective final source paths
using exclusive creation. Both outputs passed the 500 KiB source-size check.

## Visual Review

Both generated originals were inspected using `view_image` with
`detail: "original"`, before normalization. Both final 960 x 640 PNGs
were then inspected at original resolution as well.

- Both variants preserve the two main subjects, faces, expressions, doorway,
  glass etching, windows, table, chairs, camera, and spatial arrangement.
- The younger man remains standing on the left of the exchange. The older
  man remains seated on the right, looking toward the opening/viewer.
- The small card remains flat on the tabletop, with two distinct relaxed
  hands on opposite sides. No floating card or overlapping grip was observed.
- Each visible exchange arm was traced from shoulder through upper arm,
  elbow, sleeve, cuff, wrist, and hand. No disconnected or doubled limb,
  broken joint, reversed wrist, or conspicuously fused/extra finger was
  observed. The anatomy follows the repaired source.
- Light: rainy silver daylight, readable muted celadon interior and charcoal
  suits, neutral faces, restrained mahogany. No sepia/yellow treatment.
- Dark: blue-green rainy evening city, localized warm shaded brass lamp at
  rear right, readable faces and card, visible textile/wood/floor detail in
  shadows. No purple/neon treatment or obvious black-clipped region.
- The existing tiny background street silhouettes are retained as setting
  context; no additional main figure or face reflection was introduced.
- No text, logo, watermark, decorative border, weapon, or gore was observed.

This is a visual review, not an anatomical guarantee or automated proof.
The full originals are retained for independent inspection. No integrated
homepage crop, scrim, border, responsive layout, or theme-switching acceptance
is claimed by this art-only handoff.

## Validation And Scope

- PNG format, exact 960 x 640 dimensions, byte sizes, and SHA-256 verified.
- Repaired `choice-mafia-v3.png` remains byte-identical.
- Agent-guidance check passed: `node scripts/check-agent-guidance.mjs`,
  the command behind `pnpm check:agents`, using the runtime above.
- Only the two v4 source PNGs and this document were created by this task.
- No components, optimizer, public derivatives, tests, other source assets,
  old provenance documents, commits, or goals were changed.
- Optimizer and derivatives were explicitly left to the main task.
  Browser/mobile/theme integration and `pnpm perf:budget` were not run here;
  they remain part of the main task's integrated validation after publication.

## Exact Light Prompt

```text
Use case: lighting-weather.
Asset type: Mafia homepage game-choice artwork, LIGHT THEME variant. Produce one landscape 1536x1024 image, 3:2.
Input image 1 is the EDIT TARGET: the attached repaired 960x640 painterly 1930s Sofia cafe artwork. Edit this exact composition, not a new scene. Preserve the same two subject faces and identities, hair, expressions, positions, scale, clothing, poses, and all doorway/window/table/card/hand placement.

Primary request: change ONLY the lighting, weather illumination, and theme-related color treatment into rainy overcast DAYLIGHT entering the cafe. Make the interior legible in muted celadon and charcoal; glass and limestone city buildings outside are cool silver in soft cloudy daytime light. Retain subdued mahogany furniture and worn upholstery. Faces, clothing, room planes, and floor texture must be readable without black crush. The atmosphere remains suspenseful human negotiation, with the same finely painted period oil/gouache detail and controlled brushwork. Use natural neutral skin, gray wool, cool soft daylight, restrained wood color, and gentle believable contact shadows. No sepia or yellow filter, no golden sunlight, no cinematic neon, no shiny CGI.

LOCK THE COMPOSITION: the same view through the partly open etched-glass doorway into the 1930s Balkan/Sofia cafe; the same dark-haired younger suited man standing behind the LEFT side of the small table; the same older silver-haired suited man seated on the RIGHT looking toward the viewer/open doorway. Keep the door and etched glass, window mullions, rain-streaked city buildings, curtain, table, glasses, chairs, foreground floor, camera, perspective, and proportions exactly where they are. Do not zoom, crop, flip, restage, change identities, or add a figure.

CRITICAL ANATOMY LOCK: the source already has repaired hands and arms. Preserve those exact correct shapes and joint placements; DO NOT redesign the exchange. Keep ONE small pale card lying FLAT on the tabletop in the same place. Keep two separate relaxed natural hands resting at opposite sides of the card, with a visible gap, not pinching a floating card and not overlapping. Preserve the younger man's continuous shoulder-to-upper-arm-to-elbow-to-forearm-to-cuff-to-wrist-to-hand path. Preserve the older man's continuous visible shoulder-to-bent-elbow-to-table-supported-forearm-to-cuff-to-neutral-wrist-to-palm-down-hand path. Both arms have normal lengths and believable sleeve continuity, one elbow and one wrist each. Hands have natural fingers and thumbs without extra, missing, fused, doubled, claw-like, twisted, or disconnected anatomy. Keep the other arms obscured as in the source. Relight these forms only; the already-correct anatomy and small card placement must stay unchanged.

Avoid: new people or reflected faces, new objects, extra arms/hands/fingers/cards, broken shoulders/elbows/wrists, changes to faces or pose, letters or readable writing, logos, watermarks, decorative frame, borders, weapons, gore, sepia/yellow grading, black-crushed shadows, saturated neon, spotlight effects, lens flares, glowing orbs, collage. Return the complete single edited illustration, not a comparison.
```

## Exact Dark Prompt

```text
Use case: lighting-weather.
Asset type: Mafia homepage game-choice artwork, DARK THEME v4 counterpart to the attached daylight artwork. Generate one genuinely new edited illustration at 1536x1024 landscape, 3:2.
Input image 1 is the EDIT TARGET: the new daylight Mafia cafe illustration. Preserve its exact composition and repaired anatomy to make a coherent day/night pair. This request is a new imagegen edit, NOT a re-encoding or uniform dark filter.

Primary request: transform this same 1930s Balkan/Sofia cafe scene into an elevated, refined nocturnal noir painting. Outside the rain-streaked glass is a blue-green rainy city EVENING, with cool silver wet limestone facades, subtle distant period streetlights and carefully controlled reflections. Inside, a small period brass practical lamp placed at the far RIGHT rear of the room, on the window ledge behind the seated man's chair and away from the table exchange, supplies a restrained warm ivory/amber pool of light. Keep the lamp modest in scale with a physically shaded bulb, not a glowing orb or giant highlight. Its light subtly warms the older man's temple, cheek, suit shoulder and the card/table contact area; believable soft bounce keeps the younger man's face and fingers readable. The cool rainy window light separates both figures from the background. Compose sophisticated warm/cool lighting with atmospheric depth and selective painterly detail, not a flat tint. The noir interior remains muted petrol/celadon/charcoal with subdued mahogany furniture and tasteful brass. Preserve visible shadow detail in faces, clothing, wall panels, upholstery and foreground floor. No black crush. Keep warm highlights localized; this is not a sepia/brown/yellow scene.

LOCK THE COMPOSITION AND IDENTITIES: exactly the SAME two suited adult men, same faces, hair, expressions, positions, scale, body poses and tailored suits. Same view through the partly open etched-glass doorway. Younger dark-haired man stands behind the LEFT side of the small table. Older silver-haired man is seated on the RIGHT and looks toward the viewer/open door. Doorway, glass etching, window mullions, rainy architecture, curtain, chairs, glasses, table, floor perspective and camera framing remain unchanged. Do not zoom, crop, flip, move figures, restage, add people, or invent reflected faces. Only the explicitly requested small rear brass practical may be added. Keep the main story and exchanged card where they are, in the upper half.

CRITICAL REPAIRED ANATOMY LOCK: preserve the existing natural arm and hand geometry from the edit target. ONE small pale card remains FLAT on the tabletop in its exact place. Two separate relaxed natural hands rest on opposite sides of it, with a visible gap, not overlapping and not holding it in midair. Preserve the younger man's continuous shoulder, upper arm, gently bent elbow, sleeve, forearm, white cuff, neutral wrist and relaxed hand. Preserve the older man's continuous shoulder, upper arm, one comfortably bent elbow, table-supported forearm, sleeve, white cuff, neutral wrist and palm-down hand. Normal arm proportions and believable shoulder-elbow-wrist continuity; natural fingers and thumbs with no extra, missing, fused, doubled or twisted digits. Keep the other arms obscured as before. Relight these already-correct forms; DO NOT redesign or repair them again.

Style: polished original oil/gouache period noir illustration, assured selective brushwork, tactile wool/aged mahogany/rainy glass/limestone/brass, clear human negotiation and suspense. Same scene and painterly language as the daylight anchor, with more intentional nighttime lighting and depth.
Avoid: purple, violet, neon, cyan glow strips, shiny cinematic CGI, glossy neon reflections, sepia/yellow filter, black-crushed shadows, blown highlights, bokeh orbs, lens flares, smoke clouds, extra figures, new faces, extra limbs/hands/cards, broken shoulders/elbows/wrists, hovering card, text, writing, logos, watermarks, decorative frame, border, weapons, gore, split scene or comparison. Return one complete new nighttime artwork.
```
