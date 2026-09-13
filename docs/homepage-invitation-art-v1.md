# Homepage Invitation Art V1

Generated on 2026-09-07 using the built-in `image_gen` tool and the requested
`C:/Users/Administrator/.codex/skills/.system/imagegen/SKILL.md` workflow.
One new illustration, with one targeted correction for composition/crop
defects in the first output. No API/CLI fallback or new dependencies.

## Deliverables

Paths are relative to `E:/werewolf_mafia`.

| File | Dimensions | Bytes |
| --- | --- | ---: |
| assets/game-art-source/homepage/invitation-v1.png | 1536 x 512 | 480071 |
| apps/web/public/game-art/homepage/invitation-v1.webp | 1536 x 512 | 66060 |
| apps/web/public/game-art/mobile/homepage/invitation-v1.webp | 960 x 320 | 12786 |

Application URLs match the integration task's markup:

- `/game-art/homepage/invitation-v1.webp`
- `/game-art/mobile/homepage/invitation-v1.webp`

Both WebPs are 3:1. The desktop file preserves the requested intrinsic
1536 x 512 dimensions. Desktop is below 130 KiB; mobile is below 45 KiB.
Combined output size: 78846 bytes; a normal viewport fetches the selected
candidate only.

The matching solid background is **`#0b2020`**, measured as the per-channel
median across the desktop WebP's bottom eight pixel rows. The left 55% field
has median **`#0c2222`**. These are measurements of the actual encoded image,
not the approximate color requested in the prompt.

## Composition And Review

Original tactile painted still life: one blank warm ivory sealed envelope,
one burgundy wax seal with a crescent/rosette relief, and two distinct
face-down green/gold cards with Balkan-inspired ornament. No key or
additional prop was added. Physical folds, card edges and separated corners
remain inspectable. No text, logo, person, candle, light blob or copied IP
insignia was observed.

The first generated output returned 1536 x 1024 rather than the requested
panorama and placed a card inside the intended left text field. The one
targeted edit made the object group smaller and moved it rightward so a
true 3:1 crop could preserve all corners. The accepted scene was cropped,
not stretched or composited. The left 55% is clear of objects; the group
sits approximately at x=64-94% and remains fully inside the final canvas.

The accepted generated file, normalized PNG, and encoded WebPs were inspected.
Isolated Chromium renders used the actual encoded files with
`object-fit: cover; object-position: right center`:

- Desktop: 1200 x 400.
- Mobile: 320 x 140, 375 x 160, and 390 x 180.

All four decodes and intrinsic-dimension checks passed. All four screenshots
were reviewed; no paper or card corner is cropped, and the envelope, two
card backs, and red seal remain recognizable in the mobile strips.

Review screenshots are outside the repository:

`C:/Users/Administrator/.codex/visualizations/2026/05/27/019e6aa0-15f1-7f70-9b9c-957902364c79/`

- `homepage-invitation-v1-desktop.png`
- `homepage-invitation-v1-mobile-320.png`
- `homepage-invitation-v1-mobile-375.png`
- `homepage-invitation-v1-mobile-390.png`

These are asset-only checks. The main task owns all live Bulgarian copy,
buttons, CSS, layout, status changes and integrated browser acceptance.
This task did not edit React, CSS, browser tests, or existing choice art.

## Provenance

Generated originals remain unchanged under:

`C:/Users/Administrator/.codex/generated_images/01a07c1e-3af0-78d1-8e00-46ccf5c1416a/`

| Role | File |
| --- | --- |
| Initial generation, not published | exec-4af7a8ec-72b1-499f-b799-48a829dc4b48.png |
| Accepted corrected composition | exec-78eda641-b8cf-4c42-a021-a5c0b901deb6.png |

The existing `apps/web/public/game-art/card-back-secret.webp` and
`apps/web/public/game-art/role-seer.webp` were viewed for material and motif
context only. Neither was passed to generation or edited. The initial
generation had no reference images. Only its own output was included in
the targeted edit, after inspection.

