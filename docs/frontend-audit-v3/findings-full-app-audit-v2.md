# Full Application Audit v2 — Findings (2026-05-21, post-changes)

Fresh re-audit after the user's "many changes" round. **Compare against `findings-full-app-audit.md` (v1, 2026-05-21 morning)** to see what landed.

**Methodology**: 5 parallel specialized agents on disjoint scopes — `/play` game room v2, lobby/create flow v2, game-server backend v2, CSS bloat v2 (now 20,076 lines), secondary pages v2. Plus direct inspection of new `/create` route, protocol.ts changes, `.env.example`, recent 67 commits.

**Baseline**: `pnpm regression` → green. 67 commits ahead of `origin/main`. ~1,411 uncommitted insertions in working tree.

---

## 📊 Net assessment — what landed since v1

| Area | v1 → v2 | Verdict |
|---|---|---|
| **Lobby create flow** | 10 stutter-fixes proposed | ✅ **9/10 landed cleanly** — view-transition root disabled, min-height+contain on step-pane, persisted slots with `inert`, useRef for initialState, rAF-deferred audio, AudioContext singleton, React.memo, autoFocus preventScroll guard |
| **`/play` game room** | 15 issues | ⚠️ **1 fully fixed, 3 partial, 11 still open** — startTransition for setSnapshot only; rest unchanged |
| **Backend game-server** | 11 P0+P1 issues | ❌ **0 fully closed**, 2 partial. Public attack surface **expanded** (`/stats` now exposes 12 room codes vs 1) |
| **CSS bloat** | 49 dead selectors flagged | ❌ **46/49 still there**. File grew +668 lines (19,408 → 20,076). 0 `@layer`, 0 `prefers-reduced-motion`, 282→283 `html[data-theme="light"]`. One win: 611 lines of widget styles moved to CSS modules |
| **Secondary pages** | 33 issues | ⚠️ Only L4 (lobby Back link) fully fixed; AL3 + R1 partial; rest open |
| **Imagen + cinematic backdrop** | Theatre stack prompt | ✅ Landed (commits `cb5dfcf`, `100f393`, `7b7482e`, `7e7c18e`) |
| **Landing perf** | INP+LCP+TTFB pass | ✅ Mostly landed (commits `ea8a285`, `dc5058e`, `0810815`, `53bd204`) |

**Headline**: ~50% of v1 P0/P1 work **landed**. Most progress in lobby create + landing perf. **Backend and CSS work has NOT started.**

---

## 🔴 P0 — NEW critical issues found in v2

### P0-V2-1 — `/history/[gameId]/replay` is publicly accessible and renders private events
- **File**: `apps/web/app/history/[gameId]/replay/page.tsx:22-28, 122`
- **What**: No `requireSession()` guard. Renders timeline events with `visibility="private"`, `"faction"`, `"moderator"` for non-participant viewers — **leaks secret roles, night actions, mafia coordination, witch potion use**.
- **Impact**: Public replay link → anyone can browse game history with full role disclosure. Catastrophic for ongoing or recent rooms; players can scrape opponent's roles.
- **Fix**: Either gate behind `requireSession()` + check `userId` was in `gamePlayers` for this `gameId`, OR filter `visibility !== "public"` events at the DB query level for non-participants.

### P0-V2-2 — `/create` route lacks `requireSession()`
- **File**: `apps/web/app/create/page.tsx:10`
- **What**: New family-agnostic `/create` route, but unlike `/werewolf/create` and `/mafia/create` (which require session), it has no auth gate.
- **Impact**: Unauthenticated user can reach wizard. Eventual `room.create` call will fail without token, but UX is broken and confusing. Also a security hole if game-server's `ALLOW_DEV_AUTH` is still misconfigured (see P0-V2-3 chain).
- **Fix**: `await requireSession("/create" + (mode ? "?mode=" + mode : ""))`.

