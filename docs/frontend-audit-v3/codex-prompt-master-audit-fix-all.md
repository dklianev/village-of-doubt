# Codex master prompt — Fix all v2 audit findings

**Source of truth**: `docs/frontend-audit-v3/findings-full-app-audit-v2.md`

**Scope**: Every P0 + P1 + selected P2 issue from the v2 audit. Organized into **4 sequential phases** that can be run independently. Each phase is a coherent deliverable; if you only complete Phase 1, that's still a meaningful PR.

**Total scope**: ~54 atomic English commits, ~20 hours Codex work at high reasoning. No new npm dependencies. 1 minor schema change (game-token nonce store).

**Critical operating rules**:
1. **Phase-by-phase ordering matters.** Privacy/security FIRST. Then /play. Then Lobby. Then polish.
2. **Validate after every commit**: `pnpm regression && pnpm typecheck && pnpm build`. If any goes red, revert and reassess.
3. **Bulgarian only** for user-facing strings. Commit messages in English.
4. **No `prefers-reduced-motion` guards** anywhere — project convention (ambient effects are intentional).
5. **Cite line numbers from current `main`** when applying diffs — file shapes may have shifted from v2 snapshot.
6. **Run `bg-copy-reviewer` agent** after each phase that touches user copy.
7. **Run `role-mechanics-reviewer` agent** after game-server changes.
8. If you must split a stage further, do it — atomic commits beat one mega-commit.
9. If a stage fails after 2 attempts, **stop and document** in `audit-v3/blocked-items.md`. Don't push broken code.

---

# PHASE 1 — Privacy & Security (Sprint A)

**Goal**: Close all 9 P0 issues. This is the ship-blocker phase. Must land before any public launch.

**Scope**: 12 atomic commits, ~4 hours Codex work.

## Stage 1.1 — Replay page privacy guard (P0-V2-1) 🚨

**The most serious issue.** Currently `/history/[gameId]/replay` is publicly accessible and renders events with `visibility="private"/"faction"/"moderator"` to ANY viewer. This leaks secret roles, mafia signals, witch potions, etc.

**File**: `apps/web/app/history/[gameId]/replay/page.tsx`

### Step 1.1a — Add session gate + participant check

```diff
+ import { requireSession } from "@/lib/require-session";
  // ... existing imports

  export default async function ReplayPage({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;
+   const session = await requireSession(`/history/${gameId}/replay`);
    const replay = await loadReplay(gameId);
    if (!replay) {
      notFound();
    }

+   // Determine if current viewer participated in this game
+   const wasParticipant = replay.players.some((p) => p.userId === session.user.id);

-   const timeline = await getGameTimeline(db, replay.game.id, 300);
+   const timeline = await getGameTimeline(db, replay.game.id, 300, {
+     visibilityFilter: wasParticipant ? "all" : "public",
+   });

    return (
      // ... existing render
    );
  }
```

### Step 1.1b — Update `getGameTimeline` to filter by visibility

**File**: `packages/database/src/queries.ts` (or wherever `getGameTimeline` lives)

```diff
- export async function getGameTimeline(db: Database, gameId: string, limit: number) {
+ export async function getGameTimeline(
+   db: Database,
+   gameId: string,
+   limit: number,
+   options: { visibilityFilter?: "all" | "public" } = {},
+ ) {
+   const visibilityFilter = options.visibilityFilter ?? "all";
    return db.select(/* ... */)
      .where(eq(gameEvents.gameId, gameId))
+     .where(visibilityFilter === "public" ? eq(gameEvents.visibility, "public") : undefined)
      .orderBy(gameEvents.at)
      .limit(limit);
  }
```

(Adjust to Drizzle/your ORM syntax. The key point: non-participants get ONLY `visibility="public"` events.)

### Step 1.1c — Add E2E test for privacy

Create `apps/web/app/history/[gameId]/replay/__tests__/replay-privacy.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("replay privacy", () => {
  it("filters private events for non-participants", async () => {
    // Fetch /history/<gameId>/replay as non-participant
    // Assert: timeline contains 0 events with visibility !== "public"
  });

  it("shows full timeline to participant", async () => {
    // Fetch as participant
    // Assert: timeline contains private/faction/moderator events
  });
});
```

### Commit 1
```
fix(history): gate replay behind session + filter private events for non-participants
```

---

## Stage 1.2 — `/create` route session gate (P0-V2-2)

**File**: `apps/web/app/create/page.tsx`

```diff
  import type { Metadata } from "next";
  import { LobbyCreateClient } from "@/components/lobby-create-client";
+ import { requireSession } from "@/lib/require-session";
  import { GAME_MODE_DEFINITIONS, getGameFamily, type GameMode } from "@werewolf/shared";

  export default async function CreatePage({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
    const params = await searchParams;
    const initialMode = parseMode(params?.mode);
+   const redirectTo = params?.mode ? `/create?mode=${encodeURIComponent(params.mode)}` : "/create";
+   await requireSession(redirectTo);

    return (
      <main className="shell lobby-shell" data-theme={getGameFamily(initialMode)}>
        <LobbyCreateClient initialMode={initialMode} />
      </main>
    );
  }
```

### Commit 2
```
fix(create): require session for /create route with redirect preservation
```

---

## Stage 1.3 — `/stats` room code hashing (P0-V2-3)

**File**: `apps/game-server/src/rooms/GameRoom.ts`

Locate `getRuntimeStats()` (~line 95) and `recentEndings` push site:

```diff
+ import { createHash } from "node:crypto";
+
+ function hashRoomCode(code: string): string {
+   return createHash("sha256").update(code).digest("hex").slice(0, 8);
+ }
+
  static getRuntimeStats() {
    /* ... existing byFamily logic ... */
    return {
      activeRooms: GameRoom.liveRooms.size,
      connectedPlayers: [...].reduce(...),
      byFamily,
-     recentEndings: GameRoom.recentEndings.slice(),
-     lastWinner: GameRoom.recentEndings[0] ?? null,
+     recentEndings: GameRoom.recentEndings.map((e) => ({
+       ...e,
+       code: hashRoomCode(e.code),
+     })),
+     lastWinner: GameRoom.recentEndings[0]
+       ? { ...GameRoom.recentEndings[0], code: hashRoomCode(GameRoom.recentEndings[0].code) }
+       : null,
    };
  }
```

Adjust frontend `RecentEndingsCard` if it ever tries to link to room codes — it shouldn't (codes are post-game and useless), but verify with grep.

### Commit 3
```
fix(stats): hash room codes in public /stats payload (prevent enumeration)
```

---

## Stage 1.4 — ALLOW_DEV_AUTH opt-in (P0-B1)

**File**: `apps/game-server/src/rooms/GameRoom.ts:181`

