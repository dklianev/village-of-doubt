# Mobile Light Background Restoration

Date: 2026-09-08.

## Scope And Method

- Restore only the two existing palette-degraded mobile light hero masters.
- Use the built-in `image_gen.imagegen` edit tool, with one separate call per master and `view_image` inspection before editing.
- Preserve the scene, composition, perspective, palette, lighting and painterly character. No redesign or added objects.
- Copy accepted generated PNGs directly to the master paths. No manual enlargement, resizing, re-encoding, palette conversion or runtime asset generation.
- These are AI-generated restorations, not recovered originals or pixel-identical archival reconstructions. Fine material details are reconstructed.
- The canonical runtime pipeline remains owned by the main task.

## Werewolf

Status: visually accepted and installed; native output size differs from the requested size.

- Edit input and installed master: `E:/werewolf_mafia/assets/game-art-source/mobile/werewolf/bg-hero-light-v1.png`.
- Original backup: `E:/codex-temp/image-quality-repair-2026-09-08/source-before/mobile/werewolf/bg-hero-light-v1.png`.
- Original: palette PNG, 768 x 1024, 483076 bytes.
- Original SHA-256: `bdcadb6627ae5532d44e24ffbf3f7a4f48f81f6e696c7b564054409a66c674c2`. Backup hash verified equal before editing.
- Untouched generated output: `C:/Users/Administrator/.codex/generated_images/01a07e4f-1ec1-7813-bb40-1a6403f81266/exec-f3ab76dc-28f4-4d42-86f8-7891e837ee2b.png`.
- Requested native size: 1536 x 2048.
- Actual generated size: 1086 x 1448, RGB sRGB PNG, not palette-indexed, 2745765 bytes.
- Installed/output SHA-256: `853557cd35610d404a349111f6333871612445ba9e238cfcd5affd2356768474`.
- Visual review: the church, forest, houses, tiled gate, stone wall and wet lane retain their scene placement; sky colors are continuous without the original indexed-color speckling. Material detail is reconstructed in the same painterly character.
- Size limitation: the built-in tool did not honor the requested dimensions. Its native output is retained unchanged; no claim is made that this file is 1536 x 2048.

Exact built-in edit prompt:

```text
Edit the referenced image as a strictly faithful image-quality restoration, not a new design.
Input image: the edit target is E:/werewolf_mafia/assets/game-art-source/mobile/werewolf/bg-hero-light-v1.png, an existing palette-degraded 768x1024 portrait game background.
Output: one native generated 1536x2048 portrait PNG, full continuous RGB color, aspect ratio 3:4. Generate restored detail at that resolution; do not merely resize the input.
Preserve EXACTLY the existing composition, crop, camera position, perspective, proportions, building silhouettes, object placement, painterly illustration style, muted warm gray/ochre/olive palette and soft golden daylight. Preserve the church bell tower and cross in the upper left, evergreen forest and mist behind the village, the white-plaster timber houses and tiled rooftops in the middle and at the right edge, all existing chimneys and smoke, the foreground stone wall and dark wooden double gate beneath its tiled roof, the overhanging foliage at the upper right, and the winding wet stone street through the lower left foreground. Keep their original positions, sizes and shapes.
Change ONLY technical image quality: remove palette quantization, posterization, dither-dot patches, blotchy sky bands and compression artifacts. Reconstruct smooth continuous pale blue-gray and warm cream sky/cloud colors using the same cloud shapes and lighting. Restore coherent fine detail in the existing roof tiles, stone, plaster, wood grain, cobblestones, foliage and reflections without adding patterns or objects. Keep intentional atmospheric softness in the distant forest; no excessive sharpening or crunchy outlines. Preserve the original gentle painterly material rendering, not photorealism or a different art style.
No added or removed houses, trees, gates, street features, clouds, people, animals, vehicles, signs, text, logos or objects. No new storytelling, color grading, lighting change, redesign, zoom, reframing or crop. This is the same image restored to clean, high-quality native resolution.
```

## Mafia

Status: visually accepted and installed; native output size differs from the requested size.

