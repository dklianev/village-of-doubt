# PR M33.5 — Stage shell & interactive seats (layout revision before M34/M35)

> Fixes the P0/P1 UI/UX problems found after M32+M33. This is a **layout +
> interaction** revision, not cosmetics. Land it before M34 (cinematics) and M35
> (polish) — otherwise those PRs polish a broken composition.

## Why (the diagnosis)

M32 split the screen into `PlayStage` + action dock + main stack + players panel,
and M33 added phase×faction atmosphere — both good. But the composition is still a
**tall document with a stage glued on top**, which produces concrete problems:

- **Desktop:** `.play-layout` is a 2-col grid; the LEFT column stacks three tall
  blocks (`.play-stage` → `.play-action-dock` → `.play-main-stack`) while the RIGHT
  `.play-players-panel` is a short, **light/paper** rail set to `grid-row: 1 / span 3`
  → a tall empty cream void beside a long-scrolling left column. It reads unfinished.
- **Stage ↔ interaction are divorced.** Players sit in the ring, but you vote/act
  via a **separate, duplicated player list** rendered as buttons in `VotingPanel` /
  `NightActionPanel` far below. The table isn't the interaction surface.
- **Mobile breaks the metaphor:** the ring collapses to a 2-col grid under a big
  empty moon oval; a floating wax-seal "ТАЙМЕР" collides with a giant title.
- **Stage chrome:** HUD title/kicker overlap the top seats; the center is empty
  while the timer (what players watch) is a tiny corner sigil; the ring is a
  squished wide ellipse; the light rail clashes tonally with the dark stage.

## Verified current state (trust this — already audited)

Files (all client-side, keep it that way):
- `apps/web/components/play-room-client.tsx` — composes `.play-layout`:
  `<PlayStage/>` then `renderActionDock()` (`.play-action-dock` → `.play-action-dock-grid`
  holding `RoleCard`, `NightActionPanel`, `VotingPanel`, `HunterRevengePanel`,
  `PrivateChatPanel`, `LoverCard`, blessed card) then
  `<div class="card play-main-stack">` (ConnectionBanner, lobby `.action-bar`,
  `LiveCuePanel`, `PhaseRail`, `RulesSummary`, `PhaseGuide`, `NarratorDesk`,
  narrator warning, `NarratorSnapshotPanel`, winner card, `PostGameStory`) then
  `renderPlayersPanel()` (`aside.play-players-panel` — events `Събития` + chat `Чат лог` + day chat form).
- `apps/web/components/play/PlayStage.tsx` — renders `.play-table` → `.play-seat-ring`
  with one `PlayerTile` per seat, positioned by `--seat-angle`. Receives **only public
  data** (`PublicPlayer[]`, phase, mode, family, ownPlayer, onMakeNarrator/onMakeMayor).
- `apps/web/components/play/PlayerTile.tsx` — a **wide horizontal card** (avatar +
  name + status badges + management buttons). **No selection/target callback.** Too
  large to read as a "seat."
- `apps/web/components/play/VotingPanel.tsx` — renders `livingPlayers.map(...)` as a
  **full duplicate list of vote buttons** + `VoteTallyBar` + skip. (NightActionPanel
  /HunterRevengePanel follow the same target-list pattern.)
- `apps/web/components/play/PlayRoom.module.css`:
  - `.play-layout { grid-template-columns: minmax(0,1.42fr) minmax(330px,0.58fr); }`
  - `@media (min-width:1024px)`: `.play-stage/.play-main-stack/.play-action-dock` →
    `grid-column:1`; `.play-players-panel` → `grid-column:2; grid-row:1/span 3`.
  - `@media (max-width:1023px)`: single column; `.play-seat-ring` →
    `grid-template-columns: repeat(2,minmax(0,1fr))`.
  - Phase×faction backdrop token system (`--phase-art`, `--play-stage-*`) is in place — **keep it**.
- Selection state already exists in `play-room-client.tsx`: `selectedTargetId`,
  `secondTargetId`, `setSelectedTargetId`, plus keyboard `1–9`/Enter target shortcuts
  (`shortcutTargets`, `submitCurrentShortcutAction`). **Reuse this.**

