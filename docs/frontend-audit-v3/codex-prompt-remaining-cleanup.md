# Codex prompt — Remaining cleanup after v2 audit

After the massive Phase 1-4 work landed, **only 2 functional items remain open** plus 3 strategic refactors that are best done in dedicated PRs.

This prompt covers:
- **Phase A** — 2 quick functional wins (~30 min Codex work)
- **Phase B** — `play-room-client.tsx` monolith split (~3 hours, incremental)
- **Phase C** — `html[data-theme="light"]` → CSS variables migration (~2 hours, one section at a time)

**Phases are fully independent.** If you only complete Phase A, that's a complete deliverable. Phase B and Phase C can land in any order.

**Working directly on `main`.** Total scope: ~15 atomic English commits. No new npm dependencies.

---

## Pre-flight check

Before starting, verify these are STILL open by running:

```bash
# F1.3 — Should print "function Timer" twice (or once in a separate hook)
grep -nE "function Timer\b|useTimerCountdown" apps/web/components/play-room-client.tsx
grep -rn "useTimerCountdown" apps/web --include="*.ts" --include="*.tsx" 2>/dev/null

# B1.3 — Should print no rate-limit pattern in onJoin
grep -nE "rateLimit|joinRate|joinAttempts" apps/game-server/src/rooms/GameRoom.ts

# Confirm prior fixes still in place:
grep -nE "shortcutStateRef|usedNonces|hashRoomCode|isValidUserId|MAX_PENDING_PERSIST" \
  apps/game-server/src/rooms/GameRoom.ts \
  apps/web/components/play-room-client.tsx
```

If F1.3 already extracted or B1.3 already rate-limited, skip those stages and document in `audit-v3/blocked-items.md` why.

---

# PHASE A — Quick functional wins

## Stage A.1 — Extract `useTimerCountdown` hook (F1.3)

**Problem**: `play-room-client.tsx` has an inline `Timer` function component that creates a `setInterval(..., 1000)`. The component is mounted **twice** (phase-hero line 1109 + NarratorDesk line 1688). When the player is the host-narrator, 2 parallel intervals tick every second.

**File**: `apps/web/hooks/use-timer-countdown.ts` (new — confirm directory exists or create)

```ts
"use client";

import { useEffect, useState } from "react";

export type TimerCountdownResult = {
  remainingSeconds: number;
  minutes: string;
  seconds: string;
  isActive: boolean;
};

/**
 * Compute remaining time to a future timestamp, ticking once per second.
 * Shares a single setInterval per (endsAt, mount) pair — safe to call from
 * multiple sibling components if they pass the same endsAt.
 */
export function useTimerCountdown(endsAt: number): TimerCountdownResult {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!endsAt) return;

    const tick = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= endsAt) {
        window.clearInterval(tick);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [endsAt]);

  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return {
    remainingSeconds,
    minutes,
    seconds,
    isActive: Boolean(endsAt) && remainingSeconds > 0,
  };
}
```

### Refactor `Timer` component in `play-room-client.tsx`

Locate the inline `function Timer({ endsAt }: { endsAt: number })` (around line 2269). Replace its body to use the new hook:

```diff
+ import { useTimerCountdown } from "@/hooks/use-timer-countdown";

  function Timer({ endsAt }: { endsAt: number }) {
-   const [now, setNow] = useState(Date.now());
-
-   useEffect(() => {
-     setNow(Date.now());
-     if (!endsAt) return;
-     const timer = window.setInterval(() => {
-       const next = Date.now();
-       setNow(next);
-       if (next >= endsAt) {
-         window.clearInterval(timer);
-       }
-     }, 1000);
-     return () => window.clearInterval(timer);
-   }, [endsAt]);
-
-   const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
-   const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
-   const seconds = (remaining % 60).toString().padStart(2, "0");
+   const { minutes, seconds } = useTimerCountdown(endsAt);

    return (
      <div className="timer-dial">
        <span className="block text-xs uppercase tracking-[0.25em] text-[#c18a38]">таймер</span>
        <strong className="text-3xl">{endsAt ? `${minutes}:${seconds}` : "--:--"}</strong>
        {/* rest unchanged */}
      </div>
    );
  }
```

**Note**: Both call sites (line 1109 + 1688) still pass the same `endsAt`. React will create **two intervals** because they're separate component instances — extraction alone doesn't dedupe.

