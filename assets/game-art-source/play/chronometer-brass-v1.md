# Brass Chronometer

Generated with the built-in imagegen tool in edit mode with real transparent alpha.
Master: `chronometer-brass-v1.png`, 1254 x 1254 RGBA, copied unchanged.
Reference: the approved epic-timer mockup from the current design conversation.
Generated file: `C:/Users/Administrator/.codex/generated_images/01a0e00e-04fe-7bb2-b210-c944554ad5a4/exec-6cf904e6-757a-4212-aca1-624d8084d0bd.png`.
Master SHA-256: `2023eea21319ec6545900ca10b6e3a61cff71ee64c823734fdf4169483dca068`.

## Prompt

Use case: background-extraction / precise-object-edit. Input image is the approved edit target, not a suggestion for a different design. Extract and faithfully recreate ONLY the antique circular brass countdown dial at the very center of the supplied game screenshot, as one isolated UI sprite. Output a square 1024x1024 master with real transparent alpha outside the dial. Exactly frontal face, circular and centered, no perspective tilt; dial spans approximately 960 pixels with a small equal transparent margin. Preserve reference identity: narrow layered polished warm antique-brass bezel, deep nearly black forest-green enamel face, small gold crescent centered near the top inside the face, exquisite restrained lower engraved geometric foliate flourish centered at six o'clock. Keep physical narrow brass ring proportions and hand-finished material, not a generic clock. IMPORTANT EDITS: remove the digits 00:42 and the label completely; center must be empty smooth dark-green enamel, enough space for live text overlay. Replace ALL the lit countdown blocks AND ALL engraved tick/segment divisions with a completely smooth blank recessed dark circular arc channel of constant width over approximately 270 degrees around the upper and side perimeter, with the lower ornamental flourish below it. No lit segments, no ticks, no hash marks, no numbers, no hands, no lettering or watermark anywhere. Lower decorative engraving may remain but cannot look like ticks. No room, table, people, frame outside the circular timer, scenery, background color, checkerboard painted into the image, cast shadow outside the object, stand or pocketwatch crown. Preserve crisp realistic brass edges and subdued dark enamel, readable when displayed as a 200x200px game timer. Single finished isolated dial only, faithful to the supplied target, not a sheet of variants.

## Runtime Export

`scripts/optimize-assets.mjs --only play/chronometer-brass-v1.png` in the pinned
Linux asset-generator environment produces one 448 x 448 WebP. It preserves
transparency, uses the existing Q82/Q78/Q74/Q70 quality floor and effort 6,
and must fit 36 KiB. There are no duplicate mobile/AVIF assets. The unused
desktop Mafia v1 table inlay and its master are preserved in
`assets/game-art-archive/play-before-chronometer/`, reclaiming the required
runtime space without degrading any retained image. Limits and baselines are
unchanged. The small WebP is delivered directly without image-loader JavaScript
and also works in browsers that cannot decode AVIF directly.

Live text and the sixty-segment final-minute arc are rendered by `Timer.tsx`.
Neither remaining time nor a progress state is baked into the asset.
