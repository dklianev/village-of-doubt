# Codex prompt — Full-stack regression / bug / breakage audit

Целта: Codex минава систематично през ЦЯЛОТО приложение (frontend, backend, game-server, API, БД, схема, build, deploy, dependencies) и produces **report-only** документ с всички намерени проблеми, групирани по severity. **Без code changes** — само discovery.

Output → `docs/regression-audit/REPORT.md` + optional `docs/regression-audit/FINDINGS-RAW.json` (структуриран dump за по-нататъшна автоматизация).

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, Colyseus 0.17, PostgreSQL 17 + Drizzle 0.45, Better Auth 1.6, Vitest 4, Playwright 1.59). Read `AGENTS.md` and `CLAUDE.md` first.

**This is a discovery audit, NOT an implementation task.** You produce a structured findings report. Do NOT modify production code. You MAY:
- Run read-only commands (`pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm regression`, `pnpm audit`)
- Read any file
- Search / grep across the codebase
- Boot servers in dev mode for runtime inspection
- Create new files in `docs/regression-audit/` (the report and supporting docs)

**You may NOT:**
- Edit code outside `docs/regression-audit/`
- Commit fixes (this audit precedes the fix PRs)
- Run destructive DB operations
- Skip categories — every section must produce findings or explicit "no issues found"

All commit messages must be in English (project convention). One commit at the end: `docs(audit): full-stack regression audit report`.

---

## Output deliverable

### Primary: `docs/regression-audit/REPORT.md`

Structure:
```markdown
# Full-stack regression audit · YYYY-MM-DD

## Executive summary
- 🔴 P0 (blocker): N findings
- 🟠 P1 (high): N findings
- 🟡 P2 (medium): N findings
- 🟢 P3 (low): N findings

## Top 10 most urgent

(numbered list, hyperlinks to per-category sections)

## Findings by category

### 1. Build & TypeScript
...

### 2. Test failures & flakiness
...

(...etc for each of the 15 categories below)

## Findings index by file (cross-reference)

`apps/web/components/foo.tsx`
- Finding #12 (P1): missing prop validation
- Finding #34 (P2): unused export

## Recommended fix order
(suggested PR sequence)

## What was NOT audited
(any limitations / out-of-scope notes)
```

Each finding has format:
```
**[ID] [Severity] [Category] Short title**
File: `path/to/file.tsx:42`
Repro: `pnpm typecheck` outputs ... / open /play/ABC and click ...
Impact: Crashes на отваряне на /play; засяга всеки логнат потребител.
Suggested fix: Provide default for `session.user.image` или предпази с optional chain.
```

### Secondary: `docs/regression-audit/FINDINGS-RAW.json`

Same findings in JSON for tooling. Schema:
```json
{
  "auditDate": "2026-05-16",
  "totals": { "p0": 0, "p1": 0, "p2": 0, "p3": 0 },
  "findings": [
    {
      "id": "FRONT-001",
      "severity": "P1",
      "category": "frontend",
      "title": "...",
      "file": "apps/web/components/foo.tsx",
      "line": 42,
      "repro": "...",
      "impact": "...",
      "suggestedFix": "..."
    }
  ]
}
```

---

## 15 categories — what to audit, how, and what to look for

### 1. Build & TypeScript

**Run:**
```bash
pnpm typecheck 2>&1 | tee /tmp/typecheck.log
pnpm build 2>&1 | tee /tmp/build.log
```

**Look for:**
- TypeScript errors / warnings (even with strict mode, things can creep in)
- `@ts-ignore` / `@ts-expect-error` / `as any` / `as unknown as X` — list each with file:line + brief rationale check
- `eslint-disable` comments — list each with rationale
- Build warnings (missing prerender data, edge runtime conflicts, etc.)
- Bundle size warnings ("First Load JS exceeds X kB")
- Optimization hints from Next.js (Image with priority but no width, etc.)

**Severity guidance:** Hard TS errors = P0; warnings = P2; @ts-ignore in critical path = P1.

---

### 2. Test failures & flakiness

