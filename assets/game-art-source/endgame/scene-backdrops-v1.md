# Endgame Scene Backdrops v1

## Scope

Eight environment-only clean plates edited from user-approved whole-screen mock images using the built-in `image_gen` tool: eight distinct initial calls and one localized village correction after a follow-up composition request. No UI, code, standalone portraits, logo assets, or Jester overlay are produced here. The Jester overlay belongs to the integrating agent.

Preserve generated PNG sources at their native size. Current runtime assets are single native WebPs at Q75, effort 6, with default subsampling (`smartSubsample: false`). No AVIF/mobile duplicates and no artificial upscaling. The requested native size was 1920x896; actual dimensions and the replacement recipe are recorded under Current WebP Replacement below. The original AVIF production record remains explicitly historical.

The shared prompt below followed by a newline and the scene-specific text forms each initial prompt. For the six scenes after werewolves and village, the right-table clearance addendum below follows the scene-specific text. The localized village revision has its exact prompt recorded separately. Every call uses its listed reference path and `transparent_background: false`.

## Shared Prompt

```text
Use case: precise-object-edit.
Asset type: production endgame environment backdrop, NOT a UI mockup.
Input image 1 is the approved whole-screen mock and the exact edit target. Extract only its full-width illustrated environment between the top navigation and the lower portrait roster (approximately x0..1488, y60..755; use the actual scene boundaries when they differ). Deliver the environment alone as an opaque seamless edge-to-edge landscape, preferred native output 1920x896, aspect ratio approximately 2.13:1. Do not include any of the page above or below the illustrated scene and do not add borders or bars.
Primary request: faithfully remove all overlaid UI and reconstruct only the environment hidden underneath it. Preserve the SAME environment, perspective, camera angle, light, palette, architecture, right-hand window/view, furniture and exact foreground tabletop artifacts and their relative positions. This is constrained clean-plate editing, not a redesign or a newly staged scene. Keep rich crisp painterly photographic detail.
Remove top navigation/header/logo, all floating headline/body/result text, decorative UI dividers and badges, replay/restart buttons, icons, all footer/roster/player portraits and names. Do not create any new logo or standalone role portrait assets. Physical card artwork already printed on tabletop cards is part of the approved still life and must remain; it is not a UI portrait. Keep existing physical card labels only when legible and correct, and never invent extra words. Remove other textual inscriptions/brand lettering while preserving their physical paper, book, textile or plaque surfaces. No floating typography, no UI, no frame, no watermark.
Composition: retain a generous quiet upper-center wall with no props moved into it, the artifacts across the bottom foreground, and the window on the right. Reconstruct the erased text/button areas from the existing wall material with coherent texture and lighting. Keep original object scale and relationships, not a close-up of one object.
```

## werewolves

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-e9d7110e-f65c-46fc-892f-189e9cc38d0f.png`
- Production source: `assets/game-art-source/endgame/werewolves-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/werewolves-v1.webp`

```text
WEREWOLVES base: preserve the moonlit dark-green rustic Bulgarian room, burning stone fireplace and woven red wall textile far left, carved chairs, fur on right chair, open right doorway/window onto the stone village with church, mountains, moon and two distant wolves. Preserve brass tankards, candle, old books, red embroidered table runner, the two physical black wolf cards and central embossed silver wolf medallion in their original positions. SPECIAL REQUIRED EDIT: remove the entire jester set from the foreground right, including the cracked white/red theatrical mask, red-and-black velvet fool's hat, all gold bells and jester card. Reconstruct the matching runner and carved table underneath. No jester artifact remains anywhere. Keep upper-center dark-green wall quiet.
```

## village

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-aadee4da-f05d-46cc-a937-22f12b33dc16.png`
- Production source: `assets/game-art-source/endgame/village-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/village-v1.webp`

