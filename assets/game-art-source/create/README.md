# Create Masthead Art

Generated with the built-in image_gen tool on 2026-09-22. These four PNGs are immutable source masters; only WebP derivatives are served.

## Delivery

- Runtime: apps/web/public/game-art/create/masthead-{werewolf|mafia}-{light|dark}-v1.webp.
- Optimizer: scripts/optimize-assets.mjs, exact create masthead registration.
- Export: 1152 x 384, WebP Q70, no redundant mobile or AVIF files. WebP also works in the Windows WebKit test runtime, which could not decode AVIF.
- The expanded hero uses up to 1152 x 384 CSS pixels (native resolution), without upscaling on wide desktops. Mobile uses an 864 x 288 crop. These are not 2x-density full-width backgrounds.
- Same room and camera per family, lighting changes by theme. A directional mask protects the title while keeping the table and window visible. The hero is 320px tall on desktop and at least 256px on mobile, growing with enlarged text.
- Background color remains the readable fallback if an image is unavailable.
- No gameplay, role cards, lobby scenes or authentication changes.

## Prompts

### werewolf-dark

Use case: historical-scene. Asset: custom wide masthead illustration for the Bulgarian social deduction game Senkite, Werewolf room-creation screen, DARK theme. Create ONE finished raster artwork, no mockup or typography. Wide panoramic canvas, approximately 3:1.
Scene: the host has just prepared a modest Bulgarian mountain village house for a secret game night. An empty old oak table at the RIGHT, a few neatly placed face-down charcoal-green playing cards with restrained engraved brass geometric backs, plain wooden chairs and one small real oil lantern. An open window beyond the table looks onto a few slate-roof stone houses and a dense pine forest in twilight. Distinctive Bulgarian vernacular wood joinery and stone, believable physical construction, grounded perspective. No people, hands, wolves, silhouettes, weapons or magical effects.
Composition is functional: left 45 percent is a quiet dim sage-charcoal plaster wall with subtle depth, almost no objects, for website text; the meaningful tableau is around x=70% of image width. Table cards, lantern and lower window/view must all remain identifiable in the horizontal middle third, since the image will be used in a very shallow 200px header. Camera at table height looking across, not overhead. Keep objects small enough to fit that central strip. Natural detail continues beyond edges; no border or frame.
Style: richly observed, sophisticated cinematic realist game illustration, fine material detail without painterly noise, crisp legible silhouettes and plausible light. Forest green, pale stone, restrained brass, tiny red wax accent. Warm lantern against cool dusk, open midtones, NOT overwhelmingly brown or blue, no black crush, no fog/blur/bokeh, no exaggerated glowing lights. No text, lettering, watermark or UI. Output one very wide high-quality image.

### werewolf-light

Use case: lighting-weather. Input image: EDIT TARGET, dark Werewolf room-creation masthead. Create its LIGHT THEME companion. Preserve the exact architecture, camera, wide 3:1 framing, table, cards, lantern, chairs, village and forest, all positions and material detail. Change only time of day and lighting: a bright overcast late afternoon, diffuse daylight filling the room and window, readable fresh sage-green shadows and pale neutral limestone/plaster on the left; natural oak with subdued brown, green forest and slate roofs outside. The lantern is unlit. The small red wax accent and restrained brass card-back decoration stay. Left 45% must be a quiet light sage-gray plaster wall for dark interface text, not yellow parchment. Detailed, believable cinematic realist game illustration, crisp high-quality materials without grain or painterly mush. No people, silhouettes, monsters, new props, text, lettering, UI, watermarks, bloom or blur. Keep it the same room prepared for the same evening, in daylight. One finished panoramic image.

### mafia-dark

Use case: historical-scene. Asset: bespoke panoramic masthead for Senkite, Bulgarian social deduction Mafia room-creation page, DARK THEME. One finished wide 3:1 cinematic realist illustration, no interface or text.
Scene: a host has prepared a discreet private dining salon in a believable early twentieth-century Balkan city before guests arrive. On the RIGHT half a dark polished walnut table with neatly spaced face-down charcoal playing cards bearing restrained brass art-deco geometric backs, two small closed invitations with dark red wax seals, empty elegant wooden chairs with muted oxblood leather, one small shaded brass table lamp. Tall window beyond shows an old Sofia-like street, stone facades and copper roofs in blue-hour dusk. Restrained art-deco joinery, correct physical perspective and scale. The room feels intimate and lived-in, NOT a casino or luxury hotel showroom.
Composition: left 45 percent quiet deep charcoal plaster wall with faint burgundy undertone for website heading, low contrast and very few objects. Main tabletop and window occupy x=60-90 percent. Table, invitation and lower street view remain identifiable in the middle vertical third for a shallow website banner. Camera seated-height across the table, moderately wide lens, straight architecture, no fisheye. No people or hands, no umbrellas, guns, alcohol bottles, floating objects or magical symbols.
Palette: charcoal plum, neutral pale stone, subdued oxblood, restrained aged brass. Warm local lamplight with cool dusk window light, lifted midtones, material details and inviting depth, not brown monochrome, no blue wash or black crush. Sophisticated observed realism, crisp detail, no artificial blur/bokeh, fog, grain, excessive gold or ornament. No text, logos, UI, border, watermark. One clean high-quality panoramic image.

### mafia-light

Use case: lighting-weather. Input image is the EDIT TARGET: dark Mafia room-creation masthead. Produce the matching LIGHT THEME version. Preserve exact panoramic 3:1 composition, camera, architecture, city view, table and chairs, cards and two sealed invitations with their positions. Change only time and illumination: bright overcast afternoon daylight gently fills the room, neutral pale stone-gray plaster on left with subtle dusty rose undertone, softened walnut, restrained brass, oxblood leather and fabric. Clear city buildings and green copper roofs through window, natural material colors, enough open midtones to feel luminous and readable. Lamp is switched off and its shade is plain fabric, not glowing. The image must suit dark UI text at the left. No yellow sepia/parchment wash, no harsh white glare, no blue wash, no black crush. Believable material surfaces and perspective, crisp sophisticated realist game illustration. No people, new props, lettering, UI, logos, borders, watermark, blur or grain. The same prepared private room in daylight, one finished panoramic image.