**Run:**
```bash
pnpm test 2>&1 | tee /tmp/test.log
pnpm regression 2>&1 | tee /tmp/regression.log
pnpm smoke 2>&1 | tee /tmp/smoke.log
pnpm frontend:e2e 2>&1 | tee /tmp/frontend-e2e.log
pnpm playtest 2>&1 | tee /tmp/playtest.log
```

**Look for:**
- Any failing test → P0
- Skipped tests (`.skip`, `.todo`) — list each, classify if intentional → P2/P3
- Timeout-related warnings (slow tests) → P2
- Console output suggesting flakiness (random ordering bugs)
- Tests that test mocks rather than logic — note them as low-value coverage

---

### 3. BG-only invariant violations (user-facing copy)

Project requires all user-facing strings in Bulgarian Cyrillic. Latin words in copy = invariant violation.

**Run:**
```bash
grep -rEn "\\b(replay|grind|host|chat|live|loading|continue|cancel|save|delete|sign|login|logout|register|account|name|click|tap)\\b" apps/web/app apps/web/components 2>/dev/null | grep -v ".next" | grep -v "from\\|import\\|className\\|aria-\\|href=\\|src=\\|type=\\|data-\\|key=" | grep -v "// "
```

**Manual file reads to verify:**
- All `metadata` objects in `apps/web/app/**/page.tsx` — descriptions in БГ
- All `<h1>/<h2>/<h3>/<p>` content in components
- All `aria-label` / `aria-labelledby` (these ARE user-facing for screen readers)
- All toast messages / error strings emitted to UI
- All BG strings in game-server `messageBg` / `causeBg` fields

**Severity:** Each Latin word in visible UI = P1 (BG-only is a documented invariant).

---

### 4. Frontend runtime errors

**Boot dev server** and navigate through every route:
```bash
pnpm dev # in background
```

For each route in this list, open it and capture console errors / network failures:
- `/`, `/werewolf`, `/mafia`, `/werewolf/create`, `/mafia/create`
- `/werewolf/join`, `/mafia/join`, `/werewolf/join/TEST01`
- `/werewolf/roles`, `/mafia/roles`, `/roles`
- `/werewolf/rules`, `/mafia/rules`
- `/tutorial`, `/sign-in`, `/lobby`, `/lobby/TEST01`
- `/play/TEST01`, `/history`, `/leaderboard`, `/achievements`, `/friends`
- `/offline` (test PWA offline behavior)
- 404 page (open `/this-does-not-exist`)

**Capture:**
- Browser console errors / warnings (use Playwright headless run with `page.on("console", ...)` and `page.on("pageerror", ...)`)
- Network requests returning 4xx / 5xx
- Hydration mismatch warnings
- React key warnings
- "useEffect missing dependency" warnings
- Image format / lazy load warnings

Use Playwright MCP (`mcp__plugin_playwright_playwright__browser_*`) or write a one-shot Node script `docs/regression-audit/probe-routes.mjs` to automate.

**Severity:** Console error → P1; warning → P2; network failure → P0 if blocks usage.

---

### 5. Responsive layout breakage

Reuse existing visual baseline at `audit-v3/desktop/` and `audit-v3/mobile/`. Compare these against current state by re-shooting screenshots at the same viewports (1440×900, 390×844).

**Tool:** Playwright + image diff (use `pixelmatch` if available, or a simple "did size or layout dramatically change" check).

**Look for:**
- Layout broken at 390px (text wraps mid-word, elements overflow)
- Hidden CTAs / clipped buttons on mobile
- Horizontal scroll appearing
- Sticky elements failing to stick
- Modal/dropdown positioning broken

Save fresh screenshots to `docs/regression-audit/screenshots/` and reference them in findings.

**Severity:** Functionally blocked on mobile → P0; visually awkward → P2.

---

### 6. Game-server (Colyseus) correctness

**Files:** `apps/game-server/src/rooms/GameRoom.ts`, `apps/game-server/src/rooms/schemas/`, `apps/game-server/src/game-logic/`

