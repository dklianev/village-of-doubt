# Achievements: daylight collection scene

Generated on 2026-09-22 with the built-in imagegen tool. This is a light-theme counterpart to the dark stone collection, not a replacement for its artwork.

## Files and delivery

- Canonical source: `assets/game-art-source/achievements/collection-table-light-v1.png` (1536 x 1024).
- Runtime export: `apps/web/public/game-art/achievements/collection-table-light-v1.webp` (1536 x 1024, 64338 bytes).
- Reproduce: `node scripts/optimize-assets.mjs --only achievements/collection-table-light-v1.png`.
- Recipe: WebP quality 50, effort 6, smart subsampling; 64 KiB export cap. No redundant AVIF or mobile export.
- Final generator output: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-e1662df2-3139-4260-80e9-1b5049532876.png`.

The image is an empty stage. Earned objects, labels and state remain separate application content. CSS places props behind the featured relic and crops the scene separately below 640px. The scene reaches both viewport edges with no horizontal mask or centered width cap; only the vertical transition blends into the repeatable light surface. No foreground objects are baked into the background.

The first implementation used a centered 1280px export with horizontal feathering. That created visible flat side bands. The edge-to-edge correction preserves the source and delivers its full native width within the same 64 KiB cap. Desktop background width is at least 1536px and covers wider viewports; mobile uses a 960px crop. Reviewed at 320, 390, 768, 1440 and 1920px.

## References

1. Approved synthetic light concept: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-135c8d3c-6d04-47bd-842f-0ca5ef1c24df.png`.
2. Existing dark source: `assets/game-art-source/achievements/collection-table-dark-v1.png`.

## Initial prompt

```text
Use case: stylized-concept.
Asset type: production LIGHT THEME background plate for the Senkite achievements collection, landscape 1536x1024.
Reference image 1: approved light mobile concept, MATERIAL / LIGHT / ATMOSPHERE reference only. Reference image 2: existing dark background plate, CAMERA / SHARED WORLD reference only.
Create a beautiful quiet daylight counterpart: an old chalk-white to pearl-grey honed limestone tabletop with restrained natural hairline veins, rubbed edges, tiny shallow pits and a little dust, a convincing real material not uniform digital noise. Neutral off-white and soft silver-grey, very slight sage undertone compatible with #eceee9. Not beige parchment, yellow sandstone, glossy marble, orange sepia, sterile white UI or a rocky cave wall.
Keep the camera shallow overhead like reference 2. Soft daylight grazing from a window on the left creates broad subtle natural variations in the stone while maintaining a LIGHT surface. The left 65 percent and the entire lower 65 percent remain quiet empty stone for dark text and individually rendered achievement objects.
At upper-right ONLY (roughly x=1050..1536, y=100..350), a cropped small weathered ash-wood collectors' box with restrained aged silver corners, a loosely folded burgundy velvet ribbon beside it, and two tiny dull brass fasteners. Box is light weathered grey, not a black mass. These are scene-setting props, not the trophies. Keep the very top 100px mostly light and calm because a heading and count will be rendered there. Do not scatter objects across the middle.
NO typography, text, interface, navigation, lines, cards, buttons, watermarks, earned medals, masks, knife, cartridge, wax seal, shield, book or candle. Remove all such items from reference 1. Leave clear floor for real dynamic relics. No bokeh, orbs or decorative particles.
The lower 20 percent gently evens out into the pale limestone tone without a dark edge, so this can blend with a light repeating stone surface. Photographic cinematic craftsmanship and old-world character, elegant tactile detail, authentic lighting, subtle patina; like discovering the same collection in the morning.
```

First draft: `exec-b1707588-fb35-46b8-9df3-3487e7324e9f.png` in the same generated-images directory. Not shipped: overly granular stone competed with small text.

## Refinement prompt

Input: the first draft. The final output above is the refined source.

```text
Use case: precise-object-edit. Input image is the first light achievements background plate.
Keep the same 1536x1024 framing, daylight direction, upper-right weathered box, aged metal details and burgundy velvet. Refine ONLY the tabletop material: it is currently too rough and densely pitted for a readable interface.
Make the table a real old honed pearl-grey limestone slab with a softly rubbed matte finish. Far less high-frequency granular noise, grit and chipped pits. Preserve physical character through a few shallow, softly worn long hairline veins, broad subtle tonal variation and restrained traces of wear, NOT an all-over crackle pattern. The lower two thirds should be mostly smooth, very quiet pale stone, with a faint natural grain visible only upon close inspection. Ivory-grey to cool silver-grey, compatible with #eceee9, no yellow cast. Keep genuine depth and side lighting; do not make it a flat white background.
Keep the uppermost 100px light and quiet where possible. Concentrate small scratches and dust near the upper-right props. No added foreground objects, text, typography, UI, symbols or artwork. Do not add any trophies, masks, wax seals, knives or cartridges. This is the empty stage for separately rendered objects. Preserve elegant photographic realism.
```