**For true single-interval**, the consumer pattern needs to shift: lift the timer state to the parent and pass `minutes`/`seconds` strings down. **Skip this optimization** unless React DevTools profiling shows the dual interval is actually hot. The hook extraction is the right starting point; full lift can come later.

### Add unit test

**File**: `apps/web/hooks/__tests__/use-timer-countdown.test.ts` (new)

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimerCountdown } from "../use-timer-countdown";

describe("useTimerCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zeroed strings when endsAt is 0", () => {
    const { result } = renderHook(() => useTimerCountdown(0));
    expect(result.current.minutes).toBe("00");
    expect(result.current.seconds).toBe("00");
    expect(result.current.isActive).toBe(false);
  });

  it("counts down each second", () => {
    const endsAt = Date.now() + 65_000; // 1:05
    const { result } = renderHook(() => useTimerCountdown(endsAt));
    expect(result.current.minutes).toBe("01");
    expect(result.current.seconds).toBe("05");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.minutes).toBe("00");
    expect(result.current.seconds).toBe("55");
  });

  it("stops at zero", () => {
    const endsAt = Date.now() + 2_000;
    const { result } = renderHook(() => useTimerCountdown(endsAt));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });
});
```

### Commit A.1
```
refactor(play): extract useTimerCountdown hook for shared phase timer logic
```

---

## Stage A.2 — `onJoin` rate-limit (B1.3)

**Problem**: `apps/game-server/src/rooms/GameRoom.ts:240` `onJoin` accepts joins without throttling. A misbehaving (or malicious) client can rapidly rejoin, churning state mutations and Colyseus patches.

**Approach**: Track per-userId join attempts in a sliding window. Reject the request if it exceeds 5 attempts in 10 seconds.

### Add rate-limit map

**File**: `apps/game-server/src/rooms/GameRoom.ts`

After the existing `usedNonces` static initializer (~line 114-126), add:

```diff
  private static usedNonces = new Map<string, number>();
+ private static joinAttempts = new Map<string, number[]>(); // userId → epoch ms timestamps
+ private static readonly JOIN_RATE_WINDOW_MS = 10_000;
+ private static readonly JOIN_RATE_LIMIT = 5;
+ private static joinJanitorInterval: ReturnType<typeof setInterval> | undefined;

  static {
    GameRoom.nonceJanitorInterval = setInterval(() => {
      // ... existing nonce sweep
    }, 60_000);
+   GameRoom.nonceJanitorInterval.unref?.();
+
+   // Sweep join-attempt records every 30s
+   GameRoom.joinJanitorInterval = setInterval(() => {
+     const cutoff = Date.now() - GameRoom.JOIN_RATE_WINDOW_MS;
+     for (const [userId, timestamps] of GameRoom.joinAttempts) {
+       const remaining = timestamps.filter((ts) => ts > cutoff);
+       if (remaining.length === 0) {
+         GameRoom.joinAttempts.delete(userId);
+       } else {
+         GameRoom.joinAttempts.set(userId, remaining);
+       }
+     }
+   }, 30_000);
+   GameRoom.joinJanitorInterval.unref?.();
  }
+
+ private static checkJoinRateLimit(userId: string): boolean {
+   const now = Date.now();
+   const cutoff = now - GameRoom.JOIN_RATE_WINDOW_MS;
+   const timestamps = (GameRoom.joinAttempts.get(userId) ?? []).filter((ts) => ts > cutoff);
+   if (timestamps.length >= GameRoom.JOIN_RATE_LIMIT) {
+     return false;
+   }
+   timestamps.push(now);
+   GameRoom.joinAttempts.set(userId, timestamps);
+   return true;
+ }
```

### Apply in `onJoin`

```diff
  onJoin(client: Client, options: JoinRoomOptions, auth: ClientAuth) {
+   if (!GameRoom.checkJoinRateLimit(auth.userId)) {
+     client.send("safe_error", {
+       type: "safe_error",
+       messageBg: "Твърде много опити за вход. Изчакай малко.",
+     } satisfies ServerEvent);
+     client.leave(4029); // 4029 = custom code for rate-limit
+     return;
+   }
+
    const previousClient = this.clientsByUserId.get(auth.userId);
    /* ... existing logic ... */
  }