## Guardrails (unchanged from the master)
- **Client presentation only.** No `apps/game-server/**`, no `packages/shared` logic,
  no socket/protocol changes. No new deps.
- **No secret leak.** `PlayStage`/seats receive only public data. Compute target
  validity in `play-room-client.tsx` (which already holds `privateRole`) and pass a
  plain **`Set<string>` of targetable userIds** + `selectedTargetId` + `onSelectSeat`
  down. The stage must never receive `privateRole`/`privateResult`/`narratorSnapshot`.
- **No `prefers-reduced-motion` anywhere** (owner preference). If a rule demands it, STOP and report.
- **Bulgarian copy only.** Per-commit gate (`pnpm typecheck && lint && test:unit && regression`) + `pnpm playtest`.
- **Baselines stay deferred to M35.** The visual suite is already red from M32/M33;
  do NOT refresh `/play` snapshots here (M34 will change things again). Verify by live render instead.

---

## Target design

### A. Desktop app-shell (kills the empty-void / long-scroll)
Rebuild `.play-layout` (≥1024px) into a contained shell that fills the viewport with
internal scroll, instead of one long page scroll:
```
grid-template-columns: minmax(0, 1fr) clamp(320px, 26vw, 380px);
grid-template-rows: 1fr auto;
grid-template-areas:
  "stage rail"
  "dock  rail";
min-height: calc(100svh - <navbar/frame offset>);
```
- `.play-stage` → `stage` (dominant; the table centers within it).
- `.play-action-dock` → `dock` (your role + **contextual action** as a horizontal
  dock pinned under the stage; never the full-width tall block it is now).
- the chronicle/chat rail (today `.play-players-panel`) → `rail`, **full height,
  internal `overflow:auto`**, so both columns are balanced — no empty void.
- **Relocate `.play-main-stack` secondary chrome** so it stops creating a 3rd tall
  row: `PhaseRail` → into the stage HUD; `RulesSummary` + `PhaseGuide` → a collapsible
  “Правила/Подсказки” disclosure inside the rail (or a dock tab); `NarratorDesk` +
  `NarratorSnapshotPanel` → dock/rail (narrator-only); `ConnectionBanner` → slim top
  strip; winner card + `PostGameStory` → a centered takeover over the stage (not an
  inline block). Lobby `.action-bar` (Готов/Започни) → the dock.

### B. Interactive seats (the table IS the input)
- Introduce a compact **`PlaySeat`** token for the ring (avatar circle + name + state
  ring + optional vote-count badge), reusing `playerInitials`/`playerStatusBadge`/
  `playerTokenClass`. Keep `PlayerTile` only where the full card is needed (e.g.
  lobby management via click-to-expand/popover).
- Wire selection: `PlayStage` gets `targetableIds: Set<string>`, `selectedTargetId`,
  `onSelectSeat(userId)`, `voteCounts?: Map<userId, number>`. During
  `voting`/night/`hunter_revenge`, targetable seats get `data-targetable`; click sets
  `selectedTargetId`; seat shows `data-selected`, `data-voted` (player.hasVoted), and
  a live vote count in voting. Keyboard `1–9` still selects; Enter confirms (reuse existing handlers).
- **Slim the panels** (remove the duplicate lists):
  - `VotingPanel` → `VoteTallyBar` + a single primary “Потвърди гласа за {име}” (enabled
    once a seat is selected) + “Пропусни глас”. No `livingPlayers.map` of buttons.
  - `NightActionPanel` → ability blurb + selected-target confirm (+ second target where
    the role needs it) driven by seat selection. No duplicate roster.
  - `HunterRevengePanel` → same pattern.

### C. Stage composition
- Move the HUD (kicker + phase pill + title) to a **top bar of the stage, outside the
  seat-ring box** — no text over avatars.
- Put **Timer + phase sigil/label in the table center** (the focal thing); living/
  eliminated counts as small sub-text. Kill the big empty moon void.
