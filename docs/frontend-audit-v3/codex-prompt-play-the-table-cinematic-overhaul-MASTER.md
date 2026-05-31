# MASTER PROMPT — „The Table": cinematic /play overhaul (PR program M31–M35)

> This is a **master program**, not a single commit. It is split into 5 landable
> PRs (M31–M35). Each PR has its own gate and is shippable on its own. Do **not**
> squash them. Read the whole document before starting M31.

---

## 0. North star

`/play` is the heart of the product — the live game. Today it works but it
**plays like a control panel**: a long vertical stack of utilitarian panels, with
the players (the soul of social deduction) demoted to a side list, and the
day/night drama reduced to a small badge. Meanwhile the repo already ships a
**large, optimized art library that is barely surfaced**.

Goal: turn `/play` into a **cinematic table** — the circle of players is the
stage, the phase (night/day/voting/resolution) transforms the whole scene, and
the secret/social tension is *felt*. On-theme, unique, brutal, gorgeous. Use
`/imagegen` generously to fill art gaps. **Reuse the game logic; restage the UI.**

Two faces, already themed via `data-family`:
- **Werewolves → moonlit village square** at night, waking village by day.
- **Mafia → smoky lamplit table / back room**, raid-lit by day.

---

## 1. Verified architecture (trust this — do not re-derive)

**Route:** `apps/web/app/play/[code]/page.tsx` → `requireSession` →
`PlayRoomClient` (`apps/web/components/play-room-client.tsx`, 731 LOC).

**Shell DOM (already phase/faction-aware):**
```tsx
<main className="shell game-shell play-shell framed-shell" data-phase={phase} data-family={family}>
  {/* overlays: PhaseTransitionOverlay, PreGameCountdown, ReconnectModal,
      KeyboardShortcutsModal, AchievementUnlockModal */}
  <div className="framed-shell-inner play-shell-inner">
    <section className="play-layout">
      <div className="card play-main-stack play-section ...">  {/* LEFT: the long stack */}
        <ConnectionBanner/>
        <div className="phase-hero"> {/* kicker, .play-phase-pill, .phase-title h1, chips, .phase-sigil, <Timer/> */}
        {/* lobby action-bar, LiveCuePanel, PhaseRail, RulesSummary, PhaseGuide,
            NarratorDesk, narrator warning, NarratorSnapshotPanel, LoverCard,
            blessed card, RoleCard, DeathRevealCinematic, NightActionPanel,
            VotingPanel, HunterRevengePanel, PrivateChatPanel, winner card, PostGameStory */}
      </div>
      {renderPlayersPanel()}  {/* RIGHT: aside.play-players-panel — roster + day chat + Събития + Чат лог */}
    </section>
  </div>
</main>
```

**Key facts that make this overhaul cheap & safe:**
1. **`data-phase` and `data-family` already live on `.play-shell`.** All phase/faction
   atmosphere can hang off `[data-phase="night"][data-family="werewolves"]` etc.
   in CSS — **no new state plumbing required.**
2. The **layout CSS is thin**: `apps/web/components/play/PlayRoom.module.css` (127 LOC),
   `PhaseRail.module.css` (129 LOC). The visual shell is small; logic is elsewhere.
3. **24 sub-components** under `apps/web/components/play/` already encapsulate every
   piece (`PlayerTile`, `Timer`, `RoleCard`, `NightActionPanel`, `VotingPanel`,
   `PhaseRail`, `PhaseTransitionOverlay`, `DeathRevealCinematic`, `PostGameStory`,
   `PreGameCountdown`, `NarratorDesk`, `LiveCuePanel`, `PhaseGuide`, `RulesSummary`,
   `PrivateChatPanel`, `HunterRevengePanel`, `LoverCard`, `SummaryPill`,
   `TypingIndicator`, `ConnectionBanner`, `ReconnectModal`,
   `NarratorSnapshotPanel`, `AchievementUnlockModal`, `PlayerToken`).
   → **We re-compose and restyle these. We do not rewrite their logic.**
4. State comes from hooks: `useGameRoom` (socket + `snapshot`, `privateRole`,
   `privateResult`, `privateLover`, `narratorSnapshot`, `currentUserId`,
   `connectionStatus`, …), `usePhaseTransitions` (`phasePulse`,
   `showPhaseTransition`, `startCountdown`, `requestStartGame`), `useCueMode`.
   `snapshot` fields used: `players[]`, `phase`, `round`, `publicEvents[]`,
   `publicChat[]`, `voteTally[]`, `mode`, `communicationMode`, `narratorMode`,
   `narratorVoice`, `phaseEndsAt`, `winnerTeam`, `winnerReasonBg`, `tempoProfile`.
   `PublicPlayer`: `userId, name, playing, alive, ready, host, narrator, acceptedFullNarrator`.
