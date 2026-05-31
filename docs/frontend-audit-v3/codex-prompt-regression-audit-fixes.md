# Codex prompt — Fix all regression audit findings (16 items)

Implementation PR addressing every finding from `docs/regression-audit/REPORT.md` (audit dated 2026-05-16). 9 P1, 4 P2, 3 P3 — no P0. Outputs atomic commits per finding so individual fixes can be reverted if needed.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo. Read `AGENTS.md`, `CLAUDE.md`, `docs/regression-audit/REPORT.md`, and `docs/regression-audit/FINDINGS-RAW.json` first. The audit has produced 16 prioritized findings and you are implementing fixes for **all of them**.

Invariants:
- All commit messages must be in **English** (project convention).
- All user-facing copy must be in **Bulgarian** Cyrillic.
- No new npm dependencies unless explicitly justified below.
- Work on branch `fix/regression-audit-followup`.
- Each finding gets its own commit (~16 commits). Use the IDs (SEC-001, TEST-001, etc.) in commit message subjects.

---

## Pre-decisions (committed product/architecture choices)

These ambiguities in the audit's "Suggested fix" are resolved here to keep the implementation deterministic:

### DB-001 — Account deletion strategy: **anonymize, do not cascade**

When a user deletes their account, we preserve game records (other players' history depends on them) but redact PII.

Implementation:
1. Add a sentinel "deleted user" row in `user` table with fixed UUID `00000000-0000-0000-0000-000000000000`, name `"Изтрит играч"`, email `deleted@local.invalid`. Insert it via a new migration (one-time idempotent insert).
2. In `/api/account/delete` handler: BEFORE calling `auth.api.deleteUser`, run a transaction that:
   - `UPDATE game_players SET userId = '<sentinel>', displayName = 'Изтрит играч' WHERE userId = <target>`
   - `UPDATE game_events SET actorId = '<sentinel>' WHERE actorId = <target>`
   - `UPDATE game_events SET targetId = '<sentinel>' WHERE targetId = <target>`
   - `UPDATE games SET hostId = '<sentinel>' WHERE hostId = <target>`
   - `DELETE FROM user_achievements WHERE userId = <target>` (per GDPR, personal achievements vanish)
3. Then call `auth.api.deleteUser`.

FKs do **not** get changed to `set null`/`cascade` — they remain pointing to a valid (sentinel) user.

### DEPLOY-002 — CSP approach

- **Remove** `'unsafe-eval'` from `script-src` immediately (Next.js 16 production doesn't need it).
- **Keep** `'unsafe-inline'` in `script-src` for now (Next.js hydration scripts still inline). Add `# TODO: migrate to nonce-based CSP` comment with date `2026-05-16`.
- **Restrict** `connect-src` to `https:` and `wss:` only (drop `http:` and `ws:`).
- **Restrict** `img-src` to `'self' data: https:` (drop `http:` if present).
- Test after change: run `pnpm dev`, navigate routes, check browser console for CSP violations. Adjust if Next/Sentry/etc complain about specific assets.

### SEC-001 — Next.js + drizzle-orm versions

- Bump Next.js to **^16.2.6** (or latest 16.x patched version satisfying audit advisories at run time — verify with `pnpm audit` after).
- Bump drizzle-orm to the latest version that depends on Kysely >= 0.28.17 (check `pnpm why kysely` after bump).
- If drizzle-orm has no compatible version, file the residual advisory as `docs/regression-audit/SEC-001-deferred.md` with rationale.

### TEST-001 — Race condition test approach

Add a server-side **ack message** for night submissions. Game-server emits `night_action_ack` (private message to the actor) after successfully recording a night action. The test waits for both ack messages before calling `narratorAdvance`.

Don't add new client-facing ack messages to production UI — only used for testing. Keep behind protocol expansion that's idiomatic (just a new message type, not a config flag).

---

## Stage 1 — P1 fixes (9 items)

### Commit 1: `fix(deps): upgrade Next.js + drizzle-orm to patched versions (SEC-001)`

**File:** `apps/web/package.json` + lock file

1. `pnpm --filter web update next@^16.2.6 react@latest react-dom@latest`
2. `pnpm --filter @werewolf/database update drizzle-orm@latest drizzle-kit@latest`
3. Run `pnpm install` (regenerates lock).
4. Run `pnpm audit --json | tee docs/regression-audit/logs/audit-after-fix.json`.
5. Verify Next.js advisories `<16.2.6` are gone.
6. Verify Kysely advisory `<0.28.17` is gone (check `pnpm why kysely`).
7. Run `pnpm typecheck` + `pnpm build` + `pnpm test` — all must pass.
8. If Kysely advisory remains because no drizzle-orm version with patched Kysely exists yet:
   - Create `docs/regression-audit/SEC-001-deferred.md` documenting:
     - Advisory ID
     - Affected dep chain (`drizzle-orm` → `kysely`)
     - Why not patched yet (no release available)
     - Tracking link / monitoring instructions
   - Commit this file as part of this commit.

**Acceptance:** `pnpm audit` shows 0 high severity advisories OR the deferral doc explains residual.

---

### Commit 2: `fix(auth): require session in achievements API (AUTH-001)`

**File:** `apps/web/app/api/achievements/route.ts`

Replace current implementation:

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDatabase, getAchievementsForUser } from "@werewolf/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ achievements: [] });
  }
  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const achievements = await getAchievementsForUser(db, session.user.id);
    return NextResponse.json({ achievements });
  } catch (error) {
    console.error("[achievements-api]", error);
    return NextResponse.json({ error: "Грешка при зареждане на постижения." }, { status: 500 });
  }
}
```

Note: route no longer accepts `?userId=` query param. Update consumers.

**File:** `apps/web/components/achievements-client.tsx`

Remove `?userId=${encodeURIComponent(userId)}` from the fetch call; just `fetch("/api/achievements")`.

**File:** `apps/web/app/api/achievements/__tests__/route.test.ts`

Replace the test at line 48 ("reads userId from URL"). New tests:
- Without session → 401.
- With session → returns achievements for `session.user.id`.
- `?userId=other` query param is ignored (still returns own achievements).

**Acceptance:** `curl -X GET '/api/achievements?userId=victim' --no-cookie` returns 401. `pnpm test --filter web` passes new tests.

---

### Commit 3: `fix(db): anonymize game history on account deletion (DB-001)`

**File:** New migration `packages/database/drizzle/migrations/NNNN_deleted_user_sentinel.sql`

```sql
-- Insert sentinel user for anonymized game history records
INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Изтрит играч',
  'deleted@local.invalid',
  true,
  null,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