```text
VILLAGE: preserve the bright sunlit Bulgarian village room, pale plaster central wall, weathered green shelves left and open green window right, embroidered red/white wall hanging, carved chairs, church and alpine village view in daylight. Preserve the daisies in green ceramic jug left, brass lantern, aged books, cups/bowls, carved wood table and red embroidered runner. Preserve the five pale sun villager cards, two dark wolf cards and central golden sun-face medallion in exactly their original arrangement. Existing card labels are "Селянин" and "Върколак". The top-center must be uninterrupted light plaster with the original diagonal sunlight. Do not add objects or decorative overlays.
```

## vampires

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-631f9b5d-f1c0-4db5-a092-f3acd380f860.png`
- Production source: `assets/game-art-source/endgame/vampires-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/vampires-v1.webp`

```text
VAMPIRES: preserve the candlelit dark aristocratic Bulgarian room, stone fireplace left, burgundy drapery and carved red-velvet chair, dark-green upper-center wall and open right window onto the moonlit mountain village. Preserve the red-wine cut crystal goblet on the left, aged books, red cloth, gold tray with dark dried roses, elegant letter opener along the front edge, black envelope and red fang wax seal at center, huge engraved gold ring with red fang gemstone above the envelope, two original physical painted vampire cards on the foreground right, candle and small box far right. Keep every tabletop object in its approved relative position. Do not add any figures to the room, new portraits or new card designs.
```

## mafia

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-ac14ca43-80e8-4a27-9d27-2cba3c89617d.png`
- Production source: `assets/game-art-source/endgame/mafia-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/mafia-v1.webp`

```text
MAFIA: preserve the dark paneled Sofia club room, brass desk lamp far left, red leather chairs, liquor shelf and plant left, central dark wood paneling, fedora on right chair, and right-hand rainy window view of Sofia with tram and lit lamps. Preserve green felt table, left whiskey tumbler and smoking cigar in ashtray, books at lower left, two sun-backed cards flanking the existing Don and Mafia face-up physical cards, the black-and-gold M signet ring in foreground center-left, confidential kraft envelope foreground right with red M wax seal and fallen brass chess king. Do not replace or redesign card faces. Existing physical card labels "Дон" and "Мафия" only if crisp. Keep the upper-center dark wood paneling quiet for live text.
```

## town

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-efb8cce3-1141-4c2a-8c92-223b8dd0e54b.png`
- Production source: `assets/game-art-source/endgame/town-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/town-v1.webp`

```text
TOWN: preserve the exact bright Sofia office/cafe room, light ivory plaster and paneling upper center, brass/green desk lamp and books left, potted plant, dark-green leather chair, open right city view with green tram, sunlit ornate domed building and tree, and dark coat on right chair. Preserve the green felt tabletop, clear water glass far left, books and fountain pen foreground left, two existing face-up defeated mafia physical cards on left-center, ornate silver Sofia police badge foreground center, large tied kraft case folder on right with broken red wax seal, and stacked books at far right. Preserve readable physical card labels "Дон" and "Мафиот". Keep upper-center light plaster clean and quiet with original diagonal shadows.
```

## maniac

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-ee0dabea-65c9-48ad-b5f6-bcb65431dc67.png`
- Production source: `assets/game-art-source/endgame/maniac-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/maniac-v1.webp`

```text
MANIAC: preserve the dark Sofia club room with rain-streaked right window and twilight domed city building, brass desk lamp far left, bottles/plant left, red leather chair, empty wooden chairs, coat on right chair and central dark wall/paneling. Preserve green felt tabletop, whiskey glass and cigar ashtray left, handwritten notebook and fountain pen at lower-left edge, five face-down sun-backed physical cards across the mid-table, single face-up "Маниак" physical card foreground center, brass pocket watch and chain immediately right of it, black leather gloves lower-right. Keep the already printed card portrait faithful, do not create new role portrait art. Keep upper-center dark wall quiet.
```

