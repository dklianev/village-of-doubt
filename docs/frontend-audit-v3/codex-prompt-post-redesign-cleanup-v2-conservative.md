# Codex master prompt — Post-redesign cleanup v2 (conservative)

Successor to `codex-prompt-post-redesign-cleanup-v1.md`. Same 10-axis scope, **but reordered and detuned per user review (2026-05-23)**:

- **PR A** target softened: `globals.css` `< 19,000` LOC first sweep, not `< 15,000`. Grep + visual gate every delete.
- **PR B** (assets) explicitly second; no mass PNG fallback deletion; strict before/after report.
- **PRs C–E** (page migrations) stay third — same as v1 but with conservative dead-CSS posture inherited from PR A.
- **PR F** (copy) **moved AFTER all layout migrations**. Pure user-visible change, isolated, small diffs.
- **PR G** (`play-room-client` split) only after layout work is stable.
- **PR H §8.2 axe sweep removed** — `packages/ui/__visual__/ui-primitives.spec.ts` already runs AxeBuilder over `#storybook-root` and passes 44/44. We only add focus/hover/disabled stories and per-route axe.
- **PR I** unchanged.
- **PR J** treated as **almost a separate project** — STOP and ask for explicit start before PR J, even after all of A–I merge.

> **NOT a re-spec of v1 implementation guidance.** Per-PR file paths, code snippets, and acceptance metrics in v1 §1–§10 remain authoritative. v2 only changes posture, gating, ordering, and the corrections listed in §A. Treat v1 as the implementation manual; v2 as the operating instructions.

| # | Axis | PR | Effort | When |
|---|---|---|---|---|
| 1 | CSS dead-code sweep (conservative) | **PR A** | ~2 h | First |
| 2 | Asset diet (strict reporting) | **PR B** | ~3 h | After PR A merges |
| 3 | `/account` + `/history` migration | **PR C** | ~3 h | After PR B merges |
| 4 | `/achievements` + `/leaderboard` + `/friends` | **PR D** | ~3 h | After PR C merges |
| 5 | `/tutorial` + `/sign-in` + `/lobby` | **PR E** | ~3 h | After PR D merges |
| 6 | Legacy copy migration | **PR F** | ~1 h | **After all layout migrations (C+D+E)** |
| 7 | `play-room-client.tsx` split | **PR G** | ~5 h | After PR F merges |
| 8 | Tests + focus stories + per-route axe | **PR H** | ~3 h | After PR G merges |
| 9 | RSC audit + bundle budget enforce | **PR I** | ~2 h | After PR H merges |
| 10 | `GameRoom.ts` split + DB hygiene | **PR J** | ~6 h | **STOP — wait for explicit user start** |

**Cumulative**: ≈ **48 atomic commits across 10 PRs**, ~28 h Codex at high reasoning. PR J effort excluded from rolling-start budget.

---

# §A — Five corrections vs v1 (authoritative)

These supersede the corresponding sections of v1.

### A.1 — PR A targets

**v1 said**: `globals.css` < 14,000 (cumulative after A+C+D+E).
**v2 says**:
- **After PR A alone**: `< 19,000` LOC. ≈ 1,300+ lines removed conservatively.
- Cumulative target after PRs A+C+D+E: **`< 17,000`** (not 14,000).
- A second targeted CSS sweep ("PR A.2") may follow later, but ONLY if visual regression remains green and after each layout migration PR has settled.

**Why**: agressive deletion just to hit a number risks invisible regressions. Grep + visual first; trim what is *provably* dead.

### A.2 — Mandatory delete protocol per CSS class

Before deleting ANY class rule from `globals.css`, Codex MUST run and paste output into the PR description:

```bash
# Replace <PREFIX> with status-hero, privacy-hero, etc.
PREFIX="status-hero"
for cls in $(grep -oE "^\.${PREFIX}[a-z0-9-]*" apps/web/app/globals.css | sort -u); do
  c=${cls#.}
  live=$(grep -rE "(className=\"[^\"]*${c}\\b|className=\\\`[^\\\`]*${c}\\b|data-[a-z]+=\"${c}\")" \
         apps/web --include="*.tsx" --include="*.ts" | wc -l)
  echo "$c: $live live refs"
done
```

Only classes with `0 live refs` are deletable in PR A. Anything > 0 stays.

After every commit:
1. `pnpm regression && pnpm typecheck && pnpm build`
2. `pnpm visual` — if snapshot diff > 1% pixels on any page, **revert the commit** and re-narrow the delete set. Don't update baselines in PR A.

### A.3 — PR B asset posture

