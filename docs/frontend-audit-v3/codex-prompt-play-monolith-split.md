# Codex prompt — Split `play-room-client.tsx` monolith

`apps/web/components/play-room-client.tsx` is **3268 lines** with 25 inline subcomponents + 13 helpers + 6 state-mapper functions. This prompt extracts the subcomponents into focused files under `apps/web/components/play/` and helpers into `apps/web/lib/play/`.

**Target**: Main file ≤ **1800 lines** (orchestration + state management only). Net extraction ≈ 1100 lines.

**Working directly on `main`.** 8 atomic English commits, ~3 hours Codex work. No new npm dependencies. **CSS untouched.**

---

## Pre-flight check

```bash
# Verify current state
wc -l apps/web/components/play-room-client.tsx
# Expect: 3268

ls apps/web/components/play/ 2>&1
# Expect: cannot access

# Verify useTimerCountdown already extracted (Phase A)
grep -n "useTimerCountdown" apps/web/components/play-room-client.tsx
# Expect: 2 hits (import + usage in Timer)

# Verify regression is green BEFORE starting
pnpm regression
```

If any pre-condition is unexpected, **stop** and document in `audit-v3/blocked-items.md`.

---

## Subcomponent map (current line numbers)

| Line | Component | Lines | Group |
|---|---|---|---|
| 1255 | `PlayerTile` (memo) | 87 | Player display |
| 1320 | `arePlayerTilePropsEqual` (helper) | 22 | Player display |
| 1343 | `RulesSummary` | 38 | Narrator |
| 1382 | `PhaseTransitionOverlay` | 25 | Phase chrome |
| 1408 | `PreGameCountdown` | 13 | Phase chrome |
| 1422 | `AchievementUnlockModal` | 28 | Modals/reveals |
| 1451 | `DeathRevealCinematic` | 30 | Modals/reveals |
| 1482 | `PostGameStory` | 22 | Modals/reveals |
| 1505 | `SummaryPill` | 8 | Modals/reveals (used by PostGameStory) |
| 1514 | `PhaseRail` | 16 | Phase chrome |
| 1531 | `ConnectionBanner` | 26 | Connection |
| 1558 | `ReconnectModal` | 41 | Connection |
| 1600 | `LiveCuePanel` | 56 | Night actions |
| 1657 | `NarratorDesk` | 78 | Narrator |
| 1736 | `PhaseGuide` | 32 | Narrator |
| 1769 | `NarratorSnapshotPanel` | 19 | Role detail |
| 1789 | `LoverCard` | 11 | Role detail |
| 1801 | `RoleCard` | 52 | Role detail |
| 1854 | `RoleFact` | 8 | Role detail (used by RoleCard) |
| 1863 | `HunterRevengePanel` | 26 | Role detail |
| 1890 | `TypingIndicator` | 20 | Chat |
| 1911 | `PrivateChatPanel` | 116 | Chat |
| 1953 | `shortcutTargets` (helper) | 16 | Night actions |
| 1969 | `buildPrimaryNightAction` (helper) | 59 | Night actions |
| 2028 | `NightActionPanel` | 178 | Night actions |
| 2207 | `VotingPanel` | 37 | Voting |
| 2245 | `VoteTallyBar` | 24 | Voting |
| 2270 | `Timer` | 11 | Phase chrome (Phase A landed) |
| 2281 | `phaseSigil` | 21 | Phase display utils |
| 2302 | `phaseNarratorLine` | 33 | Phase display utils |
| 2336 | `narratorVoiceLineBg` | 35 | Phase display utils |
| 2371 | `roleSigil` | 23 | Role display utils |
| 2394 | `playerStatusBadge` | 45 | Player display utils |
| 2440 | `playerInitials` | 9 | Player display utils |
| 2449 | `isCueMode` | 4 | Sound utils |
| 2453 | `triggerDeviceCue` | 11 | Sound utils |
| 2464 | `eventLineClass` | 14 | Event log utils |
| 2478 | `playerTokenClass` | 40 | Player display utils |

**Helpers that STAY in `play-room-client.tsx`** (tightly coupled to main component state):
- `createRoomOptionsSignature` (line 173)
- `snapshotShellForState` (line 2519)
- `playersForState` (line 2551)
- `roleCountsForState` (line 2558)
- `voteTallyForState` (line 2562)
- `publicEventsForState` (line 2566)
- `publicChatForState` (line 2570)
- `arePhaseSlicesEqual` exported (line 2590)
- `arePlayerListsEqual` exported (line 2613)
- `PHASE_RAIL` constant (line 2881)

