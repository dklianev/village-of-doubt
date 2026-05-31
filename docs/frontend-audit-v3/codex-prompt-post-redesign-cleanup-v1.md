# Codex master prompt — Post-redesign cleanup v1 (full sweep)

Sequel to `codex-prompt-hybrid-redesign-adoption-v3.1-master.md`. After PR 1-5 from v3.1 landed and `@werewolf/ui` is live, this prompt covers the **10 remaining improvement axes** identified in the post-redesign audit (2026-05-23):

| # | Axis | Effort | Impact | PR |
|---|---|---|---|---|
| 1 | CSS dead-code sweep (status + legal + 4 более) | ~2 h | 🔥🔥🔥 | PR A |
| 2 | Asset diet (auto-WebP + `next/image` swap) | ~3 h | 🔥🔥🔥 | PR B |
| 3 | `/account` + `/history` migration to primitives | ~3 h | 🔥🔥 | PR C |
| 4 | `/achievements` + `/leaderboard` + `/friends` migration | ~3 h | 🔥🔥 | PR D |
| 5 | `/tutorial` + `/sign-in` + `/lobby` migration | ~3 h | 🔥🔥 | PR E |
| 6 | Legacy copy migration (Постижения → Легенди и др.) | ~1 h | 🔥 | PR F |
| 7 | `play-room-client.tsx` split (extract 4 hooks) | ~5 h | 🔥🔥 | PR G |
| 8 | Test coverage for play/* subcomponents + a11y | ~4 h | 🔥🔥 | PR H |
| 9 | RSC audit + bundle budget enforce in CI | ~2 h | 🔥 | PR I |
| 10 | `GameRoom.ts` split (3 modules) + DB relations | ~6 h | 🔥 | PR J |

**Total scope**: ≈ **52 atomic English commits across 10 PRs**, ~32 hours Codex work at high reasoning.

> **Operating rules** (non-negotiable, inherited from v3.1):
> 1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. If red → revert.
> 2. At each phase/PR boundary: full `pnpm verify`.
> 3. Visual regression (`pnpm visual` and `pnpm visual:ui`) green or explicitly updated in same commit.
> 4. Bulgarian-only user-facing copy. Invoke `bg-copy-reviewer` agent after every commit touching JSX text or `.md`.
> 5. **No `prefers-reduced-motion` guards anywhere.** Project convention.
> 6. **No font swap.** Noto Serif Display + Noto Serif + Iowan Old Style stay.
> 7. Deps stay pinned to v3.1 §0.4 versions. No new dependencies unless a PR explicitly says so.
> 8. Sacred preservation list (§0.2) — DO NOT TOUCH unless a PR explicitly authorises.
> 9. PR-gating: PRs A-J ship in order. Don't open PR B until PR A merges.
> 10. Atomic commits, no folding. Each commit owns ≤ 1 conceptual change.
> 11. After every commit touching `apps/game-server/src/**` or `packages/shared/src/{role-assignment,win-conditions,protocol}.ts`, invoke `role-mechanics-reviewer` agent.

---

# §0 — Pre-flight, sacred list, gating commands

## §0.1 — Pre-flight verification

```bash
# v3.1 must have landed
test -d packages/ui/src/primitives                              && echo "✓ @werewolf/ui live"
test -f apps/web/components/ArtifactImage.tsx                   && echo "✓ ArtifactImage exists"
ls packages/ui/src/primitives/*.tsx | wc -l                     # = 11
ls packages/ui/__visual__/__baseline__/ui-primitives.spec.ts-snapshots/*.png | wc -l  # = 44
grep -q "Design system" AGENTS.md                               && echo "✓ AGENTS.md updated in v3.1"
grep -q "@werewolf/ui/tokens.css" apps/web/app/globals.css      && echo "✓ tokens bridged"

# Baseline metrics for impact tracking
wc -l apps/web/app/globals.css                                  # ~20,328 → target < 15,000 after PR A
wc -l apps/web/components/play-room-client.tsx                  # 1,438 → target < 900 after PR G
find apps/web/public/game-art -name "*.png" | wc -l             # 180 → target < 50 after PR B
find apps/web/public/game-art -name "*.webp" | wc -l            # 289 → target ≥ 460 after PR B
pnpm regression 2>&1 | tail -3                                  # must be green
pnpm --filter @werewolf/ui test 2>&1 | tail -3                  # 43 passing
```

If any fail → STOP, document in `docs/frontend-audit-v3/blocked-items-post-redesign.md`.

## §0.2 — Sacred preservation list (DO NOT TOUCH unless PR allows)

- `apps/web/hooks/use-timer-countdown.ts`
- `apps/web/lib/use-modal.ts`, `auth-errors.ts`, `clipboard.ts`
- `apps/web/components/account/AccountDangerZone.tsx` — destructive flow, only PR C may add `Dialog` wrapper
- `apps/web/app/history/[gameId]/replay/page.tsx` — only PR C may touch its hero chrome
- `apps/web/app/create/page.tsx` — only PR E may touch
- All `--legal-shell-*`, `--hero-card-*`, `--art-*`, `--texture-*`, `--faction-*` tokens
- `apps/game-server/src/game-logic/night-resolver.ts` — only PR J §10.3 may modify, and only behind `role-mechanics-reviewer`
- `packages/shared/src/{role-assignment,win-conditions,protocol}.ts` — frozen
- `play-room-client.tsx` — sacred until PR G; PRs A-F must NOT touch it

## §0.3 — Atomic commit gates

After EVERY commit, run in order:

```bash
pnpm regression
pnpm typecheck
pnpm build
```

If any fails → `git revert HEAD` immediately. Don't pile fixes; isolate the failing commit.

At each PR boundary:

```bash
pnpm verify
```

After commits that touch:
- JSX text or `.md` files → invoke `bg-copy-reviewer` agent
- `apps/game-server/src/**` or `packages/shared/src/{role-assignment,win-conditions,protocol}.ts` → invoke `role-mechanics-reviewer` agent
- `packages/ui/src/**` → also run `pnpm --filter @werewolf/ui test` and `pnpm visual:ui`

---

# §1 — PR A: CSS dead-code sweep (~2 h, 4 commits)

After v3.1, the following CSS class families are dead code (their JSX consumers were migrated to `@werewolf/ui` primitives):

| Family | Approx. range in `globals.css` | Replaced by |
|---|---|---|
| `.status-hero*`, `.status-tile*` (kept), `.status-incident-card*`, `.status-hero-banner*`, `.status-hero-scrim`, `.status-hero-inner`, `.status-hero-title`, `.status-hero-subtitle`, `.status-hero-kicker` | lines ~17,977-18,160 (≈ 180 LOC) | `SceneCard` + `Display` + `Eyebrow` in `StatusHero.tsx` |
| `.privacy-shell`, `.privacy-hero*`, `.privacy-section*`, `.privacy-data-*` (preview-card chrome only — KEEP layout/grid rules) | lines ~16,043-16,500 (≈ 450 LOC, audit needed) | `SceneCard`/`PaperCard` |
| `.terms-shell`, `.terms-hero*`, `.terms-section*` | ~600 LOC range | `SceneCard`/`PaperCard` |
| `.report-shell`, `.report-hero*`, `.report-success*` | ~400 LOC range | `SceneCard`/`PaperCard` + `EmptyState` |
| `.faq-shell`, `.faq-hearth-*` (FaqHearth chrome only) | ~250 LOC range | `SceneCard` |

> **`.status-tile*` STAYS** — `StatusServiceTiles.tsx` was intentionally left on legacy classes in v3.1 §6.1.

## §1.1 — Status page dead CSS

```bash
# Identify dead rules
grep -n "^\.status-hero\|^\.status-incident" apps/web/app/globals.css > /tmp/dead-status.txt
# Sanity-check no JSX consumer still uses them
for cls in status-hero status-hero-banner status-hero-scrim status-hero-inner status-hero-kicker status-hero-title status-hero-subtitle status-hero-meta status-hero-dot status-hero-meta-label status-hero-refresh status-hero-img status-incident-card status-incident-head; do
  hits=$(grep -rE "(className=\"[^\"]*${cls}|className=\\\`[^\\\`]*${cls})" apps/web --include="*.tsx" | wc -l)
  echo "$cls: $hits live refs"
done
```

Only `status-hero-meta`, `status-hero-dot`, `status-hero-meta-label`, `status-hero-refresh`, `status-hero-time` should remain live (used by `StatusHero.tsx` inside the new `SceneCard`).

Delete all the others. Keep `.status-section*`, `.status-tile*`, `.status-page`, `.status-content`, `.status-section-head`, `.status-section-kicker`, `.status-subscribe*`, `.status-legend*` — those still drive `StatusServiceTiles`, `StatusSubscribe`, `StatusLegend`, and the page shell.

Run `pnpm visual` after — if status snapshots drift > 1% pixels, run `pnpm visual:update` only after manual inspection.

**Commit 1**: `chore(css): remove dead .status-hero* rules superseded by SceneCard primitive`

## §1.2 — Privacy page dead CSS

Same procedure, scoped to `.privacy-hero*` (replaced by `PrivacyHero`'s `SceneCard`) and `.privacy-section-head`, `.privacy-section-kicker`, `.privacy-section-lede`, `.privacy-section-preview` (replaced by `PaperCard` + `Display` + `Eyebrow`).

KEEP `.privacy-data-*`, `.privacy-promise-*`, `.privacy-rights-*`, `.privacy-version-*` — these drive specialised content widgets that primitives don't cover.

Run the consumer-check loop from §1.1 with `privacy-` prefix before deleting.

**Commit 2**: `chore(css): remove dead .privacy-hero* and .privacy-section* shell rules`

## §1.3 — Terms + Report + FAQ dead CSS

Same procedure for:
- `.terms-hero*`, `.terms-section-head`, `.terms-section-kicker` → replaced by `TermsHero` (`SceneCard`) and `Display`/`Eyebrow` inside `PaperCard`s
- `.report-hero*`, `.report-success*` chrome → replaced by `ReportHero` (`SceneCard`) and `EmptyState`
- `.faq-hearth-banner*`, `.faq-hearth-inner`, `.faq-hearth-title`, `.faq-hearth-kicker` → replaced by `FaqHearth` (`SceneCard`)

KEEP `.terms-commitments-*`, `.terms-legal-annex-*`, `.terms-conflict-*`, `.report-wizard-*`, `.faq-search-*`, `.faq-question-*`, `.faq-category-*` — these drive specialised content.

**Commit 3**: `chore(css): remove dead .terms-hero*, .report-hero*, .faq-hearth-banner* shell rules`

## §1.4 — Document the sweep

Create `docs/css-cleanup-log.md`:

```md
# CSS cleanup log

## PR A — 2026-XX-XX (post-redesign sweep)

Lines removed from `apps/web/app/globals.css`:

| Class family | LOC removed | Replaced by |
|---|---|---|
| `.status-hero*`, `.status-incident-card*` | XXX | `SceneCard` + `PaperCard` in `StatusHero.tsx`, `StatusLastIncident.tsx` |
| `.privacy-hero*`, `.privacy-section-head*` | XXX | `PrivacyHero`, `PrivacySections` (`SceneCard`/`PaperCard`) |
| `.terms-hero*`, `.terms-section-head*` | XXX | `TermsHero`, etc. |
| `.report-hero*`, `.report-success*` | XXX | `ReportHero`, `EmptyState` |
| `.faq-hearth-banner*` | XXX | `FaqHearth` |

**Net delta**: `wc -l apps/web/app/globals.css` went from X to Y (Δ -ZZZZ).

## Verification

- Visual regression baselines: `pnpm visual` — all snapshots stable
- UI primitive baselines: `pnpm visual:ui` — unchanged (44 PNGs)
- Lighthouse Performance on /status, /privacy, /terms, /report, /faq: no regression

## Policy

Future PRs migrating chrome to primitives MUST append a section here documenting
which CSS class families became dead code.
```

Fill in actual line counts after the sweep lands.

**Commit 4**: `docs(css): document CSS cleanup log + future migration policy`

**At end of PR A**: run full `pnpm verify`. Confirm `wc -l apps/web/app/globals.css` < 19,000 (~1,500 LOC removed minimum).

---

# §2 — PR B: Asset diet (~3 h, 6 commits)

Current state: 458 MB `apps/web/public/game-art`, 469 files, 180 PNGs, 289 WebPs. Goal: WebP coverage 100% for files > 200 KB, 10 largest PNGs trimmed below 400 KB each, raw `<img>` replaced by `next/image`.

## §2.1 — Audit + run existing optimizer

```bash
node scripts/optimize-assets.mjs --report-only > /tmp/asset-report.txt
node scripts/optimize-assets.mjs
```

The script already exists. Verify it produces WebP for every PNG > 200 KB. If it does not, extend it (see §2.2).

**Commit 1**: `chore(assets): run optimize-assets.mjs to backfill missing WebP variants`

## §2.2 — Extend `scripts/optimize-assets.mjs` for AVIF + size budgets

If the existing script lacks AVIF output or size-budget enforcement, extend it to:

```js
// scripts/optimize-assets.mjs (extension)
const SIZE_BUDGET_KB = {
  hero: 400,      // bg-landing-*, bg-narrator-*, etc.
  tile: 150,      // icon-ability-*, faction-*
  thumbnail: 60,  // role-portrait-*
};

// For each PNG > 200 KB:
//   1. Generate .webp (q=82, smart subsampling)
//   2. Generate .avif (q=60) for hero-class assets
//   3. If output > budget, downscale via sharp.resize({ withoutEnlargement: true })
//   4. Log src → out size delta to /tmp/asset-diet.csv
```

Use `sharp@^0.34` (already in node_modules via Next). Don't add new top-level deps.

**Commit 2**: `feat(scripts): extend optimize-assets.mjs with AVIF + size-budget enforcement`

## §2.3 — Trim the 10 largest PNGs

Run:

```bash
find apps/web/public/game-art -name "*.png" -size +1M | xargs -I {} ls -lh {} | sort -k5 -rh | head -10
```

Targets identified in 2026-05-23 audit:

| File | Current | Target |
|---|---|---|
| `card-back-secret.png` | 3.6 MB | < 400 KB WebP |
| `village-map.png` | 3.4 MB | < 400 KB WebP |
| `icon-ability-bless.png` | 3.1 MB | < 150 KB WebP |
| `faction-village.png` | 3.0 MB | < 200 KB WebP |
| `icon-ability-lovers.png` | 3.0 MB | < 150 KB WebP |
| `icon-ability-kill.png` | 3.0 MB | < 150 KB WebP |
| `icon-ability-kill-alt.png` | 3.0 MB | < 150 KB WebP |
| `icon-ability-heal.png` | 3.0 MB | < 150 KB WebP |
| `icon-phase-day.png` | 3.0 MB | < 200 KB WebP |
| `texture-parchment.png` | 3.0 MB | < 200 KB WebP |

For each: regenerate the WebP at the target size (use `sharp` resize + AVIF where it helps). Don't delete the PNG — keep it as a fallback for `<picture>` srcsets, but only if a JSX consumer actually uses it.

**Commit 3**: `perf(assets): trim 10 largest game-art PNGs (3 MB+ → < 400 KB WebP)`

## §2.4 — Migrate `<img>` to `next/image`

Audit found 8 files using raw `<img>`:

- `apps/web/components/account/AccountHero.tsx`
- `apps/web/components/leaderboard/__tests__/MainHeadline.test.tsx` (test fixture, leave alone)
- `apps/web/components/lobby/RoleDetailModal.tsx`
- `apps/web/components/lobby/RoleTileLarge.tsx`
- `apps/web/components/manual-role-builder.tsx`
- `apps/web/components/play/DeathRevealCinematic.tsx` — KEEP raw `<img>` if it's inside a Motion `<motion.div>` and you need precise paint timing
- `apps/web/components/sign-in/OAuthButton.tsx`
- `apps/web/components/site-chrome/AuthChip.tsx`

For each, swap `<img src="/game-art/foo.webp" />` with:

```tsx
import Image from "next/image";

<Image
  src="/game-art/foo.webp"
  alt="…meaningful Bulgarian alt text…"
  width={W}
  height={H}
  sizes="(max-width: 768px) 100vw, 50vw"
  // Add priority only if the image is above the fold
/>
```

For `OAuthButton`/`AuthChip` provider logos: keep raw `<img>` IF the asset is < 4 KB (next/image overhead isn't worth it for tiny icons).

**Commit 4**: `perf(web): swap raw <img> to next/image in account, lobby, manual-role-builder`

**Commit 5**: `perf(web): swap raw <img> to next/image in sign-in, AuthChip (where ≥ 4 KB)`

## §2.5 — Regression contract for asset budgets

Extend `scripts/regression.mjs` to add a contract:

```js
// asset-size-budget contract
async function checkAssetBudgets() {
  const report = await fs.readFile("/tmp/asset-diet.csv", "utf8").catch(() => null);
  if (!report) return; // first-run: skip
  const oversize = report
    .split("\n")
    .slice(1)
    .filter((line) => {
      const [, , , finalKb] = line.split(",");
      return parseFloat(finalKb) > 500;
    });
  if (oversize.length > 0) {
    throw new Error(`Assets over 500 KB budget:\n${oversize.join("\n")}`);
  }
}
```

Then in regression.mjs runner: `await check("asset size budget", checkAssetBudgets);`

**Commit 6**: `feat(regression): add asset size budget contract (max 500 KB per file)`

**At end of PR B**:
- `du -sh apps/web/public/game-art` should be < 250 MB (down from 458 MB)
- `find apps/web/public/game-art -name "*.png" -size +1M | wc -l` should be ≤ 5
- Full `pnpm verify` green

---

# §3 — PR C: `/account` + `/history` migration (~3 h, 6 commits)

## §3.1 — `/account` hero + dashboard

`apps/web/components/account/AccountHero.tsx`:

```diff
- import { Display, SceneCard } from "@werewolf/ui/server"; // already there? if not, add
+ import { Display, SceneCard, Eyebrow } from "@werewolf/ui/server";

- <header className="account-hero">
-   <Image src="..." className="account-hero-banner" />
-   <div className="account-hero-scrim" aria-hidden />
-   <div className="account-hero-inner">
-     <p className="account-hero-kicker">ДОСИЕ</p>
-     <h1 className="account-hero-title">{user.displayName}</h1>
-     <p className="account-hero-subtitle">{user.tagline}</p>
-   </div>
- </header>
+ <SceneCard eyebrow="ДОСИЕ" density="lg">
+   <Display size="h1">{user.displayName}</Display>
+   <p style={{ color: "var(--ds-ink-scene-soft)", fontSize: "var(--ds-type-lede)", margin: 0 }}>
+     {user.tagline}
+   </p>
+ </SceneCard>
```

Preserve the `<Image>` (it's the banner texture) — but render it INSIDE the SceneCard via `style={{ backgroundImage: ... }}` on the outer div, OR keep the SceneCard cinematic background tokens.

**Commit 1**: `refactor(account): migrate AccountHero to SceneCard + Display + Eyebrow`

## §3.2 — `/account` section cards

For each of:
- `AccountProfile.tsx`
- `AccountStats.tsx`
- `AccountAchievements.tsx`
- `AccountDataExport.tsx`
- `AccountRecentGames.tsx`

Wrap their main container with `<PaperCard eyebrow="..." density="md">` and replace inline section headings with `<Display size="h3">`.

**Sacred:** `AccountDangerZone.tsx` body stays — but its outer `<section>` can become `<PaperCard eyebrow="ОПАСНА ЗОНА" density="md">`. Confirmation modals should adopt `<Dialog>` (this IS authorised by PR C).

**Commit 2**: `refactor(account): migrate Profile + Stats + Achievements + DataExport + RecentGames to PaperCard`

**Commit 3**: `refactor(account): wrap AccountDangerZone in PaperCard and adopt Dialog for confirmation`

After commits 1-3, run `pnpm visual` for /account snapshots. If diff > 1% pixels, manually inspect — if intentional cleanup, run `pnpm visual:update`.

## §3.3 — `/history` list + replay

`apps/web/components/history/CaseFileCard.tsx`:

```diff
+ import { PaperCard, Eyebrow, Display } from "@werewolf/ui/server";

- <article className="case-file-card">
-   <header className="case-file-header">
-     <p className="case-file-kicker">ДЕЛО №{game.id}</p>
-     <h3 className="case-file-title">{game.title}</h3>
-   </header>
+ <PaperCard eyebrow={`ДЕЛО №${game.id}`} density="md">
+   <Display size="h3">{game.title}</Display>
    {/* body unchanged */}
