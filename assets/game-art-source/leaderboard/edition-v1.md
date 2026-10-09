# Leaderboard printing-room edition

Generated 2026-09-22 with the built-in image generation tool, from the user-approved synthetic leaderboard mockup. No real player data was supplied.

## Sources and delivery

- Dark: edition-dark-v1.png, 1536 x 1024, generated clean background extracted from the approved composition.
- Light: edition-light-v1.png, 1536 x 1024, daylight edit of the dark master.
- Runtime: same stem .webp, native size, quality 75, effort 6, smartSubsample true, per-image limit 180 KiB. No extra AVIF or mobile exports.
- Metadata: dark master copied to ../og/og-leaderboard.png; exported as 1200 x 630 cover-cropped JPEG, quality 85, mozjpeg.
- Reproduce with node scripts/optimize-assets.mjs --only leaderboard/edition-dark-v1.png --only leaderboard/edition-light-v1.png --only og/og-leaderboard.png.
- Old portrait and prior metadata master are preserved outside runtime/source export discovery in assets/game-art-archive/leaderboard-before-midnight-v1/.

All interface text, rankings and dates are semantic HTML. Only the printed newspaper brand and issue name belong to the bitmap. CSS selects one theme plate, crops the right-side props on mobile and fades the scene before dense table rows.

## Dark prompt

Use case: background-extraction. Asset type: production background image for the selected Senkite leaderboard website.
The supplied image is the APPROVED full website mockup. Extract/recreate ONLY ITS PHYSICAL BACKGROUND as a clean high-quality 1536x1024 landscape bitmap.
Preserve the exact photographic old printing-room scene and camera/material/light character from the reference: charcoal near-black printing desk, letterpress type blocks, large upright aged-metal numeral "1" near x1050,y240, wooden tray behind, cropped black typewriter on the upper-right edge, burgundy ink roller, angled newspaper proof across the right around y500. This beautiful scene must be recognisably the same as the chosen mockup, not a new still life.
REMOVE ALL INTERFACE: no top navbar, website logo in navbar, no heading "Вечерен брой", no player names, no wins, no table, no buttons, no row separators, no interface labels, no margins, no frames. Fill those deleted areas with continuous natural charcoal printing-desk material.
KEEP text that is physically printed on the angled newspaper: large Cyrillic brand "Сенките", and below it ONLY "ВЕЧЕРЕН БРОЙ". Secondary newspaper columns can be tiny indistinct authentic print. Keep the raised metal "1". Do not place floating readable text anywhere else.
Important composition: LEFT 54 percent is quiet DARK negative space suitable for live ivory headings, without props or big bright veins. The objects are clustered right of x850 and above y590. Rightmost items intentionally continue outside the frame; tabletop continues right to left with no blurred edge treatment. Lower 35 percent is mostly empty uniform dark ink-black desk with faint texture for a real HTML leaderboard. Preserve some real physical grain at lower contrast, NOT flat featureless black. Base compatible with #111512.
No black bars or top reserved stripe. No light vignette or blur along image edges, no corner frame, no baked gradients, no bokeh, no particles. Photographic realism, premium cinematic craftsmanship, controlled warm side-light on metal, burgundy and dark green-black, clear visible number 1. Crisp detailed objects; no illegible UI remnants. Recreate the background at full resolution, not a blurred screenshot crop.

## Light prompt

Use case: lighting-weather. Asset type: production LIGHT THEME background for the Senkite leaderboard.
Edit the attached clean background plate into its beautiful DAYLIGHT counterpart. Keep the exact camera, proportions and positions of every object: the aged metal numeral 1, wooden letterpress tray, small type blocks, cropped black typewriter, burgundy ink roller and diagonal newspaper proof. Preserve the physically printed Bulgarian wordmark "Сенките" and line "ВЕЧЕРЕН БРОЙ" on the newspaper. No additional text or interface.
Change the black ink-stained desk to a pale cool pearl-grey, softly worn printer's stone tabletop, compatible with #ebece7. Very subtle organic grain and rubbed wear, not heavily cracked rough stone, not beige parchment. Left 54 percent and lower 35 percent must be very quiet LIGHT negative space for dark live website text. Preserve faint natural texture so this remains a physical scene, not a flat empty white background.
Bright diffused window daylight comes from upper left. The numeral 1 is visibly aged SILVER with modest brass warmth at its edges, not glowing gold. Grey weathered wood, deep burgundy roller, authentic black typewriter with readable mechanical detail. The newspaper becomes neutral ivory paper with black ink, not yellow sepia. Subtle physical contact shadows to anchor objects, especially numeral, roller and type blocks. Keep all props on right and above y590 as in source.
Single seamless landscape scene, 1536x1024. Camera unchanged. Do not add new objects. Do not change the shape of numeral 1. No UI/navbar, no heading or table, no frames, no blurred side bands or vignette, no bokeh or light blobs, no gloomy dark haze. Refined cinematic photo realism and tactile editorial craft, a convincing morning view of the very same printing room.

