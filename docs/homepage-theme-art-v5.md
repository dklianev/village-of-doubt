# Homepage Theme Art V5

Date: 2026-09-08

## Design Decision

The user approved replacing the cold blue-gray Werewolf composition and
harmonizing both games with the site's light/dark themes. This is a focused
art and card-surface refinement, not a homepage layout or flow redesign.

- Werewolf: a new Bulgarian village passage, carved timber gate, ordinary
  villager, amber lantern and understated uncanny shadow. Matching day/night
  views replace the large white facade and blue-gray night.
- Mafia: preserve the two-person cafe scene, flat card and repaired hands.
  Light uses restrained warm neutrals; night uses graphite, burgundy and brass
  illumination instead of cold blue grading.
- Light card surfaces use warm ivory with distinct muted brass outlines.
  The scrim starts slightly lower to preserve the artwork, while text keeps
  its existing dark green/ink colors. No filter recolors the artwork in CSS.
- Heading, copy, eight-pixel corners, dimensions, role fan, invitation,
  keyboard navigation and create/join behavior remain unchanged.

## Sources and Prompts

All creative generation/editing used built-in imagegen, not API/CLI fallback.
Exact prompts, generated-original paths, source hashes and encoding settings:

- [Werewolf provenance](homepage-choice-werewolf-v5.md)
- [Mafia provenance](homepage-choice-mafia-v5.md)

Final source masters are under `assets/game-art-source/homepage/`:
`choice-{werewolf,mafia}-{dark,light}-v5.png`, each 960x640 and below 500 KiB.
Previous versions are retained unchanged; components reference V5 only.

## Runtime Delivery

| Asset | Desktop 960x640 bytes | Mobile 720x480 bytes |
| --- | ---: | ---: |
| Werewolf light | 145302 | 54514 |
| Werewolf dark | 100922 | 37596 |
| Mafia light | 100682 | 37788 |
| Mafia dark | 58270 | 19632 |

Desktop WebPs live under `apps/web/public/game-art/homepage/`; mobile WebPs
under `apps/web/public/game-art/mobile/homepage/`, with the same source stems.
Existing limits remain 160 KiB desktop and 55 KiB mobile.

The detailed light Werewolf mobile image initially exceeded 55 KiB at q54.
The compact-choice encoder now makes one final q42 attempt only when its
existing attempts exceed budget. The q42 result was visually compared with
q54 before acceptance. All older choice derivatives still reproduce at their
previous sizes; no older source was altered. No global quality or budget
change was made.

New derivatives were generated in an isolated four-source staging directory
with the repository optimizer, then reproduced using its pinned Linux Docker
generator. All eight Windows/Linux output buffers matched byte for byte,
and all four source buffers remained unchanged.

Native lazy images plus CSS app-theme selection avoid fetching hidden theme
images. Browser network tests cover light/dark app preference opposite to OS
preference and mobile/desktop delivery. No new runtime JS or dependency was
introduced.

## Visual Review and Verification

Evidence directory outside the repository:
`E:/codex-temp/homepage-theme-art-v5-2026-09-08/`.

- Source review: all four compact images; corresponding generated originals
  inspected by the art tasks.
- Browser screenshots: real cards in both themes at 1920px and 390px.
- Browser checks: 26 passed, including 320/390/768/1366/1920 widths, rendered
  text/background contrast, visible light frame, no text overlap, keyboard
  routes, app-theme switching and one selected-theme image request per game.
- Landing unit tests: 70 passed across seven files.
- Asset tests: 12 passed, including deterministic V1-V5 mobile and desktop
  derivatives in isolation and unchanged source buffers.
- Typecheck: passed; regression contracts: passed.
- Six homepage baseline diffs reviewed before updating. Their substantive
  differences are the intended artwork/surface changes. Dark snapshots also
  capture the previously implemented invitation outline, which remained
  below the earlier full-page comparison threshold; this turn does not
  change invitation CSS.
- Final baseline verification after build/restart: six passed without
  updating snapshots.

- Production build: passed, five tasks successful (four cached).
- Budget checks: passed, including six budget-script tests. Homepage declared
  client JS remains 20.1 KiB gzip; total JS remains 550.1 KiB. Art corpus is
  43674.6 KiB under the unchanged 60000 KiB hard limit. All eight new images
  satisfy their existing per-file budgets.
- Existing CSS warnings remain unchanged at reported precision: homepage
  58/62 KiB hard, create 61.2/65, play 62.4/70, tutorial 51.2/56. No limits or
  performance baselines were raised.

The dev server is available at `http://127.0.0.1:3000/` (HTTP 200 after the
build/restart). This work does not claim a backend or full product release
audit. No commit or push was performed.
