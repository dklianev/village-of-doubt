# Full Application Audit — Findings (2026-05-21)

Comprehensive audit of `werewolf_mafia` covering frontend, backend, CSS, bundles, scroll/animations, INP/perf, security, and accessibility. Compiled from 4 parallel specialized audits plus cross-cutting inspection.

**Methodology**: 4 parallel agents on disjoint scopes — `/play` game room, game-server backend, CSS+bundle bloat, secondary pages (auth/account/history/social/tutorial/lobby/offline/roles). Plus baseline `pnpm regression` (green) and direct inspection of layout, service worker, Next.js config, and test coverage.

**Scope covered**:
- ✅ `/play/[code]` (largest UX surface, 2728-line monolith)
- ✅ `/lobby/[code]`
- ✅ `/history` + `/history/[gameId]/replay`
- ✅ `/achievements`, `/leaderboard`, `/friends`
- ✅ `/tutorial`
- ✅ `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email`
- ✅ `/account`
- ✅ `/offline`, `/roles`, `/werewolf/roles`, `/mafia/roles`
- ✅ Game-server (`GameRoom.ts`, schemas, persistence, auth)
- ✅ CSS bloat (`globals.css` 19,408 lines / 362 KB)
- ✅ JS bundle weight (per-route)
- ✅ Service worker, layout chrome, Next.js config

**Already covered in prior PRs** (not re-audited): `/`, `/werewolf`, `/mafia`, `/werewolf/join`, `/mafia/join`, `/werewolf/create`, `/mafia/create`, `/faq`, `/privacy`, `/terms`, `/status`, `/report`.

---

## Executive summary

The app has shipped substantial perf work recently (landing zoom fix, theatre backdrop, view-transition theme toggle, scroll paint reduction, role memoization). What remains splits into **3 macro buckets**:

1. **`/play` is the next perf cliff** — a 2728-line monolith that re-renders fully on every Colyseus delta, with duplicate-mounted players panel, double-defined CSS shell, infinite always-on animations, and zero motion-reduce guards.

2. **Game-server has 2 P0 security gaps** — dev-auth fail-open on non-`production` `NODE_ENV` and no replay-attack protection on JWT game tokens.

3. **CSS architecture is unsustainable** — 19,408 lines / 362 KB ships on every route. 33 near-identical `*-shell` wrappers, 282 `html[data-theme="light"]` selectors (slow theme toggle), 49 confirmed dead selectors, missing CSS Layers / per-route modules.

Severity breakdown:

| Severity | Count | Examples |
|---|---|---|
| 🔴 **P0** | 8 | `/play` players panel mounted twice, double-defined `.game-shell::before`, dev-auth fail-open, JWT replay, GDPR delete without typed confirmation, `getLeaderboardRows` no SQL LIMIT, lobby is not real-time, full-state setSnapshot |
| 🟠 **P1** | 27 | persistQueue never flushed on dispose, `play-room-client.tsx` no React.memo, OAuth button stuck pending on back-nav, history hard-coded 20 cap, tutorial router.replace on every slide, `@colyseus/sdk` not lazy, achievementEvents unbounded |
| 🟡 **P2** | 26 | Various polish: vibrate over-firing, error message localization, password-toggle missing, `redirect("/roles")` loses query, etc. |

**Total: ~60 actionable items.**

---

## 🔴 P0 — Critical issues (must-fix before next milestone)

### Frontend

**P0-F1 — `/play` players panel mounted twice**
- **File**: `apps/web/components/play-room-client.tsx:897, 1011`
- **What**: `renderPlayersPanel` rendered for both mobile and desktop, with CSS `display: none` hiding one. React mounts both, runs `players.map()` twice, duplicates DOM, doubles cost of every Colyseus state update.
- **Fix**: Extract `<PlayersPanel/>` as `React.memo`, mount once, use CSS grid `order` or `useMediaQuery` to choose mobile vs desktop layout.

**P0-F2 — Double-defined `.game-shell::before`**
- **File**: `apps/web/app/globals.css:5853-5874` vs `1133-1147`
- **What**: Conflicting declarations — orb `220px` fixed + full-viewport `inset:0 cover` background. Lower one wins cascade. Phase change → swap `--phase-art` → full viewport background-image repaint + `saturate/contrast` filter pass.
- **Fix**: Merge into one selector. Put backgrounds in a separate decorative `<div aria-hidden>` with `will-change:opacity` and crossfade between phase backgrounds (no image swap).

