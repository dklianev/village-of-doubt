# M9 audit - landing + family light theme

Date: 2026-05-25

## Screenshots captured

- `home-light-before.png`
- `home-dark-before.png`
- `werewolf-light-before.png`
- `werewolf-dark-before.png`
- `mafia-light-before.png`
- `mafia-dark-before.png`

All screenshots were captured at 1440x900 with full-page output against the
local dev server.

## Findings

| Page | Light theme state | Shadow state | Decision |
|---|---|---|---|
| `/` | Hero already has usable landing art, but body backdrop is gradient-only. | Quickstart/stat cards sit close to hard section bands; large shadows look clipped near section transitions. | Reuse existing landing art with a light veil; no new imagegen by default. |
| `/werewolf` | Hero and body use the dark night village art inside a light page, which reads like dark mode embedded in light mode. | Timeline/cards and lower stat cards share the same shadow clipping risk. | Generate dedicated light werewolf art. |
| `/mafia` | Hero and body use dark rainy noir art inside a light page, which reads too heavy for light theme. | Timeline/cards and lower stat cards share the same shadow clipping risk. | Generate dedicated light mafia art. |

## Imagegen gate

Imagegen is confirmed for `/werewolf` and `/mafia` only. The landing page will
first use existing art plus theme-aware light veil treatment.