## lovers

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-077018f4-440a-444b-8a51-f2491f895613.png`
- Production source: `assets/game-art-source/endgame/lovers-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/lovers-v1.webp`

```text
LOVERS: preserve the warm sunlit Bulgarian room with pale plaster center, green shelving left, floral ceramic vase, old books, small candle and embroidered red/white hanging; two matching heart-cutout carved chairs behind the table; open green right window onto a mountain village and church at gentle sunrise. Preserve brass cup and aged books left, daisies spilling from lower-left, carved wooden tabletop, red folk runner, the original pale Seer card on foreground left and dark Wolf card foreground center-right joined by the red cord with a central knot, and opened twin sun/moon locket with chain on far right. Preserve original card labels "Гадателка" and "Върколак" only if legible. Keep the top-center pale wall quiet, retain soft diagonal sunlight and all object positions. No added people, hearts or symbols.
```

## draw

- Approved edit target: `C:/Users/Administrator/.codex/generated_images/019e6aa0-15f1-7f70-9b9c-957902364c79/exec-aff94d13-d11d-4cc4-acb5-f0eff92c6e5f.png`
- Production source: `assets/game-art-source/endgame/draw-v1.png`
- Runtime asset: `apps/web/public/game-art/endgame/draw-v1.webp`

```text
DRAW: preserve the somber empty rustic Bulgarian room with dark wood and dark-green wall upper center, red folk tapestry left, framed religious icon on left wall, empty carved chairs around the table, and right window onto cold misty village, church and pine mountains beneath overcast sky. Preserve the collapsed brass hourglass on its side spilling sand left-center, spent melted candles and wax left, scattered physical cards with village architecture and wolf heads across the red runner, overturned engraved wooden cup on far right, scattered grains and wax scraps. Keep all card faces and positions as in the approved mock. No lit victory candles, no living characters added, no victory emblems. Quiet dark central wall, sharp naturalistic foreground materials.
```

## Right-Table Clearance Addendum

The user added this requirement after the first werewolves and village generations. For vampires, mafia, town, maniac, lovers and draw, append the following exact text after the scene-specific prompt:

```text
Latest required integration constraint: reserve the rightmost 25 percent of the foreground TABLETOP as clear continuous table/runner for a separately composited Jester artifact. Keep the primary faction artifact and all tabletop card/prop clusters in the lower-left and lower-center. If the approved mock has tabletop objects occupying that reserved right quarter, move those same objects inward to the left/center while preserving their appearance and internal relationships; do not invent or discard them. Background chairs and right window stay exactly in place. This clearance instruction overrides earlier exact tabletop position instructions only where necessary.
```

Werewolves already had an open right-hand foreground after Jester removal. Village was edited once more using its initial clean plate as the only reference.

### Village Localized Revision

- Edit target: `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-4f03c64c-273c-45e0-9c57-94fa5fc88454.png`
- Selected output: `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-20ad56c8-8b18-467b-a994-6de51e632b29.png`
- Tool: built-in imagegen, `transparent_background: false`.
- The initial clean plate was superseded at the requested production paths. The built-in original remains in its generated-images directory.

```text
Use case: precise-object-edit. Input image 1 is the already approved cleaned VILLAGE backdrop, and is the exact edit target. Make ONE localized composition correction to accommodate a separate transparent overlay: clear the rightmost 25 percent of the foreground tabletop (x approximately 1380..1836 in this 1836x857 image), retaining only the carved wood surface and red embroidered runner in that area. Move the two pale sun cards currently on the right inward to join the other cards left/center, and relocate the brass cup and small herb bowl at the right edge to the left side of the table. Keep all five pale villager cards, both wolf cards, central gold sun medallion and other physical items; do not remove them. Keep all props appropriately scaled with natural shadows, group the faction objects across the lower-left and lower-center. Preserve the entire upper two thirds of the room EXACTLY, including pale blank central wall, shadows, green shelving, flowers and lantern left, chairs and right-hand village window view. Preserve the landscape framing, rich detail, warm daylight and native approximately 2.13:1 aspect ratio, preferred 1920x896 output. No UI, floating text, nav, footer, extra portraits, logo, new objects, or Jester props. Existing readable text physically printed on cards may remain. Do not change the room, camera, lighting or scene design.
```

## Historical AVIF Completion Manifest

Completed 2026-09-27; superseded by the WebP replacement on 2026-09-28. All eight former runtime files decoded as opaque AV1 images and retained the exact native PNG dimensions. This historical manifest records the shared-optimizer AVIF outputs rather than the earlier direct encodes. The PNG masters are byte-identical to the selected built-in image-generation outputs. No resize, crop, enhancement, or post-generation raster editing was applied to the saved masters.

| Scene | Native PNG and AVIF dimensions | AVIF quality | PNG bytes | AVIF bytes |
|---|---:|---:|---:|---:|
| werewolves | 1836x857 | 58 | 2365435 | 144083 |
| village | 1836x857 | 54 | 2657851 | 147261 |
| vampires | 1836x856 | 62 | 2345050 | 154898 |
| mafia | 1836x857 | 62 | 2172780 | 131890 |
| town | 1836x857 | 62 | 2370992 | 143723 |
| maniac | 1836x857 | 62 | 2176779 | 136399 |
| lovers | 1836x857 | 58 | 2531412 | 155411 |
| draw | 1835x857 | 62 | 2359082 | 151229 |
| Total | | | 18979381 | 1164894 |

Historical encoding versions: Sharp 0.35.4, libvips 8.18.6, libaom 3.14.1, libheif 1.23.2. Former AVIF runtime total was 1137.6 KiB / 1.111 MiB. PNG masters occupy 18.10 MiB.

### Historical AVIF Reproduction Recipe

This superseded recipe documents the original outputs, not current optimizer behavior. Node used for production was `E:/codex-temp/node-v24.20.0/node-v24.20.0-win-x64/node.exe`.

```js
sharp.concurrency(1);

