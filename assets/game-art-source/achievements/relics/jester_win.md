# JESTER_WIN relic

Generated with the built-in imagegen tool. This file records the prompts for the single delivered relic; no CLI or additional models were used.

## References

- Desktop: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-4c00fa62-3386-4f79-8334-356bc8390618.png
- Mobile: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-135c8d3c-6d04-47bd-842f-0ca5ef1c24df.png

## Initial Prompt

Use case: background-extraction.
Asset type: ONE standalone JESTER_WIN achievement relic raster asset, not a UI.
Input images: Image 1 is the approved desktop design reference; Image 2 is the approved mobile design reference. Extract and faithfully recreate ONLY the cracked ivory theatrical half-mask relic shown in the first achievements item (also upper-right in Image 1). Both are visual references, not layouts to reproduce.
Subject: One antique theatrical jester half-mask, the same rounded brow, hollow almond eye openings, sculpted nose, and open lower-mouth edge as the reference. Cracked aged ivory surface, subtle hand-carved ornament, worn crimson painted forehead accent, softly draped dark crimson ribbon folds to either side, tiny aged SILVER bells attached to the ribbon ends. Keep the reference mask identity and understated historical material treatment. No whole face, no person, no extra props.
Style/medium: Tangible painterly photorealism, convincing three-dimensional hand-crafted artifact, fine ivory cracks and worn edges, understated fabric weave and tarnished silver details. Not cartoon, not a flat medal, not vector, not plastic.
Composition/framing: 3:2 landscape canvas, 1536x1024 if available. Center the complete mask-and-ribbons-and-bells ensemble in an oblique front view as in the reference. All parts fully visible; about 10 percent clear transparent margin on every side, including ribbon tips and bells. Relic alone.
Lighting: Neutral soft side light with readable midtones and controlled highlights, so it works equally on charcoal AND off-white. Only a small soft semitransparent contact shadow immediately beneath the object; no broad ground shadow.
Scene/backdrop: ACTUAL TRANSPARENT ALPHA background, RGBA PNG. The entire surrounding canvas must have alpha=0, with natural antialiased object edges and translucent shadow. Real cutout transparency, NOT a drawn checkerboard, NOT a white/black/gray colored background. Where eye holes reveal empty space, preserve actual transparency.
Constraints: No table, floor, room, background texture, badge border, pedestal, text, letters, watermark, interface, other achievement objects or surrounding scenery. Render just this single relic faithfully from the approved references.

## Final Correction Prompt

The initial generated mask was used as the edit target for this correction.

Use case: precise-object-edit.
Edit the supplied single transparent JESTER_WIN relic image. Preserve the exact cracked ivory theatrical half-mask identity, pose, carved detail, crimson forehead accent, crimson fabric ribbons, and realistic painterly material rendering. Make only these production corrections:
1. Scale the ENTIRE existing ensemble down uniformly to leave about 10 percent transparent canvas margin on the left and right, while keeping centered in the same 3:2 landscape 1536x1024 canvas. Do not crop anything or add objects.
2. The three small spherical bells must be aged SILVER: neutral gray tarnished silver with soft silvery highlights, NOT gold, yellow brass, or bronze. Make the illumination neutral soft side light, retain readable material midtones.
3. Add only a tiny soft semitransparent contact shadow immediately underneath the lowest mask edge if needed. No broad shadow or backdrop.
Output MUST have actual transparent RGBA alpha, with alpha=0 for all empty background and open eye holes. Keep clean antialiased boundaries compatible with both charcoal and off-white. No colored background, table, floor, room, checkerboard pixels, text, UI, medal frame, extra props. One isolated artifact, same tangible worn mask and ribbon silhouette, not a redesign.

## Source and Runtime

- Selected generated original: C:/Users/Administrator/.codex/generated_images/01a0c687-937f-77d3-bbc8-b256cd833981/exec-3e474c5e-80c1-4398-a77a-f9b745ea2f55.png
- Source: jester_win.png, unmodified generated RGBA PNG, 1536x1024.
- Runtime: apps/web/public/game-art/achievements/relics/jester_win.webp, 960x640.
- Runtime framing: resize full original to 828x552, then add transparent padding (left 57, right 75, top 44, bottom 44). No clipping, flattening, background removal, or alpha reconstruction.
- Source alpha: original generated channel retained unchanged. Runtime alpha: resized generated alpha, encoded using the user-requested alphaQuality 80.
- QA: inspect actual-alpha composites on charcoal (#232526) and off-white (#f4f2ed), inspect dimensions and alpha bounds, and measure the WebP byte size.

## Verified Delivery

- PNG: 1536x1024, 2,136,175 bytes, alpha range 0..254; SHA-256 matches the selected generated original.
- WebP: 960x640, 78,090 bytes (78.09 KB), quality 80, alphaQuality 80, effort 6.
- Budget: the user's follow-up relaxed the original 65 KB target in favor of quality 75-80 and ideally no more than 95 KB per relic; this file meets that updated guidance.
- Runtime alpha: range 0..255; 446,741 fully transparent pixels; all outer-border pixels fully transparent; maximum alpha encoding error 1/255 relative to the resized generated alpha.
- Visible bounds at alpha > 8: x=96..864, y=123..518. The entire object is visible with approximately 10 percent horizontal margin.
- Final runtime visually inspected on both charcoal and off-white using in-memory composites. No browser, application code, other assets, or dependencies were changed.