5. Phase labels/sigils/bg come from `@/lib/play/phase-display` (`phaseBg`,
   `phaseSigil`, `phaseBg`) and `@werewolf/shared` (`phaseLabelBg`, `GamePhase`,
   `isNightPhase`). **Use the `GamePhase` union as the source of truth for phases.**

**Existing art (reuse first, generate only gaps):** under `apps/web/public/game-art/`
and `…/werewolf/`, `…/mafia/`, `…/mobile/`:
- Phase backdrops: `bg-night-phase`, `bg-day-discussion`, `bg-voting`,
  `bg-resolution`, `bg-role-reveal`, `bg-lobby-tavern` (+ faction variants).
- Transitions: `transition-night-falls`, `transition-village-wakes`,
  `transition-voting-starts`, `transition-resolution`.
- Events: `event-death`, `event-hunter-shot`, `event-reveal`.
- Per-night narrative: werewolf `night-1-fog…night-5-dawn`, mafia `night-1-rain…night-5-morning`.
- Full `role-*` set both factions; `icon-phase-*`; `faction-*` crests;
  `texture-fog/parchment/walnut/wax/ornament`; `village-map`; `narrator-kit`;
  `card-back-secret`; `empty-players`. All in avif+webp+png.

---

## 2. Guardrails (non-negotiable)

- **CLIENT PRESENTATION ONLY.** Do **not** touch `apps/game-server/**`,
  `packages/shared/src/{role-assignment,win-conditions,protocol,night-resolver}.ts`,
  schemas, or any socket message shape. Do not change *what* data the client
  receives. (role-mechanics-reviewer will block secret-leak regressions.)
- **Never render secret data into shared/public DOM.** `privateRole`,
  `privateResult`, `privateLover`, `narratorSnapshot`, blessed status are
  per-viewer secrets — they may appear only in the current player's own private
  UI, exactly as today. Do not move them into the public roster/stage markup.
- **No new runtime dependencies.** No animation libs; CSS + existing primitives only.
- **Bulgarian copy only** (bg-copy-reviewer). Any new label/string is BG.
- **The visual fixture (M31) is DEV-ONLY and production-gated** (mirror the
  `?visualAuth` pattern: active only when `NODE_ENV !== "production"`). It must be
  impossible to fake game state in prod.
- **Per-PR gate:** `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm regression`
  green, plus `pnpm playtest` (real create→play flow still works) before any PR
  that touches `play-room-client.tsx`.
- **Asset budget:** every generated asset ships as **avif + webp + png fallback**,
  with a **mobile-sized variant** under `game-art/mobile/…`, lazy-loaded per phase.
  Compress hard. Prefer one shared base + faction tint over duplicate megabytes.
- **Motion: ALL motion runs unconditionally — do NOT add any
  `@media (prefers-reduced-motion)` block anywhere** (ambient loops AND full-screen
  phase-transition beats). This is the owner's explicit instruction, consistent
  with PR M29. Do not "fix" it back. If a lint/regression rule *requires* a
  reduced-motion fallback, **stop and report it** — do not silently gate. Keep
  motion compositor-friendly (transform/opacity only) so it is performant regardless.

---

## 3. The imagegen art program (be generous — fill every gap)

Generate per faction (`werewolves`, `mafia`) unless noted. Target a cohesive,
painterly, dramatic, slightly-noir storybook look matching the existing role art.
**House style string (prepend to every prompt):**
> *"Painterly digital illustration, dramatic cinematic lighting, moody storybook
> realism, rich shadows, warm candle/cold moon accents, muted desaturated palette
> with one bold accent, no text, no UI, no watermark, 16:9 unless noted."*

### 3A. The centerpiece (NEW — the stage core)
- **Werewolves:** top-down / 3-4 view of a **village square at night** — a stone
  well or dead campfire ring, cobblestones, fog, full moon rim-light. Day variant:
  same square, warm dawn. (`stage-square-night`, `stage-square-day`.)
- **Mafia:** a **round felt card table** in a smoky back room, green felt, scattered
  chips/cards, single hanging lamp pool of light. Day/raid variant: cold daylight
  through blinds. (`stage-table-night`, `stage-table-day`.)

### 3B. Per-phase full-bleed stage backdrops (re-roll for cohesion if existing don't fit)
`lobby / role-reveal / night / day-discussion / voting / resolution` — wide 21:9
and a 9:16 mobile crop each, per faction. (Reuse existing `bg-*` if they already match.)