These state mappers transform Colyseus `GameState` to typed snapshots — they sit right next to the `room.onStateChange` orchestration logic.

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Target directory | `apps/web/components/play/` for components; `apps/web/lib/play/` for pure helpers |
| Module style | Named exports only (`export function X`); no default exports |
| Types shared between components | Re-export from `play-room-client.tsx` (where they're defined) OR move to `apps/web/lib/play/types.ts` if cleaner |
| Helper-component coupling | If helper is used ONLY by one component (e.g. `RoleFact` by `RoleCard`, `SummaryPill` by `PostGameStory`), keep helper in same file as component |
| Commit cadence | One thematic group per commit, build green after each |
| CSS changes | **None** — class names preserved exactly |
| Behavior changes | **None** — pure refactor |
| Branch | Directly on `main`, atomic English commits |
| Validation | After every commit: `pnpm regression && pnpm typecheck && pnpm build` |

---

## Stage 1 — Extract phase display utilities

**Target**: `apps/web/lib/play/phase-display.ts` + `apps/web/components/play/PhaseRail.tsx` + `apps/web/components/play/PhaseTransitionOverlay.tsx` + `apps/web/components/play/PreGameCountdown.tsx`

### Step 1a: Create `apps/web/lib/play/phase-display.ts`

Move (verbatim):
- `phaseSigil` (line 2281)
- `phaseNarratorLine` (line 2302)
- `narratorVoiceLineBg` (line 2336)
- `PHASE_RAIL` constant (line 2881)

```ts
import { type GameMode, type GamePhase, type NarratorVoice, phaseLabelBg } from "@werewolf/shared";

export const PHASE_RAIL = [ /* exact same content from line 2881 */ ] as const;

export function phaseSigil(phase: string) { /* exact same content */ }
export function phaseNarratorLine(phase: GamePhase, mode: GameMode, narratorVoice: NarratorVoice = "classic") { /* same */ }

function narratorVoiceLineBg(voice: NarratorVoice, mafia: boolean): Partial<Record<GamePhase, string>> {
  /* same */
}
```

### Step 1b: Create `apps/web/components/play/PhaseRail.tsx`

```tsx
import { PHASE_RAIL } from "@/lib/play/phase-display";

export function PhaseRail({ phase }: { phase: string }) {
  /* exact same content from line 1514 */
}
```

### Step 1c: Create `apps/web/components/play/PhaseTransitionOverlay.tsx`

```tsx
import type { GameMode, GamePhase, NarratorVoice } from "@werewolf/shared";
import { phaseLabelBg } from "@werewolf/shared";
import { phaseNarratorLine, phaseSigil } from "@/lib/play/phase-display";

export function PhaseTransitionOverlay({ /* ...props from line 1382 */ }) {
  /* exact same content */
}
```

### Step 1d: Create `apps/web/components/play/PreGameCountdown.tsx`

```tsx
export function PreGameCountdown({ value }: { value: number | null }) {
  /* exact same content from line 1408 */
}
```

### Step 1e: Update `play-room-client.tsx`

```diff
+ import { PhaseRail } from "@/components/play/PhaseRail";
+ import { PhaseTransitionOverlay } from "@/components/play/PhaseTransitionOverlay";
+ import { PreGameCountdown } from "@/components/play/PreGameCountdown";
+ import { phaseSigil } from "@/lib/play/phase-display"; // only if used elsewhere in main file
```

Delete the original `function PhaseRail`, `function PhaseTransitionOverlay`, `function PreGameCountdown`, `function phaseSigil`, `function phaseNarratorLine`, `function narratorVoiceLineBg`, and `const PHASE_RAIL` from main file.

### Verify

```bash
pnpm regression
pnpm typecheck
pnpm build
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 3100 (from 3268, -170 lines)
```

### Commit 1
```
refactor(play): extract phase display utilities and chrome components
```

---

## Stage 2 — Extract connection components

**Target**: `apps/web/components/play/ConnectionBanner.tsx` + `apps/web/components/play/ReconnectModal.tsx`

### Step 2a: `ConnectionBanner.tsx`

```tsx
import type { ConnectionStatus } from "@/components/play-room-client"; // type re-export

export function ConnectionBanner({ status, message }: { status: ConnectionStatus; message: string }) {
  /* exact same content from line 1531 */
}
```

**Check**: Is `ConnectionStatus` exported from `play-room-client.tsx`? If not, export it OR move the type to `apps/web/lib/play/types.ts` and import from there.

### Step 2b: `ReconnectModal.tsx`

```tsx
import { useModal } from "@/lib/use-modal";

export function ReconnectModal({ /* props from line 1558 */ }) {
  /* exact same content */
}
```

### Step 2c: Update imports in main file

```diff
+ import { ConnectionBanner } from "@/components/play/ConnectionBanner";
+ import { ReconnectModal } from "@/components/play/ReconnectModal";
```

Delete inline definitions.

### Verify

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 3030 (-70 from previous)
```

### Commit 2
```
refactor(play): extract ConnectionBanner and ReconnectModal
```

---

## Stage 3 — Extract endgame & achievement components

**Target**: `apps/web/components/play/AchievementUnlockModal.tsx` + `apps/web/components/play/DeathRevealCinematic.tsx` + `apps/web/components/play/PostGameStory.tsx`

`SummaryPill` stays inside `PostGameStory.tsx` (used only there).

### Step 3a: `AchievementUnlockModal.tsx`

```tsx
import { ACHIEVEMENTS } from "@werewolf/shared";
import { useModal } from "@/lib/use-modal";

export function AchievementUnlockModal({ achievementIds, onClose }: { achievementIds: string[]; onClose: () => void }) {
  /* exact same content from line 1422 */
}
```

### Step 3b: `DeathRevealCinematic.tsx`

```tsx
import type { PublicPlayer } from "@/components/play-room-client"; // or types.ts
import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { roleThumbStyle } from "@/lib/role-art";

export function DeathRevealCinematic({ players }: { players: PublicPlayer[] }) {
  /* exact same content from line 1451 */
}
```

### Step 3c: `PostGameStory.tsx` (includes inline `SummaryPill`)

```tsx
import type { GameSnapshot } from "@/components/play-room-client"; // or types.ts

export function PostGameStory({ snapshot }: { snapshot: GameSnapshot }) {
  /* exact same content from line 1482, including the SummaryPill JSX */
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  /* exact same content from line 1505 */
}
```

### Step 3d: Update imports

```diff
+ import { AchievementUnlockModal } from "@/components/play/AchievementUnlockModal";
+ import { DeathRevealCinematic } from "@/components/play/DeathRevealCinematic";
+ import { PostGameStory } from "@/components/play/PostGameStory";
```

Delete originals + the inline `SummaryPill`.

### Verify

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 2940 (-90)
```

### Commit 3
```
refactor(play): extract achievement, death reveal, and post-game story
```

---

## Stage 4 — Extract player display

**Target**: `apps/web/components/play/PlayerTile.tsx` + `apps/web/lib/play/player-display.ts`

This is the most-used subcomponent — `PlayerTile` renders 8-12 times per game. Memoization is critical.

### Step 4a: Create `apps/web/lib/play/player-display.ts`

Move:
- `playerStatusBadge` (line 2394, ~45 lines)
- `playerInitials` (line 2440, ~9 lines)
- `playerTokenClass` (line 2478, ~40 lines)
- `roleSigil` (line 2371, ~23 lines)

```ts
import type { PublicPlayer } from "@/components/play-room-client";
import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";

export function playerStatusBadge(player: PublicPlayer, phase: string): string {
  /* same */
}
export function playerInitials(name: string) {
  /* same */
}
export function playerTokenClass(player: PublicPlayer) {
  /* same */
}
export function roleSigil(role: RoleCode) {
  /* same */
}
```

### Step 4b: Create `apps/web/components/play/PlayerTile.tsx`

```tsx
import { memo } from "react";
import type { PublicPlayer } from "@/components/play-room-client";
import { playerInitials, playerStatusBadge, playerTokenClass, roleSigil } from "@/lib/play/player-display";
import { roleThumbStyle } from "@/lib/role-art";

export const PlayerTile = memo(function PlayerTile({ /* props from line 1255 */ }) {
  /* exact same content */
}, arePlayerTilePropsEqual);

function arePlayerTilePropsEqual(/* same as line 1320 */) {
  /* same */
}
```

### Step 4c: Update main file

```diff
+ import { PlayerTile } from "@/components/play/PlayerTile";
+ import { playerInitials, playerTokenClass } from "@/lib/play/player-display"; // only if used in main file outside PlayerTile
```

Delete originals.

### Verify

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 2720 (-220 — this stage removes a lot)
```

### Commit 4
```
refactor(play): extract PlayerTile and player display utilities
```

---

## Stage 5 — Extract role detail panels

**Target**: `apps/web/components/play/RoleCard.tsx` (with inline `RoleFact`) + `apps/web/components/play/LoverCard.tsx` + `apps/web/components/play/NarratorSnapshotPanel.tsx` + `apps/web/components/play/HunterRevengePanel.tsx`

Use `roleSigil` from Stage 4.

### Step 5a-d: Create the 4 files

Each file follows pattern: `import type { ... }` + verbatim component body.

`RoleFact` (line 1854) stays inside `RoleCard.tsx`.

### Step 5e: Update imports

```diff
+ import { LoverCard } from "@/components/play/LoverCard";
+ import { NarratorSnapshotPanel } from "@/components/play/NarratorSnapshotPanel";
+ import { HunterRevengePanel } from "@/components/play/HunterRevengePanel";
+ import { RoleCard } from "@/components/play/RoleCard";
```

### Verify

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 2600 (-120)
```

### Commit 5
```
refactor(play): extract role detail panels (RoleCard/LoverCard/Narrator/Hunter)
```

---

## Stage 6 — Extract chat components

**Target**: `apps/web/components/play/TypingIndicator.tsx` + `apps/web/components/play/PrivateChatPanel.tsx`

`PrivateChatPanel` is 116 lines — the biggest single subcomponent extracted so far.

### Step 6a: `TypingIndicator.tsx`

```tsx
import type { TypingNotice } from "@/components/play-room-client";

export function TypingIndicator({ notices, compact = false }: { notices: TypingNotice[]; compact?: boolean }) {
  /* same as line 1890 */
}
```

### Step 6b: `PrivateChatPanel.tsx`

```tsx
import type { ChatChannel } from "@werewolf/shared";
import { TypingIndicator } from "@/components/play/TypingIndicator"; // if used internally

export function PrivateChatPanel({ /* props from line 1911 */ }) {
  /* same */
}
```

**Check**: Does `PrivateChatPanel` use `TypingIndicator` internally? If yes, import it from new module.

### Step 6c: Update main file

```diff
+ import { TypingIndicator } from "@/components/play/TypingIndicator";
+ import { PrivateChatPanel } from "@/components/play/PrivateChatPanel";
```

### Verify

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 2470 (-130)
```

### Commit 6
```
refactor(play): extract chat components (TypingIndicator and PrivateChatPanel)
```

---

## Stage 7 — Extract night actions

**Target**: `apps/web/components/play/NightActionPanel.tsx` + `apps/web/components/play/LiveCuePanel.tsx` + `apps/web/lib/play/night-actions.ts`

This is the heaviest stage — `NightActionPanel` is 178 lines plus helper functions.

### Step 7a: Create `apps/web/lib/play/night-actions.ts`

Move pure helpers:
- `shortcutTargets` (line 1953, 16 lines)
- `buildPrimaryNightAction` (line 1969, 59 lines)

```ts
import type { /* … */ } from "@werewolf/shared";

export function shortcutTargets(/* params */) { /* same */ }
export function buildPrimaryNightAction(/* params */) { /* same */ }
```

### Step 7b: `LiveCuePanel.tsx`

```tsx
export function LiveCuePanel({ /* props from line 1600 */ }) {
  /* same */
}
```

### Step 7c: `NightActionPanel.tsx`

```tsx
import { shortcutTargets, buildPrimaryNightAction } from "@/lib/play/night-actions";

export function NightActionPanel({ /* props from line 2028 */ }) {
  /* same */
}
```

### Step 7d: Update main file

```diff
+ import { NightActionPanel } from "@/components/play/NightActionPanel";
+ import { LiveCuePanel } from "@/components/play/LiveCuePanel";
+ import { shortcutTargets, buildPrimaryNightAction } from "@/lib/play/night-actions"; // if used outside NightActionPanel
```

### Verify

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 2150 (-320 — biggest reduction)
```

### Commit 7
```
refactor(play): extract NightActionPanel, LiveCuePanel, and night-action helpers
```

---

## Stage 8 — Extract voting + narrator + rules + final cleanup

**Target**: `apps/web/components/play/VotingPanel.tsx` + `apps/web/components/play/VoteTallyBar.tsx` + `apps/web/components/play/NarratorDesk.tsx` + `apps/web/components/play/PhaseGuide.tsx` + `apps/web/components/play/RulesSummary.tsx` + `apps/web/components/play/Timer.tsx`

Plus pure utilities: `apps/web/lib/play/device-cues.ts` + `apps/web/lib/play/event-log.ts`

### Step 8a: Create simple component files

For each of:
- `VotingPanel.tsx` (line 2207, 37 lines)
- `VoteTallyBar.tsx` (line 2245, 24 lines)
- `NarratorDesk.tsx` (line 1657, 78 lines)
- `PhaseGuide.tsx` (line 1736, 32 lines)
- `RulesSummary.tsx` (line 1343, 38 lines)
- `Timer.tsx` (line 2270, 11 lines)

Follow same pattern: import types from main file or types module, then verbatim component body.

### Step 8b: Create `apps/web/lib/play/device-cues.ts`

```ts
import { playCue } from "@/lib/sound";
import type { CueMode } from "@/components/play-room-client";

export function isCueMode(value: string | null): value is CueMode {
  /* same as line 2449 */
}

export function triggerDeviceCue(phase: string, forceSilent = false) {
  /* same as line 2453 */
}
```

### Step 8c: Create `apps/web/lib/play/event-log.ts`

```ts
export function eventLineClass(message: string) {
  /* same as line 2464 */
}
```

### Step 8d: Update main file imports

```diff
+ import { VotingPanel } from "@/components/play/VotingPanel";
+ import { VoteTallyBar } from "@/components/play/VoteTallyBar";
+ import { NarratorDesk } from "@/components/play/NarratorDesk";
+ import { PhaseGuide } from "@/components/play/PhaseGuide";
+ import { RulesSummary } from "@/components/play/RulesSummary";
+ import { Timer } from "@/components/play/Timer";
+ import { isCueMode, triggerDeviceCue } from "@/lib/play/device-cues";
+ import { eventLineClass } from "@/lib/play/event-log";
```

Delete all originals. Verify no stale references remain:

```bash
# Should print 0
grep -c "^function PhaseTransitionOverlay\|^function PlayerTile\|^function Timer\|^function NightActionPanel" apps/web/components/play-room-client.tsx
```

### Verify final state

```bash
wc -l apps/web/components/play-room-client.tsx
# Expect: ≈ 1700-1800 ✓

ls apps/web/components/play/
# Expect: 20+ .tsx files

ls apps/web/lib/play/
# Expect: 5+ .ts files

pnpm regression
pnpm typecheck
pnpm build
```

### Commit 8
```
refactor(play): extract voting, narrator, rules panels + sound/event utilities
```

---

## Stage 9 — Verification + commit

Run the full validation pipeline:

```bash
pnpm regression
pnpm typecheck
pnpm build

# Run unit tests
pnpm --filter @werewolf/web test
pnpm --filter @werewolf/game-server test
```

### Visual QA checklist

Open `/play/[code]` with a test game running (use existing test fixtures or `pnpm dev` + manual session). Walk through all phases:

- [ ] **Lobby** — players list, ready state, host controls
- [ ] **Night-1 reveal** — role cards, lover card (if applicable), narrator snapshot
- [ ] **Night action** — submit action, see live cue panel, vote tally hidden
- [ ] **Day** — public chat, private chats, typing indicators, voting panel
- [ ] **Vote** — vote tally bars animate, vote submitted
- [ ] **Death reveal** — cinematic appears with role
- [ ] **Phase transition overlay** — 900ms curtain plays between phases
- [ ] **Reconnect** — disconnect WS via DevTools, modal appears, retry works
- [ ] **Achievement unlock** — if conditions met, modal appears
- [ ] **Post-game story** — final summary renders with all pills

If anything regresses visually, **revert the most recent commit** and re-investigate.

### Commit 9
```
chore(audit): close Phase B play-room-client monolith split
```

---

## Acceptance criteria

1. `apps/web/components/play-room-client.tsx` line count ≤ **1800**
2. `apps/web/components/play/` contains 20+ `.tsx` files
3. `apps/web/lib/play/` contains 5+ `.ts` files
4. `pnpm regression` green after every commit
5. `pnpm typecheck` green after every commit
6. `pnpm build` green after every commit
7. Visual QA checklist all pass (no regressions in active /play room)
8. No console errors in browser DevTools during full game playthrough
9. Existing tests still pass (LobbyWizard, AuthChip, FeedbackWidget, etc.)
10. Git diff shows ZERO behavior changes — only file moves and import updates

---

## Не пипай

- `apps/web/app/globals.css` — class names preserved exactly, no CSS changes
- `apps/web/lib/colyseus-client.ts`
- `apps/web/lib/use-modal.ts`
- `apps/web/lib/sound.ts`
- `apps/web/lib/role-art.ts`
- `apps/web/hooks/use-timer-countdown.ts` — Phase A landed cleanly
- `apps/game-server/**` — backend untouched
- `packages/shared/**` — schemas untouched
- The main `PlayRoomClient` function body — only its inline subcomponents move out
- State mappers (`snapshotShellForState`, `playersForState`, etc., lines 2519-2570) — stay in main file
- Exported equality functions (`arePhaseSlicesEqual`, `arePlayerListsEqual`) — stay in main file (other modules may import them)

---

## Failure modes

### Stage 4 (PlayerTile) is the riskiest

`PlayerTile` is memoized with a custom equality function. Moving it to a separate file risks subtle bugs if:
- `arePlayerTilePropsEqual` references closure variables (it shouldn't, but verify)
- Types `PublicPlayer` import path drifts

**Mitigation**: After Stage 4, profile with React DevTools — PlayerTile should still skip re-renders when irrelevant state changes. If it re-renders unexpectedly, the equality function lost its reference; fix and verify.

### Stage 7 (NightActionPanel) is the largest single extraction

178 lines + 75 lines of helpers. If something breaks:
- Revert and split into two commits:
  - 7a: Helpers only (`shortcutTargets`, `buildPrimaryNightAction`)
  - 7b: Components (`NightActionPanel`, `LiveCuePanel`)

### Type-resolution issues

If TypeScript complains about a re-exported type, two options:
1. Re-export the type from `play-room-client.tsx` explicitly: `export type { PublicPlayer, GameSnapshot, ... }`
2. Move the types to `apps/web/lib/play/types.ts` and import from there in both main file and subcomponents

Option 2 is cleaner if multiple subcomponents share types.

### `pnpm build` fails after a commit

1. Read the error message — usually a missing import or unresolved type
2. If quick fix: amend the commit (still atomic)
3. If not: revert (`git reset --hard HEAD~1` since not pushed), investigate, retry with smaller scope

---

## Commit summary

9 atomic English commits, ~3 hours Codex work:

```
1. refactor(play): extract phase display utilities and chrome components
2. refactor(play): extract ConnectionBanner and ReconnectModal
3. refactor(play): extract achievement, death reveal, and post-game story
4. refactor(play): extract PlayerTile and player display utilities
5. refactor(play): extract role detail panels (RoleCard/LoverCard/Narrator/Hunter)
6. refactor(play): extract chat components (TypingIndicator and PrivateChatPanel)
7. refactor(play): extract NightActionPanel, LiveCuePanel, and night-action helpers
8. refactor(play): extract voting, narrator, rules panels + sound/event utilities
9. chore(audit): close Phase B play-room-client monolith split
```

PR title (if not direct push): `refactor(play): split play-room-client monolith into focused modules`

---

## Notes for ChatGPT 5.5 x-high / Codex

- **Atomic commits matter here.** If one extraction fails, others should already be merged. Don't fold multiple stages into one mega-commit.
- **Behavioral neutrality is mandatory.** This is a pure refactor — `git diff main..feature` on JSX output should show ZERO logical changes, only imports + moved blocks.
- **Run `pnpm build` after EVERY commit.** TypeScript errors cascade; catching them early avoids cleanup later.
- **`React.memo` and equality functions** are sensitive to closure — if `PlayerTile` re-renders more after extraction, the equality function lost its argument types or imports.
- **Don't reformat moved code.** Use Edit (not Write) to move blocks; preserve exact whitespace and comment positions. Diff reviewers will thank you.
- **`PrivateChatPanel` (116 lines) and `NightActionPanel` (178 lines)** are the biggest extracts. If either is unstable, split into helper-first commit + component-second commit.
- If you finish all 9 commits with time to spare, do NOT extend scope to `play-room-client.tsx` orchestration. That's a separate future PR. Phase B ends at 1800 lines.

---

(End of prompt)