**Look for:**
- **Role leaks** in synced state: any field on `state.players` ScSchema that contains the `role` (only `revealedRole` should be public). Compare ScSchema definitions vs what gets set.
- **Authorization checks missing** на onMessage handlers: every handler that performs privileged action (start game, set narrator, pause, advance phase) trябва да проверява `ownPlayer.host || ownPlayer.narrator`.
- **Race conditions**: handlers that mutate state without ordering protection (`Promise.all` with shared writes).
- **Capacity caps**: `MAX_PUBLIC_EVENTS=120`, `MAX_PUBLIC_CHAT=80` — verify trim logic is present and works under spam.
- **Reconnect handling**: что happens when same `userId` reconnects mid-game? Verify role is restored, not regenerated.
- **Crypto randomness**: role assignment must use `crypto.randomBytes` / `crypto.getRandomValues`, NOT `Math.random` (security invariant).
- **Token validation**: HMAC verify with timing-safe equality (`crypto.timingSafeEqual`).
- **Token expiry**: 5-minute TTL enforced.
- **Pending state cleanup**: `pendingMayorSuccessor`, `pendingHunterRevenge` flags clear on phase advance.
- **Memory leaks**: timers (`setTimeout` / `setInterval`) cleared on room dispose.

**Severity:** Role leak → P0. Auth bypass → P0. Race condition → P1. Memory leak → P1.

---

### 7. Authorization & secrets (cross-stack)

**Look for:**
- Any `GAME_TOKEN_SECRET` / `BETTER_AUTH_SECRET` / `DATABASE_URL` hardcoded outside `.env.example` files
- Production guards: `scripts/check-production-env.mjs` covers what?
  - Verify `ALLOW_DEV_AUTH !== "true"` enforced when `NODE_ENV === "production"`
  - Verify `GAME_TOKEN_SECRET` ≥ 32 chars and не съдържа dev placeholders
  - Verify `OAUTH_MOCK` (ако съществува) NOT enabled in prod
- `apps/web/app/api/**/route.ts` — всеки mutation endpoint трябва да изисква session
- Open redirects: `/sign-in?redirect=URL` — accept-ва ли external URL? Трябва да валидира relative path само.
- CORS: `apps/game-server/src/index.ts` — CORS deny-by-default? Whitelist?
- CSRF: Better Auth has CSRF protection by default — verify it's not disabled
- Discord/Google OAuth callback URLs — match whitelist?

**Severity:** Exposed secret in production code → P0. Auth bypass → P0. Open redirect → P1.

---

### 8. API route hygiene (Next.js routes)

**Files:** `apps/web/app/api/**/route.ts`

For each route, verify:
- HTTP method is correct (POST for mutations, GET for queries)
- Input validation (zod or manual checks)
- Error responses: consistent shape `{ error: string }` with БГ message + correct status code
- Auth gate where required (`getSession` check)
- No unhandled rejections
- No leaked stack traces in error response (production check)
- Idempotency where it matters (delete should be idempotent)
- Rate limiting (Better Auth has it; custom endpoints may not)

**Look for:**
- Routes that accept arbitrary user input without validation
- Routes returning 500 instead of 4xx for client errors
- Routes that swallow errors silently
- Routes missing logging on failures

---

### 9. Database schema integrity

**Files:** `packages/database/src/schema.ts`, `packages/database/drizzle/migrations/*.sql`

**Run:**
```bash
pnpm --filter @werewolf/database db:generate 2>&1 | tee /tmp/db-generate.log
```

**Look for:**
- **Migration drift**: `db:generate` produces new migrations? → schema.ts has uncommitted changes
- **Missing indexes** на hot query paths: searches by `userId`, joins на `gameId`, sort by `endedAt`
- **Missing FK constraints**: every "X belongs to user/game" should have FK
- **Cascade behavior**: deleting a user — what happens to their game records, achievements, sessions? Document each FK and its `ON DELETE` policy.
- **NOT NULL constraints** missing where they should be set
- **Default values**: are they sane? (e.g. `createdAt` default `now()`)
- **Better Auth tables** (`user`, `session`, `account`, `verification`) present and aligned with Better Auth version
- **Unused tables** / columns from removed features
- **Naming consistency**: camelCase in TS, snake_case in SQL — Drizzle handles mapping but verify it's set
- **Migrations idempotency**: re-running migrations should not fail

