# Werewolf Village Shadow Correction V7

Date: 2026-09-08

## Reason for Revision

The user accepted pursuing a village/forest scene but identified an
implausibly positioned shadow in V6. The distant villager and his lantern
did not explain the shadow on the right house. V7 keeps the new village
and forest while moving the villager near that house, with the lantern on
his left and a continuous ground-to-wall shadow behind him. The interfering
wall fixture is unlit. The light variant uses left-side afternoon sunlight
as the dominant source rather than claiming the lantern overpowers daylight.

The werewolf identity is deliberately supernatural. This is an artistically
coherent lighting arrangement, not a ray-traced physical simulation.

Mafia remains V5. No layout, typography, copy, game behavior or border change
is part of V7. Earlier artwork is retained as iteration history.

## Built-In Imagegen

Two built-in imagegen edit calls, with no CLI fallback:
- Dark edit target: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-1d281287-8b99-4f8e-b47d-6b11398f3ae0.png
- Selected dark original: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-0e414624-7628-411e-ba5e-6eecfbb83e6a.png
- Selected light original, edited from the selected dark: C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-748a8ff0-69ae-43b1-bcd3-d563254edf0f.png

Both selected originals and compact source PNGs were visually inspected.
Only ordinary resizing and PNG encoding was performed outside imagegen:
960x640 Lanczos3 cover, PNG palette quality95, compressionLevel9, effort10,
dither0.5. Palette encoding is not lossless relative to the original.

## Saved Assets

| Source under assets/game-art-source/homepage/ | Dimensions | Bytes |
| --- | --- | ---: |
| choice-werewolf-dark-v7.png | 960x640 | 417833 |
| choice-werewolf-light-v7.png | 960x640 | 505646 |

| Runtime WebP under apps/web/public/game-art/ | Dimensions | Bytes |
| --- | --- | ---: |
| homepage/choice-werewolf-dark-v7.webp | 960x640 | 99488 |
| homepage/choice-werewolf-light-v7.webp | 960x640 | 150920 |
| mobile/homepage/choice-werewolf-dark-v7.webp | 720x480 | 32590 |
| mobile/homepage/choice-werewolf-light-v7.webp | 720x480 | 52948 |

Source500KiB, desktop160KiB and mobile55KiB limits remain unchanged.
The previously reviewed final q34 attempt is extended only to the exact
Werewolf light-v7 source, after all existing quality attempts.

All four new WebPs were generated in an isolated two-source staging directory
and reproduced through the repository's pinned Linux/Docker generator.
Windows and canonical Linux buffers matched byte-for-byte. Source buffers
remained unchanged. Details: E:/codex-temp/homepage-werewolf-v7-2026-09-08/assets.json.

## Verification

- Landing unit tests: 71 passed in 7 files.
- Homepage character/polish browser tests: 22 passed, covering dark/light,
  mobile/tablet/desktop, sampled rendered text contrast, border visibility,
  keyboard navigation, create/join links and selected-theme-only downloads.
- Asset optimizer tests: 15 passed, including isolated reproduction of V7.
- Typecheck, regression contracts and production build: passed.
- Six homepage visual baselines were reviewed and updated. The initial
  comparison differed only inside the Werewolf illustration; the light mobile
  view exceeded the existing tolerance. All six passed a fresh comparison
  after updating the reviewed artwork, with no tolerance changes.
- Performance budget: passed. JS corpus 550.1 KiB; homepage JS 20.1 KiB;
  runtime art corpus 44324.3 KiB. Existing CSS warning thresholds remain
  exceeded on home, create, play and tutorial, below their unchanged hard caps.
- Both themes were inspected on 1920px desktop and 390px mobile screenshots.
  The village, forest and recognizable wall silhouette remain in the crop;
  no layout or typography changes were needed for V7.
- Dev server restored at http://127.0.0.1:3000/ and HTTP 200 confirmed.

Evidence directory: E:/codex-temp/homepage-werewolf-v7-2026-09-08/.
The V6 browser/unit checks were interrupted and are not claimed as passed.
No commit or push was requested or performed for this revision.

## Exact Dark Edit Prompt