### 3C. Seat treatments (NEW)
- A **seat plate / name marker** frame (parchment tag for village, brass plate for
  mafia). A **dead-seat overlay** (crossed-out / slumped / draped cloth). Speaking/
  active glow ring. These can be PNG-with-alpha or CSS; prefer CSS where possible,
  generate art only for the plate texture.

### 3D. Cinematic moment art (reuse `event-*`, extend)
- Death/elimination: `event-death` (have) + faction night variant. Hunter's shot
  (`event-hunter-shot`, have). Role reveal flourish (`event-reveal`, have).

### 3E. End-screen splashes (NEW — for `PostGameStory` + winner card)
- **Werewolves win / village wins**, **Mafia win / town wins** — triumphant vs
  somber faction splash, 16:9 + mobile. (`end-village-win`, `end-werewolves-win`,
  `end-town-win`, `end-mafia-win`.)

### 3F. Ambient FX overlays (NEW, alpha PNG, tiny)
- Moonlight rays, drifting fog (have `texture-fog`), smoke wisps, candle bloom,
  blood-moon vignette. Used as low-opacity composited layers driven by `[data-phase]`.

> If `/imagegen` is unavailable in the session, the engineer writes these prompts
> into `docs/frontend-audit-v3/play-imagegen-shotlist.md` and stubs the art slots
> with existing `bg-*` so the layout lands; art swaps in when generated.

---

## 4. The PR program

### PR M31 — Visual fixture for /play (PREREQUISITE)
*Goal: make every `/play` state renderable deterministically, dev-only.*
- Add a dev-only mock path: when `NODE_ENV !== "production"` and `?visualGame=1`,
  `useGameRoom` (or a thin wrapper) returns a **canned snapshot + privateRole**
  instead of opening a socket. Isolate so the production path is byte-for-byte
  unchanged.
- Drive state from query: `phase`, `family`, `players`, `dead`, `role`,
  `winner`, `voteTally`, etc. Provide presets covering **every `GamePhase`** plus
  key sub-states (your-role variants, full tally, winner village/wolves/mafia,
  hunter_revenge, lobby, reconnecting).
- Add Playwright visual entries for the headline states (night/day/voting/
  resolution/lobby/role-reveal/win) × both factions; capture **baseline of the
  CURRENT design** first (so M32+ deltas are measurable).
- Commits: `feat(play): dev-only visual game fixture` · `test(visual): capture current /play baselines`.
- Gate + `pnpm playtest`. **Acceptance:** prod path untouched; all phases viewable
  at `:3000/play/VISUAL?visualGame=1&phase=…&family=…`.

### PR M32 — „The Table" stage layout
*Goal: players become the centerpiece; the stack stops being a stack.*
- Restructure `.play-layout` into a **stage-centric** composition (new CSS in
  `PlayRoom.module.css` + a new presentational `PlayStage` component that *arranges*
  existing children — no logic):
  - **Center stage:** living players arranged in a **ring/arc** around the
    centerpiece (3A). Reuse `PlayerTile`/`PlayerToken`; add seat positioning + the
    speaking/active/dead seat states. Dead players slump/grey in place.
  - **On-stage HUD:** `Timer` + phase title + round as a compact cinematic header,
    not a giant hero block.
  - **Your dock:** `RoleCard` + the contextual action panel (`NightActionPanel` /
    `VotingPanel` / `HunterRevengePanel`) as a **bottom dock / side dock**, surfacing
    only when relevant.
  - **Chronicle rail:** `Събития` (publicEvents) becomes a **ledger/ticker**;
    `Чат лог` + day chat dock as a **chat panel/drawer**. (Reuse the markup from
    `renderPlayersPanel`, re-homed.)
- Desktop: stage dominant, chronicle/chat right rail, your dock bottom. Mobile:
  stage top (ring → compact arc/grid), actions as **bottom sheet**, chronicle/chat
  as tabs.
- Keep all conditionals/states identical; only their placement + wrappers change.
- Commits (atomic): `feat(play): PlayStage seating ring scaffold` ·
  `refactor(play): re-home chronicle and chat into side rail` ·
  `feat(play): contextual action dock` · `style(play): cinematic on-stage HUD` ·
  `feat(play): dead/active seat states`.
- Gate + `pnpm playtest` + fixture screenshots each commit.

### PR M33 — Phase atmosphere + faction theming
*Goal: the whole scene transforms by phase × faction.*
- Drive a full-stage backdrop + ambient FX off `[data-phase][data-family]` on
  `.play-shell` (wire 3A/3B/3F). Night darkens + fog + moon/lamp; day brightens;
  voting = spotlight tension; resolution = reveal wash.