- </article>
+ </PaperCard>
```

`apps/web/components/history/EvidenceWallEmpty.tsx`:

```diff
+ import { EmptyState } from "@werewolf/ui";
+ import { EMPTY_STATES } from "@werewolf/ui/states";
+ import { ArtifactImage } from "@/components/ArtifactImage";
+
+ const def = EMPTY_STATES["history-empty"];
+
- <div className="evidence-wall-empty">{/* ... */}</div>
+ <EmptyState
+   artifact={<ArtifactImage artifact={def.artifact} />}
+   title={def.title}
+   body={def.body}
+   action={def.action && <Pill as="a" href={def.action.href}>{def.action.label}</Pill>}
+ />
```

**Commit 4**: `refactor(history): migrate CaseFileCard to PaperCard + EvidenceWallEmpty to EmptyState`

## §3.4 — `/history/[gameId]/replay` hero

`apps/web/app/history/[gameId]/replay/page.tsx` — only the hero chrome (top of file). Body stays untouched (sacred).

```diff
+ import { Display, SceneCard, Eyebrow } from "@werewolf/ui/server";

- <header className="replay-hero">
-   <p className="replay-kicker">ДЕЛО №{game.id}</p>
-   <h1 className="replay-title">{game.title}</h1>
- </header>
+ <SceneCard eyebrow={`ДЕЛО №${game.id}`} density="lg">
+   <Display size="h1">{game.title}</Display>
+ </SceneCard>
```

**Commit 5**: `refactor(history): migrate replay hero chrome to SceneCard + Display`

## §3.5 — Dead CSS cleanup for /account + /history

Following PR A's policy: identify `.account-hero*`, `.case-file-header`, `.replay-hero*` rules in `globals.css` and delete them (after confirming no live references).

Append to `docs/css-cleanup-log.md`.

**Commit 6**: `chore(css): remove dead .account-hero* and .replay-hero* rules + log update`

**At end of PR C**: invoke `bg-copy-reviewer` agent on all touched files. Full `pnpm verify`.

---

# §4 — PR D: `/achievements` + `/leaderboard` + `/friends` migration (~3 h, 7 commits)

## §4.1 — `/achievements`

`apps/web/components/achievements-client.tsx`:

1. Hero → `<SceneCard eyebrow="ЛЕГЕНДИ">` (use spec copy, but the page header may already say „Постижения" — that's handled in PR F)
2. Zero state → `<EmptyState>` from `EMPTY_STATES["achievements-zero"]`
3. Locked-card placeholder → `<EmptyState>` from `EMPTY_STATES["achievements-locked"]`
4. Each achievement card → wrap in `<PaperCard density="sm">` instead of raw `<article>`

**Commit 1**: `refactor(achievements): migrate hero + cards to SceneCard + PaperCard`

**Commit 2**: `refactor(achievements): adopt EmptyState for zero + locked variants`

## §4.2 — `/leaderboard`

If `apps/web/components/leaderboard/` does NOT exist, create it. Migrate:

1. Hero → `<SceneCard eyebrow="ВЕЧЕРЕН БРОЙ">` (spec copy)
2. Main headline (already at `leaderboard/MainHeadline.tsx`) → `<Display size="h1">`
3. Empty week → `<EmptyState>` from `EMPTY_STATES["leaderboard-week-empty"]`
4. Empty all-time → `<EmptyState>` from `EMPTY_STATES["leaderboard-empty"]`
5. Row tiles → `<PaperCard density="sm">`

**Commit 3**: `refactor(leaderboard): migrate hero + MainHeadline to SceneCard + Display`

**Commit 4**: `refactor(leaderboard): adopt EmptyState for week-empty + all-time-empty + row PaperCard`

## §4.3 — `/friends`

`apps/web/components/friends-client.tsx` (190 LOC, 1 file):

1. Hero → `<SceneCard eyebrow="ПОЗНАТИ НА МАСАТА">` (spec copy)
2. Friends grid → each friend tile in `<PaperCard density="sm">`
3. Empty → `<EmptyState>` from `EMPTY_STATES["friends-empty"]`
4. Pending invites empty → `<EmptyState>` from `EMPTY_STATES["friends-pending"]`
5. Invite CTA → `<Pill intent="primary">`

**Commit 5**: `refactor(friends): migrate FriendsClient to SceneCard + PaperCard + Pill`

**Commit 6**: `refactor(friends): adopt EmptyState for empty + pending variants`

## §4.4 — Dead CSS sweep

Identify `.achievements-hero*`, `.leaderboard-hero*`, `.friends-hero*`, `.friend-tile*`, `.achievement-card-locked*` and remove following PR A policy. Append to `docs/css-cleanup-log.md`.

**Commit 7**: `chore(css): remove dead .achievements-hero*, .leaderboard-hero*, .friends-hero* rules`

**At end of PR D**: invoke `bg-copy-reviewer` agent. Full `pnpm verify`. Run `pnpm visual` and update baselines if intentional.

---

# §5 — PR E: `/tutorial` + `/sign-in` + `/lobby` migration (~3 h, 8 commits)

## §5.1 — `/tutorial` slide chrome

`apps/web/components/tutorial/TutorialSlide.tsx` (shared chrome):

```diff
+ import { PaperCard, Display, Eyebrow } from "@werewolf/ui/server";