```text
Use case: inpainting / physical lighting correction
Edit the provided DARK village painting, keeping the beautiful Bulgarian village, forested ridge, roofs, windows, charcoal/olive palette, painterly style and overall composition.
The user correctly noticed that the current wolf-shaped shadow on the right house is physically disconnected from the villager far away in the middle lane, and his lantern is on the wrong side. FIX THIS LIGHTING GEOMETRY, do not just make the shadow darker.
1. Relocate the SAME ONE ordinary man from the middle-left lane to the narrow open space beside the RIGHT stone house, just left of the facade with the shadow, roughly x62%, feet y65%, head y41%. The abandoned old position becomes uninterrupted cobbled lane, no second man. Same dark hair, waistcoat, shirt and anatomy, turn him in a natural three-quarter pose so he glances back toward the viewer and village. Keep the village and forest visible, do not zoom in or add a gate.
2. His lantern must be in the hand extended on his LEFT as seen by the viewer, toward the lane, at roughly x56%, y51%, lower than his head. The physical order left-to-right is LANTERN -> MAN -> STONE WALL. The amber lantern lights the man's left side and the wall beyond him; no light source between him and the shadow. His hand and handle must be anatomically natural and connected.
3. Remove the old floating wolf emblem entirely. Replace it with ONE physically CONTINUOUS cast shadow originating at the man's feet, running a short believable distance across the cobbles to the base of the right wall, then bending up onto that wall. It should clearly belong to this nearby man. The body shadow matches his stance/pose broadly, while the head-and-neck silhouette supernaturally reveals a WEREWOLF: recognizable pointed ears, long canine muzzle facing left, thick shaggy neck. Keep the head visible at approx x70-76%, y28-37%, with the body connected below. Project the shadow away from the lower-left lantern through the man toward the wall: its scale, angle and change across the ground/wall corner must fit that light path. The supernatural identity is intentional; the cast-shadow placement must otherwise make sense.
4. The existing wall-mounted lantern on that right house would illuminate and erase this shadow. Make that single wall fixture UNLIT, retaining the actual fixture. Distant warm windows and far doorway lights can remain weak ambient accents and must not cast competing strong foreground shadows. The handheld lantern is the dominant nearby source. Do not draw a bright lamp within the cast-shadow silhouette.
The wolf head has no eyes, inner face or teeth painted in; it is cast shadow shaped by form, not an actual creature on the wall, not a decal, not a hovering cutout. Preserve stone grain through it and a soft credible penumbra.
Maintain clear night material visibility, warm local amber on gray stone, no global sepia/brown wash, no blue filter, no stronger vignette. The architecture, forest and important wolf-head contour remain in the top half for the website card. No typography, UI, border or watermark. One full-bleed 1536x1024 landscape image.
```

## Exact Light Edit Prompt

```text
Use case: lighting-weather
Create the matching LIGHT-theme version of this corrected village illustration.
Preserve this EXACT new scene geometry: same Bulgarian stone-and-timber houses, open village lane, low walls, forested ridge, ONE ordinary villager now near the RIGHT house, holding the lantern on his LEFT toward the lane, turned naturally back, and the connected cast shadow behind him onto that nearby right facade. Do not return him to the middle of the square. The wall-mounted lamp on the right house must remain unlit.
Turn night into soft late-afternoon daylight: warm neutral limestone, natural muted olive forest greens, desaturated timber, comfortably readable buildings and foliage with depth and light haze among distant trees. No blue/cyan palette, no white fog covering village, no orange/sepia filter. Restrained ivory and aged-gold highlights appropriate to a light website theme, not yellow.
Crucial shadow realism: dominant low-angle sunlight comes from off-frame LEFT, approximately the same side as the hand-held lamp, so man is BETWEEN that light direction and the wall to the right. Lantern glow is faint in daylight and no longer portrayed as overpowering the sun. Retain one physically continuous shadow starting at the feet across the cobbles and up the near stone facade behind him. Body pose, attached ground shadow and direction should fit this coherent light source. The only supernatural detail is that its head and neck clearly show pointed wolf ears, a long muzzle and shaggy shoulders. Keep that identifying head above y38% in the central-right part of the frame, but make shadow size/edge softness credible for a man standing near the wall. Not a giant floating painted wolf emblem, no actual creature, no eyes or facial details inside the shadow, no lit lamp erasing the shadow. Other house shadows and the man's lit side follow the same LEFT sunlight direction.
Maintain natural anatomy, exact position of hands and the lamp handle, and preserve the village/forest composition and every important feature. One full-bleed landscape 1536x1024 painting. No typography, border, UI, added objects or heavy vignette.
```
