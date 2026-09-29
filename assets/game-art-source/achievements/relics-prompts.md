# Achievements collection art

Generated with the built-in imagegen tool on 2026-09-22. References are the approved synthetic Senkite desktop concept (exec-4c00fa62-3386-4f79-8334-356bc8390618.png). No player information was supplied.

Original PNGs are retained here; runtime relics are 960x640 WebP, quality 78, alphaQuality 75, effort 6. The material is a repeating 512x512 WebP at quality 55. Alpha is preserved. Jester, shield and knife have their own provenance files.

## hunter_revenge

Create one standalone production game achievement artefact cutout, not a UI. Reference is the selected Senkite interface; extract/recreate the brass cartridge memento in its upper right as independent exquisite artwork. Landscape 3:2 canvas. A single antique brass rifle cartridge with fine Balkan floral engraving displayed diagonally in an open shallow aged-silver presentation case, lid behind showing exquisite subtle engraved foliage, a small burgundy braided cord trailing beside it. The lid is hinged correctly, all edges and objects complete, no words, no letters, no coins or additional props. Tactile painterly photorealism, same atmosphere as reference, warm brass contrasts with cool tarnished silver and deep red. Soft neutral daylight from upper left, well-lit detail readable on both pale stone and charcoal backgrounds. Center the complete still life occupying 82% canvas width and about75% height; leave clear transparent margins10%. Oblique front view with horizontal tabletop perspective, not top down. ACTUAL transparent alpha background, no table, no floor, no room, no checkerboard pattern baked in, only subtle translucent contact shadow. High fidelity texture, distinct materials, not a flat icon, not a coin medal, not an entire screenshot. This is the 'Последният изстрел' collectible.

## first_blood

Production transparent raster game artefact, "Първа кръв", matching the fine miniature relics in attached Senkite mockup. ONE deep oxblood red wax seal about the size of a large coin, standing at a slight oblique forward-facing angle against a small natural pool of spilled red sealing wax. Embossed central SINGLE TEARDROP emblem, around it a delicate hand-engraved folk floral border, absolutely no text, runes, letters, stars or numbers. Not actual blood or gore. Tactile sculpted glossy wax with modest realistic highlights, small chips from use and convincing irregular edges, not a goldmedal orflatoutlinedicon. Neutral upper-left soft daylight, burgundy body lit enough to read on offwhite and charcoal. Landscape3:2 canvas with seal centered horizontally and vertically, whole relic within frame, occupyingabout70%width and75%height, marginsminimum10%. Genuine TRANSPARENT ALPHA around object, no room,table,floor,color backdrop or baked checkerboard, only faint translucent contact shadow below object. Isolated asset only, NOT interface; no UI, no lettering.

## silent_civilian

One standalone transparent game collectible for Senkite, "Глас до края", matching the attached approved game's tactile artefact collection. A short candle nearly burned down, ivory beeswax with a gently lit small flame and rich sculptural wax drips, on a low antique dark bronze scalloped candle holder with subtle hand-carved Balkan foliage and a small finger loop. It should look like an exquisite miniature physical keepsake, not a UI icon or medallion. Neutral soft daylight plus restrainedwarmflame, readable detail in bronze and ivory, no large glow halo. Realistic painterly material quality. Landscape3:2 canvas, center fullobject atconsistentfrontobliqueangle, entire flame/holder within75%height and70%width, transparent margins. Genuine TRANSPARENT ALPHA background with a faint localized translucent contactshadow, no table or room, no colorbackdrop, no checkerboard pattern baked in. No text, letters, numbers, people or extraobjects. Outputonlyartefactasset, nottheinterface.

## perfect_record

Create standalone premium game collectible, "Дълга нощ", matching attached Senkite achievement artwork: a small weathered dark forest-green leather game journal lying closed at an oblique front angle, beautiful subtle hand-tooled Bulgarian floral carving with a small central sunwheel impression, leather strap secured across cover, visible irregular warm white aged page edges and tiny bronze corner protectors. NO TEXT or lettering on book or anywhere. One simple burgundy ribbon bookmark trails naturally from pages. Object is compact, horizontal, fully visible and centered on landscape3:2 canvas with10%transparent margins, occupiesaround80%width70%height. Soft neutral upper-left light, clearly lit leather carving and page edges, painterlyphotorealisticmemento similar tactile realism toreference, not flat icon, notgoldmedal. Dark green leather NOT orangebrown so series has material variety. Genuine TRANSPARENT ALPHA background, no table/floor/room/backdrop, only subtle localized contact shadow. Do not generateinterfaceorotherobjects.

## collection-surface

Generate a production seamless raster material texture for the Senkite collectible tabletop interface. Square1024x1024. Viewed straight on from above: a quiet matte light-grey mineral tabletop, very fine naturally irregular stone grain, tiny subtle wear, no conspicuous veins, no stains or focal patches. Cool neutral silver-grey with a very faint sage undertone, NOT cream/beige/brown. Subtle enough to sit behind14px dark UI text; texture contrast no more than about5–8 percent around its base value. Even diffuse daylight, no bright corners, no spotlight,no lensblur,no horizon,no perspectiveedges. Completely EMPTY surface: no objects, letters, icons, seams, UI, ornaments, frames, artifacts, cards, food, foliage or particles. Physically tangible and understated, not a smooth flat color, no generatedgradientorillustration. Seamless at all edges for repeating as a web background. This same material will also receive a dark charcoal treatment in CSS, so neutral color and tiny detail only.
# Runtime Reproduction

Final collection exports are registered in `scripts/optimize-assets.mjs`:
all seven relics use 960px width, WebP quality78, alphaQuality75 and effort6.
The surface is 512px square, quality55. Original imagegen masters remain unchanged.
Use `--only achievements/relics/<id>.png` or
`--only achievements/collection-surface.png` to reproduce an individual output.