**v1 said**: trim 10 largest PNGs, delete fallback PNGs aggressively.
**v2 says**:
- Generate report BEFORE: `node scripts/optimize-assets.mjs --report-only > /tmp/asset-diet-before.csv`
- Generate report AFTER: `node scripts/optimize-assets.mjs --report-only > /tmp/asset-diet-after.csv`
- Both reports committed under `docs/asset-diet-PR-B.md` for traceability.
- **Do NOT delete original PNG fallbacks** unless an audit (`grep -rn "\.png" apps/web/components apps/web/app`) confirms no JSX consumer references the `.png` path. WebP/AVIF additions are net new files; PNG fallback only goes away after the consumer's `<Image src>` is provably `.webp`.
- Target softened: **`< 320 MB`** in `apps/web/public/game-art` after PR B (down from 458 MB), not `< 250 MB`. Achievable via WebP fill + 10 PNG trim without deletions.
- The 8 raw `<img>` → `next/image` commits from v1 §2.4 are unchanged.

### A.4 — PR F (copy) ordering and isolation

**v1 said**: PR F sits at position 6, between layout PRs and `play-room-client` split.
**v2 says**:
- PR F moves to **immediately after PRs C+D+E merge**, position **6 of 10**, but timing is "all layout work stable" — Codex must confirm no in-flight layout regressions before opening PR F.
- Each of the 5 copy migrations stays its own commit (v1 §6 unchanged).
- **DO NOT** flip dictionary rules from `legacy: true` to `legacy: false` in the same PR as the copy migration. That flip is **PR F.2** — a tiny follow-up PR opened only after PR F sits clean in production for ≥ 1 week.

### A.5 — PR H §8.2 axe scope

**v1 said**: extend `ui-primitives.spec.ts` with AxeBuilder.
**v2 says**: this is **already done** in v3.1. Verified:

```bash
grep -n "AxeBuilder\|axe-core" packages/ui/__visual__/ui-primitives.spec.ts
# expected: 1+ hits inside the test loop
pnpm visual:ui 2>&1 | grep -E "(axe|passed|failed)"
# expected: 44/44 passing, no axe failures
```

**Skip v1's Commit 4 in PR H entirely.** PR H scope shrinks to:
- 3 commits for test coverage of play subcomponents (v1 §8.1 commits 1–3, unchanged)
- 1 commit for focus/hover/disabled story variants on interactive primitives (v1 §8.4)
- 1 commit for per-route axe sweep on the 14 main routes (v1 §8.3)

**PR H total**: 5 commits, not 6.

### A.6 — PR J gating

**v1 said**: open PR J after PR I.
**v2 says**: after PR I merges, **STOP**. PR J touches game-server protocol surface and DB workflow — it is "almost a separate project." Codex must surface a status summary and wait for explicit user start before opening PR J. Do NOT batch PR I → PR J in one session.

---

# §B — Pre-work: branch hygiene

Worktree may be dirty when this prompt is handed to Codex. Before opening PR A, Codex runs:

```bash
git status --short
# If output is non-empty:
#   1. List the dirty files in the PR description as "pre-existing local state"
#   2. DO NOT add them to PR A
#   3. Create the branch from origin/main (NOT from current HEAD if HEAD has uncommitted changes)
git fetch origin
git checkout -b post-redesign/css-dead-code-sweep origin/main
```

If the user wants their local edits preserved across the branch switch, they should stash before handing off:

```bash
git stash push -m "pre-cleanup wip" .env.example docs/*.md
git restore apps/web/next-env.d.ts   # auto-generated, safe to discard
```

Codex SHOULD NOT run `git stash` or `git restore` on its own. If worktree is dirty, ask the user before proceeding.

---

# §C — PR A: CSS dead-code sweep (conservative, ~2 h, 4 commits)

Same scope as v1 §1, but with the **A.1 + A.2 corrections** applied. Reproduced here for self-containment:

## §C.1 — Status page dead CSS

Run the §A.2 delete-protocol scan for prefix `status-hero` and `status-incident`. Expected live-ref result (from 2026-05-23 audit):

| Class | Live refs | Action |
|---|---|---|
| `.status-hero-meta`, `.status-hero-dot`, `.status-hero-meta-label`, `.status-hero-refresh`, `.status-hero-time` | > 0 (used by `StatusHero.tsx` inside `SceneCard`) | KEEP |
| `.status-hero-banner`, `.status-hero-scrim`, `.status-hero-inner`, `.status-hero-kicker`, `.status-hero-title`, `.status-hero-subtitle`, `.status-hero-img`, `.status-hero` (root) | 0 | DELETE |
| `.status-incident-card`, `.status-incident-head`, `.status-incident-body` | 0 | DELETE |
| `.status-tile*`, `.status-section*`, `.status-page`, `.status-content`, `.status-subscribe*`, `.status-legend*` | > 0 | KEEP (used by `StatusServiceTiles`, page shell) |