(Codex: check actual Drizzle migration directory layout for werewolf_mafia; adapt naming and structure.)

**File:** `packages/database/src/queries.ts`

Add new query function:

```ts
const DELETED_USER_ID = "00000000-0000-0000-0000-000000000000";
const DELETED_DISPLAY_NAME = "Изтрит играч";

export async function anonymizeUserGameHistory(db: Database, userId: string) {
  await db.transaction(async (tx) => {
    await tx.update(gamePlayers)
      .set({ userId: DELETED_USER_ID, displayName: DELETED_DISPLAY_NAME })
      .where(eq(gamePlayers.userId, userId));
    await tx.update(gameEvents)
      .set({ actorId: DELETED_USER_ID })
      .where(eq(gameEvents.actorId, userId));
    await tx.update(gameEvents)
      .set({ targetId: DELETED_USER_ID })
      .where(eq(gameEvents.targetId, userId));
    await tx.update(games)
      .set({ hostId: DELETED_USER_ID })
      .where(eq(games.hostId, userId));
    await tx.delete(userAchievements)
      .where(eq(userAchievements.userId, userId));
  });
}
```

Export from `packages/database/src/index.ts`.

**File:** `apps/web/app/api/account/delete/route.ts`

Update the POST handler:

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDatabase, anonymizeUserGameHistory } from "@werewolf/database";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    if (process.env.DATABASE_URL) {
      const db = createDatabase(process.env.DATABASE_URL);
      await anonymizeUserGameHistory(db, userId);
    }

    await auth.api.deleteUser({
      headers: await headers(),
      body: { userId },
    });
  } catch (error) {
    console.error("[account-delete]", error);
    return NextResponse.json({ error: "Не успяхме да изтрием профила." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

**Update test:** `apps/web/app/api/account/delete/__tests__/route.test.ts` — verify anonymize is called before deleteUser; both succeed → 200; anonymize fails → 500.

**Acceptance:** Manual test: log in, play one game so a row exists in `games`, delete account, verify game row still exists with `hostId = sentinel`.

---

### Commit 4: `fix(test): make race-condition test deterministic via ack (TEST-001)`

**File:** `apps/game-server/src/rooms/GameRoom.ts`

In the night action handler (search for `nightSubmit` or similar message), after successfully recording the action, emit a private ack to the actor:

```ts
client.send("night_action_ack", { phase: this.state.phase, round: this.state.round });
```

Only emit ack on success. Failures already emit `safe_error`.

**File:** `apps/game-server/src/__tests__/GameRoom.race-conditions.test.ts:52`

Replace the test to wait for acks:

```ts
const ack1 = client1.waitForMessage("night_action_ack");
const ack2 = client2.waitForMessage("night_action_ack");
client1.send("nightSubmit", { targetUserId: "race-3" });
client2.send("nightSubmit", { targetUserId: "race-3" });
await Promise.all([ack1, ack2]);
// Now safe to advance
await narratorAdvance(serverRoom);
```

**Update protocol types:** if `packages/shared/src/protocol.ts` enumerates client→server / server→client messages, add `night_action_ack` to the server→client union.

**Acceptance:** Run `pnpm playtest` 10 times consecutively (one-line shell loop). All passes.

---

### Commit 5: `fix(test): wire postgres service in CI for e2e:auth (TEST-003)`

**File:** `.github/workflows/ci.yml` (if exists; otherwise create it)

Add Postgres service block:

```yaml
services:
  postgres:
    image: postgres:17
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: werewolf_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 5s
      --health-timeout 3s
      --health-retries 10
```

In the `e2e:auth` job step, set:
```yaml
env:
  DATABASE_URL: postgres://postgres:postgres@localhost:5432/werewolf_test
  BETTER_AUTH_SECRET: ci-only-secret-that-is-long-enough-32-chars-min
  GAME_TOKEN_SECRET: ci-only-secret-that-is-long-enough-32-chars-min
  OAUTH_MOCK: "true"
```

Before the e2e step:
```yaml
- name: Run migrations
  run: pnpm --filter @werewolf/database db:migrate
  env:
    DATABASE_URL: postgres://postgres:postgres@localhost:5432/werewolf_test
```

**File:** `scripts/e2e-auth.mjs:34`

Replace the skip-on-missing-DATABASE_URL behavior. New logic:

```js
const isLocalOnly = process.env.E2E_LOCAL_ONLY === "true";
if (!process.env.DATABASE_URL) {
  if (isLocalOnly) {
    console.log("пропуснато (локален режим): DATABASE_URL липсва");
    return;
  }
  console.error("✗ e2e:auth изисква DATABASE_URL извън локален режим. Стартирай с E2E_LOCAL_ONLY=true за skip или подай DATABASE_URL.");
  process.exit(1);
}
```

**Acceptance:** CI run on PR exercises e2e:auth with real DB. Local devs can still `E2E_LOCAL_ONLY=true pnpm e2e:auth` to skip.

---

### Commit 6: `fix(deploy): pass Google OAuth + APP_URL to docker web service (DEPLOY-001)`

**File:** `docker-compose.yml`

In the `web.environment` block, add:

```yaml
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
BETTER_AUTH_URL: ${BETTER_AUTH_URL}
```

(Some of these may already exist — only add missing ones; verify against current file.)

**File:** `scripts/check-production-env.mjs:51`

Extend the OAuth provider warning/error to cover Google:

```js
const hasDiscord = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (!hasDiscord && !hasGoogle) {
  console.error("✗ Производственото пускане очаква поне един OAuth провайдер (Discord или Google).");
  process.exit(1);
}
if (!hasGoogle) {
  console.warn("⚠ Google OAuth не е конфигуриран; интерфейсът ще покаже само Discord и имейл.");
}
if (!hasDiscord) {
  console.warn("⚠ Discord OAuth не е конфигуриран; интерфейсът ще покаже само Google и имейл.");
}
```

Also assert `NEXT_PUBLIC_APP_URL` is set to a `https://` URL in production.

**File:** `.env.example` + `.env.local.example`

Verify both have `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`. Add if missing.

**Acceptance:** `pnpm check:prod-env` with realistic production env vars passes; missing Google trips the warning; missing both trips the error.

---

### Commit 7: `fix(game-server): refuse insecure random fallback in role assignment (GAME-001)`

**File:** `packages/shared/src/role-assignment.ts:35`

Replace `defaultRandomSource`:

```ts
function defaultRandomSource(): () => number {
  // Prefer Web Crypto (browser + modern Node)
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    return () => {
      const buf = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buf);
      return buf[0] / 0xffffffff;
    };
  }

  // Node fallback: use node:crypto.randomBytes (synchronous OS entropy)
  try {
    // Dynamic import keeps this file isomorphic in case of bundling
    const nodeCrypto = require("node:crypto") as typeof import("node:crypto");
    return () => {
      const buf = nodeCrypto.randomBytes(4);
      return buf.readUInt32BE(0) / 0xffffffff;
    };
  } catch {
    throw new Error("Не е намерен криптографски източник на случайност. Раздаването на роли е спряно.");
  }
}
```

(If `packages/shared` is bundled for browser too, replace `require` with proper conditional import; or split into `role-assignment.node.ts` vs browser variant. Codex: pick the cleaner approach for this codebase.)

**Add test:** `packages/shared/src/__tests__/role-assignment.test.ts` (extend existing or create):

```ts
it("refuses to assign roles when no crypto source is available", () => {
  const originalCrypto = globalThis.crypto;
  // @ts-expect-error testing destabilization
  delete globalThis.crypto;
  vi.doMock("node:crypto", () => { throw new Error("forbidden"); });
  // expect call to throw
  // ...
  globalThis.crypto = originalCrypto;
});
```

**Acceptance:** Math.random не се ползва никога. Hostile testing — disable both — throws Bulgarian error.

---

### Commit 8: `fix(bg-copy): add Bulgarian 404 page (BG-001)`

**File:** New `apps/web/app/not-found.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страницата я няма | Върколак и Мафия",
  description: "Тази страница не съществува. Върни се към масата.",
};

export default function NotFoundPage() {
  return (
    <main className="shell not-found-shell">
      <section className="paper-card not-found-card rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">404</p>
        <h1 className="mt-3 text-5xl font-black">Страницата я няма на масата.</h1>
        <p className="mt-4 max-w-2xl text-[#4f3829]">
          Може кодът на стаята да е изтекъл, или линкът да е грешен.
          Върни се към началото или избери семейство игри.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/">Към началото</Link>
          <Link className="btn btn-secondary" href="/werewolf">Върколак</Link>
          <Link className="btn btn-secondary" href="/mafia">Мафия</Link>
          <Link className="btn btn-secondary" href="/tutorial">Първа игра</Link>
        </div>
      </section>
    </main>
  );
}
```

Add minimal CSS in `globals.css`:
```css
.not-found-shell {
  display: grid;
  place-items: center;
  padding: 64px 16px;
  min-height: calc(100vh - 80px);
}
.not-found-card {
  max-width: 720px;
  text-align: left;
}
```

**Acceptance:** Open `/this-does-not-exist` → Bulgarian copy, 3 CTAs visible.

---

### Commit 9: `fix(bg-copy): replace Latin "host-ът" with "домакинът" in safe errors (BG-002)`

**File:** `apps/game-server/src/rooms/GameRoom.ts`

Lines 350, 406, 444 (and any other occurrences):
- `"Само host-ът..."` → `"Само домакинът..."`

Run `grep -rn "host-ът\|host-а\|host-а" apps/game-server/src apps/web 2>/dev/null` to confirm zero matches after the change.

Also check for any English `host` slipping into UI strings (excluding code identifiers like `player.host` field name).

**Acceptance:** No `host-ът` / `host-а` Latin word in any user-facing string in game-server.

---

## Stage 2 — P2 fixes (4 items)

### Commit 10: `fix(api): validate game-token room code format (API-001)`

**File:** `apps/web/app/api/game-token/route.ts:14-16`

Replace the validation:

```ts
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

const rawCode = typeof body.code === "string" ? normalizeRoomCode(body.code) : "";
if (!ROOM_CODE_PATTERN.test(rawCode)) {
  return NextResponse.json({ error: "Невалиден код на стая." }, { status: 400 });
}
const roomCode = rawCode;
```

**File:** `apps/web/app/api/game-token/__tests__/route.test.ts`

Add test:
- POST `{ code: "ABC" }` (3 chars) → 400
- POST `{ code: "ABCDEF1234567" }` (13 chars) → 400
- POST `{ code: "abc-123" }` (special chars) → 400
- POST `{ code: "ABC123" }` (valid) → 200

**Acceptance:** Cannot mint tokens for malformed codes.

---

### Commit 11: `fix(env): align secret minimum length to 32 chars everywhere (ENV-001)`

**File:** `packages/shared/src/server.ts:117`

Update `assertUsableSecret`:

```ts
const MIN_SECRET_LENGTH = 32;

export function assertUsableSecret(secret: string | undefined, contextName: string): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`${contextName} трябва да е поне ${MIN_SECRET_LENGTH} символа за production-grade сигурност.`);
  }
  // ... rest unchanged
}
```

**File:** `apps/web/lib/env.ts:7`

Update `BETTER_AUTH_SECRET` validation to `min(32)`.

**File:** Any test fixtures that use short secrets — bump to 32+ chars. Search `test-secret\|dev-only` and replace.

**Acceptance:** `pnpm test` + `pnpm typecheck` pass. `pnpm check:prod-env` rejects 16-char secrets.

---

### Commit 12: `fix(test): playtest passes vitest suite filters correctly (TEST-002)`

**File:** `scripts/playtest.mjs:15`

The current spawn appends a literal `--` after the package script, which Vitest interprets weirdly. Fix the argument forwarding:

```js
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";

const suites = [
  "apps/game-server/src/game-logic/__tests__/night-resolver.test.ts",
  "apps/game-server/src/__tests__/GameRoom.security.test.ts",
  "apps/game-server/src/__tests__/GameRoom.regression.test.ts",
];

// Use `vitest run <suite>` directly via --filter to ensure proper arg forwarding.
const proc = spawn(
  pnpm,
  ["--filter", "@werewolf/game-server", "exec", "vitest", "run", ...suites],
  { stdio: "inherit", shell: false }
);

proc.on("exit", (code) => process.exit(code ?? 1));
```

(If the package uses a different script name, adjust accordingly. Codex: verify `apps/game-server/package.json` has a `vitest` binary accessible via `pnpm exec`.)

**Acceptance:** `pnpm playtest` runs exactly the 3 listed suites and no others. Compare output line count vs current behavior.

---

### Commit 13: `fix(deploy): tighten production CSP (DEPLOY-002)`

**File:** `Caddyfile:9` (or wherever CSP header is set)

Current:
```
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
```

Change to:
```
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
# TODO 2026-05-16: migrate to nonce-based CSP, drop 'unsafe-inline' from script-src
```

Specific changes:
- Drop `'unsafe-eval'` from `script-src`
- Drop `http:` and `ws:` from `connect-src`
- Drop `http:` from `img-src` (keep `https:`)
- Keep `'unsafe-inline'` for now (commented TODO for future)

**Test:** boot production-like build, navigate routes, check browser console for CSP violations. If specific Next.js features break (e.g., eval-using devtools), adjust narrowly with explicit hash/nonce — do not re-add `unsafe-eval`.

**Acceptance:** CSP header in response no longer contains `unsafe-eval`. No console CSP violations during smoke test of all key routes.

---

## Stage 3 — P3 cleanup (3 items)

### Commit 14: `chore(cleanup): remove legacy AuthForm and orphan CSS (DEAD-001)`

**File:** `apps/web/components/auth-form.tsx` — **delete file**

**File:** `apps/web/app/globals.css` — remove all `.auth-form*` rules

Verify no imports remain:
```bash
grep -rEn "auth-form\|AuthForm" apps/web 2>/dev/null
```

Should return no matches.

**Acceptance:** `pnpm typecheck` + `pnpm build` pass after deletion.

---

### Commit 15: `chore(cleanup): resolve or remove stale TODOs in quickstart + game-config (TODO-001)`

**File:** `apps/web/components/landing/QuickStartSection.tsx:182,214`

For each TODO:
- If implementing is cheap (< 30 min), implement.
- If not, replace the TODO with a non-debt comment referencing a future ticket: `// Stats by family will be wired post-launch (see docs/post-launch-todo.md).`

Create `docs/post-launch-todo.md` (or append to existing) with the deferred items as a bulleted list.

**File:** `packages/shared/src/game-config.ts:66` — same treatment for the promo rules TODO.

**Acceptance:** `grep -rEn "TODO|FIXME|HACK|XXX" apps packages 2>/dev/null` returns either zero hits OR all hits are accompanied by a reference to `docs/post-launch-todo.md`.

---

### Commit 16: `docs(agents): update AGENTS.md to current stack + scripts (DOC-001)`

**File:** `AGENTS.md`

Update:
- Auth section: mention Google OAuth + Discord OAuth + email/password (not just Discord).
- Test counts: drop the explicit "39 tests" number, replace with "tests grouped under `pnpm test`, `pnpm playtest`, `pnpm e2e:auth`".
- Verify chain: list current `pnpm verify` order:
  ```
  optimize:assets → regression → typecheck → build → smoke → frontend:e2e → e2e:auth → playtest → test → visual → perf:budget
  ```
- Git hooks: replace `.husky` references with `.githooks/pre-commit`.
- Any other drift you find (cross-check sections against repo state).

**Acceptance:** `AGENTS.md` matches current state of repo. New contributor reading it can run `pnpm verify` end-to-end without surprise.

---

## Final verification

After all 16 commits, run:

```bash
pnpm install
pnpm regression
pnpm typecheck
pnpm build
pnpm test
pnpm smoke
pnpm frontend:e2e
E2E_LOCAL_ONLY=true pnpm e2e:auth   # locally without DB
pnpm playtest
# repeat 10 times: pnpm playtest && echo "PASS $i"
pnpm visual
pnpm perf:budget
pnpm audit
```

Expected results:
- All commands pass.
- `pnpm audit` shows 0 high-severity OR documented deferred advisories.
- `pnpm playtest` is deterministic over 10 consecutive runs.
- Manual: open `/this-does-not-exist` → BG 404.
- Manual: `curl -X GET '/api/achievements?userId=victim' --no-cookie` → 401.
- Manual: log in, play a game, delete account, verify game row exists with `hostId = '00000000-0000-0000-0000-000000000000'`.

---

## Update REPORT.md

After all fixes are merged, run another regression audit pass (or have Codex update the existing report). Append a section:

```markdown
## Fix verification (YYYY-MM-DD)

All 16 findings from the 2026-05-16 audit have been addressed in branch `fix/regression-audit-followup`.

| ID | Status | Commit |
|---|---|---|
| SEC-001 | ✅ Fixed | abc1234 |
| TEST-001 | ✅ Fixed | def5678 |
... (etc)
```

Commit this update as commit #17: `docs(audit): mark all 16 findings as fixed`.

---

## PR title

`fix: address all 16 regression audit findings (9 P1, 4 P2, 3 P3)`

PR body should:
- Link to `docs/regression-audit/REPORT.md`
- List the 16 commits in order
- Note: SEC-001 dep upgrade affects all bundles; reviewers should check first-load JS budgets
- Note: DB-001 introduces a sentinel user row; will require running new migration on production DB

---

## Do NOT

- Do not group commits (each finding = one commit; do not squash).
- Do not introduce new features.
- Do not change unrelated code.
- Do not skip Stage 3 — small commits, but they keep the repo clean.
- Do not regenerate art assets or run image optimization unless a test step requires.
- Do not switch DB engines or migration tools.

---

(End of prompt)