---

### 10. Production env & deployment guards

**Files:** `scripts/check-production-env.mjs`, `docker-compose*.yml`, `Caddyfile`, `apps/web/proxy.ts`, `apps/game-server/src/index.ts`

**Look for:**
- Каква е shape-ът на `.env` за production? List required vars.
- `scripts/check-production-env.mjs` — какво проверява? Какво **не** проверява?
- Docker compose:
  - Service health checks
  - Restart policies
  - Volume mounts
  - Network isolation between web/game-server/DB
  - Secrets management (env_file vs hard-coded)
- Caddy:
  - HTTPS termination configured
  - WebSocket upgrade headers (за Colyseus)
  - Rate limiting / DDoS protection
  - HSTS headers
  - CSP headers (Content-Security-Policy)
- Graceful shutdown:
  - Game-server: SIGTERM handler that disconnects clients cleanly
  - Web: Next.js обикновено handle-ва това
- Logging:
  - PII в logs? (имейли, displayNames)
  - Log levels appropriate?
  - Errors are logged with stack traces?

---

### 11. Dependency security

**Run:**
```bash
pnpm audit --json > /tmp/audit.json
```

**Output processing:**
- Group by severity (critical/high/moderate/low)
- For each vulnerable dep: список с засегнати packages + fix version
- Note transitive vs direct dependencies

**Additional manual checks:**
- `package.json` files — any deps marked deprecated на npm?
- Any deps not used (run `depcheck` ако е достъпно, или manually grep imports vs `dependencies`)?
- Lock file consistency: `pnpm install --frozen-lockfile` should pass

---

### 12. Performance regressions

**Run:**
```bash
pnpm build
```

**Capture:**
- `apps/web/.next/build-manifest.json` — bundle sizes per route
- Largest chunks (`apps/web/.next/static/chunks/*.js`)
- Image asset sizes in `apps/web/public/game-art/`
- CSS bundle size

**Compare against budgets (if defined):**
- Total JS gzipped per route < 220 KB
- Total CSS < 70 KB
- Largest art asset < 800 KB
- Hero images < 400 KB

**Look for:**
- New dependencies that bloated bundle
- Unoptimized images (PNG without WebP variant)
- Imports of full lodash / moment instead of specific functions
- Client components that should be server components

---

### 13. Dead code / unused exports

**Tools:**
- `pnpm ts-prune` (if installed) — лист unused exports
- Manual: `grep -r "export const X"` vs `grep -r "import.*X"` for suspicious symbols

**Look for:**
- Unused React components
- Unused utility functions
- Unused CSS classes (orphans в `globals.css` без съответен JSX usage)
- Commented-out code blocks > 5 lines
- `console.log` / `console.warn` в production code (не debug paths)
- Empty try-catch blocks
- Functions с TODO bodies

---

### 14. TODO / FIXME / HACK debt

**Run:**
```bash
grep -rEn "TODO|FIXME|HACK|XXX|@deprecated" apps/ packages/ scripts/ 2>/dev/null | grep -v "node_modules\|.next"
```

**Classify each:**
- Active concern (still relevant) → list with file:line
- Stale (referenced code that no longer exists) → P3 cleanup
- Documentation gap (TODO is "add docs") → P3
- Security TODO ("TODO: add rate limiting") → P1

---

### 15. Documentation drift

**Files to verify against actual code:**
- `AGENTS.md` — invariants section: still all enforced?
- `CLAUDE.md` — hooks / skills mentioned actually exist?
- `docs/rules-bg.md` — references roles that exist?
- `docs/werewolf-rules-implementation-status.md` — matrix accurate?
- `README.md` (если съществува) — quickstart instructions работят?
- `.env.example` — has every env var that's read by code?
- API documentation (if any) matches actual endpoints?

---

## Execution plan for Codex

Recommended order (some categories depend on prior commands):