Estimated removal: ~180 LOC.

After delete: `pnpm regression && pnpm typecheck && pnpm build && pnpm visual --grep "/status"`. If visual drifts > 1% pixels, revert.

**Commit 1**: `chore(css): remove dead .status-hero* and .status-incident* rules superseded by SceneCard`

## §C.2 — Privacy page dead CSS

Scan prefix `privacy-hero` and `privacy-section-head` / `privacy-section-kicker` / `privacy-section-lede` / `privacy-section-preview` (these are the chrome rules replaced by `PrivacyHero`'s `SceneCard` + `PrivacySections`' `PaperCard` + `Eyebrow`).

KEEP `.privacy-data-*`, `.privacy-promise-*`, `.privacy-rights-*`, `.privacy-version-*` — specialised content widgets that primitives don't cover.

Estimated removal: ~250–350 LOC (depends on §A.2 scan).

**Commit 2**: `chore(css): remove dead .privacy-hero* and .privacy-section-head/kicker/lede/preview rules`

## §C.3 — Terms + Report + FAQ dead CSS

Same protocol for:
- `terms-hero*`, `terms-section-head`, `terms-section-kicker`
- `report-hero*`, `report-success*` chrome (KEEP `.report-wizard-*`)
- `faq-hearth-banner*`, `faq-hearth-inner`, `faq-hearth-title`, `faq-hearth-kicker` (KEEP `.faq-search-*`, `.faq-question-*`, `.faq-category-*`)

Estimated removal: ~400–600 LOC combined.

**Commit 3**: `chore(css): remove dead .terms-hero*, .report-hero*, .faq-hearth-banner* shell rules`

## §C.4 — Cleanup log

Create `docs/css-cleanup-log.md` (v1 §1.4 template, unchanged). Fill actual line deltas from `wc -l` before and after each commit.

**Commit 4**: `docs(css): document CSS cleanup log + future migration policy`

**PR A close-out**:
- `wc -l apps/web/app/globals.css` must be `< 19,000`. If still ≥ 19,000 after legitimate deletes only, that's acceptable — open a follow-up PR A.2 rather than forcing the number.
- Full `pnpm verify` green.
- `pnpm visual` snapshots unchanged (no baseline updates in PR A).

---

# §D — PRs B through I

For each PR below, **v1's `§<n>` section is the implementation spec**. v2 only changes posture per §A.

## D.1 — PR B (assets)

- Follow v1 §2 commits 1–5.
- Apply correction **A.3**: BEFORE/AFTER reports committed under `docs/asset-diet-PR-B.md`. No PNG fallback deletion without consumer audit.
- v1 §2.5 regression contract (`asset size budget`) stays — that protects future commits.
- Target softened to `< 320 MB` and `≤ 5` PNGs > 1 MB.

## D.2 — PR C (account + history)

- Follow v1 §3 unchanged (6 commits).
- After PR C merges, no CSS sweep beyond the dead `.account-hero*`, `.case-file-header`, `.replay-hero*` rules in v1 §3.5. Anything broader belongs in PR A.2.

## D.3 — PR D (achievements + leaderboard + friends)

- Follow v1 §4 unchanged (7 commits).
- Same conservative dead-CSS posture.

## D.4 — PR E (tutorial + sign-in + lobby)

- Follow v1 §5 unchanged (8 commits).
- After PR E merges, run `wc -l apps/web/app/globals.css`. Cumulative target: **`< 17,000`** (was `< 16,000` in v1; eased by 1,000).

## D.5 — PR F (copy) — **opens only after C+D+E settle**

- Follow v1 §6 commits 1–5 unchanged.
- **DROP** v1's optional Commit 6 ("flip legacy rules to hard"). That becomes **PR F.2**, opened ≥ 1 week after PR F lands in production (correction A.4).

## D.6 — PR G (`play-room-client.tsx` split)

- Follow v1 §7 unchanged (8 commits).
- Pre-flight assertion: `pnpm playtest` must pass before any extraction commit. After each extraction commit, re-run `pnpm playtest`. Any failure → revert that one commit.

## D.7 — PR H (tests + a11y) — **shrunk per A.5**

5 commits, not 6:

1. **v1 §8.1 commit 1**: `test(play): cover NightActionPanel + VotingPanel + PlayerTile`
2. **v1 §8.1 commit 2**: `test(play): cover ConnectionBanner + ReconnectModal + Timer`
3. **v1 §8.1 commit 3**: `test(play): cover RoleCard + NarratorDesk`
4. **v1 §8.4** (now commit 4): `test(ui): add focus/hover/disabled story variants for interactive primitives`
5. **v1 §8.3** (now commit 5): `test(visual): add per-route axe-core a11y sweep across 14 main routes`