const qualityByKey = {
  werewolves: 58,
  village: 54,
  vampires: 62,
  mafia: 62,
  town: 62,
  maniac: 62,
  lovers: 58,
  draw: 62,
};

await sharp(sourcePath, { limitInputPixels: false })
  .rotate()
  .resize({ width: 1920, fit: "inside", withoutEnlargement: true })
  .avif({
    quality: qualityByKey[key],
    effort: 7,
    chromaSubsampling: "4:4:4",
  })
  .toFile(outputPath);
```

The former AVIF pipeline set `sharp.concurrency(1)`, normalized orientation with `rotate()` and passed the image through `resize({ width: 1920, fit: "inside", withoutEnlargement: true })`. All eight sources are narrower than 1920, so their native dimensions remained unchanged. No sharpening, additional metadata, lossless flag, alpha, or explicit color transform was applied.

Encoder concurrency was necessary for byte-identical AVIF reproduction with the recorded library versions. A werewolves check at default concurrency 12 produced the original 145,546-byte file even with rotate/resize; concurrency 1 reproduced the integrated 144,083-byte file and its SHA-256 exactly. This validation was in memory and did not write an image. The eight historical AVIF checksums and byte counts were collected directly from disk; that post-integration re-encode check was limited to werewolves.

The initial direct-AVIF production pass totaled 1,177,074 bytes. On 2026-09-27 the integrating agent regenerated the AVIFs through the shared orientation/resize pipeline at the same quality, effort and chroma settings. The historical byte counts and hashes below were read from those integrated outputs, totaling 1,164,894 bytes. Only this provenance document was updated during that independent QA follow-up; no image was rewritten by the reviewer at that time.

### Selected Built-In Outputs

| Scene | Original generated output copied into the production source |
|---|---|
| werewolves | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-ee881d68-4d38-4b82-b75b-e0dad8be60fe.png` |
| village | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-20ad56c8-8b18-467b-a994-6de51e632b29.png` |
| vampires | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-2ddfee33-9701-4ea3-8527-f30a800ceefa.png` |
| mafia | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-712a0039-e078-40b5-8e1a-015ee05e8e46.png` |
| town | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-8ddda0cf-7d66-4758-b7df-8c49a22a2f9b.png` |
| maniac | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-621c119e-cf01-45a4-b420-fcc09ba02c1b.png` |
| lovers | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-155afc06-d874-40ac-8816-7033c1ecefbc.png` |
| draw | `C:/Users/Administrator/.codex/generated_images/01a0e444-461f-7263-afe2-a54375049598/exec-fe23cfeb-525b-42b3-9eb0-4c1f451dd6c3.png` |

