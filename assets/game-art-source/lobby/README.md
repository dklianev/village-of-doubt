# Waiting-room scene masters

These scene masters are for the scoped lobby waiting-room redesign only.
Play components and CSS are owned by the parent task. No existing tavern,
active-phase scene, table inlay or phase icon is replaced by this pipeline work.

## Provenance

The following images generated for the approved mockup were copied byte-for-byte from
`C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/`.
Source and destination paths were checked for containment, reparse-point
ancestors and destination collisions. SHA-256 matched after copying.

| Master | Generated image | Bytes | Dimensions | SHA-256 |
| --- | --- | ---: | --- | --- |
| waiting-werewolves-dark-v1.png | exec-3f121d96-c33e-4e71-8972-5c84fa2e889e.png | 2753121 | 1486 x 1058 | f1fbf5ccfb4447ca32f7207b6d4d99b5a44ea1a9e5cf27ba19eb04123fb2c3cf |
| waiting-werewolves-light-v1.png | exec-b80aee35-303a-452f-8592-dc793bc3e6c9.png | 3131353 | 1484 x 1060 | ce0a17bd777fbc189ae2161fd1fde4768977d610b55e3cc8a03b407f4e52cddb |
| waiting-mafia-dark-v1.png | exec-b7711665-583b-4619-9a11-c008609f0822.png | 2467045 | 1487 x 1058 | 462699745ff1d30c041a7b46e6e651c4031b20399e6d17d25189961af4bedca2 |
| waiting-mafia-light-v1.png | exec-baeaaa8c-f5c9-411c-bd61-5215e5e10b24.png | 2656641 | 1486 x 1058 | 6b935afcae18c141c6970786c5af23279333e83c3a4f260187db3763092d21ef |

All four destination masters live in
`E:/werewolf_mafia/assets/game-art-source/lobby/`.

## Prompt intent and source paths

The entries below record intended composition from the scoped request and
visual inspection. They are intent summaries, not verbatim generation prompts;
the parent task retains the original image-generation conversation. These are
synthetic scene plates without real player data, credentials or game state.

1. Werewolves dark: a Bulgarian mountain-village tavern at dusk, a large empty
   round carved table with red woven textiles, a closed card deck and candles;
   firelight and cool evening village light, consistent table geometry for
   the parent UI's public-seat overlay, no baked-in interface or text.
   Source: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-3f121d96-c33e-4e71-8972-5c84fa2e889e.png`.
2. Werewolves light: the matching tavern and empty round table in daylight,
   preserving the textiles, card deck, seat positions and mountain-village
   window composition for the light theme, no baked-in interface or text.
   Source: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-b80aee35-303a-452f-8592-dc793bc3e6c9.png`.
3. Mafia dark: an old European private salon at night, an empty round polished
   table with burgundy inlay, leather chairs, green banker lamp, closed cards
   and sealed invitation; fireplace and rain-lit city square beyond the window,
   preserving clear table geometry, no baked-in interface or text.
   Source: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-b7711665-583b-4619-9a11-c008609f0822.png`.
4. Mafia light: the matching salon, table, chairs, lamp and invitation in soft
   daylight with a pale green interior and rainy city square; retain the dark
   scene's composition for theme switching, no baked-in interface or text.
   Source: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-baeaaa8c-f5c9-411c-bd61-5215e5e10b24.png`.

## Delivery contract

Only the four exact v1 master paths below receive these delivery caps. The
1320px runtime width is an explicitly approved exception for the two Werewolves
paths only. Mafia retains its existing 1920px maximum and native dimensions.

| Source-relative path | Maximum runtime width | WebP cap |
| --- | ---: | ---: |
| lobby/waiting-werewolves-dark-v1.png | 1320 | 220 KiB |
| lobby/waiting-werewolves-light-v1.png | 1320 | 260 KiB |
| lobby/waiting-mafia-dark-v1.png | 1920 | 200 KiB |
| lobby/waiting-mafia-light-v1.png | 1920 | 200 KiB |

Existing quality steps remain Q82, Q78, Q74, Q70. Masters remain byte-identical
and retain their original dimensions. These names produce only a WebP, not
public PNG, AVIF, mobile or thumbnail derivatives. Exports use proportional
`inside` resizing without enlargement or cropping. If the configured width
cannot fit at Q70, encoding fails without shrinking further, replacing an
existing derivative or changing the source master.