```

### Test

**File**: `apps/game-server/src/__tests__/GameRoom.security.test.ts` — add test:

```ts
it("rate-limits rapid join attempts from the same user", async () => {
  const room = await createTestRoom();
  const userId = "test-user-1";
  const displayName = "Митко";

  // 5 joins should succeed
  for (let i = 0; i < 5; i++) {
    await expect(room.attemptJoin({ userId, displayName })).resolves.toBeDefined();
    await room.attemptLeave(userId);
  }

  // 6th within 10s window should be rejected with safe_error
  const error = await room.attemptJoin({ userId, displayName }).catch((e) => e);
  expect(error?.message).toMatch(/Твърде много опити/);
});
```

(Adapt `attemptJoin`/`attemptLeave` to actual test harness pattern from the file.)

### Commit A.2
```
feat(game-server): rate-limit onJoin attempts to 5 per 10s window
```

---

## Stage A.3 — Verify Phase A

```bash
pnpm regression
pnpm typecheck
pnpm build
pnpm --filter @werewolf/web test apps/web/hooks/__tests__/use-timer-countdown.test.ts
pnpm --filter @werewolf/game-server test
```

### Commit A.3
```
chore(audit): close Phase A remaining cleanup items
```

**Phase A done.** Functional audit completely closed. Ready to ship.

---

# PHASE B — `play-room-client.tsx` monolith split

**Problem**: `play-room-client.tsx` is 3290 lines — by far the largest file in the codebase. Many subcomponents are inline (PhaseTransitionOverlay, PreGameCountdown, Timer, ReconnectModal, AchievementUnlockModal, etc.). Hard to read, hard to test, hard to memoize selectively.

**Goal**: Extract internal components into `apps/web/components/play/` subdirectory. Target main file ~1500 lines (orchestration + state management only).

**Approach**: Incremental, one subcomponent per commit. After each extraction, verify visual parity + tests.

## Stage B.1 — Extract `PhaseTransitionOverlay`

**Current**: `play-room-client.tsx:1381-1410` (~30 lines)

**Target**: `apps/web/components/play/PhaseTransitionOverlay.tsx`

```tsx
"use client";

import type { GameMode, GamePhase, NarratorVoice } from "@werewolf/shared";
import { phaseBg, phaseNarratorLine, phaseSigil } from "./phase-display";

interface Props {
  phase: GamePhase;
  mode: GameMode;
  narratorVoice: NarratorVoice;
  pulseKey: number;
}