- <article className="tutorial-slide">
-   <p className="tutorial-slide-kicker">{kicker}</p>
-   <h2 className="tutorial-slide-title">{title}</h2>
-   <div className="tutorial-slide-body">{children}</div>
- </article>
+ <PaperCard eyebrow={kicker} density="lg">
+   <Display size="h2">{title}</Display>
+   {children}
+ </PaperCard>
```

This single change propagates through `SlideSetup`, `SlideNight`, `SlideDay`, `SlideVote`, `SlideResolution`, `SlideFinal`.

**Commit 1**: `refactor(tutorial): migrate TutorialSlide chrome to PaperCard + Display`

## §5.2 — `/tutorial` flipbook hero

`apps/web/components/tutorial/TutorialFlipbook.tsx`:

Hero (the slot at the top before slides start) → `<SceneCard eyebrow="ПЪРВИ СТЪПКИ" density="lg">`.

**Commit 2**: `refactor(tutorial): migrate TutorialFlipbook hero to SceneCard`

## §5.3 — `/sign-in`

`apps/web/components/sign-in/OAuthButton.tsx`:

```diff
+ import { Pill } from "@werewolf/ui";

- <button type="button" className="oauth-button" onClick={onClick}>
-   <img src={`/oauth/${provider}.svg`} alt="" width={20} height={20} />
-   <span>{label}</span>
- </button>
+ <Pill intent="secondary" onClick={onClick}>
+   <img src={`/oauth/${provider}.svg`} alt="" width={20} height={20} aria-hidden />
+   <span>{label}</span>
+ </Pill>
```

The sign-in page hero (if any) → `<SceneCard eyebrow="ВЛИЗАНЕ">`.

**Commit 3**: `refactor(sign-in): migrate OAuthButton to Pill primitive`

**Commit 4**: `refactor(sign-in): migrate page hero to SceneCard`

## §5.4 — `/lobby` wizard

`apps/web/components/lobby/LobbyWizard.tsx` (189 LOC) + steps in `apps/web/components/lobby/Step*.tsx`:

1. Wizard frame → `<SceneCard eyebrow="ЛОБИ" density="lg">`
2. Each step body → `<PaperCard density="md">`
3. Step progress chip → `<Pill intent="ghost" size="sm">`
4. Primary/secondary action buttons → `<Pill intent="primary">` / `<Pill intent="secondary">`

`apps/web/components/lobby/StepRoles.tsx` (242 LOC) — biggest step file. Same treatment.

**Commit 5**: `refactor(lobby): migrate LobbyWizard frame to SceneCard`

**Commit 6**: `refactor(lobby): migrate Step* bodies to PaperCard + Pill for actions`

**Commit 7**: `refactor(lobby): adopt Pill for step progress chips`

## §5.5 — Dead CSS sweep

`.tutorial-slide-*`, `.tutorial-flipbook-hero*`, `.oauth-button*`, `.lobby-wizard-frame*`, `.lobby-step-*` etc.

**Commit 8**: `chore(css): remove dead .tutorial-slide*, .oauth-button*, .lobby-wizard* rules`

**At end of PR E**: invoke `bg-copy-reviewer` agent. Full `pnpm verify`. **Confirm `globals.css` is < 16,000 LOC** (cumulative target after PR A + C + D + E).

---

# §6 — PR F: Legacy copy migration (~1 h, 5 commits)

The dictionary in `docs/dictionary.md` lists these "legacy-OK" overrides that should be flipped to the spec terms. Each gets its own commit because Bulgarian copy review is paramount.

| Current production | Spec target | Files affected |
|---|---|---|
| Постижения | Легенди | `nav-links.ts`, `AuthChip.tsx`, `SlideResolution.tsx`, `account/AccountAchievements.tsx`, `/achievements/page.tsx`, possibly `i18n` copy if it exists |
| Класация | Вечерен брой | `nav-links.ts`, `SlideResolution.tsx`, `/leaderboard/page.tsx`, `leaderboard/MainHeadline.tsx` |
| Често задавани въпроси | Седни до огъня | `/faq/page.tsx`, `nav-links.ts` |
| Приятели | Познати на масата | `nav-links.ts`, `/friends/page.tsx`, `friends-client.tsx` |
| Профил | Досие | `nav-links.ts`, `AuthChip.tsx`, `/account/page.tsx` |
| Доклад | Сигнал | `nav-links.ts`, footer if linked, `/report/page.tsx` |

For each:

```bash
# Confirm scope before editing
grep -rn "Постижения" apps/web --include="*.tsx" --include="*.ts" --include="*.md"
```

Replace ONLY user-facing text (JSX children, button labels, `<title>`/metadata). DO NOT rename TypeScript identifiers, route paths, file names, or analytics event names.

**Commit 1**: `feat(copy): migrate „Постижения" → „Легенди" across nav, AuthChip, achievements, tutorial`

**Commit 2**: `feat(copy): migrate „Класация" → „Вечерен брой" across nav, leaderboard, tutorial`

**Commit 3**: `feat(copy): migrate „Често задавани въпроси" → „Седни до огъня" across faq, nav`

**Commit 4**: `feat(copy): migrate „Приятели" → „Познати на масата" + „Профил" → „Досие" across nav, friends, account`

**Commit 5**: `feat(copy): migrate „Доклад" → „Сигнал" across nav, report`

After each: run `pnpm check:dict` — the `[legacy]` count should decrease. Final state: `pnpm check:dict` reports `0 hard warnings, 0 legacy-OK hits`.

Flip `scripts/check-dictionary.mjs` legacy rules from `legacy: true` to `legacy: false` AFTER all 5 commits land — that turns warnings into hard fails. Add this as part of Commit 5 (final commit body), OR as a separate Commit 6:

**Commit 6** (optional): `chore(scripts): flip dictionary legacy rules to hard warnings after copy migration`

**Invoke `bg-copy-reviewer` agent** on every touched file. Full `pnpm verify`.

---

# §7 — PR G: `play-room-client.tsx` split (~5 h, 8 commits)

Current state: **1,438 LOC**, 28 `useState`, 10 `useEffect`, 62 hook calls in a single body. Target: **< 900 LOC** by extracting 4 cohesive hooks. The file STAYS as the orchestrator — extractions go into `apps/web/hooks/play/*.ts`.

**Goal — make each extracted hook independently testable.**

## §7.1 — Pre-flight: snapshot behavior

Before any extraction:

```bash
# Snapshot the file
cp apps/web/components/play-room-client.tsx /tmp/play-room-baseline.tsx

# Run the full play test surface
pnpm --filter @werewolf/web test -- play-room-client
pnpm playtest  # full headless game playthrough
pnpm visual --grep "/play"
```

All must be green before extraction. After every extraction commit, re-run all three.

## §7.2 — Extract `useGameRoom` hook

Create `apps/web/hooks/play/use-game-room.ts`. Owns:
- `Room | null` state
- `createGameClient` invocation
- `room.onMessage` / `room.onStateChange` listeners (just the connection — keep game-state derivation in the client for now)
- `ROOM_RECONNECT_STORAGE_PREFIX` storage glue
- `reconnectNowRef` and reconnect attempts (lines ~140-220 in current file)

Public API:

```ts
export interface UseGameRoomOptions {
  code: string;
  createOptions?: CreateRoomOptions;
  onStateChange?: (state: ColyseusSchema) => void;
  onMessage?: (type: string, payload: unknown) => void;
  onError?: (error: Error) => void;
}

export interface UseGameRoomResult {
  room: Room | null;
  connectionStatus: "idle" | "connecting" | "connected" | "reconnecting" | "failed";
  reconnectAttempts: number;
  reconnectNow: () => void;
}

export function useGameRoom(opts: UseGameRoomOptions): UseGameRoomResult;
```

Test in `apps/web/hooks/play/__tests__/use-game-room.test.ts` — vitest with mocked `createGameClient`. Cover: happy path connect, reconnect on disconnect, max-attempt failure.

**Commit 1**: `refactor(play): extract useGameRoom hook (connection + reconnect)`

## §7.3 — Extract `useCueMode` hook

Owns `CUE_MODE_STORAGE_KEY`, cue-mode state + setter, `triggerDeviceCue` wiring.

`apps/web/hooks/play/use-cue-mode.ts`:

```ts
export type CueMode = "audio" | "haptic" | "off";

export interface UseCueModeResult {
  mode: CueMode;
  setMode: (mode: CueMode) => void;
  trigger: (event: CueEvent) => void;
}

export function useCueMode(): UseCueModeResult;
```

Test: storage persistence, mode-switch debounce, trigger no-op when `mode === "off"`.

**Commit 2**: `refactor(play): extract useCueMode hook (sound + haptics)`

## §7.4 — Extract `usePhaseTransitions` hook

Owns `PhaseTransitionOverlay` trigger state, `DeathRevealCinematic` trigger queue, `PreGameCountdown` state machine.

`apps/web/hooks/play/use-phase-transitions.ts`:

```ts
export interface UsePhaseTransitionsResult {
  currentOverlay: "none" | "phase-change" | "death-reveal" | "pregame-countdown";
  queueDeathReveal: (player: PublicPlayer) => void;
  queuePhaseChange: (next: GamePhase) => void;
  dismissOverlay: () => void;
}

export function usePhaseTransitions(opts: {
  phase: GamePhase;
  onCue?: (event: CueEvent) => void;
}): UsePhaseTransitionsResult;
```

Test: queueing two deaths shows both in sequence, dismissing first reveals second.

**Commit 3**: `refactor(play): extract usePhaseTransitions hook (overlay queue)`

## §7.5 — Extract `useReconnectQueue` hook (separate from §7.2)

If the reconnect logic stayed inside `useGameRoom` and grew too large (> 250 LOC), split the queue/backoff piece into its own hook:

`apps/web/hooks/play/use-reconnect-queue.ts`:

```ts
export interface UseReconnectQueueOptions {
  maxAttempts: number;
  initialDelayMs: number;
  multiplier: number;
}

export function useReconnectQueue(opts: UseReconnectQueueOptions): {
  attempts: number;
  nextAttemptAt: number | null;
  scheduleNext: () => void;
  reset: () => void;
};
```

Skip this commit if §7.2 left the queue manageable (< 100 LOC inside useGameRoom).

**Commit 4** (conditional): `refactor(play): extract useReconnectQueue hook from useGameRoom`

## §7.6 — Update `play-room-client.tsx` to consume hooks

Replace the inlined state/effects with the new hook calls. Aim for `play-room-client.tsx` < 900 LOC.

**Commit 5**: `refactor(play): consume extracted hooks in PlayRoomClient orchestrator`

## §7.7 — Move pure helpers out

Already-exported pure helpers in `play-room-client.tsx`:
- `arePhaseSlicesEqual` (line 1272)
- `arePlayerListsEqual` (line 1295)
- `createRoomOptionsSignature` (line ~87)

Move them to `apps/web/lib/play/equality.ts` (or extend the existing `apps/web/lib/play/types.ts`). Update all consumers.

**Commit 6**: `refactor(play): move arePhaseSlicesEqual + arePlayerListsEqual to lib/play/equality.ts`

## §7.8 — Add unit tests for orchestrator

`apps/web/components/__tests__/play-room-client.test.tsx`:

- Renders without crashing for each phase (`lobby`, `night`, `day`, `vote`, `post-game`)
- Sets up Colyseus mocks via `vi.mock("@/lib/colyseus-client", ...)`
- Confirms `useGameRoom` is called with correct `code` prop
- Confirms reconnect button fires `reconnectNow`

**Commit 7**: `test(play): unit-cover PlayRoomClient orchestrator and extracted hooks`

## §7.9 — Document hook contracts

Create `apps/web/hooks/play/README.md`:

```md
# Play hooks

Extracted from `PlayRoomClient` in PR G (2026-XX-XX). Each hook owns a single
concern and is independently testable.

| Hook | Owns | Lines | Tests |
|---|---|---|---|
| `useGameRoom` | Colyseus connection + lifecycle | ~250 | use-game-room.test.ts |
| `useCueMode` | Audio/haptic cue routing | ~80 | use-cue-mode.test.ts |
| `usePhaseTransitions` | Overlay/cinematic queue | ~140 | use-phase-transitions.test.ts |
| `useReconnectQueue` | Backoff scheduling (if extracted) | ~80 | use-reconnect-queue.test.ts |

PlayRoomClient now < 900 LOC and is a thin orchestrator over these.
```

**Commit 8**: `docs(play): document extracted hooks contracts + responsibilities`

**At end of PR G**:
- `wc -l apps/web/components/play-room-client.tsx` < 900
- All 4 hook tests green
- `pnpm playtest` green
- Full `pnpm verify`
- Invoke `role-mechanics-reviewer` agent if any hook touches game-server protocol (unlikely)

---

# §8 — PR H: Test coverage for play/* subcomponents + a11y (~4 h, 6 commits)

## §8.1 — Pick top 8 untested play subcomponents

Audit found 24 files in `apps/web/components/play/*.tsx`, ~5 with tests. Prioritise by criticality:

| Component | Why critical | Test focus |
|---|---|---|
| `NightActionPanel.tsx` | Each role's primary night UI | Renders correct action per role; submits action; disables after submit |
| `VotingPanel.tsx` | Day-phase vote casting | Renders alive players; click casts vote; double-click changes vote |
| `PlayerTile.tsx` | Identity card for each seat | Renders correct portrait per role-known state; shows dead state |
| `ConnectionBanner.tsx` | Disconnect UX | Shows when disconnected; hides on reconnect |
| `ReconnectModal.tsx` | Recovery flow | Triggers reconnect button; confirms abandon flow |
| `Timer.tsx` | Phase countdown | Counts down; flashes < 10 s; calls onExpire |
| `RoleCard.tsx` | Player's secret role | Renders role + faction; hidden in spectator mode |
| `NarratorDesk.tsx` | Narrator interactive surface | Shows narrator actions; gated by host |

For each, create `apps/web/components/play/__tests__/<Component>.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@testing-library/react";
import { NightActionPanel } from "../NightActionPanel";

describe("NightActionPanel", () => {
  it("renders wake-up for werewolf at night-2", () => {
    render(<NightActionPanel role="werewolf" phase="night-2" /* ... */ />);
    expect(screen.getByText(/будиш се/i)).toBeInTheDocument();
  });

  it("submits action when target clicked", async () => {
    const onSubmit = vi.fn();
    render(<NightActionPanel /* ... */ onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /Селянин/ }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ target: "..." }));
  });

  it("disables after submit", async () => {
    /* ... */
  });
});
```

**Commit 1**: `test(play): cover NightActionPanel + VotingPanel + PlayerTile`

**Commit 2**: `test(play): cover ConnectionBanner + ReconnectModal + Timer`

**Commit 3**: `test(play): cover RoleCard + NarratorDesk`

## §8.2 — a11y axe sweep in Storybook visual suite

`packages/ui/__visual__/ui-primitives.spec.ts` — extend with axe checks:

```ts
import AxeBuilder from "@axe-core/playwright";

