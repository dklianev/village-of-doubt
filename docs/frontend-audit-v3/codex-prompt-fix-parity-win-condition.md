# Codex prompt — Fix werewolves/vampires parity win condition (GAME-002)

Logic bug: текущият код иска werewolves/vampires да изтрият **всички** селяни, докато canonical rules + UI копи + mafia logic вече казват, че трябва да печелят при **паритет**. Този PR fixва логиката, инвертира test-овете, и actualizes vague rules.ts copy.

---

## Pre-analysis (what I found)

### 🔴 Bug A — Logic uses wipe-out instead of parity

**File:** `packages/shared/src/win-conditions.ts:69-75`

```ts
// CURRENT (BUG):
if (aliveWerewolves > 0 && aliveVampires === 0 && aliveMafia === 0 && aliveVillage === 0) {
  return { winner: "werewolves", reasonBg: "Върколаците останаха единствената жива страна." };
}
if (aliveVampires > 0 && aliveWerewolves === 0 && aliveMafia === 0 && aliveVillage === 0) {
  return { winner: "vampires", reasonBg: "Вампирите останаха единствената жива страна." };
}
```

Werewolves/Vampires win **only** when `aliveVillage === 0` (entire village wiped out). But:

### Evidence this is a bug, not intentional design

1. **`docs/rules-bg.md:667`**:
   > "Върколаците печелят, ако броят на живите върколаци стане равен на или по-голям от броя на живите селяни."

2. **`docs/rules-bg.md:857`** (duplicate statement, same content).

3. **`apps/web/components/play-room-client.tsx:2213`** — already shows in the UI:
   > `win: "Върколаците да достигнат паритет със селото"`

4. **`apps/web/components/play-room-client.tsx:2255`** — already shows in the UI:
   > `win: "Вампирите да достигнат паритет с всички останали"`

5. **Same file, mafia logic (line 77-82)** uses parity:
   ```ts
   if (aliveMafia >= totalAlive - aliveMafia) {
     return { winner: "mafia", reasonBg: "Мафията е равна или повече от всички останали живи." };
   }
   ```

So: UI says parity, rules doc says parity, mafia uses parity, **but werewolves/vampires logic does NOT use parity**. Clear bug.

### 🔴 Bug B — Test codifies the bug

**File:** `packages/shared/src/__tests__/win-conditions.test.ts:30-40`

```ts
it("does not let Werewolves win by parity alone", () => {
  expect(evaluateWinCondition([
    { playerId: "wolf", role: "werewolf", alive: true },
    { playerId: "villager", role: "ordinary_villager", alive: true },
  ])).toMatchObject({ winner: null, reasonBg: null });
});
```

This test **explicitly asserts the buggy behavior**. It must be inverted.

### 🟡 Bug C — Vague copy in rules.ts contradicts UI specificity

**File:** `packages/shared/src/games/werewolf/rules.ts:15`

```ts
"Върколаците или Вампирите печелят, когато останат доминиращата жива сила."
```

"Доминиращата жива сила" is vague. UI elsewhere ($play-room-client.tsx) says specific "паритет". This rules.ts text feeds `/werewolf/rules` page — should match UI specificity.

### ✅ What is already correct (no changes needed)

- `apps/web/components/play-room-client.tsx:2195,2213,2255` — role-card "win" copy already says "паритет". ✓
- `apps/web/components/tutorial/SlideResolution.tsx` — generic copy ("научава дали играта продължава"). ✓ No specific win text.
- `apps/web/components/games/game-rules-page.tsx` — renders from rules.ts. Updates auto when we fix rules.ts.
- Achievements logic (`packages/shared/src/achievements.ts`) — keys on `winnerTeam`, not on parity directly. Works either way.
- `apps/game-server/src/rooms/GameRoom.ts:1709` — calls `evaluateWinCondition`. Fix propagates automatically.
- Hunter revenge / mayor succession — these run before the win check (lines 1203, 1378 in GameRoom.ts). Order is preserved.

### Impact на bug-а върху играчите

Real game timeline with 8 players, 2 werewolves:

| Step | Alive WW | Alive village | Should end? | Currently ends? |
|---|---|---|---|---|
| Start | 2 | 6 | No | No |
| Night 1 | 2 | 5 | No | No |
| Day 1 vote | 2 | 4 | No | No |
| Night 2 | 2 | 3 | No | No |
| Day 2 vote | 2 | 2 | **YES (parity)** | ❌ NO (bug — game continues) |
| Night 3 | 2 | 1 | YES (parity) | ❌ NO |
| Day 3 vote | 2 | 0 | YES (wipe-out) | ✅ YES (finally) |