## Current encoding result: all four published

Only supplied master paths were passed to `optimize-assets.mjs --only` inside
the canonical Linux image exported by `run-asset-generators.mjs`, using the
root package's pinned Sharp 0.35.4. The Mafia pair was exported first. After
approval of the exact Werewolves width/cap exception, only the two Werewolves
paths were exported again; the published Mafia files were left unchanged.
All four expected runtime files now exist, with no extra delivery formats.

First-fitting quality measurements at the approved runtime widths:

| Master theme | Runtime width | Q82 bytes | Q78 bytes | Q74 bytes | Q70 bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Werewolves dark | 1320 | 303830 | 263538 | 231482 | 222722 |
| Werewolves light | 1320 | 357244 | 309296 | 275324 | 264136 |
| Mafia dark | 1487 | 259930 | 223018 | 193944 | 182998 |
| Mafia light | 1486 | 279302 | 238120 | 209634 | 198520 |

Published files in `E:/werewolf_mafia/apps/web/public/game-art/lobby/`:

| Runtime file | Quality | Bytes | Dimensions | SHA-256 |
| --- | ---: | ---: | --- | --- |
| waiting-werewolves-dark-v1.webp | 70 | 222722 | 1320 x 940 | ef12cb1ce083322b5a2e650b0aca6b03dcaca762f002109d0076f1984595df1b |
| waiting-werewolves-light-v1.webp | 70 | 264136 | 1320 x 943 | 4284f495f50fa990b07d568f5eab0f5eebdd44e95f843158d5d4a69acf89f6cc |
| waiting-mafia-dark-v1.webp | 74 | 193944 | 1487 x 1058 | f54ba7a0bc80e31c6ba486a2b4234b6e587ba0137f14a541c6119f44987f35c4 |
| waiting-mafia-light-v1.webp | 70 | 198520 | 1486 x 1058 | e47ebc14dc657e6a5eb2e301339ad880d1a7a0fc77615bafa4a97e71620d5f03 |

All runtime images were visually inspected alongside the sources. Framing and
scene content are preserved; the Werewolves reduction affects runtime resolution
only. The parent owns browser crop, contrast and seat-overlay QA and is capping
the scene at 1780 CSS pixels, centered: 1780 / 1320 = 1.348485, below the existing
1.35 upscaling threshold. That browser layout was not edited or verified here.

## Budget and checks

Archival of only the proven-unused `empty-lobby` masters and six runtime
derivatives is documented with all eight before/after SHA-256 hashes in
[`assets/game-art-archive/lobby-waiting/README.md`](../../game-art-archive/lobby-waiting/README.md).
That manifest records each original path, archive destination and byte count;
the files were byte-preserving moves with containment/reparse-point checks.
Rechecking the archive hashes against that manifest confirms they are unchanged.
It recovers 845065 runtime bytes. Before adding plates, the runtime corpus was
75913691 bytes (74134.4638671875 KiB), with 886309 bytes available under the
unchanged global cap. The four published plates total 879322 bytes
(858.712890625 KiB), within that combined allocation. The corpus is now
76793013 bytes (74993.1767578125 KiB), leaving 6987 bytes
(6.8232421875 KiB) beneath the unchanged 75000 KiB hard limit.

The 220/260 KiB Werewolves caps plus the unchanged published Mafia pair
(392464 bytes) total at most 883984 bytes, also within the combined allocation.
A focused test bounds the actual four-plate corpus by 886309 bytes in addition
to the individual caps; the global corpus gate is unchanged.

The native-resolution Werewolves attempts previously failed at Q70 with 258084
and 307612 bytes. Reallocating caps alone could not fit the original combined
budget, which led to the explicitly approved 1320px runtime-only exception.
No source master, quality floor, global budget or unrelated asset policy changed.

Focused tests cover exact-path matching, unchanged neighboring policy,
reproducible selected-only outputs, byte-identical source masters, approved
runtime dimensions, the combined corpus bound, and failure at Q70 without
replacing an existing derivative. Full asset regeneration,
full asset verification, build and parent-owned browser integration were not run.