for (const p of PRIMITIVES) {
  test(`@ui ${p.name} matches snapshot`, async ({ page }) => {
    await page.goto(`http://localhost:6006/${p.url}&viewMode=story`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${p.name.replace("/", "-").toLowerCase()}.png`, {
      maxDiffPixelRatio: 0.01,
    });

    const results = await new AxeBuilder({ page })
      .include("#storybook-root")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
```

Run `pnpm visual:ui` — fix any violations. Common ones: missing `aria-label`, insufficient contrast, focus visibility.

**Commit 4**: `test(visual): add axe-core sweep to per-primitive Storybook suite`

## §8.3 — Per-route a11y sweep in `pnpm visual`

Extend `playwright.config.ts` test specs (under `__visual__/`) to add axe assertions per page. Cover: `/`, `/status`, `/privacy`, `/terms`, `/report`, `/faq`, `/account`, `/history`, `/achievements`, `/leaderboard`, `/friends`, `/tutorial`, `/sign-in`, `/create`.

**Commit 5**: `test(visual): add per-route axe-core a11y sweep across 14 main routes`

## §8.4 — Storybook focus-state stories

For Pill, PaperCard, SceneCard, Dialog, Sheet, Toast — add `Focused`, `Hovered`, `Disabled` story variants using Storybook 10's `parameters.pseudo`:

```tsx
export const Focused: Story = {
  args: { ... },
  parameters: { pseudo: { focusVisible: true } },
};
```

These get captured in `pnpm visual:ui` automatically. Update baselines as needed.

**Commit 6**: `test(ui): add focus/hover/disabled story variants for interactive primitives`

**At end of PR H**:
- New tests count: ≥ 15 (8 play components × 1-2 tests each + axe coverage)
- `pnpm visual:ui` adds ~12 new baselines (focus states)
- Full `pnpm verify`

---

# §9 — PR I: RSC audit + bundle budget enforce (~2 h, 4 commits)

## §9.1 — `"use client"` audit

Currently 69 client components in `apps/web/components/`. Goal: shrink to < 50 by extracting interactive islands.

Run:

```bash
for f in $(grep -rl "^\"use client\"" apps/web/components); do
  echo "=== $f ==="
  head -5 "$f"
done > /tmp/client-audit.txt
```

For each `"use client"` file, ask:
1. Does the component use a React hook (`useState`, `useEffect`, etc.)?
2. Does it have an event handler bound at the top level?
3. Does it import from `@/lib/colyseus-client`, `@/lib/auth-client`, or other client-only modules?

If NO to all three → flip to server component (remove the `"use client"` directive).

Likely candidates:
- `apps/web/components/SiteFooter.tsx`
- `apps/web/components/JsonLd.tsx`
- `apps/web/components/resource-hints.tsx`
- `apps/web/components/skeleton.tsx`

If YES to any → extract the interactive piece into a child client component, leave the parent as a server component.

Example for `manual-role-builder.tsx` (398 LOC):
- Server shell: form layout, labels, descriptions
- Client island: `<ManualRoleBuilderForm>` — only the interactive form state

**Commit 1**: `refactor(rsc): flip SiteFooter + JsonLd + resource-hints + skeleton to server components`

**Commit 2**: `refactor(rsc): extract interactive island from manual-role-builder; server shell stays`

## §9.2 — Bundle budget script enforce in CI

`scripts/bundle-budget.mjs` exists. Verify it enforces (not just audits) and wire into `pnpm verify`.

Confirm `scripts/bundle-budget.mjs` exits non-zero when budget exceeded. If it only logs, extend it:

```js
const BUDGETS = {
  "/_next/static/chunks/main-*.js": { gzipKb: 80 },
  "/_next/static/chunks/framework-*.js": { gzipKb: 60 },
  "/_next/static/chunks/pages/_app-*.js": { gzipKb: 120 },
  "/_next/static/css/*.css": { gzipKb: 50 },
};

let failed = false;
for (const [pattern, budget] of Object.entries(BUDGETS)) {
  const files = await glob(`apps/web/.next${pattern}`);
  for (const file of files) {
    const size = await getGzipSize(file);
    const kb = size / 1024;
    const status = kb > budget.gzipKb ? "FAIL" : "ok";
    console.log(`${status}  ${file} = ${kb.toFixed(1)} KB (budget ${budget.gzipKb} KB)`);
    if (kb > budget.gzipKb) failed = true;
  }
}
process.exit(failed ? 1 : 0);
```

Add to `package.json#scripts.verify` chain (already there based on v3.1 review).

**Commit 3**: `feat(scripts): enforce bundle budget (gzipped) with hard fail in CI`

## §9.3 — RSC contract in regression

`scripts/regression.mjs` — add a contract:

```js
async function checkRscDiscipline() {
  const noClientNeeded = [
    "apps/web/components/SiteFooter.tsx",
    "apps/web/components/JsonLd.tsx",
    "apps/web/components/resource-hints.tsx",
    "apps/web/components/skeleton.tsx",
  ];
  for (const f of noClientNeeded) {
    const src = await fs.readFile(f, "utf8");
    if (src.startsWith('"use client"')) {
      throw new Error(`${f} should be a server component (no client hooks/handlers)`);
    }
  }
}
```

**Commit 4**: `feat(regression): RSC discipline contract (forbid "use client" in pure-presentational files)`

**At end of PR I**:
- `pnpm verify` includes bundle budget; fails if exceeded
- Client component count: ≤ 50 in `apps/web/components/`
- Full `pnpm verify`

---

# §10 — PR J: `GameRoom.ts` split + DB hygiene (~6 h, 9 commits)

**Highest risk PR — every commit MUST invoke `role-mechanics-reviewer` agent.**

## §10.1 — Pre-flight: full game-server test suite

```bash
pnpm --filter @werewolf/game-server test
pnpm playtest
pnpm loadtest:heavy  # optional — confirms no perf regression baseline
```

All green before extraction. After every extraction, re-run.

## §10.2 — Extract `PlayerPresenceManager`

Create `apps/game-server/src/rooms/player-presence-manager.ts`. Owns:
- `clientsByUserId: Map<string, Client>`
- `joinAttempts: Map<string, number[]>` rate limit
- `checkJoinRateLimit` static logic
- `nonceJanitorInterval`, `joinJanitorInterval`
- Client connect/disconnect handlers

Public API:

```ts
export class PlayerPresenceManager {
  constructor(opts: { onJoin: (client: Client) => void; onLeave: (userId: string) => void });
  attachClient(client: Client, userId: string): void;
  detachClient(userId: string): void;
  isRateLimited(userId: string): boolean;
  dispose(): void;
}
```

Inject into `GameRoom` constructor. Move all rate-limit & janitor static state into module-level singletons (preserving current behaviour).

Test in `apps/game-server/src/rooms/__tests__/player-presence-manager.test.ts`.

Invoke `role-mechanics-reviewer` agent after commit.

**Commit 1**: `refactor(game-server): extract PlayerPresenceManager from GameRoom (connections + rate-limit)`

## §10.3 — Extract `PhaseStateMachine`

Create `apps/game-server/src/rooms/phase-state-machine.ts`. Owns:
- `phaseTimer: clock.setTimeout`
- Phase transition logic (`lobby` → `night` → `day` → `vote` → `night` cycle)
- `pausedSnapshot` save/restore for reconnect

Public API:

```ts
export class PhaseStateMachine {
  constructor(opts: {
    clock: ClockLike;
    onPhaseEnter: (phase: GamePhase) => void;
    onPhaseExit: (phase: GamePhase) => void;
    onTick: (remainingMs: number) => void;
  });
  setPhase(phase: GamePhase, durationMs: number): void;
  pause(): void;
  resume(): void;
  getRemainingMs(): number;
  dispose(): void;
}
```

Important: night-action **resolution** logic (`game-logic/night-resolver.ts`) is sacred — `PhaseStateMachine` orchestrates phase changes but DOES NOT touch resolution.

Invoke `role-mechanics-reviewer` agent.

**Commit 2**: `refactor(game-server): extract PhaseStateMachine from GameRoom (phase orchestration + pause/resume)`

## §10.4 — Extract `AchievementBroadcaster`

Owns:
- `achievementEvents: AchievementEventLike[]`
- `announcedAchievementUnlocks: Set<string>`
- Wiring to broadcast unlocks to clients

Invoke `role-mechanics-reviewer` agent.

**Commit 3**: `refactor(game-server): extract AchievementBroadcaster from GameRoom`

## §10.5 — Update `GameRoom.ts` to compose extractions

`GameRoom` now becomes a thin coordinator:
- Instantiates `PlayerPresenceManager`, `PhaseStateMachine`, `AchievementBroadcaster`, `GamePersistence`
- Routes commands via `handleCommand` (kept inline — it's the protocol surface)
- Forwards events between components

Target: `wc -l apps/game-server/src/rooms/GameRoom.ts` < 1,500 LOC (down from 2,475).

Invoke `role-mechanics-reviewer` agent.

**Commit 4**: `refactor(game-server): compose extracted managers in GameRoom orchestrator (< 1500 LOC)`

## §10.6 — Database relations + drizzle migrations workflow

`packages/database/src/schema.ts` — add relations:

```ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  gamePlayers: many(gamePlayers),
  achievements: many(userAchievements),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  players: many(gamePlayers),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  user: one(users, { fields: [gamePlayers.userId], references: [users.id] }),
  game: one(games, { fields: [gamePlayers.gameId], references: [games.id] }),
}));
```

Now refactor 2 known N+1 hotspots in `packages/database/src/queries.ts` (lines 138, 366) to use relational queries:

```ts
// Before
const player = await db.select(...).from(gamePlayers).innerJoin(games, ...);

// After
const player = await db.query.gamePlayers.findFirst({
  where: eq(gamePlayers.id, id),
  with: { game: true, user: true },
});
```

**Commit 5**: `feat(database): add drizzle relations for users + games + gamePlayers + achievements`

**Commit 6**: `perf(database): use relational queries in queries.ts (replaces 2 raw innerJoin chains)`

## §10.7 — Migration workflow audit

Currently `packages/database/migrations/` has only 1 SQL file → indicates `db:push` is the active workflow (risky for prod schema drift).

1. Run `pnpm db:generate` after any schema change going forward
2. Add `packages/database/README.md` documenting:
   - Always `pnpm db:generate` after editing `schema.ts`
   - Never `pnpm db:push` against production
   - `pnpm db:migrate` is the only path to prod
3. Wire `pnpm db:generate --dry-run` into `pnpm regression` to catch unsaved schema drift

```js
// scripts/regression.mjs addition
async function checkSchemaDrift() {
  const { execSync } = await import("node:child_process");
  try {
    execSync("pnpm --filter @werewolf/database db:generate --dry-run", { stdio: "pipe" });
  } catch (err) {
    throw new Error("Schema drift detected — run `pnpm db:generate` and commit the migration");
  }
}
```

**Commit 7**: `docs(database): document migration workflow + add README`

**Commit 8**: `feat(regression): add schema drift contract (drizzle generate --dry-run)`

## §10.8 — Final AGENTS.md update

Append to `AGENTS.md`:

```md
## Post-redesign architecture (PR J, 2026-XX-XX)

### Game server modules

`GameRoom.ts` is now a thin orchestrator over:
- `PlayerPresenceManager` — connections, rate limits, janitors
- `PhaseStateMachine` — phase transitions, pause/resume
- `AchievementBroadcaster` — unlock events
- `GamePersistence` (existing) — DB writes

Sacred: `game-logic/night-resolver.ts` and the `handleCommand` protocol surface
in `GameRoom`. Any change to either MUST be approved by `role-mechanics-reviewer`.

### Database

Drizzle relations live in `schema.ts`. Use relational queries via
`db.query.<table>.findFirst({ with: {...} })` instead of raw joins.

Migrations workflow:
- Always `pnpm db:generate` after editing `schema.ts`
- Never `pnpm db:push` against production
- `pnpm db:migrate` is the only path to prod
- `pnpm regression` includes schema drift check
```

**Commit 9**: `docs(agents): document post-redesign game-server modules + DB migration workflow`

**At end of PR J**:
- `wc -l apps/game-server/src/rooms/GameRoom.ts` < 1,500
- All game-server tests green (including new manager tests)
- `pnpm loadtest:heavy` baseline (no regression)
- Full `pnpm verify`
- Invoke `role-mechanics-reviewer` agent on the whole PR

---

# §11 — Acceptance criteria (cross-cutting after PRs A-J)

| Metric | Before | After |
|---|---|---|
| `wc -l apps/web/app/globals.css` | 20,328 | < 14,000 |
| `wc -l apps/web/components/play-room-client.tsx` | 1,438 | < 900 |
| `wc -l apps/game-server/src/rooms/GameRoom.ts` | 2,475 | < 1,500 |
| `du -sh apps/web/public/game-art` | 458 MB | < 250 MB |
| Number of PNG > 1 MB in `game-art` | 35+ | ≤ 5 |
| `find ... -name "*.test.tsx"` in `apps/web/components/play` | 5 | ≥ 13 |
| Number of `"use client"` in `apps/web/components/` | 69 | ≤ 50 |
| `pnpm check:dict` legacy hits | 17 | 0 |
| Pages migrated to `@werewolf/ui` primitives | 5 (status + 4 legal) | 14+ (+ account, history, achievements, leaderboard, friends, tutorial, sign-in, lobby) |
| `pnpm visual:ui` baselines | 44 | ≥ 56 (with focus states + per-route axe) |
| Bundle budget enforced in `pnpm verify` | No | Yes |
| Schema drift contract in regression | No | Yes |

`pnpm verify` MUST be green at every PR boundary.

---

# §12 — Commit summary (54 commits across 10 PRs)

| PR | Commits | Scope |
|---|---|---|
| A | 4 | CSS dead-code sweep (status + privacy + terms/report/faq + log doc) |
| B | 6 | Asset diet (optimizer + AVIF + 10 PNG trim + img→Image × 2 + budget contract) |
| C | 6 | /account + /history migration + dead CSS |
| D | 7 | /achievements + /leaderboard + /friends migration + dead CSS |
| E | 8 | /tutorial + /sign-in + /lobby migration + dead CSS |
| F | 5-6 | Copy migration × 5 + (optional) flip legacy rules to hard |
| G | 8 | play-room split into 4 hooks + helpers + tests + docs |
| H | 6 | play/* tests × 3 + axe sweep × 2 + focus stories |
| I | 4 | RSC audit × 2 + bundle budget + RSC contract |
| J | 9 | Game-server split × 4 + DB relations × 2 + migrations workflow × 3 |

Total: **54 atomic commits**, **~32 hours** Codex work at high reasoning, **0 sacred files modified outside authorised PRs**.

---

# §13 — Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm regression` fails after CSS delete | Class still in JSX | Grep the class name BEFORE deleting; restore the rule |
| `pnpm visual` snapshot diff > 5% pixels | Real visual regression | Revert; visual must stay stable, only intentional polish updates baselines |
| `pnpm playtest` fails after `play-room-client` split | Hook extraction broke effect order | Revert; re-extract one hook at a time |
| `pnpm --filter @werewolf/game-server test` fails after GameRoom split | Race condition between manager and room | Revert; serialise the broken interaction explicitly via a small dispatch queue |
| `bg-copy-reviewer` flags English leak | English placeholder during refactor | Replace with proper Bulgarian copy from `docs/dictionary.md` |
| `role-mechanics-reviewer` flags secret leak | Manager broadcasting private state | Revert; route secret data only through the existing `protectedPrivateState` pattern |
| Schema drift contract fails after `schema.ts` edit | Migration not generated | Run `pnpm db:generate` and commit the new SQL |
| Bundle budget fails | New dep or large import | Audit `pnpm why <pkg>` or `pnpm dlx source-map-explorer` |

---

# §14 — Notes for Codex / ChatGPT operator

- **Order matters.** Don't open PR B until PR A merges — PR A clears CSS that PR B's optimizer assumes is gone.
- **Visual baselines are sacred.** When `pnpm visual` reports diffs, ALWAYS manually inspect the diff PNG before running `pnpm visual:update`. False updates can hide real regressions.
- **`role-mechanics-reviewer`** is the only safety net for PR J. Don't merge anything in PR J that the agent flagged unresolved.
- **Bulgarian copy first, English never.** Every refactor that touches JSX text MUST be reviewed by `bg-copy-reviewer` agent. Specifically: hint at it in commit body if a `[legacy]` hit was cleared.
- **No new deps in PRs A-I.** PR J may add `drizzle-orm` query helpers if not already present, but check `pnpm why` first.
- **No `prefers-reduced-motion` guards anywhere.** Project convention.
- **Sacred files in v3.1 §0.2 STILL APPLY** unless the specific PR section above explicitly authorises a touch.
- **Each commit is independently revertable.** If a commit needs > 1 file to make sense, split it further.

---

# §15 — Sources

- `docs/frontend-audit-v3/codex-prompt-hybrid-redesign-adoption-v3.1-master.md` (predecessor)
- `docs/frontend-audit-v3/REPORT.md`
- `docs/frontend-audit-v3/findings-full-app-audit-v2.md`
- `docs/dictionary.md` (canonical Bulgarian copy)
- `AGENTS.md` (project conventions)
- `packages/ui/docs/tokens.md` (token catalog)
- `docs/css-cleanup-log.md` (created in PR A)

Verified against codebase state 2026-05-23.