1. **Setup** — pull latest, ensure clean working tree, `pnpm install`.
2. **Static checks** (parallel): categories 1, 3, 13, 14, 15. These are grep + read.
3. **Run command-based checks** (serial — they need clean state):
   - `pnpm typecheck` (category 1)
   - `pnpm regression` (category 2)
   - `pnpm test` (category 2)
   - `pnpm smoke`, `pnpm frontend:e2e`, `pnpm playtest` (category 2, 4)
   - `pnpm audit` (category 11)
   - `pnpm build` (category 1, 12)
   - `pnpm --filter @werewolf/database db:generate` (category 9)
4. **Manual code reading** (categories 6, 7, 8, 9, 10).
5. **Runtime probing** (category 4, 5):
   - Boot dev servers
   - Use Playwright MCP to walk routes
6. **Compile report** — synthesize findings into `REPORT.md` + `FINDINGS-RAW.json`.
7. **Commit** — single commit `docs(audit): full-stack regression audit report`.

---

## Severity definitions

| Severity | Meaning | Examples |
|---|---|---|
| 🔴 **P0 (blocker)** | App is unusable, security hole, data loss risk, or breaks core flow | Role leak, auth bypass, build fails, crash on key route |
| 🟠 **P1 (high)** | Significant degradation; should fix before public launch | BG-only violation in visible UI, missing input validation, console errors on every page, missing FK constraint |
| 🟡 **P2 (medium)** | Quality / polish issue; fix in follow-up | Layout awkward at edge breakpoint, TypeScript warning, dead code, docs drift |
| 🟢 **P3 (low)** | Nice-to-have cleanup | TODO comment cleanup, unused import, stylistic inconsistency |

---

## Constraints

- **Read-only**: do not modify source code outside `docs/regression-audit/`.
- **Be exhaustive**: every category produces findings OR explicit "no issues found in this category — verified via X commands and Y file reads".
- **Be specific**: every finding has file:line + reproducible repro. Vague observations ("could be cleaner") are excluded.
- **Be honest about uncertainty**: if you can't determine if something is a bug (e.g. you don't know intent), classify as "question" with severity ❓ and explain.
- **Bulgarian for user-facing strings in your findings descriptions when describing UI**, English for technical writing. Commit message in English.
- **No new npm dependencies** for the audit itself (use what's already installed).

---

## Acceptance criteria

1. `docs/regression-audit/REPORT.md` exists with all 15 categories addressed.
2. `docs/regression-audit/FINDINGS-RAW.json` exists with structured data.
3. Each finding has: ID, severity, category, title, file:line, repro, impact, suggested fix.
4. Executive summary at top of REPORT.md has accurate totals.
5. Top 10 most urgent section at top, hyperlinked to per-category sections.
6. At minimum: ran `pnpm typecheck`, `pnpm regression`, `pnpm test`, `pnpm build`, `pnpm audit`, `pnpm --filter @werewolf/database db:generate`.
7. At minimum: probed via Playwright at least 6 key routes for console errors.
8. Optional `docs/regression-audit/screenshots/` directory if visual regressions found.
9. Single English commit at the end: `docs(audit): full-stack regression audit report`.
10. No production code changes; `git status` shows only files under `docs/regression-audit/`.

---

## Do NOT do

- Do not fix issues — only catalog. Fixes will come in follow-up PRs informed by this report.
- Do not run destructive DB operations.
- Do not modify production code, `.env`, lock files, or game-server logic.
- Do not skip categories. If a category has nothing, write "No issues found" with proof.
- Do not invent issues. Every finding must be reproducible from listed file:line.
- Do not include accessibility findings (out of scope per project decision).
- Do not include subjective design opinions (those are separate audits like `audit-v3/`).

---

## Verification by user

When complete, user-ът ще:
1. `cat docs/regression-audit/REPORT.md` — checks totals + top-10.
2. Random sample 3 findings: open the file at the cited line, reproduce, verify the finding is real.
3. Compare against existing `audit-v3/REPORT.md` — overlapping items should be cross-referenced (note in REPORT.md "this overlaps with audit-v3 P0 #X").

---

(End of prompt)