**P0-F3 — Full-state setSnapshot on every Colyseus delta**
- **File**: `apps/web/components/play-room-client.tsx:241-243`
- **What**: `room.onStateChange` triggers `setSnapshot(toSnapshot)` for EVERY change (typing, hasVoted, tally, chat). All children re-render: `RulesSummary`, `PhaseGuide`, `PhaseRail`, `NarratorDesk`, `VotingPanel`, `DeathRevealCinematic` — none are `React.memo`.
- **Fix**: Split state into slices (players, phase/timer, chat, events). Wrap heavy panels in `React.memo` with stable props, or use `useSyncExternalStore` per-slice.

**P0-F4 — No `prefers-reduced-motion` in 19,408 lines of CSS**
- **File**: `apps/web/app/globals.css` (entire file)
- **What**: Zero motion-reduce guards. `.phase-transition-overlay` (900ms curtain), `cuePulse`, `voteBarIn`, `revealPulse`, `countdownVeil` play unconditionally. WCAG 2.3.3 violation.
- **Fix**: User explicitly said "no reduced-motion guards" earlier — but THIS context is different: full-screen curtains during gameplay can trigger vestibular discomfort in WCAG-sensitive players. Recommend adding ONLY for the 4-5 high-amplitude animations (curtain, pulse, revealPulse), not for the subtle ambient ones.

**P0-F5 — `/lobby/[code]` is not real-time**
- **File**: `apps/web/components/lobby-invite-client.tsx:132-151`
- **What**: Static banner with "host + 2 empty slots". No WebSocket, no presence, no player count from server. Route is named `/lobby` but is really `/invite`.
- **Fix**: Either connect to `/api/rooms/[code]/preview` polling (cheap), or upgrade to WebSocket presence, or rename to `/invite/[code]` with honest expectations.

**P0-F6 — GDPR delete has minimal friction**
- **File**: `apps/web/components/account/AccountDangerZone.tsx:13-33`
- **What**: 2 clicks to delete account — no typed confirmation (no email re-entry, no "DELETE" word). Inline panel, not modal. Easy accidental deletion.
- **Fix**: Require typed email or word "ИЗТРИЙ" before enabling button. Add `<dialog>` modal with focus trap.

### Backend

**P0-B1 — Dev-auth fail-open on non-`production` `NODE_ENV`**
- **File**: `apps/game-server/src/rooms/GameRoom.ts:181`
- **What**: `ALLOW_DEV_AUTH !== "false"` evaluates TRUE if env var is missing/empty. Combined with `NODE_ENV !== "production"` guard, deployments with `NODE_ENV=staging` or unset env accept any unsigned `userId`+`displayName`.
- **Fix**: Switch to opt-in: `process.env.ALLOW_DEV_AUTH === "true" && process.env.NODE_ENV !== "production"`.

**P0-B2 — No replay-attack protection on game tokens**
- **File**: `GameRoom.ts:186-189` + `verifyGameToken`
- **What**: JWT has `nonce` field but no nonce-tracking. A stolen token works for 5 minutes. Also `clientsByUserId.set` silently overwrites existing client (session hijack without notice).
- **Fix**: Per-room `Set<string>` of consumed nonces (TTL = `expiresAt`). On duplicate `userId` join, send `safe_error` + `leave()` to old client before replacing.

### Data

**P0-D1 — `getLeaderboardRows` has no SQL LIMIT**
- **File**: `apps/web/app/leaderboard/page.tsx:73-91`
- **What**: Fetches ENTIRE rows table, aggregates in JavaScript, returns top 30. At N=10k rows → slow + memory blowup. Will only get worse over time.
- **Fix**: Move aggregation to SQL: `GROUP BY display_name, ORDER BY wins LIMIT 30` (Postgres). Add index on `(display_name, ended_at)`.

---

## 🟠 P1 — High-priority (next 2 sprints)

### `/play` perf hotspots (5)

