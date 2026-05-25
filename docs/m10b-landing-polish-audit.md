# M10b landing polish audit - 2026-05-25

## Source material

Baseline screenshots already exist in `docs/m9-audit/`:

| Route | Light | Dark |
|---|---|---|
| `/` | `home-light-before.png` | `home-dark-before.png` |
| `/werewolf` | `werewolf-light-before.png` | `werewolf-dark-before.png` |
| `/mafia` | `mafia-light-before.png` | `mafia-dark-before.png` |

## Findings for M10b

| Area | Current issue | Fix direction |
|---|---|---|
| `/` light background | Existing light wash is serviceable, but it does not have a distinct table-game identity after the family pages gained bespoke light art. | Generate three light homepage samples outside the repo; commit only the selected variant. |
| `/` quickstart section | The section wash and large shadows create a hard rectangular edge, so card elevation reads clipped at the section boundary. | Keep the semantic DOM and make the section full-bleed/overflow-safe with softer, roomier elevation. |
| `/werewolf` light cards | Dark role/timeline art sits too sharply on the warm village background. | Warm the card surfaces and image frames while keeping dark artwork readable. |
| `/mafia` light cards | Noir art is appropriate, but the card bodies read as hard dark blocks on a pale city wash. | Add warmer parchment/glass surfaces, softer borders, and gentler shadow contrast. |

## Constraints

- No new dependencies, fonts, Motion usage, or `prefers-reduced-motion` guards.
- Dark theme composition should remain unchanged apart from intentional shadow softening.
- Generated homepage art follows sample-first workflow: three temp variants, user chooses, then selected files enter `apps/web/public/game-art/`.