### Historical AVIF And Unchanged PNG SHA-256

| Scene | PNG SHA-256 | AVIF SHA-256 |
|---|---|---|
| werewolves | `6a3e3527454214a7533702da8e8d0f6820f7eba444af0f4f309ab372daacf652` | `4568a8a03a96f4d6d88f044ad4fe4068a842f8c894c1a904fcb4a2551b923053` |
| village | `8c0c978a5a3dbcb8ff0ff4c6c6162c4eeaa3d2cd4e20f0c508d0f07d9724d6da` | `e36c4d5b421ef8fb6a45df42a45e40da3238885a4101e9d34b7ef7b4a63b8150` |
| vampires | `0d852b259ad7b58247e15218c54e54a7d946dad3eb8241319c962ed6269ad853` | `750bc3053a5a83f44493e04fbcde6d8abe76f7e53d2f24905084f260e581e026` |
| mafia | `14d9ab62dfd70497d6406edeed10374d556553a8e507d9e83d7838ecbdd300af` | `02f258e49b579bff539cf2ac4e789b181b14dce04933b3eeb6e1569f8339a10b` |
| town | `2c488901f1937365b2083df734b41d41f420e71440526665b3118928ccc5ec6e` | `6ded33756c49abd884f77546f75157a17aaa86ee5957b197955ae7e83cf9c232` |
| maniac | `37da442f3bcd10963cb8155c3c28cfc9e4e34b53480588cf7664393f499c4f64` | `ae338c2768a8242cb8b5868a4075272448ce3b8a79c83bc068a22c8eec3b50fc` |
| lovers | `6b073dc6ce78e1acea053c7581b8579471a46c4a2d0c1cff53e6fb931e074bcc` | `74b46fe7b010db07dd33405d0289936e33dc038ad746f5bed6514715c4630939` |
| draw | `584413bff18819fa52c1e4db46321e23f4612aa3c2703b59906f253e8c914f1f` | `46003252e10f26aee59a9d5efc1f0a659b8df755c1edddb71d88b078711327e1` |

### Historical AVIF Visual QA

- Inspected all eight approved full-screen references before generation.
- Inspected every generated clean plate. No navigation, UI headings, buttons, footer roster, floating UI portrait or victory badge remains.
- Kept the right-hand window, upper-center wall, overall lighting and original physical tabletop motifs. Primary faction objects occupy the lower-left/center and the right foreground offers placement room for the separate overlay.
- Werewolves has no Jester mask, hat, bells or Jester card. The Jester cutout supplied by the integrating agent was not regenerated or edited.
- Physical painted cards and background artwork are part of the supplied environments, not standalone portrait deliverables. Some existing diegetic book lettering remains in the village output.
- The later right-table-clearance requirement intentionally changes some tabletop item positions. Village received one localized second imagegen edit for this purpose; the other six scenes include the additional constraint in their first prompt.
- Reviewed all decoded AVIFs in a single in-memory contact preview, without writing a contact sheet or temporary image to disk.
- Before optimizer integration, verified all eight PNG copies against their selected generated originals and all eight direct AVIF encodes against an in-memory re-encode: all byte-identical. After integration, verified the unchanged PNG hashes, refreshed all eight runtime sizes/hashes, and reproduced the integrated werewolves AVIF byte-for-byte using the current recipe including concurrency 1.
- This is asset QA only. Browser-level responsive crop, live text contrast, and overlay interaction are owned by the integrating agent; no UI code or baseline was changed here.

## Historical Budget And Integration

The integrating agent reported 392 KB of remaining art budget. Quality takes precedence over forcing all eight images into that allowance; aim approximately 100-160 KiB per scene. Integration, current-build budget reconciliation, runtime crop/mobile checks, and any replacement/retirement decisions remain with the integrating agent. This asset-only task does not edit budget gates, app code, or visual baselines.

## Current WebP Replacement