| # | File:line | Issue | Fix |
|---|---|---|---|
| F1.1 | `play-room-client.tsx:830,1057-1081` | `PhaseTransitionOverlay` uses `backdrop-filter: blur(8px)` on full viewport — GPU-expensive on mobile | Lower to `blur(4px)` or scope to `(min-width: 1024px)` |
| F1.2 | `globals.css:10759-10770` | `.phase-transition-overlay` repaints cover-snapped image of entire viewport on each phase switch | Split into 2 layers: static backdrop + animated content card; only animate content card |
| F1.3 | `play-room-client.tsx:1901-1933` | `Timer` setInterval(1000ms) instantiated 2× (phase-hero + NarratorDesk) | Single `useTimerCountdown(endsAt)` hook shared, or RAF-based |
| F1.4 | `play-room-client.tsx:653-826` | Player panel concatenates `player.connected,ready,host,narrator,mayor,actedThisPhase,hasVoted` as one string — every field change recomputes whole list | Extract `<PlayerTile>` as `React.memo` with custom `arePropsEqual` |
| F1.5 | `globals.css:7943-7972` | `.player-token::before` uses 300% sprite background-position update per state change — per-player tile sprite repaint | `will-change` only when state changes; or inline SVG state icon |
| F1.6 | `play-room-client.tsx:1891` + `globals.css:10924` | Vote bar duplicate animation: `transform: scaleX()` transition (180ms) + `animation: voteBarIn 220ms both` — animation re-triggers on every re-mount | Drop the keyframe animation, keep only transition |
| F1.7 | `play-room-client.tsx:310-316` | Reconnect UX: just sets `setStatus("Връзката прекъсна")` — no spinner, no retry button, no exponential backoff | Add reconnect modal with `aria-live="assertive"`, manual retry, online-event re-join |

### Backend (8)

| # | File:line | Issue | Fix |
|---|---|---|---|
| B1.1 | `GameRoom.ts:2060-2073` | `persistQueue` is unbounded `.then()` chain. On DB outage → memory growth, never flushed on dispose | Counter for pending writes, reject new tasks at >N; `await this.persistQueue` (with timeout) in `onDispose` |
| B1.2 | `GameRoom.ts:1957` | `achievementEvents` grows for entire game; long games (20+ rounds) → thousands of entries holding payload objects | Compress to needed-for-eval fields; or process incrementally in `evaluateAchievementUnlocks` |
| B1.3 | `GameRoom.ts:194-258` | `onJoin` has no rate-limit and no guard against same userId connecting from multiple sockets | Before `set`, if userId exists, leave old client with safe_error |
| B1.4 | `GameRoom.ts:312-315` | `onDispose` only clears `liveRooms` + `phaseTimer`. Other maps/sets leak if held by long-lived references (Sentry breadcrumbs, persistQueue closure) | Explicit `.clear()` on all maps/sets + `await persistQueue` |
| B1.5 | `GameRoom.ts:142` | `maxClients = 47` no differentiated limit for players vs spectators. No per-IP rate-limit | Separate spectator slot limit; add Express middleware throttle by IP |
| B1.6 | `GameRoom.ts:260-273, 297-310` | `allowReconnection` rejection not caught → unhandled rejection in Node | Wrap `allowReconnection` in try/catch |
| B1.7 | `GameRoom.ts:812-855` | `sendChat` uses `message.slice(0, 500)` without `typeof === "string"` check — bad payload causes try/catch path (user sees generic error) | `if (typeof message !== "string" || !message.trim()) return;` |
| B1.8 | `app.config.ts:23-28` + `/stats` | `recentEndings` exposes room codes (minor info-leak; codes are useless post-game but still public) | Hash codes or drop from public payload |

### Bundle / data flow (10)

| # | File:line | Issue | Fix |
|---|---|---|---|
| BD1 | `lib/colyseus-client.ts` import chain | `@colyseus/sdk` (~80-120 KB gzipped) ships in shared chunk because of static imports | `dynamic(() => import('@/lib/colyseus-client'))` only on `/play/*` and `/lobby/*` |
| BD2 | `layout.tsx` → `AuthChip` | `AuthChip` statically imports `authClient` + 7 lucide icons → eager on every route | `dynamic({ ssr: false })` — session is cookie-based, no SSR needed for chip |
| BD3 | `layout.tsx` → `ToastHost` | Ships globally even when no toasts; loads 4 lucide icons | `dynamic({ ssr: false })` |
| BD4 | `account/page.tsx:51-66` | `getGameHistoryForUser(50)` + `getPlayerRolesInGames` + `getAchievementsForUser` run serially → slow TTFB | `Promise.all()`; add `unstable_cache` keyed by userId for 30s |
| BD5 | `achievements-client.tsx:20-36` | Double waterfall — `useSession` → `fetch("/api/achievements")` despite page already being session-gated | Move fetch to server component; pass `unlockedIds` as props |
| BD6 | `history/page.tsx:13-14` | Hard-coded `HISTORY_CASE_LIMIT = 20`; no pagination | Cursor pagination `?before=<endedAt>` or "Зареди още" |
| BD7 | `history/[gameId]/replay/page.tsx:165` | `getGameTimeline(db, game.id, 300)` no pagination; large `ol` block, no virtualization | Lazy by phase; "Покажи 18 събития" expander |
| BD8 | `games/game-roles-page.tsx:411-446` | `normalizeSearch` does 30+ `.replaceAll()` per render | Single `String.prototype.normalize("NFD")` + regex |
| BD9 | `games/game-roles-page.tsx:227-253` | `<img>` (not `next/image`) with `onError` fallback — 20+ missing webp = 20 net requests + 20 reflows | Check KNOWN_*_ASSETS first; placeholder if missing |
| BD10 | `tutorial/TutorialFlipbook.tsx:49-63` | `router.replace` + `localStorage.setItem` on every slide change → INP issue on slow phones | Debounce URL update (300ms) or use `history.replaceState` directly |