**Skip v1 §8.2 entirely** — confirmed already wired in v3.1.

## D.8 — PR I (RSC + bundle budget)

- Follow v1 §9 unchanged (4 commits).
- After PR I merges → **STOP**. Surface a status summary to the user. Do NOT open PR J without explicit start.

---

# §E — PR J (game-server + DB) — gated

**Treat PR J as a separate engagement.** It's:
- High-risk (touches protocol surface)
- Requires `role-mechanics-reviewer` agent after every single commit
- Touches `apps/game-server/src/rooms/GameRoom.ts` (2,475 LOC) — the most complex file in the repo
- Includes database migration workflow changes that need ops coordination

Codex MUST NOT auto-start PR J. When PRs A–I all land:

1. Run a status summary in the chat with metrics (LOC deltas, test counts, asset MB).
2. Ask: "PRs A–I are merged. PR J is a 6 h, 9-commit refactor of the game-server orchestration + DB workflow. Proceed?"
3. Wait for explicit user "да" / "go" before opening PR J.

When/if the user says go, follow v1 §10 unchanged.

---

# §F — Acceptance criteria (softened per §A)

| Metric | Before | After (v2 target) |
|---|---|---|
| `wc -l apps/web/app/globals.css` | 20,328 | **< 17,000** (was < 14,000 in v1) |
| `du -sh apps/web/public/game-art` | 458 MB | **< 320 MB** (was < 250 MB in v1) |
| `find ... -name "*.png" -size +1M \| wc -l` | 35+ | ≤ 5 (unchanged) |
| `wc -l apps/web/components/play-room-client.tsx` | 1,438 | < 900 (unchanged) |
| `wc -l apps/game-server/src/rooms/GameRoom.ts` | 2,475 | < 1,500 (PR J only) |
| `find apps/web/components/play -name "*.test.tsx" \| wc -l` | 5 | ≥ 13 (unchanged) |
| `"use client"` in `apps/web/components/` | 69 | ≤ 50 (unchanged) |
| `pnpm check:dict` legacy hits | 17 | 0 (after PR F) |
| Pages on `@werewolf/ui` | 5 | ≥ 14 (after PR E) |
| `pnpm visual:ui` baselines | 44 | ≥ 56 (PR H focus + per-route axe) |
| Bundle budget enforced in `pnpm verify` | No | Yes (PR I) |
| Schema drift contract in regression | No | Yes (PR J only) |

`pnpm verify` MUST be green at every PR boundary.

---

# §G — Failure modes (same as v1 §13)

Unchanged from v1. Key additions for v2 conservative posture:

| Symptom | v2 response |
|---|---|
| §A.2 scan shows > 0 live refs for a class you wanted to delete | KEEP the class. The PR adds nothing about it. Don't try to "fix" the JSX in the same PR. |
| `pnpm visual` drift after CSS delete | **Revert.** Never update baselines in PR A. |
| Asset diet report shows file shrank but visual diff | Revert that file's recompression; tune the sharp settings. |
| `pnpm check:dict` legacy hits remain after PR F | Open PR F.2 (small follow-up). Don't ship PR F as a "fix everything" PR. |
| Layout migration introduces text drift detected by `bg-copy-reviewer` | Stop the PR; fix copy; re-run agent; only then continue. |
| PR J temptation after PR I lands | STOP. See §E. |

---

# §H — Operator notes (Codex / ChatGPT)

- **One PR open at a time.** Don't draft PR B branch while PR A is still in review.
- **Conservative > clever.** When in doubt, KEEP the CSS rule. v1's aggressive targets are aspirational, not deadline-driven.
- **Visual regression is the only ground truth.** Both `pnpm visual` (full app) and `pnpm visual:ui` (Storybook) must stay green.
- **Every commit message in English, every user-facing string in Bulgarian.** Always invoke `bg-copy-reviewer` on JSX + `.md` touching commits.
- **No new dependencies in PRs A–I.** PR J may add drizzle-orm relation helpers if absent.
- **No `prefers-reduced-motion` guards anywhere.** Project convention.
- **No font swap.** Noto Serif Display + Noto Serif + Iowan Old Style stay.
- **Sacred files in v1 §0.2 and §B.2 still apply.**
- **PR J is its own conversation.** Surface status and pause. Don't auto-start it.

---

# §I — Sources

- `docs/frontend-audit-v3/codex-prompt-post-redesign-cleanup-v1.md` (parent — implementation spec)
- `docs/frontend-audit-v3/codex-prompt-hybrid-redesign-adoption-v3.1-master.md` (v3.1 master — design system foundation)
- `docs/dictionary.md` (Bulgarian copy SOT)
- `docs/css-cleanup-log.md` (created in PR A)
- `AGENTS.md` (project conventions)

State verified against worktree on 2026-05-23.