The built-in tool did not expose an explicit model version or seed, so
neither is claimed. Prompt replay is a new generation; deterministic
reproduction starts from the stored accepted PNG.

| Deliverable | SHA-256 |
| --- | --- |
| Source PNG | a2d5457d97a3a0a3b5197445440379e394edf1bb756da5e27c73d36a59273b63 |
| Desktop WebP | e27f68b62cc782c58e47ca08b3718b01c676c32b80b41b92ffe54f06718d367d |
| Mobile WebP | ca8c0ae097fd2870a153a417e53d9de59ffd6a71b4f3d78c697f315b27d5b8b7 |

## Reproduction

Native Windows tooling: Node 24.20.0 at
`E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`,
workspace Sharp 0.35.4, libvips 8.18.6, libwebp 1.6.0.

Normalize the accepted 1536 x 1024 original using this exact crop and PNG
encoding. Palette quality 90 retained the wax detail better than the initial
quality-78 trial while staying below the existing 500 KiB source budget:

```js
sharp.concurrency(1);
await sharp(acceptedOriginal)
  .extract({ left: 0, top: 280, width: 1536, height: 512 })
  .png({
    compressionLevel: 9,
    palette: true,
    quality: 90,
    effort: 10,
    adaptiveFiltering: true,
  })
  .toFile("assets/game-art-source/homepage/invitation-v1.png");
```

The source is already below the source-trimming threshold, so the normal
optimizer preserves its dimensions and bytes. No public PNG, AVIF, role
thumbnail, or separate mobile source is needed.

The minimal optimizer addition matches only
`homepage/invitation-v1.png`, after platform path normalization:

- Desktop maximum width 1536, budget 130 KiB, default WebP quality 82.
- Mobile width 960, budget 45 KiB, preferred WebP quality 70.
- Existing effort 6, smart subsampling, and quality fallback are unchanged.
- Dedicated mobile-source precedence is unchanged.
- Other names, versions, directories, nested paths, backup files and
  recursive mobile paths do not receive this rule.

To reproduce only this asset:

1. Create a fresh temporary root with
   `assets/game-art-source/homepage` and `apps/web/public/game-art`.
2. Copy only `invitation-v1.png` into that root's source directory.
3. Run the repository's absolute `scripts/optimize-assets.mjs` path using
   Node above, with the temporary root as the working directory and
   `WEBP_QUALITY=82`, `ASSET_FILE_CONCURRENCY=1`.
4. Check the source is byte-identical and the only outputs are the two
   WebPs listed above. Delete those temporary outputs and regenerate:
   both must be byte-identical to the first run.
5. Copy back only those two invitation WebPs when deliberately refreshing
   this asset. Do not run a broad optimizer over the shared dirty tree.

The regression test automates this isolated two-pass check; publication
also used the real optimizer against a one-master temporary tree. No manual
WebP encoder or modified canonical runner was introduced.

The repository's full-catalog verifier was not run because this bounded task
must not regenerate unrelated assets. Canonical Linux reproduction was instead
verified for this one source, as recorded below.

### Canonical Linux Verification

The unchanged `runAssetGenerators` function from
`scripts/run-asset-generators.mjs` was called on Windows with:

```js
runAssetGenerators({
  rootDirectory: isolatedRoot,
  sharpVersion: "0.35.4",
  generators: ["scripts/optimize-assets.mjs"],
});
```

The runner dispatched Docker using its pinned canonical image:

`node:24.20.0-bookworm@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2`

The fresh temporary root contained only the invitation source PNG, a copy of
the current optimizer script at `scripts/optimize-assets.mjs`, and an empty
`apps/web/public/game-art` directory. Sharp 0.35.4 was read from the repository's
package manifest and installed by the existing runner inside the container.
Default desktop quality 82 and mobile quality 70 were unchanged.