### P0-V2-3 — `/stats` endpoint now exposes 12 room codes (was 1)
- **File**: `apps/game-server/src/app.config.ts:23-28` + `apps/game-server/src/rooms/GameRoom.ts:102-117`
- **What**: New family stats feature added `recentEndings: Array<{code, winnerTeam, winnerReasonBg, endedAt, family}>` (cap 12). All publicly accessible without auth/rate-limit.
- **Impact**: Recent room codes leak. While codes are post-game and useless for joining, an attacker can enumerate game outcomes by family and timing, possibly correlating with user behavior. Combined with absence of replay protection (P0-V2-4), an attacker who held a token for a finished game could probe the room ID.
- **Fix**: Hash codes (`recentEndings[].code` → `sha256(code).slice(0,8)`), OR auth-guard the endpoint, OR drop codes from public payload entirely.

### Still open from v1 (carrying forward, unchanged severity)

| Item | v1 ID | File:line | Status |
|---|---|---|---|
| `ALLOW_DEV_AUTH` fail-open default | P0-B1 | `GameRoom.ts:181` | ⚠️ Slightly improved (`NODE_ENV !== "production"` AND-guard, docker-compose forces `"false"`) but default still fail-open. Switch to opt-in: `=== "true"` |
| No replay-attack protection on JWT game tokens | P0-B2 | `GameRoom.ts:186-189` | ❌ Zero progress. Token reusable for 5 min |
| `getLeaderboardRows` no SQL LIMIT | P0-D1 | `packages/database/src/queries.ts:298-311` | ⚠️ Now has `.limit(500)` default but JS still `.slice(30)` after fetching. Aggregation in JS, not SQL |
| GDPR delete minimal friction | P0-F6 | `AccountDangerZone.tsx:48-77` | ❌ Open |
| `/lobby/[code]` not real-time | P0-F5 | `lobby-invite-client.tsx` | ❌ Open |
| `/play` players panel mounted twice | P0-F1 | `play-room-client.tsx:897, 1011` | ❌ Open |
| `.game-shell::before` defined twice | P0-F2 | `globals.css:1133` + `:5995` | ❌ Open |
| Full setSnapshot on Colyseus delta | P0-F3 | `play-room-client.tsx:241-243` | ⚠️ Wrapped in `startTransition` but full snapshot still recomputes for every patch |

**Total P0**: 11 (3 new this round + 8 carried)

---

## 🟠 P1 — Notable new + carried

### NEW in v2 — Lobby create flow

| # | File:line | Issue | Fix |
|---|---|---|---|
| LC-1 | `apps/web/lib/lobby-form.ts` (698 lines) | "God file" — reducer + selectors + URL glue + templates + random utils all in one | Split into `lobby-form/types.ts`, `reducer.ts`, `selectors.ts`, `templates.ts` |
| LC-2 | `apps/web/components/lobby/StepRoom.tsx` (393 lines) | Contains `StepRoom` + `ManualTempoPanel` + `ManualTimerControl` + `Field` + `RefreshIcon` + 2 form-const blocks | Extract `Field`/`RefreshIcon` to `components/lobby/Field.tsx`; `ManualTempoPanel*` to own file |
| LC-3 | `apps/web/lib/lobby-form.ts:308-324` | `criticalRoleWarnings` uses substring matching on Bulgarian text ("не съвпада", "Липсва") — fragile to copy changes | Return structured warning codes from `validateRoleDistributionForMode`, filter by code |
| LC-4 | `apps/web/components/lobby/LobbyWizard.tsx:111` | `state.formError` rendered without `role="alert"` or `aria-live` — screen reader doesn't announce | Add `role="alert"` or `aria-live="assertive"` |
| LC-5 | `apps/web/components/lobby/QuickStartRow.tsx:120` | "Default 4 recipes" filtering by hard-coded ID list; breaks silently on rename. `recipes` recomputed every render (no `useMemo`) | Mark `featured: true` as source-of-truth; `useMemo` keyed on `state.lockedFamily` |
| LC-6 | `apps/web/lib/lobby-form.ts:62,103,141` | `displayName` field in state + reducer + action **never read or written** in lobby UI. Dead code | Remove field/action, or wire to lobby publication |
| LC-7 | `apps/web/components/lobby/MobileSummaryChip.tsx:36` | `role="dialog" aria-modal="true"` overlay without focus trap or Escape-to-close | Add focus trap, return focus on close, `aria-labelledby` link |
| LC-8 | `apps/web/components/lobby/StepRoles.tsx:38-43` | `visibleRoles` recomputed without `useMemo` — `.filter() + .toLowerCase() + .tags.join()` on each render across 20+ roles | Wrap in `useMemo(..., [family, roleSearch, runtimeFilter])` |