Replaced on 2026-09-28 through `scripts/optimize-assets.mjs --only` for these eight exact sources. The installed Windows Playwright WebKit could not decode the AVIF plates; wrapping their URLs in Next 16.3.3 image optimization did not transcode them because its `BYPASS_TYPES` includes AVIF. Native WebP replaces the former runtime AVIFs rather than adding a second format. This is not a claim about every Safari/WebKit installation.

All PNG masters retain the SHA-256 values recorded above. No master, Jester or laurel asset was regenerated or edited. The optimizer writes each WebP through its existing temporary-file/rename path, then removes only that scene's obsolete AVIF after a successful bounded export. Failed encoding or a size-cap failure preserves the previous WebP and AVIF. There are no new mobile, PNG or thumbnail derivatives.

| Runtime file under `apps/web/public/game-art/endgame/` | Native dimensions | WebP bytes | WebP SHA-256 |
|---|---:|---:|---|
| `werewolves-v1.webp` | 1836x857 | 176730 | `31b169fa6eb271b1108e561823ec7c803b998dc7579fe63c1d5eee50011dd133` |
| `village-v1.webp` | 1836x857 | 226732 | `803659c717bbed1e104ef4779cc5268878887923e4f64c56c1827f4029e9943a` |
| `vampires-v1.webp` | 1836x856 | 161954 | `417672c65570c7629c27348e5334ca22dcce3ffb32d58758f9b48ad37ff7371e` |
| `mafia-v1.webp` | 1836x857 | 139042 | `46a0a32ba70df8da3cc6baa245a3f74ea3a4994224df2da005eec36914f92105` |
| `town-v1.webp` | 1836x857 | 164074 | `76a035dfdcbe9b2cf827ddf90126edb108ed8c9b396d853fcd6b46f4b6053e0b` |
| `maniac-v1.webp` | 1836x857 | 141750 | `11d4b2cb72c331d3f34193af7e9665da3af8e03a411e6df5fa12fd5a915a2328` |
| `lovers-v1.webp` | 1836x857 | 201284 | `46248db944ef0820413a969d428e5f23cbb5ed087755ee255168ddfdce8160a6` |
| `draw-v1.webp` | 1835x857 | 166024 | `8f7cfac820c26596e9832b7a64fd67658060868686cc23e57064fbfaf2a26db4` |
| Total | | 1377590 | |

The replacement totals 1345.3 KiB, an increase of 212,696 bytes / 207.7 KiB over the retired AVIFs. Each scene has a 230 KiB cap, below the existing general 360 KiB WebP cap. The largest is village at 221.4 KiB. Global budget gates and native dimensions are unchanged. Main owns current-build aggregate budget verification and browser visual review.

### Current Reproduction Recipe

Encoding versions: Node 24.20.0, Sharp 0.35.4, libvips 8.18.6, libwebp 1.6.0. Every scene uses fixed Q75 and effort 6, with default subsampling (`smartSubsample` omitted, therefore false), not a descending quality fallback. The existing Windows optimizer sets `sharp.concurrency(1)`.

```js
await sharp(sourcePath, { limitInputPixels: false })
  .rotate()
  .resize({ width: 1920, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 75, effort: 6 })
  .toFile(outputPath);
```

Use the shared optimizer, which enforces the cap and successful-replacement cleanup:

```powershell
node scripts/optimize-assets.mjs --only endgame/village-v1.png --only endgame/town-v1.png --only endgame/werewolves-v1.png --only endgame/mafia-v1.png --only endgame/vampires-v1.png --only endgame/maniac-v1.png --only endgame/lovers-v1.png --only endgame/draw-v1.png
```

The independent pipeline checks reproduce all eight native WebPs and the unchanged transparent Jester in an isolated temporary root, compare exact derivative bytes against both the explicit recipes and published outputs, verify master bytes, and exercise repeated export plus AVIF preservation on failure. The fidelity spec expects direct WebP `src` and `currentSrc` and decodes every image after hydration and viewport/text resizing. Cross-browser rendering and visual comparison remain with main; no screenshot or budget baselines were updated by this conversion.