- Edit input and installed master: `E:/werewolf_mafia/assets/game-art-source/mobile/mafia/bg-hero-light-v1.png`.
- Original backup: `E:/codex-temp/image-quality-repair-2026-09-08/source-before/mobile/mafia/bg-hero-light-v1.png`.
- Original: palette PNG, 922 x 1229, 508395 bytes.
- Original SHA-256: `4f38799c69ef090a8e89a7f2863a8e63e227197ddb03ccfc293627f784af99d6`. Backup hash verified equal before editing.
- Untouched generated output: `C:/Users/Administrator/.codex/generated_images/01a07e4f-1ec1-7813-bb40-1a6403f81266/exec-28995756-c3f2-45e4-ab43-a9a752a16740.png`.
- Requested native size: 1152 x 1536.
- Actual generated size: 1086 x 1448, RGB sRGB PNG, not palette-indexed, 2602900 bytes.
- Installed/output SHA-256: `99beac98940c2c8e0767e0da2fd3b24a51d2b43182bb7dcab82459e4e19188df`.
- Visual review: the damaged sky patches are removed; the curving street, tram tracks, double-arm lamp, distant dome, right-hand balcony, awning, doors and wall lanterns retain the original scene composition. Fine decorative details are reconstructed, not archival reproductions.
- Size limitation: the built-in tool did not honor the requested dimensions. Its native output is retained unchanged; no claim is made that this file is 1152 x 1536.

Exact built-in edit prompt:

```text
Edit the referenced image as a strictly faithful image-quality restoration, not a new design.
Input image: the edit target is E:/werewolf_mafia/assets/game-art-source/mobile/mafia/bg-hero-light-v1.png, the existing palette-degraded 922x1229 portrait game background.
Output: one native generated 1152x1536 portrait PNG, full continuous RGB color, aspect ratio 3:4. Please generate the restored image itself at 1152x1536 pixels, not a smaller preview and not a simple resampling of the degraded input.
Preserve EXACTLY the existing composition, crop, camera position, perspective, proportions, architectural silhouettes, object placement, painterly illustration style, muted warm stone/cream/ochre/dark bronze palette and soft golden daylight. Preserve the empty curving wet city street and tram rails in the foreground and left side; the existing black double-arm streetlamp at the left-center and all existing bollards; the distant domed building at the far left, distant spires and receding street facades; the large ornate building on the right, its upper curved wrought-metal balcony, the curved gold-trimmed projecting bay below it, the faded reddish-brown scalloped awning, the intricate dark gold-trimmed entrance doors, all existing wall lanterns, window frames, stone facade details and wet pavement reflections. Keep every major element at the same relative location, scale and angle.
Change ONLY technical quality: remove palette quantization, posterization, dotted checkerboard/halftone patches and compression artifacts, especially the large harsh stippled patches in the sky at upper left. Restore clean, continuous pale blue-gray and warm cream atmospheric sky colors and soft cloud transitions in the same sky regions. Those dotted color islands are damage, not clouds or intentional artistic texture. Reconstruct coherent fine material detail in the existing stonework, metalwork, doors, glass, awning fabric, tram rails and reflective paving. Keep the original painterly surface character, atmospheric distance and gentle contrast; do not turn it into a photograph or create crunchy oversharpened edges.
No added or removed buildings, balconies, lamps, doors, street features, people, animals, vehicles, signs, text, logos or objects. No new readable lettering on the awning. No color-grading revision, lighting change, new weather, redesign, zoom, reframing or crop. This must remain the same street scene, restored to clean high-quality native resolution.
```

## Verification And Handoff

- Both inputs and both generated outputs were visually inspected using `view_image`.
- PNG metadata confirms both accepted outputs are RGB sRGB images rather than palette-indexed PNGs.
- SHA-256 checks confirm each installed master is byte-identical to its generated output, including embedded provenance metadata.
- Exactly two separate built-in image generation calls were used. No CLI/API fallback, extra image revisions, manual enlargement or other asset changes were performed.
- Both accepted outputs are 1086 x 1448, below the requested dimensions. This tool limitation is explicitly included in the main-task handoff.
- Runtime regeneration, runtime crop/theme checks and final pipeline validation are deferred to the main task. No CSS or runtime asset files were edited for this restoration.
