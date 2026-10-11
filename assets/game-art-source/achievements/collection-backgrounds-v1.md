# Collection Backgrounds

Built-in imagegen, 2026-09-22. Reference: the user's first approved dark collection mockup, `exec-57150963-34eb-409a-810d-bee508e6cea8.png`. No personal data or game secrets.

The earlier neutral plaster tile did not preserve that reference's materiality. These two dark-only assets replace it in the dark theme. The light-theme surface is unchanged.

- `collection-table-dark-v1.png`: full scene master; published as 1536x1024 WebP, quality 70. Cropped at native scale, never stretched to the page height. The scene fades into the continuation texture.
- `collection-slate-dark-v1.png`: continuation texture master; published as 512x512 WebP, quality 65. Repeats at native scale at 40% opacity over charcoal. It is deliberately subdued, not used as the sole hero backdrop.
- Recipe: `node scripts/optimize-assets.mjs --only achievements/collection-table-dark-v1.png --only achievements/collection-slate-dark-v1.png`.
- The social preview is now JPEG rather than palette PNG; see `og-collection-v2.md`. Both formats count toward the unchanged art budget.

## Scene Prompt

Use case: precise-object-edit.
Input image 1 is the approved visual direction. Create a production BACKGROUND PLATE from it, wide landscape 1536x1024. Keep its cinematic photographic atmosphere and table surface, NOT a website screenshot.
Remove ALL text, buttons, navigation, divider lines and ALL foreground achievement objects (mask, cartridge case, wax seal, shield, candle, book, knife). Reconstruct the empty surface behind them naturally. Keep only the dark weathered small trunk cut off at the upper RIGHT edge, a little folded burgundy cloth along that edge and a few very understated tiny dry leaf fragments at the extreme right edge. Keep all of these props in the upper-right 25% and mostly in shadow; the left 60% and lower 65% must be open surface.
The actual surface is a nearly black worn stone worktable, seen at a shallow overhead angle. Preserve the reference's subdued fine-grained dusty stone with natural shallow fractures and warm worn patches. NOT a coarse volcanic rock wall and NOT a flat gray or green screen. Grounding, depth, subtly grazing warm side light, tactile material. The center and left remain dark neutral charcoal for bright text placed later in real HTML.
No borders, no light spots, no particles floating, no text, no symbols, no UI, no medals, no trophies, no large objects in foreground. The background should look convincingly like the ORIGINAL reference after removing its interface and movable relics. The lower 15% gently falls into near-black shadow so it can continue into a dark page without a hard edge.

## Continuation Prompt

Use case: stylized-concept.
Asset type: production background texture for the dark achievements collection in the Bulgarian social-deduction game Senkite.
Image 1 is a STYLE AND MATERIAL REFERENCE only, not an image to copy with UI.
Generate ONLY the bare tabletop visible behind the objects in the reference. Square 1024x1024, fully opaque, edge-to-edge, seamlessly tileable in both directions. No UI, text, panels, lines, objects, masks, knives, cartridges, boxes, candles, leaves or ornament drawings.
The material must look like the reference's ancient charcoal-black stone worktable: deeply tactile uneven worn slate, broken layered edges within the stone, fine scratches, a few thin naturally irregular warm bronze-brown mineral veins, pits and rubbed patches. Not concrete plaster, fine speckle, uniform gray noise, leather or a smooth green slab. Use readable medium-scale organic variations, rather than only tiny dust specks.
Near-overhead perspective matching objects photographed slightly from above. Very restrained warm side-light grazing the ridges makes physical depth visible. Mostly deep charcoal with subtle warm patina; no green or blue tint. Keep the surface DARK but its texture visibly readable: roughly charcoal #191b19 through #35332e with very sparse worn ridges around #484136. No big bright patch, no vignette, no horizon. The page places ivory text directly on this surface so contrast must remain high. Match the convincing cinematic materiality of the reference, not its decorative contents.