- Lazy-load the phase backdrop for the active phase only; preload the next.
- Reuse existing `bg-*`; swap to re-rolled art if generated.
- Commits: `feat(play): phase-driven stage backdrops` ·
  `feat(play): ambient fog/moon/lamp FX layers` ·
  `style(play): werewolf vs mafia stage theming` · `perf(play): lazy phase art loading`.
- Ambient loops may animate unconditionally (transform/opacity only, compositor).

### PR M34 — Cinematic moments
*Goal: the beats land — night falls, someone dies, town votes, game ends.*
- Restage existing overlays with art: `PhaseTransitionOverlay` (wire
  `transition-*`), `DeathRevealCinematic` (wire `event-death`/faction variants),
  `PreGameCountdown`, role-reveal flourish, and a real **victory/defeat end scene**
  for the winner card + `PostGameStory` (wire 3E).
- No `prefers-reduced-motion` gating on any beat (per §2). Keep flashes
  compositor-only and reasonably brief so they stay performant.
- Commits: `feat(play): cinematic phase-transition staging` ·
  `feat(play): death reveal scene art` · `feat(play): victory/defeat end scene`.

### PR M35 — Polish, perf, mobile, a11y, baselines
- Contrast/readability pass over backdrops (text always legible on stage).
- Mobile bottom-sheet + tabs polish; landscape; small screens.
- Perf: verify no full-stage repaints (Paint flashing), 60fps idle, asset weight
  within budget; audit total `/play` art payload.
- a11y: phase changes announced (`aria-live` already present), focus order through
  the new dock, keyboard shortcuts (the `1–9`/Enter/Esc/Space handlers) still work.
- `pnpm test:visual --update-snapshots` → commit only `/play` frames after sign-off.
- Commits: `style(play): stage readability + mobile polish` ·
  `perf(play): art payload + paint audit` · `test(visual): refresh /play baselines`.

---

## 5. Verification (run before each PR's baseline commit)
Dev server `:3000`, pre-primitives reference `:3101` (for non-/play sanity only).
1. `:3000/play/VISUAL?visualGame=1&phase=night&family=werewolves` and `…&family=mafia`
   — distinct, atmospheric, players centered, text legible.
2. Same for `phase=day_discussion|voting|resolution|role_reveal|lobby` and
   `winner=village|werewolves|mafia`.
3. `hunter_revenge`, dead-player view, reconnecting, full tally.
4. Mobile (375px): stage + bottom sheet + tabs usable; no overflow.
5. Perf (DevTools Rendering → Paint flashing): only composited layers move; no
   full-stage repaint; idle ~60fps.
6. `pnpm playtest` green (real multiplayer flow unaffected).
7. Prod path: `?visualGame` does nothing when `NODE_ENV=production`.

## 6. Acceptance criteria (whole program)
- [ ] Players are the visual center; phase × faction transforms the whole stage.
- [ ] Every `GamePhase` renderable via dev fixture; prod path untouched & gated.
- [ ] Zero game-logic / protocol / server changes; no secret data in shared DOM.
- [ ] All existing sub-components reused (no logic rewrite); shortcuts still work.
- [ ] Generated art shipped avif+webp+png + mobile variants, lazy by phase, within budget.
- [ ] BG copy only; no new deps; per-PR gate + `pnpm playtest` green.
- [ ] All motion unconditional; NO `prefers-reduced-motion` block anywhere; motion compositor-only.
- [ ] `/play` visual baselines refreshed; no unrelated frames changed.

## 7. Failure modes
| Symptom | Cause | Fix |
|---|---|---|
| Spectator/devtools shows a player's role | Secret moved into public/stage DOM | Keep `privateRole*` in the own-player dock only |
| `pnpm playtest` breaks | Touched logic while restaging | Re-compose markup only; revert logic edits |
| Huge `/play` payload / slow load | All phase art eager-loaded | Lazy per active phase; preload next only |
| Jank during transitions | Animated filter/box-shadow/bg-position | transform/opacity only; pre-soften gradients |
| Fixture leaks to prod | Flag not gated on NODE_ENV | Gate on `NODE_ENV !== "production"` AND query |
| Text unreadable on backdrop | Backdrop too bright behind content | Scrim/contrast layer behind text; tune opacity |
| Lint/reviewer demands reduced-motion | Project motion rule | STOP, report to owner — owner declined gating; do not auto-add |
| Mobile stage overflows | Ring doesn't collapse | Arc/grid fallback + bottom sheet at <=720px |
```