The game continues **2 phases too long**. През тези 2 фази селото няма как да обърне резултата (върколаците не могат да бъдат гласувани надолу с равен брой) — играчите водят празни разговори.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo. Read `AGENTS.md`, `CLAUDE.md`, and `docs/rules-bg.md:663-670` first.

Invariants:
- All commit messages in **English** (project convention).
- All user-facing copy in **Bulgarian** Cyrillic.
- Branch name: `fix/win-condition-parity`.
- No new npm dependencies.
- Single PR, small scope, focused fix.

This PR fixes finding **GAME-002**: werewolves/vampires win condition uses wipe-out instead of parity. See "Pre-analysis" section above for full evidence trail.

---

## Stage 1 — Fix the core logic

**File:** `packages/shared/src/win-conditions.ts`

Replace the block from line ~60 to ~85 (current Cook + WW + Vampires + Mafia sequence) with:

```ts
  // Cook stalemate clause — preserved as-is.
  // When exactly one nightly threat (WW or Vampire) faces exactly one villager,
  // and that villager is the Cook, the night threat cannot kill them.
  if (
    aliveWerewolfOrVampire === 1 &&
    aliveMafia === 0 &&
    aliveVillage === 1 &&
    alive.some((player) => player.alive && player.role === "cook")
  ) {
    return { winner: "draw", reasonBg: "Последната нощна заплаха не може да преодолее Готвача." };
  }

  // Mixed nightly threats (Werewolves + Vampires together against village).
  // Rare scenario; resolve at parity with tie-break by faction headcount.
  if (aliveWerewolves > 0 && aliveVampires > 0 && aliveMafia === 0) {
    if (aliveWerewolfOrVampire >= totalAlive - aliveWerewolfOrVampire) {
      if (aliveWerewolves > aliveVampires) {
        return { winner: "werewolves", reasonBg: "Върколаците надделяха в смесената нощ." };
      }
      if (aliveVampires > aliveWerewolves) {
        return { winner: "vampires", reasonBg: "Вампирите надделяха в смесената нощ." };
      }
      return { winner: "draw", reasonBg: "Върколаци и вампири се изравниха над селото." };
    }
    return { winner: null, reasonBg: null };
  }

  // Werewolves alone — parity rule per docs/rules-bg.md:667.
  if (aliveWerewolves > 0 && aliveVampires === 0 && aliveMafia === 0) {
    if (aliveWerewolves >= totalAlive - aliveWerewolves) {
      return { winner: "werewolves", reasonBg: "Върколаците са равни или повече от живите селяни." };
    }
    return { winner: null, reasonBg: null };
  }

  // Vampires alone — same parity rule as werewolves.
  if (aliveVampires > 0 && aliveWerewolves === 0 && aliveMafia === 0) {
    if (aliveVampires >= totalAlive - aliveVampires) {
      return { winner: "vampires", reasonBg: "Вампирите са равни или повече от живите селяни." };
    }
    return { winner: null, reasonBg: null };
  }

  // Mafia clause — unchanged (already parity-based).
  if (aliveMafia > 0) {
    if (aliveMafia >= totalAlive - aliveMafia) {
      return { winner: "mafia", reasonBg: "Мафията е равна или повече от всички останали живи." };
    }
    return { winner: null, reasonBg: null };
  }

  return { winner: null, reasonBg: null };
```

**Important note for Codex:** double-check the existing maniac clause (line 45-51 in current file) stays **above** the Cook clause and remains unchanged. The maniac parity check should fire before the WW/Vampire parity check, otherwise a maniac surviving with one werewolf and one villager could mis-resolve.

---

## Stage 2 — Invert and expand the win-condition tests

**File:** `packages/shared/src/__tests__/win-conditions.test.ts`

Replace the test on lines 30-40 ("does not let Werewolves win by parity alone") with these **four** new tests:

```ts
  it("lets Werewolves win at parity (1 wolf vs 1 villager)", () => {
    expect(
      evaluateWinCondition([
        { playerId: "wolf", role: "werewolf", alive: true },
        { playerId: "villager", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "werewolves",
      reasonBg: "Върколаците са равни или повече от живите селяни.",
    });
  });

  it("lets Werewolves win at parity (2 wolves vs 2 villagers)", () => {
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "w2", role: "werewolf", alive: true },
        { playerId: "v1", role: "ordinary_villager", alive: true },
        { playerId: "v2", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "werewolves",
    });
  });

  it("keeps the game alive when villagers still outnumber werewolves", () => {
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "v1", role: "ordinary_villager", alive: true },
        { playerId: "v2", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });
  });

  it("lets Vampires win at parity", () => {
    expect(
      evaluateWinCondition([
        { playerId: "vamp", role: "vampire", alive: true },
        { playerId: "villager", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "vampires",
      reasonBg: "Вампирите са равни или повече от живите селяни.",
    });
  });
```

Add a fifth test for the mixed WW+Vampires edge case:

```ts
  it("resolves mixed WW+Vampires by faction headcount tie-break", () => {
    // 2 werewolves + 1 vampire vs 1 villager → WW > V → werewolves win
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "w2", role: "werewolf", alive: true },
        { playerId: "v1", role: "vampire", alive: true },
        { playerId: "village", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "werewolves",
      reasonBg: "Върколаците надделяха в смесената нощ.",
    });

    // 1 werewolf + 1 vampire vs 0 villagers → tied → draw
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "v1", role: "vampire", alive: true },
      ]),
    ).toMatchObject({
      winner: "draw",
      reasonBg: "Върколаци и вампири се изравниха над селото.",
    });
  });
```

Keep the existing Cook stalemate test (line 42-52) unchanged — it still applies. Keep both maniac tests unchanged.

---

## Stage 3 — Update vague rules.ts copy

**File:** `packages/shared/src/games/werewolf/rules.ts:14-16`

Replace the bullet list:

```ts
// CURRENT (vague):
bulletsBg: [
  "Селяните печелят, когато последният Върколак или Вампир бъде премахнат.",
  "Върколаците или Вампирите печелят, когато останат доминиращата жива сила.",
  "Влюбени от различни отбори могат да имат отделна победа, ако останат последни.",
],
```

With (specific):

```ts
bulletsBg: [
  "Селяните печелят, когато всички Върколаци и Вампири бъдат елиминирани.",
  "Върколаците печелят, когато броят на живите Върколаци е равен или по-голям от живите Селяни.",
  "Вампирите печелят по същия принцип на паритет като Върколаците.",
  "Влюбени от различни отбори имат отделна победа, ако останат последните двама живи.",
],
```

This rules.ts feeds the `/werewolf/rules` page (rendered via `apps/web/components/games/game-rules-page.tsx`). Update propagates automatically.

---

## Stage 4 — Verify game-server flow integrity

**File:** `apps/game-server/src/rooms/GameRoom.ts`

The game-server calls `evaluateWinCondition` at line 1709 (or thereabouts). After the fix, the function returns a winner earlier (at parity). Verify the surrounding flow:

1. **After night resolution** (`resolveNight` → `evaluateWinCondition` → if winner, `transitionTo("game_over")`).
2. **After day vote resolution** (similar pattern).
3. **After Hunter revenge** (if a wolf is shot by a dying hunter, parity could be achieved mid-resolution).
4. **After mayor succession** (rare — mayor death + revote).

Codex: read the surrounding code at line 1700-1750 in `GameRoom.ts`. Verify that:
- `evaluateWinCondition` is called AFTER pending revenge shots resolve (not before).
- Game does not skip pending revenge prompts because winner was declared too early.

If you find an order-of-operations bug, fix it in the same commit and add an integration test in `apps/game-server/src/__tests__/GameRoom.full-night.test.ts` (extend existing or add new test):

```ts
it("resolves Hunter revenge before declaring werewolves winner at parity", async () => {
  // Setup: 2 wolves + 1 hunter + 1 villager
  // Night: wolves kill hunter; hunter revenge prompts; hunter shoots a wolf
  // Expected: 1 wolf alive + 1 villager alive → still parity → werewolves win
  // But: revenge must resolve first, THEN evaluate
  // If wolves had been 3 → revenge brings down to 2 → 2 wolves + 1 villager → parity → werewolves win
});
```

If the order is already correct, write a regression test that locks it in place.

---

## Stage 5 — Update audit report

**File:** `docs/regression-audit/REPORT.md`

Add a new finding section under "Findings by category" → "6. Game-server (Colyseus) correctness":