export function PhaseTransitionOverlay({ phase, mode, narratorVoice, pulseKey }: Props) {
  if (pulseKey === 0 || phase === "lobby") {
    return null;
  }

  return (
    <div key={`${phase}-${pulseKey}`} className={`phase-transition-overlay transition-${phase}`} aria-hidden="true">
      <div>
        <span>{phaseSigil(phase)}</span>
        <strong>{phaseBg(phase, mode)}</strong>
        <small>{phaseNarratorLine(phase, mode, narratorVoice)}</small>
      </div>
    </div>
  );
}
```

Also extract `phaseBg`, `phaseSigil`, `phaseNarratorLine`, `phaseLabel` helpers to `apps/web/components/play/phase-display.ts`.

Update import in `play-room-client.tsx`:

```diff
+ import { PhaseTransitionOverlay } from "@/components/play/PhaseTransitionOverlay";
- function PhaseTransitionOverlay({ /* ... */ }) { /* ... */ }
```

### Commit B.1
```
refactor(play): extract PhaseTransitionOverlay to dedicated module
```

---

## Stage B.2 — Extract `Timer` + `PreGameCountdown`

**Current**: `Timer` (~line 2269) + `PreGameCountdown` (~line 1417)

**Target**: `apps/web/components/play/Timer.tsx` and `apps/web/components/play/PreGameCountdown.tsx`

Move both components verbatim. `Timer` now uses `useTimerCountdown` hook (from Phase A.1).

### Commit B.2
```
refactor(play): extract Timer and PreGameCountdown components
```

---

## Stage B.3 — Extract `ReconnectModal`

**Current**: Inline in play-room-client around line 1560+

**Target**: `apps/web/components/play/ReconnectModal.tsx`

Move with its `useModal` integration. Keep props minimal: `status`, `onRetry`, optional `onCancel`.

### Commit B.3
```
refactor(play): extract ReconnectModal component
```

---

## Stage B.4 — Extract `AchievementUnlockModal`

**Current**: Inline around line 1420

**Target**: `apps/web/components/play/AchievementUnlockModal.tsx`

### Commit B.4
```
refactor(play): extract AchievementUnlockModal component
```

---

## Stage B.5 — Extract `PlayersPanel` and `PlayerToken`

**Current**: `renderPlayersPanel` inline function (line ~915) plus token render logic

**Target**: `apps/web/components/play/PlayersPanel.tsx` and `apps/web/components/play/PlayerToken.tsx`

Make `PlayerToken` a `React.memo` with custom equality (the proposed PV-7 / F1.4 improvements).

### Commit B.5
```
refactor(play): extract PlayersPanel and memoized PlayerToken
```

---

## Stage B.6 — Extract `NarratorDesk` and `VotingPanel`

These are the two heaviest UI sections in the file.

**Target**:
- `apps/web/components/play/NarratorDesk.tsx`
- `apps/web/components/play/VotingPanel.tsx`

### Commit B.6
```
refactor(play): extract NarratorDesk and VotingPanel components
```

---

## Stage B.7 — Extract chat + event log subcomponents

**Target**:
- `apps/web/components/play/PublicChat.tsx`
- `apps/web/components/play/PrivateChats.tsx`
- `apps/web/components/play/EventLog.tsx`

### Commit B.7
```
refactor(play): extract chat and event log components
```

---

## Stage B.8 — Verify Phase B

```bash
pnpm regression
pnpm typecheck
pnpm build
pnpm --filter @werewolf/web test
```

**Visual QA**: Open `/play/[code]` with a test game running. Verify:
- All phases transition correctly (lobby → night → day → vote → reveal → game_over)
- Reconnect modal appears on simulated WS drop
- Achievement modal appears when unlocking
- Vote bars animate smoothly
- No console errors

Expected: `play-room-client.tsx` should now be **~1500-1800 lines** (down from 3290).

### Commit B.8
```
chore(audit): document Phase B split outcome and target metrics
```

**Phase B done.** Maintainability dramatically improved.

---

# PHASE C — `html[data-theme="light"]` → CSS variables migration

**Problem**: 292 `html[data-theme="light"] .X { ... }` selectors. Each adds to style recalculation cost on theme toggle (~80-150ms INP on mobile). v1 audit recommended migration to CSS variables; not started.

**Goal**: Start the migration. Pick a small section, convert it to vars, prove the pattern, then extend.

**Approach**: One semantic section per commit. Don't try to migrate everything at once — that breaks visual parity.

## Stage C.1 — Identify a starter section

Pick the section with the LEAST cross-dependencies. Good candidates (low risk):
- `.faq-shell` chrome (~20 light-theme overrides)
- `.privacy-shell` chrome (~25 overrides)
- `.status-shell` chrome (~18 overrides)

**Avoid for first pass**:
- `.landing-hero-card` (touched recently, complex backdrop)
- `.game-shell` (active /play)
- `.lobby-shell` (active create flow)

Recommended: **`.faq-shell`** — settled, well-tested.

### Action

```bash
grep -n 'html\[data-theme="light"\] \.faq' apps/web/app/globals.css | wc -l
# Expect 15-25 lines
```

### Commit C.1
```
docs(css): document theme-light migration pattern (faq shell as pilot)
```

Write a short pattern note in `docs/css-tokens.md` (new):

```md
# CSS theme token pattern

## Goal
Replace `html[data-theme="light"] .X { property: value }` selectors with CSS
variable definitions, so theme toggle changes ONLY the variables (not 282+
distinct selectors).

## Pattern

### Before (selector-based)
```css
.faq-shell {
  background: #1a1410;
  color: #f5e8c8;
}
html[data-theme="light"] .faq-shell {
  background: #fcf6ec;
  color: #2a1b10;
}
```

### After (token-based)
```css
:root {
  --faq-shell-bg: #1a1410;
  --faq-shell-color: #f5e8c8;
}
html[data-theme="light"] {
  --faq-shell-bg: #fcf6ec;
  --faq-shell-color: #2a1b10;
}
.faq-shell {
  background: var(--faq-shell-bg);
  color: var(--faq-shell-color);
}
```

## Naming convention

- Prefix variables with section: `--faq-shell-X`, `--privacy-section-X`
- Suffix with semantic role: `-bg`, `-border`, `-text`, `-accent`, `-shadow`
- Keep light-theme overrides grouped in ONE `html[data-theme="light"] {}` block
  per migrated section.