### NEW in v2 — `/play` game room

| # | File:line | Issue | Fix |
|---|---|---|---|
| PV-1 | `play-room-client.tsx:179, 327` | `useEffect` deps include `createOptions` (server props) — new reference per render breaks WS connection on parent re-render | Memoize `createOptions` with `useMemo(() => createOptions, [code])` |
| PV-2 | `play-room-client.tsx:457-479, 634-646` | `submitCurrentShortcutAction` redefined in render + key-handler effect deps list of 11 → full re-bind on each change | `useCallback` + ref for last state |
| PV-3 | `play-room-client.tsx:830, 1073` | `PhaseTransitionOverlay` re-mounts via `key=${phase}-${pulseKey}` → 900ms blur curtain plays even on reconnect-snapshot | Show only when `previousPhase !== phase` AND player already saw game |
| PV-4 | `play-room-client.tsx:487-492` | `requestStartGame` uses 3× `window.setTimeout` not cancelled on unmount; can trigger `room.send("startGame")` on disposed room | Store timeout IDs, cancel in cleanup |
| PV-5 | `play-room-client.tsx:828, 836` | 4 layout selectors on `<main>`: `framed-shell shell game-shell play-shell phase-${phase}` + `data-phase` + `data-theme` + `data-family` — quadruple style recalc | Consolidate to single `data-phase` |

### NEW in v2 — Backend

| # | File:line | Issue | Fix |
|---|---|---|---|
| BV-1 | `packages/shared/src/games/werewolf/roles.ts:398, 420` (et al) | New `runtimeStatus: "manual_only"` on `stray_cat`/`guard_dog` (+others) **NOT enforced** in game-server. Grep shows no match for `runtimeStatus` in `apps/game-server/src` → these roles can leak into automatic narrator games | Add runtime check in `assignRoles` or `createGameConfigFromOptions` |
| BV-2 | `apps/game-server/src/rooms/GameRoom.ts:515-540` | `customTimers` echoed back via `syncPublicConfig`. `autoAdvanceWhenReady` boolean accepted from untrusted client for non-manual profiles | Ignore `autoAdvanceWhenReady` for non-manual tempo |
| BV-3 | `apps/game-server/src/persistence/game-persistence.ts:198-203` | `ensureUsers` synthesizes `email: ${userId}@anonymous.local` for every event actor/target. If dev-auth accepts arbitrary userIds, ghost user records accumulate | Tighten userId shape validation before persist |
| BV-4 | `.env.example:28-37` | Real production domain `tisi.lol` now committed. Not secret but leaks infra topology | Revert to placeholder `werewolf.example.com` |

### NEW in v2 — Secondary pages

| # | Page | File:line | Issue | Fix |
|---|---|---|---|---|
| SV-1 | /leaderboard | `apps/web/app/leaderboard/page.tsx:76-88` | `byName` aggregates by `displayName` — two users with same name merge into one row | Use `userId` as key; display name separately |
| SV-2 | /lobby/[code] | `lobby-invite-client.tsx:30-37` | `navigator.clipboard.writeText` without feature detection — HTTP context throws without useful toast | try/catch with fallback `document.execCommand("copy")` or text selection |
| SV-3 | /account | `account/AccountProfile.tsx:89, 57` | After `saveName` immediate `router.refresh()` → double re-fetch + focus loss. Success "Запазено." lacks `role="status"` (only error has `role="alert"`) | Drop `router.refresh()`; add `role="status" aria-live="polite"` |
| SV-4 | /tutorial | `TutorialFlipbook.tsx:75-91` | Global `keydown` listener captures arrows everywhere — breaks Tab+arrow navigation on progress dots | Skip handler if `document.activeElement` is button with `data-progress` |
| SV-5 | /achievements | `achievements-client.tsx:38, 46-49` | Flash-of-locked — 12-15 tiles render as locked before `loaded` resolves | Hide list while `!loaded`, or show skeleton |
| SV-6 | /lobby (wizard) | `lobby/RoleDetailModal.tsx:6-52` | No Escape close, no focus trap, no scroll lock | Shared `useModal` hook |
| SV-7 | /verify-email | `auth/VerifyEmailClient.tsx:37` | `setTimeout(() => router.push("/"), 2000)` not cancelled on unmount | Store timeoutId, cleanup in effect |