```diff
- const allowDevAuth = process.env.ALLOW_DEV_AUTH !== "false" && process.env.NODE_ENV !== "production";
+ const allowDevAuth =
+   process.env.ALLOW_DEV_AUTH === "true" && process.env.NODE_ENV !== "production";
```

**File**: `.env.example`

```diff
- ALLOW_DEV_AUTH=true
+ # ALLOW_DEV_AUTH=true   # uncomment ONLY for local dev; never set in production
```

**File**: `docker-compose.yml` — verify `ALLOW_DEV_AUTH: "false"` is set explicitly (already is per audit).

### Commit 4
```
fix(security): flip ALLOW_DEV_AUTH to opt-in default
```

---

## Stage 1.5 — Game-token nonce tracking (P0-B2)

**File**: `apps/game-server/src/rooms/GameRoom.ts`

Add static nonce store:

```diff
  export class GameRoom extends Room<{ state: GameState }> {
    private static liveRooms = new Set<GameRoom>();
+   // Nonce tracking — prevents JWT replay within token TTL
+   private static usedNonces = new Map<string, number>(); // nonce → expiresAt epoch ms
+   private static nonceJanitorInterval: ReturnType<typeof setInterval> | undefined;
+
+   static {
+     // Sweep expired nonces every 60s to bound memory
+     GameRoom.nonceJanitorInterval = setInterval(() => {
+       const now = Date.now();
+       for (const [nonce, exp] of GameRoom.usedNonces) {
+         if (exp < now) GameRoom.usedNonces.delete(nonce);
+       }
+     }, 60_000);
+   }
```

Update `onAuth` to consume nonce:

```diff
    if (options.token) {
      const payload = verifyGameToken(options.token, getGameTokenSecret(), { roomCode: this.state.code });
+     if (GameRoom.usedNonces.has(payload.nonce)) {
+       throw new Error("Този токен е вече използван.");
+     }
+     GameRoom.usedNonces.set(payload.nonce, payload.expiresAt);
      return { userId: payload.userId, displayName: payload.displayName };
    }
```

Also tighten same-user join collision:

```diff
  onJoin(client: Client, options: JoinRoomOptions, auth: ClientAuth) {
+   const existingClient = this.clientsByUserId.get(auth.userId);
+   if (existingClient && existingClient.sessionId !== client.sessionId) {
+     existingClient.send("safe_error", { messageBg: "Влязохте от друго устройство." });
+     existingClient.leave(1000);
+   }
    this.clientsByUserId.set(auth.userId, client);
    // ... rest unchanged
```

### Commit 5
```
feat(security): add nonce store for game-token replay prevention
```

---

## Stage 1.6 — Leaderboard SQL aggregation (P0-D1 + SV-1)

**File**: `packages/database/src/queries.ts` (locate `getLeaderboardRows`)

Currently fetches with `.limit(500)` then JS aggregates. Replace with SQL aggregation grouped by `userId` (not `displayName`):

```diff
  export async function getLeaderboardRows(db: Database) {
-   const rows = await db.select(/*...*/).from(games)
-     .leftJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
-     .where(eq(games.status, "finished"))
-     .limit(500);
-   // ... JS aggregation by displayName
+   // SQL aggregation by userId — prevents merging users with same display name
+   return db
+     .select({
+       userId: gamePlayers.userId,
+       displayName: sql<string>`MAX(${gamePlayers.displayName})`.as("displayName"),
+       gamesPlayed: sql<number>`COUNT(*)`.as("gamesPlayed"),
+       wins: sql<number>`SUM(CASE WHEN ${gamePlayers.didWin} THEN 1 ELSE 0 END)`.as("wins"),
+       lastPlayedAt: sql<Date>`MAX(${games.endedAt})`.as("lastPlayedAt"),
+     })
+     .from(gamePlayers)
+     .innerJoin(games, eq(gamePlayers.gameId, games.id))
+     .where(eq(games.status, "finished"))
+     .groupBy(gamePlayers.userId)
+     .orderBy(desc(sql`wins`), desc(sql`gamesPlayed`))
+     .limit(30);
  }
```

Adjust SQL syntax to Drizzle's actual API. Also add migration for index if missing:

```sql
CREATE INDEX IF NOT EXISTS games_status_endedat_idx ON games (status, ended_at DESC);
CREATE INDEX IF NOT EXISTS gameplayers_userid_idx ON game_players (user_id);
```

### Commit 6
```
perf(leaderboard): SQL aggregation by userId with LIMIT 30, add indexes
```

---

## Stage 1.7 — GDPR delete typed confirmation (P0-F6)

**File**: `apps/web/components/account/AccountDangerZone.tsx`

Replace simple 2-click flow with `<dialog>` + typed confirmation:

```tsx
"use client";
import { useState, useRef, useEffect } from "react";

export function AccountDangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const canDelete = confirmText.trim().toUpperCase() === "ИЗТРИЙ";

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  async function handleDelete() {
    if (!canDelete) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (res.ok) {
        window.location.href = "/sign-in?deleted=1";
      } else {
        // error toast
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <section className="account-danger-zone">
      <h3>Опасна зона</h3>
      <p>Изтриването е необратимо. Всичките ти игри, постижения и съобщения изчезват.</p>
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
        Изтрий профила
      </button>

      <dialog ref={dialogRef} className="danger-confirm-dialog" onClose={() => setOpen(false)}>
        <h4>Сигурен ли си?</h4>
        <p>За потвърждение напиши думата <strong>ИЗТРИЙ</strong> по-долу.</p>
        <p className="danger-confirm-email">Профил: <strong>{email}</strong></p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="ИЗТРИЙ"
          aria-label="Напиши ИЗТРИЙ за потвърждение"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <div className="danger-confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Отказ
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canDelete || submitting}
            aria-busy={submitting}
            onClick={handleDelete}
          >
            {submitting ? "Изтриваме…" : "Изтрий завинаги"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
```

CSS for `.danger-confirm-dialog` (`globals.css`):

```css
.danger-confirm-dialog {
  border: none;
  border-radius: 18px;
  padding: 28px;
  max-width: 460px;
  background: var(--card-bg, #1a1410);
  color: var(--ink);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
}
.danger-confirm-dialog::backdrop {
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(4px);
}
.danger-confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}
.danger-confirm-email {
  color: var(--blood);
  font-weight: 700;
}
```

### Commit 7
```
fix(account): typed confirmation modal for GDPR delete
```

---

## Stage 1.8 — Enforce `runtimeStatus: "manual_only"` server-side (BV-1)

**File**: `apps/game-server/src/rooms/GameRoom.ts`

In `onCreate` or wherever role distribution is finalized, before `setRoles`:

```diff
+ import { ROLE_DEFINITIONS, getRoleRuntimeStatus } from "@werewolf/shared";

  onCreate(options: CreateOptions) {
    GameRoom.liveRooms.add(this);
    const mode = options.mode ?? "werewolves_classic";
    const playerCount = options.playerCount ?? (mode === "mafia_sport" ? 10 : 8);
    this.config = createGameConfigFromOptions({ ...options, mode, playerCount });

+   // Strip manual_only roles unless narratorMode === "full_human"
+   if (this.config.narratorMode !== "full_human") {
+     for (const [role, count] of Object.entries(this.config.roles)) {
+       if (count && getRoleRuntimeStatus(role as RoleCode) === "manual_only") {
+         delete this.config.roles[role as RoleCode];
+       }
+     }
+   }

    this.setState(new GameState());
    /* ... rest ... */
  }
```

Add test in `apps/game-server/src/__tests__/`:

```ts
it("strips manual_only roles when narratorMode is not full_human", async () => {
  const room = new GameRoom();
  await room.onCreate({
    mode: "werewolves_classic",
    narratorMode: "automatic",
    roles: { stray_cat: 1, guard_dog: 1, ordinary_villager: 5 },
  });
  expect(room.config.roles.stray_cat).toBeUndefined();
  expect(room.config.roles.guard_dog).toBeUndefined();
});
```

### Commit 8
```
fix(game-server): enforce runtimeStatus manual_only requires full_human narrator
```

---

## Stage 1.9 — Revert `.env.example` to placeholder (BV-4)

**File**: `.env.example`

```diff
- RESEND_FROM=Върколак и Мафия <noreply@tisi.lol>
+ RESEND_FROM=Върколак и Мафия <noreply@example.com>

- PUBLIC_WEB_DOMAIN=tisi.lol
- PUBLIC_WS_DOMAIN=ws.tisi.lol
- CORS_ORIGIN=https://tisi.lol
- # In production also set:
- # BETTER_AUTH_URL=https://tisi.lol
- # NEXT_PUBLIC_APP_URL=https://tisi.lol
- # NEXT_PUBLIC_GAME_SERVER_URL=wss://ws.tisi.lol
+ PUBLIC_WEB_DOMAIN=werewolf.example.com
+ PUBLIC_WS_DOMAIN=ws.werewolf.example.com
+ CORS_ORIGIN=https://werewolf.example.com
+ # In production also set:
+ # BETTER_AUTH_URL=https://werewolf.example.com
+ # NEXT_PUBLIC_APP_URL=https://werewolf.example.com
+ # NEXT_PUBLIC_GAME_SERVER_URL=wss://ws.werewolf.example.com
```

Real production values go in `.env.production` (gitignored) or environment.

### Commit 9
```
chore(env): revert real production domain to placeholder in .env.example
```

---

## Stage 1.10 — persistQueue bounded + flush on dispose (B1.1)

**File**: `apps/game-server/src/rooms/GameRoom.ts`

```diff
  export class GameRoom extends Room<{ state: GameState }> {
    private persistQueue: Promise<void> = Promise.resolve();
+   private persistQueueLength = 0;
+   private static MAX_PENDING_PERSIST = 50;
+
+   private enqueuePersist(task: () => Promise<void>) {
+     if (this.persistQueueLength >= GameRoom.MAX_PENDING_PERSIST) {
+       console.warn(`[GameRoom ${this.state.code}] persistQueue backpressure (${this.persistQueueLength}), dropping write`);
+       return;
+     }
+     this.persistQueueLength++;
+     this.persistQueue = this.persistQueue
+       .then(task)
+       .catch((err) => console.error(`[GameRoom ${this.state.code}] persist error:`, err))
+       .finally(() => { this.persistQueueLength--; });
+   }
```

Replace all `this.persistQueue = this.persistQueue.then(...)` calls with `this.enqueuePersist(...)`.

Update `onDispose`:

```diff
  async onDispose() {
    GameRoom.liveRooms.delete(this);
    this.phaseTimer?.clear();
+
+   // Flush pending writes with timeout
+   await Promise.race([
+     this.persistQueue,
+     new Promise((resolve) => setTimeout(resolve, 3000)),
+   ]);
+
+   // Clear all references
+   this.clientsByUserId.clear();
+   this.privatePlayers.clear();
+   this.pendingNightActions.clear();
+   this.pendingVampireBites.clear();
+   this.achievementEvents.length = 0;
+   this.announcedAchievementUnlocks.clear();
+   this.announcedWitchVictims.clear();
  }
```

### Commit 10
```
fix(game-server): bound persistQueue + flush + clear all refs on dispose
```

---

## Stage 1.11 — `autoAdvanceWhenReady` only for manual tempo (BV-2)

**File**: `packages/shared/src/game-config.ts:255-280` (or `normalizePhaseTimers`)

```diff
  export function normalizePhaseTimers(
    base: PhaseTimers,
    customTimers: Partial<PhaseTimers> | undefined,
+   tempoProfile: TempoProfile,
  ): PhaseTimers {
    if (!customTimers) return base;
+   const isManual = tempoProfile === "manual";
    return {
      ...base,
      dayDiscussionSeconds: clamp(customTimers.dayDiscussionSeconds ?? base.dayDiscussionSeconds, 5, 900),
      // ... other timer clamps
-     autoAdvanceWhenReady: customTimers.autoAdvanceWhenReady ?? base.autoAdvanceWhenReady,
+     autoAdvanceWhenReady: isManual
+       ? (customTimers.autoAdvanceWhenReady ?? base.autoAdvanceWhenReady)
+       : base.autoAdvanceWhenReady,
    };
  }
```

Update callers to pass `tempoProfile`.

### Commit 11
```
fix(game-config): ignore autoAdvanceWhenReady for non-manual tempo profiles
```

---

## Stage 1.12 — Verification & a11y polish for Phase 1

Add `aria-busy` to all submit buttons in auth/account/danger-zone (cross-cutting v1 finding). Run `bg-copy-reviewer` on changed files. Run `role-mechanics-reviewer` on `GameRoom.ts`.

### Commit 12
```
chore(a11y): aria-busy on submit buttons across auth/account flows
```

**Phase 1 complete.** Privacy + security locked. Ship-ready.

---

# PHASE 2 — /play game room overhaul (Sprint B)

**Goal**: Convert the 2728-line monolith into a maintainable, performant component tree. Halve Colyseus update cost. Add reconnect UX.

**Scope**: 14 atomic commits, ~6 hours Codex work.

## Stage 2.1 — Single-mount players panel (P0-F1)

**File**: `apps/web/components/play-room-client.tsx:897, 1011`

Extract `<PlayersPanel>` to a separate component. Mount once. Use CSS to switch positioning (mobile vs desktop).