| Canonical Output | Dimensions | Bytes | SHA-256 Comparison |
| --- | --- | ---: | --- |
| homepage/invitation-v1.webp | 1536 x 512 | 66060 | Exact match with published desktop hash above |
| mobile/homepage/invitation-v1.webp | 960 x 320 | 12786 | Exact match with published mobile hash above |

The run processed exactly one source and produced exactly these two files.
Both Linux WebP SHA-256 values matched the existing published values in the
provenance table. The staged and repository source PNGs remained byte-identical
with SHA-256 `a2d5457d97a3a0a3b5197445440379e394edf1bb756da5e27c73d36a59273b63`.
Both published WebPs were verified unchanged after comparison. No generated
output was copied back; the temporary tree was removed after verification.

To repeat this check, prepare the one-source temporary tree described above,
copy the optimizer script into its `scripts` directory, invoke the existing
runner with these arguments, then compare its exact output set and SHA-256
values against the published files before removing the temporary tree.
Do not overwrite published files on a mismatch.

## Validation

```powershell
$node = 'E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe'
& $node --test scripts/optimize-assets.test.mjs scripts/run-asset-generators.test.mjs scripts/critical-mobile-assets.test.mjs scripts/asset-digest.test.mjs
& $node scripts/check-agent-guidance.mjs
& $node scripts/bundle-budget.mjs
git diff --check -- scripts/optimize-assets.mjs scripts/optimize-assets.test.mjs
```

- New invitation tests failed first on the generic 1400 x 467 output, then
  passed after the exact-path rule.
- All 21 narrow asset tests passed, including unchanged-source, output-set,
  budget, geometry, dedicated-source precedence and repeatability checks.
- Four browser asset renders passed and were inspected.
- Agent-guidance and scoped whitespace checks passed.
- Read-only performance check passed against existing build output. Runtime
  art was 42262.2 KiB, below the 60000 KiB hard limit. Existing route CSS
  warnings remained; no hard budget failed.
- All six choice-v2 source/runtime SHA-256 values were verified unchanged.
- Isolated canonical Linux reproduction passed for the single invitation
  source: exactly two outputs, both published WebP SHA-256 values matched,
  and no source or published bytes changed.
- No full build, broad optimization, canonical full-catalog reproduction,
  frontend/browser-test edit, commit or goal creation was performed.

## Integrated Homepage Verification

The closing invitation now follows the first-game guide. Real activity follows
the invitation; unavailable data is one compact notice with a status-page link.
Valid empty and populated results remain distinct, without fictional examples.
The family pages retain their existing shared activity components and styling.

The integrated invitation was reviewed at 320, 390, 768 and 1920 pixels in
both themes. Tests cover decoded responsive artwork, contained element and text
bounds, 44px hit targets, keyboard redirects, Axe and sampled secondary-action
contrast. The six homepage full-page baselines were reviewed, updated and then
verified without update mode; eight unchanged family-page comparisons passed.

Production build passed. Homepage declared client JS remains 20.1 KiB gzip;
CSS is 57.5 KiB, above the existing 56 KiB warning and below the 62 KiB hard
limit. No budget was increased. The artwork uses lazy responsive delivery.
These checks validate presentation, not availability of the game statistics API.

## Generation Prompt