```markdown
**[GAME-002] [P1] [game-server] Werewolves and Vampires win conditions used wipe-out instead of documented parity rule**
File: `packages/shared/src/win-conditions.ts:69`
Repro: Run 2 werewolves vs 2 villagers through `evaluateWinCondition`; pre-fix it returned `{ winner: null }`, while `docs/rules-bg.md:667` documents parity wins. UI role-card copy in `apps/web/components/play-room-client.tsx:2213` already promised "Върколаците да достигнат паритет със селото".
Impact: Games continued 2+ phases past the documented endgame, frustrating play and contradicting UI promises.
Suggested fix: Fixed in branch `fix/win-condition-parity` (commit <hash>). Werewolves and vampires now win at parity; mixed WW+Vampires scenario resolves via faction headcount tie-break.
```

Update `docs/regression-audit/FINDINGS-RAW.json`:
- Increment `totals.p1` from 9 to 10.
- Append the GAME-002 finding object to `findings` array.

---

## Acceptance criteria

1. `packages/shared/src/win-conditions.ts` returns winner at parity for werewolves, vampires, and mixed WW+V scenarios.
2. `packages/shared/src/__tests__/win-conditions.test.ts` has 5 new/updated tests verifying the parity rule (including mixed faction tie-break).
3. `packages/shared/src/games/werewolf/rules.ts` lists explicit parity bullets (no more "доминиращата жива сила" vagueness).
4. `pnpm test` passes (all win-condition tests green).
5. `pnpm --filter @werewolf/game-server test` passes (no full-night regression).
6. `pnpm regression` passes.
7. `pnpm typecheck` passes.
8. `pnpm build` passes.
9. `pnpm playtest` passes 5 consecutive runs (determinism check, includes race-conditions test).
10. Manual: spin up local game, simulate 2 wolves + 2 villagers reaching parity. Game ends at parity with `winnerTeam === "werewolves"` and `phase === "game_over"`.
11. `docs/regression-audit/REPORT.md` and `FINDINGS-RAW.json` updated with GAME-002 entry.

---

## Не пипай

- Mafia logic (already correct, parity-based).
- Maniac clause (already correct).
- Cook stalemate clause (preserved as-is).
- Lovers clause (independent, unchanged).
- UI copy in play-room-client.tsx (already says "паритет").
- Tutorial slides (generic copy, no win-condition specifics).
- Hunter revenge logic and order-of-operations (only add tests; do not change unless an actual order bug is found).
- Historical game records in the database (no retroactive migration).
- Achievement triggers (key on `winnerTeam`; auto-adjusts).

---

## Verification (after Codex finishes)

```bash
pnpm --filter @werewolf/shared build
pnpm --filter @werewolf/shared test       # win-conditions tests green
pnpm --filter @werewolf/game-server test  # full-night + race regression
pnpm typecheck
pnpm build
pnpm regression
for i in 1 2 3 4 5; do pnpm playtest && echo "PASS $i"; done
```

Manual smoke test:
1. Start local stack (`pnpm dev`).
2. Create werewolf game with 4 players (1 host + 3 dev clients).
3. Force role assignment: 2 werewolves + 2 villagers.
4. Night: werewolves kill 1 villager → 2W + 1V → parity → expect game_over.
5. Verify `state.winnerTeam === "werewolves"` in the client state.

---

## Commit strategy (3 atomic commits, all English)

Branch: `fix/win-condition-parity`

1. `fix(shared): werewolves and vampires win at parity per documented rules`
   - Changes: `packages/shared/src/win-conditions.ts` core logic.
2. `test(shared): invert parity assertions and add mixed-faction tie-break coverage`
   - Changes: `packages/shared/src/__tests__/win-conditions.test.ts` (and any game-server tests touched).
3. `docs(audit): record GAME-002 parity fix in regression audit report`
   - Changes: `docs/regression-audit/REPORT.md` + `FINDINGS-RAW.json` + (optional) `packages/shared/src/games/werewolf/rules.ts` if not committed separately.

If rules.ts update is large/separate, split into commit 4:

4. `docs(rules): clarify werewolf and vampire parity in game rules bullets`

PR title: `fix(GAME-002): werewolves and vampires win at parity, not wipe-out`

PR body should include:
- Link to `docs/rules-bg.md:667` as canonical rule source.
- Link to the original bug discussion (this conversation, if external link possible).
- Note: "Historical games already in DB are not retroactively recomputed; their `winnerTeam` reflects the old logic. This is intentional — we do not rewrite history."

---

(End of prompt)