```tsx
// apps/web/components/play/PlayersPanel.tsx (new)
"use client";
import { memo } from "react";
import type { PlayerSnapshot } from "...";

interface Props {
  players: PlayerSnapshot[];
  currentUserId: string;
  onPlayerClick?: (userId: string) => void;
  variant: "mobile" | "desktop"; // CSS variant only — same data
}

export const PlayersPanel = memo(function PlayersPanel({ players, currentUserId, onPlayerClick, variant }: Props) {
  return (
    <aside className={`players-panel players-panel--${variant}`} data-variant={variant}>
      {players.map((p) => (
        <PlayerTile key={p.userId} player={p} isMe={p.userId === currentUserId} onClick={onPlayerClick} />
      ))}
    </aside>
  );
}, arePlayerListsEqual);

function arePlayerListsEqual(a: Props, b: Props): boolean {
  if (a.variant !== b.variant || a.currentUserId !== b.currentUserId) return false;
  if (a.players.length !== b.players.length) return false;
  for (let i = 0; i < a.players.length; i++) {
    if (!arePlayersEqual(a.players[i], b.players[i])) return false;
  }
  return true;
}

function arePlayersEqual(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  return a.userId === b.userId
    && a.connected === b.connected
    && a.ready === b.ready
    && a.hasVoted === b.hasVoted
    && a.actedThisPhase === b.actedThisPhase
    && a.alive === b.alive
    && a.host === b.host;
}
```

Replace both render sites in play-room-client.tsx:

```diff
- {renderPlayersPanel("mobile")}
- {renderPlayersPanel("desktop")}
+ <PlayersPanel
+   players={players}
+   currentUserId={user.id}
+   onPlayerClick={handlePlayerClick}
+   variant={useMediaQuery("(min-width: 1024px)") ? "desktop" : "mobile"}
+ />
```

Or use a CSS-only switch with `data-variant` + media query toggling positioning. Either way: **one mount**.

### Commit 13
```
refactor(play): extract PlayersPanel as memoized single-mount component
```

---

## Stage 2.2 — Merge double `.game-shell::before` (P0-F2)

**File**: `apps/web/app/globals.css`

Find both definitions (`:1133` and `:5995`). Decide which behavior is intended (full-viewport cover background OR small fixed orb). Delete the other. Likely keep the cover background, delete the orb.

Move backgrounds into a dedicated `<div className="game-shell-backdrop" aria-hidden />` rendered inside `<main>` for cleaner control. Phase-art swap should crossfade two layers, not `background-image` swap.

### Commit 14
```
fix(play): merge double .game-shell::before, use dedicated backdrop element
```

---

## Stage 2.3 — State slicing for Colyseus deltas (P0-F3)

**File**: `apps/web/components/play-room-client.tsx`

Split monolithic `snapshot` into slices. Use `useSyncExternalStore` per slice OR multiple `useState` per concern:

```tsx
// Before: single setSnapshot per delta
const [snapshot, setSnapshot] = useState<RoomSnapshot>(initial);

// After: sliced
const [playersSlice, setPlayersSlice] = useState(initial.players);
const [phaseSlice, setPhaseSlice] = useState({ phase: initial.phase, phaseEndsAt: initial.phaseEndsAt, round: initial.round });
const [voteSlice, setVoteSlice] = useState(initial.voteTally);
const [chatSlice, setChatSlice] = useState(initial.publicChat);

room.onStateChange((state, changes) => {
  // Diff each slice; only set if changed
  startTransition(() => {
    const nextPlayers = mapPlayers(state.players);
    if (!arePlayerListsEqual(playersSlice, nextPlayers)) setPlayersSlice(nextPlayers);

    const nextPhase = { phase: state.phase, phaseEndsAt: state.phaseEndsAt, round: state.round };
    if (!arePhaseSlicesEqual(phaseSlice, nextPhase)) setPhaseSlice(nextPhase);

    if (state.voteTally.changed) setVoteSlice(mapVotes(state.voteTally));
    if (state.publicChat.changed) setChatSlice(mapChat(state.publicChat));
  });
});
```

This is a substantial refactor; consider splitting into smaller commits per slice.

### Commit 15-17 (3 commits)
```
refactor(play): slice game state into players/phase/votes/chat
refactor(play): only set slices that actually changed (skip identity-equal)
test(play): add tests for slice equality fns
```

---

## Stage 2.4 — Memoize `createOptions` (PV-1)

**File**: `apps/web/components/play-room-client.tsx:179, 327`

```diff
- export function PlayRoomClient({ code, user, createOptions }: Props) {
+ export function PlayRoomClient({ code, user, createOptions: createOptionsRaw }: Props) {
+   const createOptions = useMemo(() => createOptionsRaw, [code, createOptionsRaw.mode, createOptionsRaw.playerCount]);
    // ...
  }
```

Or accept that createOptions is a server-passed prop that shouldn't change without remount → use the prop directly but verify `useEffect` deps don't include it.

### Commit 18
```
fix(play): memoize createOptions to prevent WebSocket reconnect storms
```

---

## Stage 2.5 — useCallback shortcuts with ref pattern (PV-2)

**File**: `apps/web/components/play-room-client.tsx:457-479, 634-646`

```tsx
// Stable callback via ref
const stateRef = useRef({ room, phase, selectedTargetId });
useEffect(() => {
  stateRef.current = { room, phase, selectedTargetId };
});

const submitCurrentShortcutAction = useCallback(() => {
  const { room, phase, selectedTargetId } = stateRef.current;
  // ... existing logic
}, []); // empty deps — pulls from ref

useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* uses submitCurrentShortcutAction */ };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [submitCurrentShortcutAction]); // now stable, listener bound once
```

### Commit 19
```
perf(play): stable keyboard shortcut callbacks via ref pattern
```

---

## Stage 2.6 — PhaseTransitionOverlay only on real phase change (PV-3)

**File**: `apps/web/components/play-room-client.tsx:830, 1073`

```diff
- <PhaseTransitionOverlay key={`${phase}-${pulseKey}`} phase={phase} />
+ {hasJoinedFully && previousPhase !== phase && (
+   <PhaseTransitionOverlay phase={phase} />
+ )}
```

Where `hasJoinedFully` is a state flag set after initial snapshot resolves.

### Commit 20
```
fix(play): skip phase transition overlay on initial join / reconnect snapshot
```

---

## Stage 2.7 — Cancel `requestStartGame` setTimeout chain (PV-4)

**File**: `apps/web/components/play-room-client.tsx:487-492`