- Ring geometry: near-circle (use `aspect-ratio` on the ring box); clamp radius; handle
  large counts (>12) without overlap (tighter radius + smaller tokens, or two arcs).
- Make the rail **dark** to match the stage (today it’s light paper → tonal clash).
  Reuse the `.play-action-dock` dark treatment.

### D. Mobile (≤1023px)
- Compact header: small kicker + inline title; move the wax-seal timer into the stage
  center or a slim sticky top bar — never floating over the title.
- Stage: tighter ring or an honest grid with a **small** center chip (not the empty oval).
- `.play-action-dock` → a **sticky bottom sheet** (always-reachable action; expandable),
  so you never scroll past the ring to act.
- Chronicle + chat → a **tabbed** panel (Събития / Чат), not two stacked long logs.
- Secondary chrome (rules/guide) → collapsible.

---

## Commits (atomic, gate each)
1. `refactor(play): app-shell grid with full-height rail` — §A grid + relocate
   `.play-main-stack` chrome; rail full-height internal scroll. (No empty void; balanced columns.)
2. `feat(play): interactive seats select vote and night targets` — §B `PlaySeat` +
   selection wiring (targetableIds/selectedTargetId/onSelectSeat computed in
   play-room-client from `privateRole`); slim Voting/Night/Hunter panels.
3. `style(play): stage HUD and central timer` — §C HUD out of seat zone, timer/phase
   to center, ring near-circle + large-count handling.
4. `style(play): unify side rail with dark stage` — §C dark rail tonal cohesion.
5. `feat(play): mobile bottom-sheet actions and tabbed chronicle` — §D.
6. `style(play): seat states and readability polish` — selected/voted/dead/active
   seat states, fix truncated tile text, contrast over backdrops.

## Verification (live render via fixture; servers on :3000)
1. Desktop ≥1280: `/play/VISUAL?visualGame=1&phase=…&family=…` for
   night/day_discussion/voting/resolution/role_reveal/lobby/game_over × both factions —
   **no empty right void**, stage fills, rail full-height & dark, dock pinned under stage.
2. Voting: clicking a **seat** arms the vote; confirm casts it; vote counts show on
   seats; no duplicate name-button list. Night: seat click sets target; panel confirms.
3. Keyboard `1–9`/Enter still select/confirm; Esc clears.
4. Mobile 390: compact header, no timer/title collision, action bottom-sheet reachable,
   chronicle/chat tabbed, ring/grid not overlapping a giant empty center.
5. 0 console errors; `pnpm playtest` green; no secret role text in the public stage DOM
   (inspect a non-self seat — only public status, never the role).

## Acceptance criteria
- [ ] Desktop: contained app-shell; balanced columns; no empty cream void; far less page scroll.
- [ ] Seats are the vote/night/hunter input; duplicate player-button lists removed.
- [ ] Target validity computed from `privateRole` in the client; stage gets only public data + a Set of ids.
- [ ] Timer/phase central & prominent; HUD off the seat zone; ring near-circle; rail dark.
- [ ] Mobile: bottom-sheet actions + tabbed chronicle; no header collisions.
- [ ] Client-only; no deps; no `prefers-reduced-motion`; BG copy; gate + playtest green.

## Failure modes
| Symptom | Cause | Fix |
|---|---|---|
| Role text visible on another player's seat | privateRole/result passed to stage | Pass only `targetableIds: Set` + public data |
| Empty void returns | rail not full-height or main-stack still stacks left | rail `grid-area:rail; height:100%; overflow:auto`; relocate chrome |
| Can't vote / double UI | seat selection not wired or panel still lists players | wire `onSelectSeat`→`selectedTargetId`; slim panels |
| Winner/PostGame pushes layout tall again | left as inline block | render as centered takeover over stage |
| Ring overlaps center/HUD at 14+ players | fixed radius | clamp radius + smaller tokens / two arcs; HUD outside ring box |
| Mobile action unreachable | dock still inline below long ring | sticky bottom sheet |
| Lint demands reduced-motion | project rule | STOP, report — owner declined gating |