---

## 🎯 v1 items: detailed progress status

### Lobby create flow (v1 `codex-prompt-create-stutter-fix.md`) — ✅ 90% landed

| # | Stage | Status | Verification |
|---|---|---|---|
| 1 | Disable view-transition root crossfade | ✅ | `globals.css:10304-10312` — `::view-transition-old/new/group(root)` animation: none |
| 2 | `min-height` + `contain` on `.lobby-step-pane` | ✅ | `globals.css:8911-8921` |
| 3 | Persist all 4 step components | ✅ | `LobbyWizard.tsx:97-110` — all 4 mounted with `inert` + `aria-hidden` |
| 4 | Guard autoFocus with `preventScroll` | ✅ | `StepRoom.tsx:87-97` |
| 5 | AudioContext singleton | ✅ | `sound.ts:92-108` |
| 6 | React.memo on StickyPreview + MobileSummaryChip | ✅ | `StickyPreview.tsx:92-110`, `MobileSummaryChip.tsx:50-78` |
| 7 | Progress bar `transform: scaleX()` | ⚠️ | StickyPreview uses scaleX for balance bar; no progress bar in StepNav (might've been removed) |
| 8 | Confetti reduced-motion guard | N/A | (Skipped per user convention) |
| 9 | useRef for initialState | ✅ | `LobbyWizard.tsx:37-40` |
| 10 | Defer audio cue via rAF | ✅ | `LobbyWizard.tsx:69-79` |

### `/play` game room (v1 P0-F1 through F7) — ❌ 20% landed

| Item | Status | Notes |
|---|---|---|
| Single-mount players panel | ❌ | Both `renderPlayersPanel("mobile")` and `("desktop")` still in DOM |
| Merge double `.game-shell::before` | ❌ | Still defined at `:1133` AND `:5995` |
| State slicing + React.memo | ⚠️ | `startTransition` added but `toSnapshot` still full per delta |
| Reduced-motion guards | ❌ | 0 `@media (prefers-reduced-motion)` in 20,076 lines |
| Phase transition blur | ❌ | `backdrop-filter: blur(8px)` still at `:11449` |
| Single timer hook | ⚠️ | Same `Timer` component, but instantiated twice (phase-hero + NarratorDesk) |
| PlayerTile React.memo | ❌ | String concat still at `:692-700` |
| Vote bar deduplicate animation | ❌ | `transition` + `animation` conflict still at `:11561-11569` |
| Reconnect UX modal | ❌ | No `room.reconnect()` / sessionId persistence |

### Backend (v1 P0-B1, B2 + B1.x) — ❌ Almost nothing closed

- ALLOW_DEV_AUTH: ⚠️ Slightly improved with `NODE_ENV` AND-guard, docker-compose forces "false"; **default still fail-open**
- Replay tokens: ❌ No nonce store
- persistQueue: ❌ Still unbounded; `onDispose` doesn't await
- achievementEvents: ❌ Still unbounded
- onJoin rate limit: ❌ Still silent overwrite
- onDispose cleanup: ❌ Still incomplete
- sendChat type validation: ⚠️ Channel validated, message still untyped
- recentEndings: ❌ Worsened (1 → 12 codes exposed)

### CSS bloat — ❌ Worse net

- File: 19,408 → 20,076 lines (+668)
- Dead selectors: 49 flagged → **46 still there** (only `report-head/-kicker/-lede` removed)
- `html[data-theme="light"]` selectors: 282 → 283 (one more added)
- `@layer`: 0 → 0
- `prefers-reduced-motion`: 0 → 0
- `*-shell` wrappers: 33 → 34 (`not-found-shell` added)
- Always-on infinite animations: 7 → 7
- **Win**: 611 lines of widget styles moved to CSS modules (commit `53bd204`)
- **Concern**: 23 new gradient declarations + 10 new triple-stop box-shadows + 10 new `html[data-theme="light"]` overrides added in uncommitted +603 lines — repeating same anti-patterns

### Secondary pages — ❌ Mostly open

- Only fully fixed: L4 (lobby Back link, `/lobby` route now exists)
- Partially fixed: AL3 (leaderboard `.limit(500)` added but still JS aggregation), R1 (`useDeferredValue` added but `matchesRoleSearch` still does 30 `replaceAll`)
- All other 30+ items unchanged

---

## 🔥 Critical action items (must-fix before public launch)

### Privacy & security — Sprint 0

1. **🚨 N1 (P0-V2-1) — Filter private replay events for non-participants** (`/history/[gameId]/replay`)
2. **🚨 N3 (P0-V2-2) — Add `requireSession()` to `/create` route**
3. **🚨 P0-V2-3 — Hash or drop room codes from `/stats` public payload**
4. **P0-B1 — Flip ALLOW_DEV_AUTH default to opt-in (`=== "true"`)**
5. **P0-B2 — Add nonce tracking for game tokens (in-memory Set with TTL = expiresAt)**
6. **P0-D1 — Move leaderboard aggregation to SQL (`GROUP BY userId ORDER BY wins LIMIT 30`)**
7. **P0-F6 — Typed-confirmation modal for GDPR delete**
8. **BV-1 — Enforce `runtimeStatus: "manual_only"` in game-server's `assignRoles`**
9. **BV-4 — Revert real domain `tisi.lol` from `.env.example`**

### `/play` performance (the next big perf cliff)

10. Single-mount players panel (P0-F1)
11. Merge double `.game-shell::before` (P0-F2)
12. State slicing for Colyseus deltas (P0-F3 — beyond startTransition)
13. PV-1: memoize `createOptions` to prevent WS disconnect storms
14. PV-4: cancel `requestStartGame` setTimeout chain on unmount
15. PV-5: collapse 4 layout attributes on `<main>` to single `data-phase`
16. F1.x: PhaseTransitionOverlay split, single Timer hook, PlayerTile memo, sprite update guards
17. F1.7: reconnect modal with `room.reconnect()` + sessionId persistence

### Lobby create polish

18. LC-1 + LC-2: split `lobby-form.ts` and `StepRoom.tsx`
19. LC-3: replace BG-substring matching with warning codes
20. LC-4: `aria-live` for form errors
21. LC-5: `useMemo` for QuickStartRow recipes
22. LC-6: remove dead `displayName` state
23. LC-7: shared `useModal` hook (covers SV-6, R3, AC danger zone)
24. LC-8: `useMemo` for `visibleRoles` in StepRoles

### CSS hygiene

25. Delete the 46 confirmed dead selectors (~15-20 KB raw)
26. Stop accumulating new `html[data-theme="light"]` selectors — migrate to CSS variables (start small with one section)
27. Add 1-2 `@layer` directives for chrome and tokens (test caching impact)

### Secondary pages

28. SV-1: leaderboard merge-by-userId
29. SV-3: drop `router.refresh()` from AccountProfile saves
30. T1: debounce `router.replace` in tutorial slide change
31. T4: add "Skip to game" CTA in tutorial
32. R3, SV-6: shared modal hook with focus trap + scroll lock + Escape

---

## 📅 Proposed sprint plan

### Sprint A (this week, 5 days) — privacy + security
- All 9 items in "Privacy & security" above
- Verify `pnpm regression` + add 2-3 new tests:
  - Replay page filters private events for non-participant
  - Game-server rejects token with reused nonce
  - GameRoom.assignRoles rejects `runtimeStatus: "manual_only"` in automatic narrator

### Sprint B (week 2, 5 days) — `/play` overhaul
- All items 10-17 above
- Add tests for `play-room-client.tsx` (currently 0 tests for 2728 lines!)

### Sprint C (week 3, 5 days) — polish + hygiene
- Items 18-32 above
- CSS cleanup (delete dead selectors)
- Start lobby-form.ts split

### Sprint D (week 4, optional) — architecture
- CSS Layers introduction
- Per-route CSS module migration plan
- E2E test infrastructure (Playwright)

---

## 📂 Suggested Codex prompts to write next

Each can be a self-contained `codex-prompt-*.md` file similar to existing patterns:

1. **`codex-prompt-replay-privacy-guard.md`** — P0-V2-1: gate `/history/[gameId]/replay`, filter events by visibility
2. **`codex-prompt-create-auth-gate.md`** — P0-V2-2: requireSession on /create
3. **`codex-prompt-stats-public-surface.md`** — P0-V2-3: hash room codes in /stats payload
4. **`codex-prompt-backend-security-hardening-v2.md`** — P0-B1, B2, BV-1, BV-2, BV-3, BV-4
5. **`codex-prompt-play-room-overhaul-v2.md`** — combine P0-F1, F2, F3 + all PV-1 through PV-5 + F1.x
6. **`codex-prompt-lobby-architecture-cleanup.md`** — LC-1 through LC-8
7. **`codex-prompt-css-dead-selector-purge.md`** — Delete 46 dead selectors + start light-theme CSS var migration
8. **`codex-prompt-modal-shared-hook.md`** — Build `useModal` with focus trap + scroll lock + Escape, then migrate RoleDetailModal, RoleCodexDetail, AccountDangerZone confirm
9. **`codex-prompt-leaderboard-sql-aggregate.md`** — P0-D1 + SV-1 in one PR

---

## 📉 What's worse than v1

- **Backend attack surface expanded** — `/stats` exposes 12 room codes instead of 1
- **CSS grew +668 lines** with same anti-patterns (multi-gradient, theme-light selectors)
- **New P0 found** — `/history/[gameId]/replay` privacy leak (was not surfaced in v1 because agent didn't go deep on visibility)
- **New P0 found** — `/create` lacks auth gate
- **`runtimeStatus: "manual_only"`** added in shared/roles.ts but not enforced server-side

## 📈 What's better than v1

- **Lobby create flow** — 9/10 stutter-fix items landed cleanly
- **Landing perf** — INP/LCP/TTFB pass mostly applied
- **Theatre backdrop** — cinematic vignette + floor shadow + fixed ambient backdrop live
- **Non-critical widgets** — moved to lazy CSS modules (`53bd204`)
- **Sentry bundle** — removed from public JS (`dc5058e`)
- **Service worker** — versioned shell cache (`0810815`)
- **Roles codex** — memoized filtering and cards (`7a24464`)
- **Auth sign-in** — contextual copy per destination (`49b6bf5`)
- **Tutorial navigation** — fixed reachability across steps (`b545da9`)

---

## 🎯 Bottom line

**Big landing/UX/perf wins, but the deep structural work hasn't started.** The user shipped polish well — cinematic backdrop, lobby stutter fix, theme toggle perf, scroll paint reduction. But the **deep work** flagged in v1 — backend security, `/play` overhaul, CSS architecture — is largely untouched, and **two new P0 privacy issues surfaced** (replay leak, /create no auth).

**Recommended next move**: don't ship another polish PR until Sprint A (privacy + security) lands. The replay-page leak is the most serious — anyone with a game URL can browse opponents' roles, mafia signals, witch potions.

After Sprint A, the `/play` overhaul (Sprint B) is the next-biggest win — it's the largest UX surface and the biggest performance liability remaining.

---

**Files produced**:
- This document (`findings-full-app-audit-v2.md`)
- v1 preserved at `findings-full-app-audit.md`

**Agent reports preserved at**:
- `audit-v3/agent-reports/v2-play.md` (synthesized into this doc)
- `audit-v3/agent-reports/v2-backend.md`
- `audit-v3/agent-reports/v2-css.md`
- `audit-v3/agent-reports/v2-lobby-create.md`
- `audit-v3/agent-reports/v2-secondary.md`

(Agent transcripts available in `C:\Users\Administrator\AppData\Local\Temp\claude\E--werewolf-mafia\` task output files if deeper drill-down needed.)