```diff
+ const startGameTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
+
+ useEffect(() => () => {
+   startGameTimers.current.forEach(clearTimeout);
+   startGameTimers.current = [];
+ }, []);

  function requestStartGame() {
-   window.setTimeout(() => { /* countdown 3 */ }, 0);
-   window.setTimeout(() => { /* countdown 2 */ }, 1000);
-   window.setTimeout(() => { /* fire */ }, 2000);
+   startGameTimers.current.push(setTimeout(() => { /* countdown 3 */ }, 0));
+   startGameTimers.current.push(setTimeout(() => { /* countdown 2 */ }, 1000));
+   startGameTimers.current.push(setTimeout(() => {
+     room?.send("startGame");
+   }, 2000));
  }
```

### Commit 21
```
fix(play): cancel countdown timers on unmount to prevent disposed-room calls
```

---

## Stage 2.8 — Collapse layout attributes on `<main>` (PV-5)

**File**: `apps/web/components/play-room-client.tsx:828, 836`

```diff
- <main className={`framed-shell shell game-shell play-shell phase-${phase}`} data-phase={phase} data-theme={family} data-family={family}>
+ <main className="framed-shell shell game-shell play-shell" data-phase={phase} data-family={family}>
```

Update CSS to use `[data-phase="night"]` instead of `.phase-night` (already mostly does). Drop `data-theme` (it's set on `<html>` already).

### Commit 22
```
refactor(play): consolidate layout attributes on game-shell main
```

---

## Stage 2.9 — Reconnect modal with sessionId persistence (F1.7)

**File**: `apps/web/components/play-room-client.tsx`

Persist `room.sessionId` in `sessionStorage` keyed by room code. On `onLeave`, if abnormal close, attempt `colyseusClient.reconnect(sessionId)` with exponential backoff (1s, 2s, 4s, 8s). Show modal with manual retry button.

```tsx
const [connState, setConnState] = useState<"connecting" | "connected" | "reconnecting" | "lost">("connecting");
const sessionIdRef = useRef<string | null>(null);

useEffect(() => {
  if (!room) return;
  sessionIdRef.current = room.sessionId;
  sessionStorage.setItem(`room-session:${code}`, room.sessionId);

  room.onLeave((closeCode) => {
    if (closeCode === 1000 || closeCode === 1001) {
      setConnState("lost"); // graceful close
      return;
    }
    setConnState("reconnecting");
    attemptReconnect();
  });
}, [room]);

async function attemptReconnect(attempt = 1) {
  if (attempt > 5) {
    setConnState("lost");
    return;
  }
  const delay = Math.min(8000, 1000 * 2 ** (attempt - 1));
  await new Promise((r) => setTimeout(r, delay));
  try {
    const reconnected = await colyseusClient.reconnect(sessionIdRef.current!);
    setRoom(reconnected);
    setConnState("connected");
  } catch {
    attemptReconnect(attempt + 1);
  }
}
```

UI: render `<ReconnectModal state={connState} onRetry={() => attemptReconnect(1)} />` when `connState === "reconnecting"` or `"lost"`.

### Commit 23-24
```
feat(play): persist sessionId for reconnect attempts
feat(play): reconnect modal with exponential backoff and manual retry
```

---

## Stage 2.10 — Misc polish (F1.x batch)

Single commit batching small fixes:

1. **F1.1** — Lower `backdrop-filter: blur(8px)` to `blur(4px)` on `.phase-transition-overlay`
2. **F1.3** — Single `useTimerCountdown(endsAt)` hook, reuse in phase-hero + NarratorDesk
3. **F1.4** — PlayerTile React.memo with custom comparator (already done in Stage 2.1)
4. **F1.5** — `.player-token::before` add `will-change: background-position` only when transitioning state
5. **F1.6 / Vote bar** — Drop the keyframe animation, keep only the transition (`globals.css:11561-11569`)
6. **PV-6** — AchievementUnlockModal Escape + focus trap (covered in Stage 3.6 shared modal)
7. **PV-7** — Dynamic-import lucide icons used only in modals/sheets
8. **PV-8** — PlayerTokensSkeleton render only in active variant (covered by Stage 2.1)
9. **PV-9** — `useMemo` for `fullNarratorAccepted`
10. **PV-10** — Status clear only when status is "connected"/"lobby" placeholder

### Commit 25-26
```
perf(play): blur reduction, single timer hook, sprite update guards, vote bar dedup
perf(play): useMemo for derived flags, status clear guard, lucide lazy imports
```

**Phase 2 complete.** `/play` should now be 2× faster on Colyseus updates and have proper reconnect UX.

---

# PHASE 3 — Lobby architecture polish (Sprint C)

**Goal**: Decompose `lobby-form.ts` and `StepRoom.tsx`, replace fragile BG-substring validation, add `aria-live`, introduce shared `useModal` hook.

**Scope**: 10 atomic commits, ~4 hours Codex work.

## Stage 3.1 — Split `lobby-form.ts` (LC-1)

**File**: `apps/web/lib/lobby-form.ts` (698 lines)

Create directory `apps/web/lib/lobby-form/`:
- `apps/web/lib/lobby-form/types.ts` — interfaces, action types
- `apps/web/lib/lobby-form/reducer.ts` — pure reducer
- `apps/web/lib/lobby-form/selectors.ts` — `currentConfig`, `roleWarnings`, `criticalRoleWarnings`, `estimatedDurationSeconds`, `roleBalance`
- `apps/web/lib/lobby-form/templates.ts` — `MANUAL_PRESET_STORAGE_KEY`, recipe presets
- `apps/web/lib/lobby-form/url.ts` — `hrefForState`, `initialState` from URL params
- `apps/web/lib/lobby-form/index.ts` — re-exports for backward compat

Each file ~100-150 lines. No behavior changes.

### Commit 27-30 (4 commits, one per split)
```
refactor(lobby-form): extract types module
refactor(lobby-form): extract reducer and selectors
refactor(lobby-form): extract templates and URL helpers
refactor(lobby-form): re-export through index, remove deprecated lobby-form.ts
```

---

## Stage 3.2 — Decompose `StepRoom.tsx` (LC-2)

**File**: `apps/web/components/lobby/StepRoom.tsx` (393 lines)

Extract:
- `Field` + `RefreshIcon` → `apps/web/components/lobby/Field.tsx`
- `ManualTempoPanel` + `ManualTimerControl` → `apps/web/components/lobby/ManualTempoPanel.tsx`
- `StepRoom.tsx` becomes ~150 lines (orchestration only)

### Commit 31-32
```
refactor(lobby): extract Field component
refactor(lobby): extract ManualTempoPanel component
```

---

## Stage 3.3 — Structured warning codes (LC-3)

**File**: `apps/web/lib/lobby-form/selectors.ts` (after Stage 3.1 split)

```diff
- export function criticalRoleWarnings(state: LobbyFormState): string[] {
-   const warnings = roleWarnings(state);
-   return warnings.filter((w) => w.includes("не съвпада") || w.includes("Липсва"));
- }

+ export type WarningCode = "ROLE_COUNT_MISMATCH" | "FACTION_MISSING" | "PLAYER_COUNT_INVALID" | ...;
+ export type RoleWarning = { code: WarningCode; messageBg: string };
+
+ export function roleWarnings(state: LobbyFormState): RoleWarning[] {
+   const issues: RoleWarning[] = [];
+   const config = currentConfig(state);
+   const total = countRoles(config.roles);
+   if (total !== config.playerCount) {
+     issues.push({ code: "ROLE_COUNT_MISMATCH", messageBg: "Броят роли не съвпада с броя играчи." });
+   }
+   // ... rest
+   return issues;
+ }
+
+ export function criticalRoleWarnings(state: LobbyFormState): RoleWarning[] {
+   return roleWarnings(state).filter((w) =>
+     w.code === "ROLE_COUNT_MISMATCH" || w.code === "FACTION_MISSING"
+   );
+ }
```

Update callers to use `.messageBg` for display, `.code` for logic.

### Commit 33
```
refactor(lobby-form): structured warning codes replace BG substring matching
```

---

## Stage 3.4 — `aria-live` on form errors (LC-4)

**File**: `apps/web/components/lobby/LobbyWizard.tsx:111`

```diff
- {state.formError ? <p className="lobby-form-error">{state.formError}</p> : null}
+ {state.formError ? (
+   <p className="lobby-form-error" role="alert" aria-live="assertive">
+     {state.formError}
+   </p>
+ ) : null}
```

### Commit 34
```
a11y(lobby): aria-live on form errors for screen-reader announcement
```

---

## Stage 3.5 — useMemo for recipes and visibleRoles (LC-5, LC-8)

**File**: `apps/web/components/lobby/QuickStartRow.tsx`

```diff
+ import { useMemo } from "react";
  // ...
- const recipes = ALL_RECIPES.filter(/* ... */);
+ const recipes = useMemo(() => ALL_RECIPES.filter(/* ... */), [state.lockedFamily]);
```

**File**: `apps/web/components/lobby/StepRoles.tsx:38-43`

```diff
+ const visibleRoles = useMemo(() =>
+   getRolesForFamily(state.family).filter((role) => {
+     const def = ROLE_DEFINITIONS[role];
+     const haystack = `${def.nameBg} ${def.shortDescriptionBg} ${def.tags.join(" ")}`.toLowerCase();
+     const query = state.roleSearch.trim().toLowerCase();
+     return (query.length === 0 || haystack.includes(query))
+       && getRoleRuntimeStatus(role) === state.runtimeFilter;
+   }),
+ [state.family, state.roleSearch, state.runtimeFilter]);
- const visibleRoles = getRolesForFamily(state.family).filter(/* ... */);
```

### Commit 35
```
perf(lobby): memoize recipes and visibleRoles to skip per-render filter
```

---

## Stage 3.6 — Shared `useModal` hook (LC-7, R3, SV-6, ACDangerZone)

**File**: `apps/web/lib/use-modal.ts` (new)

```ts
import { useEffect, useRef } from "react";

export function useModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Save focus, lock body scroll
    previousActiveElement.current = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first focusable inside modal
    const focusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // Focus trap
        const focusableEls = ref.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableEls || focusableEls.length === 0) return;
        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      previousActiveElement.current?.focus();
    };
  }, [open, onClose]);

  return { ref };
}
```

Migrate consumers:
- `RoleCodexDetail` (`games/game-roles-page.tsx`)
- `RoleDetailModal` (`lobby/RoleDetailModal.tsx`)
- `AccountDangerZone` confirm dialog (Stage 1.7)
- `AchievementUnlockModal` (`play-room-client.tsx`)
- `MobileSummaryChip` overlay

### Commit 36-37
```
feat(ui): shared useModal hook with focus trap and scroll lock
refactor(modals): migrate all 5 modal consumers to useModal
```

---

## Stage 3.7 — Remove dead `displayName` (LC-6)

**File**: `apps/web/lib/lobby-form/types.ts` (after Stage 3.1)

Remove `displayName: string` from `LobbyFormState`, remove `SET_DISPLAY_NAME` action, remove initialization, remove reducer case.

### Commit 38
```
chore(lobby-form): remove dead displayName field from state
```

---

# PHASE 4 — Polish + CSS hygiene + remaining backend (Sprint D)

**Goal**: Delete dead CSS, fix all remaining P1/P2 secondary-page items, finish backend reliability work.

**Scope**: 18 atomic commits, ~6 hours Codex work.

## Stage 4.1 — Delete 46 dead CSS selectors

**File**: `apps/web/app/globals.css`

For each of the 46 confirmed dead selectors (full list in `findings-full-app-audit-v2.md` Section "Dead selectors progress"), grep to confirm zero JSX references, then delete the CSS rule blocks.

```bash
# Verification pattern:
for sel in auth-card auth-input mode-choice-card quickstart-block first-game-flow \
           winner-banner landing-rules-card landing-tableau seat-avatar seat-card; do
  count=$(grep -rn "$sel" apps/web/components apps/web/app --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "DEAD: $sel ($count JSX refs)"
  fi
done
```

Delete in CSS for all confirmed dead. Run `pnpm build` to verify no broken references. Estimated savings: 15-20 KB raw / ~4 KB gzipped.

### Commit 39-40
```
chore(css): delete 30 confirmed dead selectors (auth/mode-choice/landing batch)
chore(css): delete 16 remaining dead selectors (lobby/seat/report/leaderboard batch)
```

---

## Stage 4.2 — `useDeferredValue` + cached haystack for role search (R1)

**File**: `apps/web/components/games/game-roles-page.tsx:411-446`

```diff
+ const ROLE_HAYSTACK_CACHE = new Map<RoleCode, string>();
+
+ function getRoleHaystack(role: RoleCode): string {
+   const cached = ROLE_HAYSTACK_CACHE.get(role);
+   if (cached) return cached;
+   const def = ROLE_DEFINITIONS[role];
+   const haystack = `${def.nameBg} ${def.shortDescriptionBg} ${def.tags.join(" ")} ${role}`
+     .normalize("NFD")
+     .replace(/[̀-ͯ]/g, "")
+     .toLowerCase();
+   ROLE_HAYSTACK_CACHE.set(role, haystack);
+   return haystack;
+ }

  function matchesRoleSearch(role: RoleCode, query: string): boolean {
-   const def = ROLE_DEFINITIONS[role];
-   const haystack = `${def.nameBg}...`.toLowerCase()
-     .replaceAll("ѝ", "и").replaceAll("Ѝ", "И"); // ... 30 more replaces
-   const normalizedQuery = query.toLowerCase().replaceAll(/* same chain */);
-   return haystack.includes(normalizedQuery);
+   const haystack = getRoleHaystack(role);
+   const normalizedQuery = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
+   return haystack.includes(normalizedQuery);
  }
```

### Commit 41
```
perf(roles): cache normalized role haystack, replace 30 replaceAll calls
```

---

## Stage 4.3 — Leaderboard merge-by-userId (SV-1)

**Covered in Phase 1 Stage 1.6** — already done if Phase 1 landed. Verify and move on.

---

## Stage 4.4 — Drop `router.refresh()` from form saves (SV-3)

**File**: `apps/web/components/account/AccountProfile.tsx:89, 57`

```diff
  async function saveName(newName: string) {
    setSubmitting(true);
    try {
      await authClient.updateUser({ name: newName });
-     router.refresh();
+     // Optimistic: name is now in local state; revalidation happens on next nav
      setSavedAt(Date.now());
    } finally {
      setSubmitting(false);
    }
  }
```

Add `role="status" aria-live="polite"` to success indicator.

### Commit 42
```
fix(account): drop router.refresh, add role=status for save feedback
```

---

## Stage 4.5 — Tutorial slide debounce + skip CTA (T1, T4)

**File**: `apps/web/components/tutorial/TutorialFlipbook.tsx`

```diff
+ const urlUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
+
  function changeSlide(index: number) {
    setCurrent(index);
    window.localStorage.setItem(STORAGE_KEY_INDEX, String(index));
-   router.replace(`/tutorial?step=${index + 1}`, { scroll: false });
+   if (urlUpdateTimer.current) clearTimeout(urlUpdateTimer.current);
+   urlUpdateTimer.current = setTimeout(() => {
+     history.replaceState(null, "", `/tutorial?step=${index + 1}`);
+   }, 300);
  }
+
+ // Cleanup
+ useEffect(() => () => {
+   if (urlUpdateTimer.current) clearTimeout(urlUpdateTimer.current);
+ }, []);
```

Add "Към играта" button:

```tsx
<div className="tutorial-flipbook-nav">
  {/* ... existing prev/next/dots ... */}
  <Link href="/werewolf/create" className="btn btn-secondary tutorial-skip">
    Прескочи към игра →
  </Link>
</div>
```

### Commit 43
```
fix(tutorial): debounce URL update, add skip-to-game CTA
```

---

## Stage 4.6 — Tutorial keydown scope (SV-4)

**File**: `apps/web/components/tutorial/TutorialFlipbook.tsx:75-91`

```diff
  function onKeyDown(event: KeyboardEvent) {
+   const target = event.target as HTMLElement | null;
+   if (target?.closest("input, textarea, [contenteditable], button[data-progress]")) {
+     return;
+   }
    if (event.key === "ArrowLeft") { /* ... */ }
  }
```

### Commit 44
```
a11y(tutorial): scope keydown handler away from buttons and inputs
```

---

## Stage 4.7 — Achievements skeleton state (SV-5)

**File**: `apps/web/components/achievements-client.tsx`

```diff
  if (!loaded) {
-   return <p>Зареждаме...</p>;
+   return (
+     <div className="achievements-skeleton" aria-hidden="true">
+       {Array.from({ length: 12 }).map((_, i) => (
+         <div key={i} className="achievement-tile achievement-tile-skeleton" />
+       ))}
+     </div>
+   );
  }
```

### Commit 45
```
ux(achievements): skeleton state replaces flash-of-locked tiles
```

---

## Stage 4.8 — VerifyEmail timeout cleanup (SV-7)

**File**: `apps/web/components/auth/VerifyEmailClient.tsx`

```diff
+ useEffect(() => {
+   if (status !== "success") return;
+   const id = setTimeout(() => router.push("/"), 2000);
+   return () => clearTimeout(id);
+ }, [status, router]);
- if (status === "success") {
-   setTimeout(() => router.push("/"), 2000);
- }
```

### Commit 46
```
fix(verify-email): cancel redirect timeout on unmount
```

---

## Stage 4.9 — Sign-in error mapping (A1)

**File**: `apps/web/components/sign-in/EmailPasswordForm.tsx:49-50`

Create `apps/web/lib/auth-errors.ts`:

```ts
export function mapAuthError(code: string | undefined, fallback = "Възникна грешка."): string {
  switch (code) {
    case "USER_NOT_FOUND": return "Няма такъв профил с този имейл.";
    case "INVALID_PASSWORD": return "Грешна парола.";
    case "EMAIL_EXISTS": return "Този имейл вече има профил. Влез или ползвай 'Забравих паролата'.";
    case "WEAK_PASSWORD": return "Паролата е твърде слаба.";
    case "EMAIL_NOT_VERIFIED": return "Първо потвърди имейла си. Виж пощата.";
    case "RATE_LIMITED": return "Твърде много опити. Опитай след минута.";
    default: return fallback;
  }
}
```

Use in `EmailPasswordForm.tsx`, `ForgotPasswordClient.tsx`, `ResetPasswordClient.tsx`, `VerifyEmailClient.tsx`.

### Commit 47
```
ux(auth): centralized BG error mapping for all auth flows
```

---

## Stage 4.10 — OAuthButton pending recovery (A2)

**File**: `apps/web/components/sign-in/OAuthButton.tsx`

```diff
+ useEffect(() => {
+   if (!isPending) return;
+   const id = setTimeout(() => setIsPending(false), 15_000);
+   const onVisible = () => {
+     if (document.visibilityState === "visible") setIsPending(false);
+   };
+   document.addEventListener("visibilitychange", onVisible);
+   window.addEventListener("pageshow", () => setIsPending(false));
+   return () => {
+     clearTimeout(id);
+     document.removeEventListener("visibilitychange", onVisible);
+   };
+ }, [isPending]);
```

### Commit 48
```
fix(sign-in): reset OAuth pending state on back-nav or timeout
```

---

## Stage 4.11 — Clipboard fallback (SV-2)

**File**: `apps/web/components/lobby-invite-client.tsx:30-37`

```diff
  async function copyInvite() {
+   const url = `${window.location.origin}/lobby/${code}`;
    try {
-     await navigator.clipboard.writeText(url);
+     if (navigator.clipboard && window.isSecureContext) {
+       await navigator.clipboard.writeText(url);
+     } else {
+       // Fallback for HTTP / older browsers
+       const ta = document.createElement("textarea");
+       ta.value = url;
+       ta.style.position = "fixed";
+       ta.style.opacity = "0";
+       document.body.appendChild(ta);
+       ta.select();
+       document.execCommand("copy");
+       document.body.removeChild(ta);
+     }
      pushToast({ message: "Поканата е копирана." });
    } catch {
      pushToast({ message: "Не можахме да копираме. Опитай ръчно.", variant: "error" });
    }
  }
```

### Commit 49
```
fix(lobby): clipboard fallback via execCommand for non-secure contexts
```

---

## Stage 4.12 — Offline polling pause on hidden tab (O1)

**File**: `apps/web/components/offline-client.tsx`

```diff
  useEffect(() => {
-   const id = setInterval(() => {
-     if (navigator.onLine) window.location.reload();
-   }, 5000);
-   return () => clearInterval(id);
+   const id = setInterval(() => {
+     if (document.hidden) return;
+     if (navigator.onLine) {
+       fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(2000) })
+         .then(() => window.location.reload())
+         .catch(() => { /* still offline */ });
+     }
+   }, 5000);
+   return () => clearInterval(id);
  }, []);
```

### Commit 50
```
fix(offline): pause polling on hidden tab, verify reachability before reload
```

---

## Stage 4.13 — achievementEvents bounded (B1.2)

**File**: `apps/game-server/src/rooms/GameRoom.ts`

```diff
  private achievementEvents: AchievementEventLike[] = [];
+ private static MAX_ACHIEVEMENT_EVENTS = 500;

  // Where events are pushed:
  this.achievementEvents.push(event);
+ if (this.achievementEvents.length > GameRoom.MAX_ACHIEVEMENT_EVENTS) {
+   this.achievementEvents.shift();
+ }
```

### Commit 51
```
fix(game-server): bound achievementEvents array (max 500)
```

---

## Stage 4.14 — Persistence userId validation (BV-3)

**File**: `apps/game-server/src/persistence/game-persistence.ts:198-203`

```diff
+ function isValidUserId(userId: string): boolean {
+   return typeof userId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(userId);
+ }

  async function ensureUsers(db: Database, userIds: string[]) {
-   for (const userId of userIds) {
+   const validUserIds = userIds.filter(isValidUserId);
+   for (const userId of validUserIds) {
      await db.insert(users)
        .values({ id: userId, email: `${userId}@anonymous.local` })
        .onConflictDoNothing();
    }
  }
```

### Commit 52
```
fix(persistence): validate userId shape before user upsert
```

---

## Stage 4.15 — Final verification + CSS modules opportunity exploration

Run full suite:

```bash
pnpm regression
pnpm typecheck
pnpm build
pnpm --filter @werewolf/web test
pnpm --filter @werewolf/game-server test
```

Run `bg-copy-reviewer` agent on all touched files.

Run `role-mechanics-reviewer` agent on `GameRoom.ts` changes.

Run Lighthouse on `/`, `/werewolf`, `/mafia`, `/play/[code]` (with test code), `/history/[gameId]/replay` (with test gameId). Capture in `audit-v3/after/master-fix-all/`.

### Commit 53-54
```
chore(audit): refresh visual baselines for master-fix-all PR
chore(audit): close v2 audit items
```

---

# Phase summary

| Phase | Commits | Hours | Wins |
|---|---|---|---|
| **Phase 1** — Privacy + Security | 12 | ~4 | All 9 P0 closed |
| **Phase 2** — `/play` overhaul | 14 | ~6 | Half the Colyseus cost, reconnect UX |
| **Phase 3** — Lobby architecture | 10 | ~4 | God-file split, shared modal, structured warnings |
| **Phase 4** — CSS + Polish + Backend | 18 | ~6 | -15 KB CSS, all P2 polish, bounded structures |
| **Total** | **54** | **~20** | All audit items closed |

---

# Не пипай (across all phases)

- Role definitions in `packages/shared/src/games/*/roles.ts` (only check `runtimeStatus` enforcement, don't add/remove roles)
- Win-conditions logic in `packages/shared/src/win-conditions.ts`
- Auth provider configuration (`apps/web/lib/auth.ts`)
- Better-auth schema or session handling
- Existing imagen banners — no regeneration needed
- Service worker logic (already proper per audit)
- `next.config.ts` view-transition flag
- Any test that's currently passing — only ADD tests, don't modify

---

# Failure modes & recovery

If Codex hits a wall on any stage:

1. **Stop the stage.** Don't push half-broken code.
2. **Document** in `audit-v3/blocked-items.md`:
   - Which stage
   - What was tried
   - Why it didn't work
   - Suggested next angle (more context needed? Refactor too big? Test infrastructure missing?)
3. **Continue with next independent stage.** Phases 1-4 are loosely coupled; you can skip a stuck stage and come back.

If `pnpm regression` goes red after a commit:
1. **Revert that commit** (`git reset --hard HEAD~1` if not pushed).
2. Analyze the regression contract that failed.
3. Either fix the contract (if behavior change was intentional) or reapproach the change.

---

# Suggested PR splits

If shipping as separate PRs (recommended for review-ability):

- **PR #1** — Phase 1 (privacy + security) — 12 commits — must merge first
- **PR #2** — Phase 2 (play overhaul) — 14 commits — depends on #1 for clean baseline
- **PR #3** — Phase 3 (lobby cleanup) — 10 commits — can land in parallel with #2
- **PR #4** — Phase 4 (polish) — 18 commits — last, may have small conflicts to resolve

If shipping as one mega-PR (faster but reviewer-hostile):
- Single PR with all 54 commits — title: `feat: close all v2 audit findings (security, /play, lobby, polish)`
- Add commit-message-keyed sections in PR description

---

# Verification per phase

Each phase has a checkpoint:

### Phase 1 done if:
- `pnpm regression` green
- `pnpm test` green
- Replay page returns 200 only for participants (verify with curl + test session)
- `/create` returns 302 to `/sign-in` for anonymous (verify with curl)
- `/api/stats` response shows hashed `code` field (verify with curl)
- Game-token replay test: send same token twice → second join rejected
- ALLOW_DEV_AUTH unset → game-server rejects unsigned join

### Phase 2 done if:
- Chrome DevTools Performance recording on `/play` shows half the JS time per Colyseus delta vs baseline
- Players panel mounts once (verify with React DevTools)
- Kill WS mid-game → reconnect modal appears → retry restores room state
- No console errors during phase transitions

### Phase 3 done if:
- `lobby-form.ts` no longer exists (replaced by `lobby-form/` directory)
- `StepRoom.tsx` < 200 lines
- All 5 modals use `useModal` hook (grep verification)
- BG copy reviewer finds no English in lobby/create flow
- `aria-live` on form errors confirmed in DOM

### Phase 4 done if:
- `globals.css` < 19,500 lines (-500 from baseline of 20,076)
- No JSX references to any deleted CSS class (grep verification)
- Lighthouse Performance ≥ 85 mobile, ≥ 95 desktop on all routes
- Auth error mapping confirmed in 4 flows
- All previously flagged `setTimeout` cleanups present

---

(End of master prompt)
