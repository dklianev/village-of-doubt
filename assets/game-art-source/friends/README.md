# Guestbook Scene

Approved reference: `exec-6748a661-fc52-4ace-b15e-f51bc51c097e.png` from the local
Codex generated-image collection. These replacements reproduce the selected
guestbook composition; UI text and controls remain HTML, not baked into art.

Generated with the built-in Image Gen tool, 2026-09-26. The two existing scene
masters were replaced for this redesign. Source PNGs are excluded from runtime
delivery. `scripts/optimize-assets.mjs` owns their deterministic derivatives.

## Prompt Set

- Dark scene, precise-object-edit: extract the exact approved website background;
  remove navigation, headings, guest list, monograms, controls, invitation sheet,
  seal and footer. Preserve the stone room, village window, forest, candles,
  guestbook, envelopes, edge foliage and books. Keep the central lower area dark
  forest-green and empty for live HTML. Full-bleed 4:3 framing, no people or UI.
  Source result: `exec-906b62c9-2305-45ae-932e-a4ce60525edb.png`.
- Light scene, lighting-weather: change only the dark scene's illumination to a
  clear morning, keeping the same camera, geometry, objects and locations.
  Limestone walls, pine green foliage, blue-grey mountains, neutral walnut.
  Pale grey-green lower copy area, no orange wash, no new frame or controls.
  A readability edit lifts only the central copy area to pale silvery sage and
  the upper-left wall to soft limestone, without moving objects or adding a panel.
  Final source: `exec-549ab167-236d-474a-b525-1b528008a6f8.png`.
- Invitation seal, background-extraction: isolate the reference's single
  wine-red wax seal with its subtle embossed wolf, irregular rim and top-left
  light. Straight-on, transparent background, no paper, text or additional items.
  Source result: `exec-394ff880-03d3-48ff-8fe8-af6c0dea3457.png`.
- Guest medallion, precise-object-edit: a single straight-on dark green leather
  disk with a narrow antiqued double brass rim, matching the reference initials.
  Blank center for a dynamic HTML initial, transparent background, no symbols.
  Source result: `exec-bd32a7ff-f96e-4fc5-9dad-b1023714e6e2.png`.

## Delivery

Scenes: 1448 px WebP/AVIF and 960 px mobile WebP. Seal: 192 px transparent WebP
for a 96 px CSS slot. Medallion: 128 px transparent WebP for a 48 px CSS slot.
The invitation uses its own restrained aged-paper texture instead of the global
ornament texture. Tests decode the small ornaments and check alpha, dimensions,
entropy, size and reproducibility instead of treating them as full-size scenes.

## Demo Fidelity Paper Revision

Built-in Image Gen, 2026-09-26, reference `exec-6748a661-fc52-4ace-b15e-f51bc51c097e.png`.
Precise-object-edit prompt: recreate only the invitation's blank warm ivory
parchment, natural mottled fibers and gently darker aged edges; straight-on 3:4,
full-bleed paper with a quiet light center. No text, controls, seal, symbols,
frame, folds, tears, holes, perspective or table. Source result:
`exec-611389dd-53c6-4c65-ade5-ea58006649b1.png`.
Project master: `friends/invitation-paper-v1.png`. Runtime delivery is a single
816x1088 Q72 WebP capped at 80 KiB, with no mobile or AVIF duplicate.
