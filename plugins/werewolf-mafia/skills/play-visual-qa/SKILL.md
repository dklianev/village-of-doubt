---
name: play-visual-qa
description: Use for /play layout, seat geometry, target selection, phase/faction atmosphere, cinematic overlays, visual fixture, or browser-game QA.
---

# Play Visual QA

Use this skill for `/play` changes and for review passes after M31-M35 style work.

## Fixture URLs

Base:

```text
/play/VISUAL?visualGame=1&phase=<phase>&family=<werewolves|mafia>
```

Important variants:

```text
/play/VISUAL?visualGame=1&phase=night&family=werewolves&viewer=player&role=doctor&players=8
/play/VISUAL?visualGame=1&phase=voting&family=mafia&voteTally=full&players=8
/play/VISUAL?visualGame=1&phase=hunter_revenge&family=werewolves&viewer=dead&role=hunter&dead=2&players=12
/play/VISUAL?visualGame=1&phase=game_over&family=mafia&winner=mafia&dead=5&players=12
```

The Hunter revenge fixture must use `viewer=dead&role=hunter`; a living Hunter is not allowed to act.

## Matrix

Check at least:

- phases: `lobby`, `role_reveal`, `night`, `day_discussion`, `voting`, `resolution`, `hunter_revenge`, `game_over`
- factions: `werewolves`, `mafia`
- viewports: `1440x900`, `1390x820`, `390x844`
- themes when styling changes: dark and light

## Programmatic Checks

Use Browser or Playwright to verify:

- `.play-stage` exists and is visible.
- no horizontal overflow.
- no `.play-seat` outside `.play-stage`.
- no `.play-seat-avatar` outside `.play-stage`.
- no seat-seat overlap.
- no desktop/laptop seat collision with `.play-table-core`.
- no private role text in public stage seat DOM.
- no console/page errors.
- targetable seats can be clicked in `night`, `voting`, and `hunter_revenge`.

## Repo Commands

Run:

```bash
pnpm playtest
pnpm visual --grep "play-"
```

If the bundled Playwright browser is missing locally, use system Chrome for manual QA and report the setup blocker.