## Migration steps per section
1. Identify all `html[data-theme="light"] .X { … }` for the section
2. Define dark defaults as `--section-tokens` in `:root`
3. Define light overrides in single `html[data-theme="light"] { … }` block
4. Replace property values in `.X { … }` with `var(--section-token)`
5. Delete the `html[data-theme="light"] .X { … }` selectors
6. Visual diff: dark + light themes should look IDENTICAL to before
7. Performance check: theme toggle should be measurably faster
```

---

## Stage C.2 — Migrate `.faq-shell` (pilot)

**File**: `apps/web/app/globals.css`

For each property in `.faq-shell`, `.faq-hero`, `.faq-section`, `.faq-question`, `.faq-answer` that's overridden by `html[data-theme="light"] .X`:

1. Define dark default as `:root` token
2. Define light override in **one block** `html[data-theme="light"] { --token: ... }`
3. Replace property values with `var(--token)`
4. Delete the now-unused `html[data-theme="light"] .X { … }` selector

Example diff:

```diff
+ :root {
+   --faq-shell-bg: rgba(17, 12, 10, 0.92);
+   --faq-shell-border: rgba(245, 232, 200, 0.14);
+   --faq-shell-text: #f5e8c8;
+   --faq-shell-shadow: 0 32px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(245, 232, 200, 0.06);
+ }
+
+ html[data-theme="light"] {
+   --faq-shell-bg: rgba(252, 246, 236, 0.94);
+   --faq-shell-border: rgba(83, 52, 31, 0.18);
+   --faq-shell-text: #2a1b10;
+   --faq-shell-shadow: 0 32px 60px rgba(40, 26, 16, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
+ }

  .faq-shell {
-   background: rgba(17, 12, 10, 0.92);
-   border: 1px solid rgba(245, 232, 200, 0.14);
-   color: #f5e8c8;
-   box-shadow: 0 32px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(245, 232, 200, 0.06);
+   background: var(--faq-shell-bg);
+   border: 1px solid var(--faq-shell-border);
+   color: var(--faq-shell-text);
+   box-shadow: var(--faq-shell-shadow);
  }

- html[data-theme="light"] .faq-shell {
-   border-color: rgba(83, 52, 31, 0.18);
-   background: rgba(252, 246, 236, 0.94);
-   box-shadow: 0 32px 60px rgba(40, 26, 16, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
- }

- html[data-theme="light"] .faq-shell {
-   color: #2a1b10;
- }
```

(Adapt to actual properties present in the file.)

### Visual diff verification

```bash
pnpm dev
# Open http://localhost:3000/faq in both dark + light themes
# Compare to git stash visual or baseline screenshots
```

If pixels differ, revert and re-check token values. Use DevTools to diff computed styles.

### Commit C.2
```
refactor(css): migrate .faq-shell to CSS variable tokens
```

---

## Stage C.3 — Verify perf impact

**Setup**:
1. Build production bundle: `pnpm build && pnpm start`
2. Open Chrome DevTools → Performance
3. Throttle CPU 4×
4. Record 5 seconds while clicking theme toggle 3 times
5. Note "Recalculate Style" + "Layout" + "Paint" durations

**Compare to baseline** (theme toggle pre-migration). Expected: small but measurable drop (5-15%).

If improvement is meaningful, **continue with more sections** (one commit each):
- C.4: `.privacy-shell`
- C.5: `.status-shell`
- C.6: `.terms-shell`
- C.7: `.report-shell`

After each, verify visual parity + performance trend.

### Commit C.3 (if performance improvement validated)
```
perf(css): theme-light migration shows measurable INP improvement
```

---

## Stage C.4-C.7 — Migrate next sections (one per commit)

Same pattern as C.2 for each of:
- `.privacy-shell` (~25 overrides)
- `.status-shell` (~18 overrides)
- `.terms-shell` (~22 overrides)
- `.report-shell` (~30 overrides)

Each commit: migrate ONE section + verify visual + run build.

```
refactor(css): migrate .privacy-shell to CSS variable tokens
refactor(css): migrate .status-shell to CSS variable tokens
refactor(css): migrate .terms-shell to CSS variable tokens
refactor(css): migrate .report-shell to CSS variable tokens
```

After C.7, recount:

```bash
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css
# Expect: 292 → ~180 (~110 selectors converted to vars)
```

---

## Stage C.8 — Document and pause

After 5 sections migrated, stop and write a follow-up note in `docs/css-tokens.md`:

- Sections migrated so far
- Sections remaining (high-risk: landing, game-shell, lobby)
- Performance delta measured
- Decision: continue or stop here

The remaining ~180 selectors are mostly in high-risk areas (active game, lobby, landing). Migrating them is a multi-week effort and should be a separate dedicated PR.

### Commit C.8
```
docs(css): theme-token migration progress and next steps
```

**Phase C done.** Established pattern, ~40% of light-theme overrides migrated, INP improvement measured.

---

# Acceptance criteria

## Phase A (must-pass)
- `useTimerCountdown` hook exists and is used in `Timer` component
- Hook tests pass (`pnpm --filter @werewolf/web test`)
- `onJoin` rate-limit rejects 6th attempt within 10s with safe_error
- Security test for rate-limit passes
- `pnpm regression` green

## Phase B (must-pass)
- `play-room-client.tsx` line count ≤ 1800
- All extracted components exist in `apps/web/components/play/`
- Visual QA: all game phases work without regression
- `pnpm regression` green
- No console errors in `/play/[code]` browser DevTools

## Phase C (must-pass per section)
- Visual parity: dark + light themes pixel-identical to pre-migration
- `html[data-theme="light"]` selector count drops by at least 15 per section
- `pnpm regression` green
- Chrome DevTools Performance recording shows measurable Recalc Style improvement on theme toggle

---

# Verification commands

```bash
# After every commit:
pnpm regression
pnpm typecheck
pnpm build

# After Phase A:
pnpm --filter @werewolf/web test apps/web/hooks/__tests__/use-timer-countdown.test.ts
pnpm --filter @werewolf/game-server test apps/game-server/src/__tests__/GameRoom.security.test.ts

# After Phase B:
wc -l apps/web/components/play-room-client.tsx
# Expect: ≤ 1800

# After Phase C (per section):
grep -c 'html\[data-theme="light"\]' apps/web/app/globals.css
# Expect: decreases by 15-30 per section migrated
```

---

# Не пипай

- Existing `useModal`, `lib/use-modal.ts` — already battle-tested
- Existing security tests in `GameRoom.security.test.ts` — only ADD tests
- `lobby-form/` directory structure — keep as is
- Theatre backdrop CSS (`.landing-shell::before`, body fixed pseudo) — landed cleanly
- Auth error mapping (`lib/auth-errors.ts`) — done
- Any imagen — no new assets needed
- `next.config.ts` — current state is fine

---

# Commit summary

15 atomic English commits:

```
Phase A (3 commits, ~30 min)
1. refactor(play): extract useTimerCountdown hook for shared phase timer logic
2. feat(game-server): rate-limit onJoin attempts to 5 per 10s window
3. chore(audit): close Phase A remaining cleanup items

Phase B (8 commits, ~3 hours)
4. refactor(play): extract PhaseTransitionOverlay to dedicated module
5. refactor(play): extract Timer and PreGameCountdown components
6. refactor(play): extract ReconnectModal component
7. refactor(play): extract AchievementUnlockModal component
8. refactor(play): extract PlayersPanel and memoized PlayerToken
9. refactor(play): extract NarratorDesk and VotingPanel components
10. refactor(play): extract chat and event log components
11. chore(audit): document Phase B split outcome and target metrics

Phase C (4-6 commits, ~2 hours)
12. docs(css): document theme-light migration pattern (faq shell as pilot)
13. refactor(css): migrate .faq-shell to CSS variable tokens
14. perf(css): theme-light migration shows measurable INP improvement
15. refactor(css): migrate .privacy/.status/.terms/.report shells to vars
```

PR titles (if splitting):
- **PR #1** — Phase A: `chore: close remaining v2 audit cleanup items (Timer hook + onJoin rate-limit)`
- **PR #2** — Phase B: `refactor(play): split play-room-client monolith into focused components`
- **PR #3** — Phase C: `refactor(css): theme-light → CSS variable tokens (faq/privacy/status/terms/report)`

---

# Failure modes

**Phase A failure**: If `useTimerCountdown` test infrastructure missing (no `@testing-library/react` or `vitest` fake timers), document in `audit-v3/blocked-items.md` and skip test, ship hook + rate-limit only.

**Phase B failure**: If extracting a component breaks visual rendering (e.g., props not threaded correctly), **revert that single commit** and try a smaller extraction. Don't push broken visuals.

**Phase C failure**: If migrating a section breaks visual parity (pixel diff), **revert and re-check token values**. The most common pitfall: subtle differences in `rgba()` alphas or hex values. Use DevTools to diff computed styles between branches.

If overall Codex session times out mid-Phase B or C, the deliverable is whatever atomic commits have landed. Each commit is a meaningful step forward.

---

(End of prompt)
