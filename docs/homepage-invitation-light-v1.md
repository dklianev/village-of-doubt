# Homepage Invitation: Light Variant

Created on 2026-09-07 with the built-in image generation tool. This is an
edit of `assets/game-art-source/homepage/invitation-v1.png`, not a new scene.
The envelope, seal and two cards retain the dark illustration's composition;
the cloth and ambient illumination change for the light page.

## Delivery

| Path | Dimensions | Bytes |
| --- | --- | ---: |
| assets/game-art-source/homepage/invitation-light-v1.png | 1536 x 512 | 440772 |
| apps/web/public/game-art/homepage/invitation-light-v1.webp | 1536 x 512 | 110930 |
| apps/web/public/game-art/mobile/homepage/invitation-light-v1.webp | 960 x 320 | 19638 |

The original generated PNG is preserved at
`C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-649ddbe5-684a-4bd4-aef1-04d1951327ad.png`.
Its 2172 x 724 canvas was resized proportionally to 1536 x 512. The stored
PNG uses Sharp compressionLevel 9, palette true, quality 75, effort 10 and
adaptiveFiltering true. No stretching, content replacement or recoloring
was performed outside image generation.

Runtime derivatives were generated in an isolated workspace through
`runAssetGenerators`, using the repository's pinned Linux Node image and
Sharp 0.35.4. Only this source and its two outputs were processed. The native
repeatability test also reproduces both output byte counts and dimensions.

SHA-256:

- Source: `96ddda33cfed2015d20f480362dfc7175169c552011752146e8a1ada97d127b6`
- Desktop: `894eafacbe429e478eab1252ac93d6b586ae8b14ca3c0f81617d86b94307cf63`
- Mobile: `462b8de9f597d7986ed8b0c87432238aca716b630f0d3c06f2bb7ff8c327e062`

The two invitation pictures are decorative lazy images. CSS selects the
application's stored theme, not the operating system's preference. The
inactive picture has no layout box; it must not fetch its lazy image until
selected. Both variants share an 8px clipped outer radius, with actions inset
to preserve focus rings. This selection behavior is covered by browser tests.

## Generation Prompt

```text
Edit this exact original invitation illustration into its LIGHT THEME counterpart. Preserve the composition EXACTLY: wide panorama 1536x512 (3:1), a blank ivory folded envelope with burgundy crescent-rosette wax seal and exactly two dark green/gold ornamental face-down cards wholly in the RIGHT third. Keep their exact sizes, positions, proportions, recognizable ornament, materials and warm paper color. No new objects, no text or labels or frame. Change ONLY the dark petrol fabric background into very light desaturated silver-sage green woven linen, softly and evenly daylight lit. Target background lightness roughly #d9e2d7, neither beige nor neon mint. The LEFT 58% must stay completely empty with subtle fine tactile cloth texture for DARK live text. Keep sufficient separation of pale envelope from pale sage cloth via a natural restrained contact shadow. Do not bleach or flatten the cards or wax seal; keep their deep verdigris and burgundy accents. Soft broad lighting, no spotlight, no gradient glow, no particles, no vignette, no collage. Same artisan-painted tactile style and exact still life, just a believable daylight surface. Preserve every card and paper corner inside the image canvas. Return only the artwork.
```
