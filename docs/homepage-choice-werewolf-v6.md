# Werewolf Homepage Village Art V6

Date: 2026-09-08

## User Direction

The user rejected the close gate scene, including the subsequent stronger
wolf-shadow preview, and requested a completely new image showing the village
and the forest with a richer atmosphere. Those rejected gate edits were never
integrated. The new composition replaces only the Werewolf homepage artwork;
Mafia stays on V5. Existing themes, text, layout and card borders are preserved.

The new scene shows a stone-and-timber Bulgarian village, a forested ridge,
warm windows, a small ordinary villager and a recognizable werewolf cast
shadow on a house. The initial generated village was reframed after a real
desktop/mobile card preview showed that too much of the village sat behind
the text. The selected version raises the village roofs, windows and shadow.
Daylight is an imagegen edit of the selected night scene.

## Built-In Imagegen Provenance

All creative generation and editing used the built-in imagegen tool.
No CLI/API fallback or code-based illustration/color editing was used.
Originals remain in the built-in output directory.

- Initial village, superseded:
  C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-bfd496c1-d03a-45b5-b15e-ce97f350e37f.png
- Selected night, edit of the initial village:
  C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-1d281287-8b99-4f8e-b47d-6b11398f3ae0.png
- Selected day, lighting edit of the selected night:
  C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-4e43e30e-002c-4202-b44d-9ed1dbb4e61a.png

## Project Deliverables

Source PNGs under assets/game-art-source/homepage:
- choice-werewolf-dark-v6.png: 960x640, 404314 bytes.
- choice-werewolf-light-v6.png: 960x640, 486477 bytes.

Sources use standard Sharp resizing (Lanczos3, cover, 960x640) and PNG
palette encoding (quality95, effort10, compressionLevel9, dither0.5). This
is quantized encoding, not lossless relative to the generated original.
Both source masters were inspected visually after encoding.

Runtime WebPs use the same stems under:
- apps/web/public/game-art/homepage/
- apps/web/public/game-art/mobile/homepage/

Desktop remains 960x640 with a 160KiB limit; mobile remains 720x480 with a
55KiB limit. Detailed foliage/stone in the light mobile asset exceeded
55KiB at q42 (64518 bytes). A q34 candidate (55230 bytes) was inspected
alongside q42 and accepted. The extra attempt is restricted to this exact
light V6 source; no global quality or budget change is intended. An encoding
experiment with zero PNG dithering did not materially reduce WebP size.

Integration, canonical asset reproduction and final verification are recorded
after completion. This is an artwork change, not a backend/release audit.

## Exact Prompts

### Initial village generation

```text
Use case: historical-scene
Create ONE completely new full-bleed 1536x1024 landscape illustration for the DARK-theme Werewolf card on a premium Bulgarian social-deduction game website. No reference image: do NOT make a close-up of a wooden gate or a large wolf portrait.
Scene and atmosphere: a small authentic Bulgarian mountain village at night at the edge of an ancient dense forest. An intimate crooked cobbled village square and narrow lane, several modest stone houses with dark timber upper stories and heavy stone-tiled roofs. The houses feel inhabited: a few small warmly lit amber windows, a discreet lantern at a doorway. Behind their rooflines, clearly visible layered fir and beech forest climbing toward a rocky mountain ridge. Low delicate mist threading the edge of the trees only, clear village details, quiet suspense. Strong depth from the near square through the houses into the forest; grounded Balkan folk horror, not generic medieval fantasy or a castle.
Important composition: the VILLAGE AND FOREST are the main visual experience, not a portrait or a foreground wall. Eye-level slightly elevated view into the village. Group the important roofs and tree line across the central 20-80% horizontal area and upper 8-42% vertical area; several distinct homes and a substantial dense green forest must survive a central mobile crop. Forest canopy visible behind and between houses, not just a tiny dark blob or distant sky. Sky only a small strip, no giant moon. Lower half continues the atmospheric lane naturally, visually quieter for future HTML text, no drawn gradient or UI.
Narrative foreground: a single ordinary adult villager in plain charcoal wool waistcoat and linen shirt stands near the central-left side of the lane, not huge, head about x43%, y34%; holds one small amber lantern with a natural anatomically correct hand. He glances back warily. Nearby on the small stone side wall of a house at central-right, his lantern-cast shadow clearly reveals a WEREWOLF instead: unmistakable pointed ears, elongated wolf muzzle and thick shaggy neck on upright broad shoulders. This is a dark CAST SHADOW following the stone surface, NOT a real second creature, not a logo or floating wolf head. Keep the wolf shadow's head above y40%, near x63%, so text does not hide it. A small localized amber light on the stone makes the wolf outline legible at 350px wide; no huge white plaster facade. The shadow is a memorable story detail within the broader village landscape, not the whole poster.
Palette and lighting: charcoal, restrained deep forest greens and olive foliage, warm gray limestone, natural desaturated timber, small amber window/lantern accents. Neutral silvery nighttime fill shows the village architecture, forest layers and ordinary face clearly. No blue/cyan cast, teal grading, orange-brown wash, sepia or crushed black landscape. A little restrained wine-red fabric accent is acceptable but not mandatory. Atmospheric and cinematic but the real scene must stay inspectable, not blurry or underexposed.
Style: bespoke sophisticated painterly narrative illustration, believable regional vernacular architecture, natural human anatomy, tactile wood and stone with controlled detail; intentional composition and elegant light, not stock photography, glossy 3D, an AI fantasy template or a busy symmetrical poster.
Output: one landscape 1536x1024 image, no typography, no watermark, no border, no UI, no giant wolf, no gore, no decorative particles.
```