### Auth / Account / UX (4)

| # | File:line | Issue | Fix |
|---|---|---|---|
| AX1 | `sign-in/OAuthButton.tsx:27-38` | `isPending` stuck `true` on back-navigation after popup | Timeout 15s + listen for `pageshow`/`visibilitychange` |
| AX2 | `account/AccountDataExport.tsx:4-6` | `window.location.href = "/api/account/export"` blocks navigation with zero feedback | `<a download>` or `fetch + blob` with progress |
| AX3 | `sign-in/EmailPasswordForm.tsx:49-50` | All sign-in errors collapse to "Неуспешна заявка. Провери имейла и паролата." | Map `result.error.code` to specific BG strings |
| AX4 | `auth/ForgotPasswordClient.tsx:18-30` | No rate-limit feedback — user can spam-click | Disable re-submit for 60s with countdown |

---

## 🟡 P2 — Polish / nice-to-have (26 items, abridged)

Notable patterns (full list in agent reports):

- **Audio/haptic over-firing in `/play`** — `vibrate()` triggered on every action (line 444-449); throttle to max 1/600ms
- **`DeathRevealCinematic` always mounts image** even when no death (returns null after); add `useMemo` for lookup
- **`StepRoles roles-step-sticky`** loses position on step swap (fixed by Phase 1 of create-stutter prompt, verify)
- **Tutorial `STORAGE_KEY_COMPLETED` set but never read** — either remove or use as `/play` gating
- **Tutorial no "Skip to end"** button — forced minimum 5 clicks
- **Tutorial doesn't use View Transitions API** despite project convention
- **`/offline` interval polling** runs even when tab hidden; listen to `online` event only
- **`/friends` requires session** but only reads localStorage — false auth gate
- **Role detail modal doesn't trap focus or lock background scroll**
- **`redirect("/roles")` loses query string** (e.g., `?team=town` filter)
- **`<output>` element missing** on lobby code seal (the room code is the page's point)
- **`navigator.share` AbortError not differentiated** from API-unsupported
- **Password show/hide toggle missing** on all auth forms (a11y antipattern)
- **`safeRedirect` allows `/api/...` paths** — open-redirect vector
- **Error message inconsistency** — 6+ different "Грешка при …" phrasings; needs `formatBgError(code)` helper
- **`aria-busy` missing** on submitting CTAs (screen reader confusion)
- **`localStorage` writes lack try/catch** for iOS Safari private mode (QuotaError)
- **`router.refresh()` after every mutation** — slow on poor connection; use optimistic UI
- **History client-side filter ungated** — no debounce, no URL state, lost on refresh
- **`AccountHero` avatar** has no upload pipeline despite UI hinting one might exist

---

## 🏗️ CSS architecture findings

### Quantitative

| Metric | Value |
|---|---|
| `globals.css` total lines | **19,408** |
| Raw size | **436 KB** |
| Built (.next/static) | **362 KB** (no per-route splitting) |
| `html[data-theme="light"]` selectors | **282** |
| Heavy filter usages (`filter:`, `backdrop-filter:`) | **49 + 26 = 75** |
| `box-shadow` rules with ≥3 layers | **62 (of 229 total)** |
| Always-on `animation: ... infinite` | **7** |
| `@keyframes` definitions | **42** |
| Distinct `*-shell` wrapper classes | **33** |
| Confirmed dead selectors (truly unused) | **49** |
| Estimated savings if all addressed | **~80-120 KB raw** |

### Dead selectors (top samples, full list in agent report)

`auth-card`, `auth-input`, `auth-mode-switch`, `auth-orbit`, `auth-side`, `auth-stage` (`globals.css:5086–5189`), `code-seal`, `cue-silent`, `invite-scene-card`, `mode-choice-card/grid` (`:1735–1850`), `quickstart-block` (`:3422`), `quickstart-winner-active/mark`, `play-players-panel-desktop/mobile`, `first-game-flow` (`:1926–1973`), `winner-banner` (`:2667–2712`), `landing-rules-card` (`:3136`), `landing-tableau` (`:1719`), `landing-live-strip` (`:1975`), `mayor-codex-card` (`:5064`), `lobby-invite-card/preset-card`, `report-section/-head/-kicker/-lede`, `leaderboard-list/rank/row`, `seat-avatar/card`.

### Strategic refactor (long-term)

1. **CSS Layers + route-scoped CSS modules**

   Current: 362 KB ships on every route. Target:
   - `@layer tokens` — `:root`, theme variables (~5 KB)
   - `@layer chrome` — `site-chrome`, footer, dropdowns (~15 KB)
   - `@layer shell` — unified `legal-shell`, `auth-shell` (~25 KB)
   - Per-route `.module.css`: `play`, `lobby`, `report`, `status`, `achievements`, `faq`, `tutorial`, `sign-in` — each 5-20 KB scoped

   **Expected**: 200+ KB initial CSS → ~80-100 KB.

2. **Tokenized chrome system**

   Define 3 canonical wrappers: `<PaperCard>`, `<FramedShell>`, `<ParchmentCard>` with design tokens (`--card-bg`, `--card-border`, `--card-shadow`, `--card-accent`). The 33 `*-shell` variants become component props. Stops architectural drift — each new page no longer accrues new chrome classes.

3. **Migrate `html[data-theme="light"]` selectors to CSS variables**

   282 `html[data-theme="light"] .X { ... }` blocks → unified into ~30 CSS variables overridden once at `:root[data-theme="light"]`. Drops 6 KB + drastically faster theme toggle style recalc.

---

## 🔥 Quick wins (≤30 minutes each, recoups ≥30% of waste)

1. **Delete 49 confirmed dead CSS selectors** — ~15-20 KB raw, ~4 KB gzipped
2. **`AuthChip` and `ToastHost` → `dynamic({ ssr: false })`** — saves ~6-10 KB initial chunk on every route
3. **`@colyseus/sdk` lazy-import only in `play-room-client.tsx`** — saves ~30-60 KB gzipped on every non-game route
4. **Remove `play-room-client.tsx` players panel duplication** — halves Colyseus update cost on every game
5. **Fix `ALLOW_DEV_AUTH` to opt-in** — closes P0 security gap with 1-line change
6. **Add `getLeaderboardRows` SQL `LIMIT 30`** — closes P0 data scaling cliff
7. **Wrap heavy `/play` panels in `React.memo`** — `<PlayerTile>`, `<PhaseGuide>`, `<NarratorDesk>` — biggest INP impact in game

---

## 📅 Recommended roadmap (3 sprints)

### Sprint 1 — Security + show-stoppers (1 week)

- [ ] P0-B1: `ALLOW_DEV_AUTH` opt-in
- [ ] P0-B2: Nonce tracking for game tokens + client-collision handling
- [ ] P0-D1: `getLeaderboardRows` SQL LIMIT + index
- [ ] P0-F6: Typed confirmation for GDPR delete
- [ ] P0-F5: Decide lobby UX — real-time presence or rename
- [ ] B1.1: `persistQueue` flush on dispose
- [ ] B1.4: Explicit cleanup on `onDispose`

### Sprint 2 — `/play` perf overhaul (2 weeks)

- [ ] P0-F1: Single-mount players panel
- [ ] P0-F2: Merge double `.game-shell::before`
- [ ] P0-F3: Slice state, `React.memo` heavy panels
- [ ] P0-F4: Targeted reduced-motion guards for high-amplitude animations
- [ ] F1.x: Phase transition overlay split, single timer hook, PlayerTile memo, sprite update guards
- [ ] F1.7: Reconnect UX modal with retry
- [ ] Bundle: lazy `@colyseus/sdk`

### Sprint 3 — Architecture + polish (1-2 weeks)

- [ ] CSS: delete 49 dead selectors
- [ ] CSS: migrate `html[data-theme="light"]` to CSS variables
- [ ] CSS: split into CSS Layers + per-route modules (incremental)
- [ ] Bundle: `AuthChip`, `ToastHost`, `WelcomeModal`, `CookieBanner` → dynamic
- [ ] BD4: parallel server fetches on `/account` + `unstable_cache`
- [ ] BD5: remove `/achievements` double waterfall
- [ ] BD6: history pagination
- [ ] AX1-AX4: auth flow polish (pending state, error mapping, rate-limit feedback)
- [ ] All P2 polish items

---

## 🧪 Test coverage gaps

**Frontend** — present:
- API routes: account/delete, achievements, game-token
- Components: FeedbackWidget, MainHeadline, LobbyWizard, OAuthButton, AuthChip, DayClueChips
- Lib: history-highlights, leaderboard-headlines, room-options, sound

**Frontend** — missing critical:
- `play-room-client.tsx` (2728 lines, ZERO tests)
- `site-chrome.tsx` (drawer, dropdown, theme toggle logic)
- `ModeChoiceCards`, `FaqHearth`, `ManualRoleBuilder`
- E2E / integration tests entirely absent

**Backend** — missing critical:
- `applyPendingVampireBites` multi-round flow
- `getPrivateChatRecipients` cross-faction edge cases (mafia × vampire × werewolves)
- `extendTimerByNarrator` clamp (10..600s)
- `persistQueue` backpressure behavior
- Replay-attack defense (doesn't exist yet)
- `submitNightAction` from disconnected clients
- Race conditions test exists but only 77 lines

---

## 🌐 Cross-cutting patterns

1. **Error messages are inconsistent** — 6+ phrasings of "Грешка при …". Build `formatBgError(code)` helper in `lib/`.
2. **`router.refresh()` after every mutation** — slow on poor connections. Use optimistic UI + reconciliation on conflict.
3. **`localStorage` access not guarded** — iOS Safari private mode throws `QuotaError`. Extract `safeLocalStorage` helper.
4. **No `password show/hide` toggle** on any auth form. A11y antipattern.
5. **`aria-busy` missing** on submitting CTAs.
6. **`safeRedirect` allows `/api/...` paths** — open-redirect vector via `?redirect=/api/account/export`.
7. **`session.user.name` fallback to single initial** in 3+ places — better to use first 2 letters of email.
8. **Image strategy mixed** — most uses `next/image`, but `RoleArt` uses raw `<img>` with `onError`. Standardize.
9. **Modal pattern absent** — multiple inline "danger zones" instead of `<dialog>` with focus trap.
10. **Service worker caches static shell** but not `/tutorial`, `/faq`, `/sign-in` — these would be high-value offline.

---

## 🚨 What this audit did NOT cover (future work)

- Database query analysis (no schema dump inspected, no `EXPLAIN ANALYZE` runs)
- Performance under load (no synthetic load test)
- Real Lighthouse / WebPageTest runs on production-built artifact
- SEO meta audit beyond cursory inspection
- Email deliverability / DKIM / SPF
- WebSocket reconnect storm under network partition
- Mobile real-device testing (iPhone Safari, Android Chrome)
- Cumulative Layout Shift (CLS) measurements per route
- Bundle visualization (`@next/bundle-analyzer` not installed)
- Accessibility — only spot-checked; full WCAG 2.2 sweep needed

---

## 📂 Next steps

Each P0 + P1 finding can become its own focused Codex prompt following the existing `codex-prompt-*.md` pattern. Suggested grouping:

1. **`codex-prompt-play-room-perf-overhaul.md`** — combine P0-F1, F2, F3, F4 + all F1.x
2. **`codex-prompt-backend-security-hardening.md`** — combine P0-B1, B2 + B1.1, B1.3, B1.4, B1.6, B1.7
3. **`codex-prompt-css-architecture-split.md`** — strategic CSS refactor
4. **`codex-prompt-bundle-lazy-loading.md`** — BD1, BD2, BD3, AuthChip, ToastHost, etc.
5. **`codex-prompt-data-scaling.md`** — P0-D1 (leaderboard SQL) + BD6 (history pagination)
6. **`codex-prompt-account-gdpr-polish.md`** — P0-F6 + AX2 (data export feedback)
7. **`codex-prompt-auth-flow-polish.md`** — AX1, AX3, AX4 + cross-cutting auth issues
8. **`codex-prompt-lobby-realtime.md`** — P0-F5 (lobby as real-time or rename)

Each prompt scoped to ~3-10 commits, ~30 min to 2 hours Codex work. Total roadmap = 8 PRs, ~3-4 weeks calendar with single Codex pipe.