```text
Use case: illustration-story.
Asset type: one original panoramic 3:1 bitmap, exactly 1536x512 pixels, full-bleed unframed closing invitation artwork for a Bulgarian mystery tabletop-game homepage. A single continuous painted still life, not a collage, not a UI mockup.
Scene/backdrop: directly overhead view of a flat dark desaturated petrol-green bookcloth tabletop, finely woven tactile texture, approximate base color #17383C. The LEFT 55 percent of the entire canvas is EMPTY, very quiet, evenly toned dark green material with only subtle small-scale weave. This whole left area must be suitable for cream live HTML heading and buttons later, with no objects, lines, motifs, corner decorations, harsh shadows, bright areas or visual interruptions.
Objects: wholly inside the RIGHT 45 percent, arrange one substantial warm pale ivory stationery envelope, sealed shut, with crisp physically plausible triangular folds and slightly deckled paper edges. The envelope is blank, has no writing, and bears one small rich burgundy-red wax seal with a simple original embossed crescent and tiny eight-point rosette in shallow relief, no letters. Under and just beside it, TWO face-down elegant physical game cards, slightly fanned, with visible separated edges and confidently rectangular silhouettes; dark verdigris card backs with restrained antique-gold Balkan carved-leaf and geometric embroidery-inspired ornament. Intimate handmade craft, not a known IP or copied existing card face. No key or other prop is needed.
Composition: straight top-down, panoramic canvas 3 times as wide as high. Every object and its soft local contact shadow is bounded inside x=58-95%, y=10-90%. The envelope is the primary focal shape around x=79%, y=53%, tilted very slightly, large enough to remain recognizable when the whole panorama is displayed at 390px width. The two card backs remain visibly distinct above/left of the envelope within that same right area, not mostly hidden. Keep comfortable tabletop margin on all sides of the group; no cropped paper or card corners. The left 55% is completely unoccupied. Do not add a fake text panel, artificial gradient overlay, frame or dividing line; it is one continuous cloth surface.
Style/medium: exquisitely authored painterly oil and gouache still-life illustration, clear inspectable object construction, tactile paper fibers, sculpted wax, subtle cloth weave, deliberate brush edges and warm/cool color relationships. Premium intimate invitation to a mysterious game night. Painterly, not photographic flat-lay stock imagery, not glossy 3D. Match the spirit of characterful illustrated folk-mystery role artwork through material detail rather than figures.
Lighting/color: soft broad neutral daylight, enough gentle modeling to distinguish the sealed fold and embossed wax, evenly lit quiet background. Deep petrol and verdigris green dominate the surface, contrasted by pale warm paper and a small blood-red/burgundy seal; gold appears only as restrained card ornament. Not all brown/gold, not murky, no glowing light effect. Keep the lower and left edges close to the same dark petrol tone so adjacent solid-color HTML can blend naturally.
Strict exclusions: ANY text, writing, letters, numbers, logos, watermark, known IP insignia, people, hands, faces, creatures, candles, lamps, fire, light blobs, bokeh, sparkling particles, vignette, group painting, tavern scene, extra envelopes, extra cards, weapons, gore, border, collage, split image.
```

## Composition Correction

Only `exec-4af7a8ec-72b1-499f-b799-48a829dc4b48.png` was passed as the edit target.

```text
Use case: precise-object-edit.
Recompose the attached painted invitation still life for a wide panoramic delivery. Preserve its lovely tactile dark petrol-green cloth, blank pale folded stationery envelope, burgundy wax seal with crescent/rosette, and exactly two distinct face-down green/gold Balkan-motif cards. Keep the same painterly style and physical object proportions. No new objects.
CRITICAL GEOMETRY: output a 1536x1024 canvas of the SAME continuous cloth, but make the entire existing envelope-plus-two-cards group MUCH SMALLER and move it rightward. Every physical object and its contact shadow MUST be inside the rectangle x=920 through 1420, y=318 through 700. Outside that rectangle is ONLY evenly toned dark petrol-green cloth. The group occupies roughly the rightmost third of the image and only the middle third of image height, not the full image height.
This will be cropped afterward to a 1536x512 panorama, taking y=256 through 768. Therefore do not place any card corner or envelope outside y=318..700, and do not put anything left of x=920. Ensure generous plain cloth above and below the group. Preserve readable card edges, clean triangular envelope folds, and a burgundy seal. No text, crop marks, guide lines, borders, panels, vignette, highlight blobs or extra decorations. Just one continuous evenly toned cloth surface across the whole canvas with the smaller intact still-life group at right-middle.
```