### Card-aware reframing

```text
Edit the provided village-at-night painting. Preserve this exact artistic direction, architecture, forest, charcoal/deep olive palette, amber windows, clear wolf cast shadow, believable ordinary villager and moody Bulgarian atmosphere. The user wants to SEE THE VILLAGE AND FOREST, not a portrait or just a giant forest.
Important practical correction: this illustration will have HTML text covering the LOWER HALF. In the current image the village windows and villager are too low and get covered. RECOMPOSE vertically so the entire visual story fits in the UPPER HALF and the lower half is a quieter continuation of the cobbled approach. This is a new camera framing, not a crop or flat translation.
Target composition:
- Dense tree-covered ridge and forest occupy only the top 0-23% of image height. Still beautifully layered, clear and atmospheric, with a little thin mist and practically no sky.
- Place the row of charming stone-and-timber village homes just below that, with roofs around y23-30% and their warm WINDOWS visibly around y30-43%. Multiple complete recognizable houses should be visible in the upper half.
- The ordinary villager is smaller and further into the lane, with his HEAD around x42%, y33%, upper body and handheld lantern around y38-46%. Keep his anatomy natural; full body can extend into the lower half. Do not put his head below 40%.
- The near right house that carries the werewolf SHADOW should have its roof raised enough that the clearly pointed ears and long canine muzzle are at x64-76%, y23-36%. The upright shaggy shoulder shadow continues below. Keep the recognizable head above 38%, with amber illumination on the stone behind its outline, no eyes/glow/real wolf.
- Bottom 50-100%: richly atmospheric but quieter cobbled approach with low stone walls, without the most important faces or windows there. No fake gradient, empty blank field or UI.
Retain a coherent spatial scene with normal architecture and perspective; no squeezed miniatures, warped buildings, collage, double horizons or duplicated people. Keep the cinematic painterly quality and understated warm light, no blue cast, no brown wash. The forest still matters, but must share the top half with the inhabited VILLAGE. One full-bleed landscape 1536x1024, no typography, no border.
```

### Matching daytime edit

```text
Use case: lighting-weather
Edit this exact Bulgarian village scene into its matching LIGHT-THEME daytime illustration. Preserve the entire composition, every stone-and-timber house, roofs, windows, forest and mountain ridge, lane, low walls, the small ordinary man holding a lantern, and the unmistakable werewolf cast shadow on the central-right house. Same camera, geometry, framing, human identity/anatomy, exact positions and sizes. No new objects or architecture.
Change ONLY time of day and illumination: calm warm late-afternoon light before sunset, neutral honey-gray limestone, weathered gray-brown timber, deep olive and natural forest greens with clearly visible tree layers. Soft pale neutral light through the tree line, a little fine mist between the trees. The whole village, house details and forest should be comfortably readable for a light website theme, with real depth and soft natural shadows, not a white haze. Local subtle golden sunlight warms stone and foliage, without global yellow, orange, brown or sepia tint. Keep the palette refined and coherent with warm ivory and restrained aged brass UI.
The existing WOLF cast-shadow head must remain clearly recognizable and EXACTLY in place on the right stone facade: pointed ears, long muzzle and shaggy neck. Retain it as a dark shadow on naturally sunlit stone, never as a literal second creature or painted emblem. No glowing eyes. Retain the small lantern and believable natural hands; its warm glow is subdued by daylight. Window warmth can be gentle, not blazing like night. Forest must remain green and textured rather than bleached or cyan. No large white plaster wall, no blue-dominant sky, no moon.
Premium grounded painterly folk-horror illustration, one full-bleed landscape image 1536x1024. No typography, UI, border, watermarks, fake gradients or added vignette.
```
