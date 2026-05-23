# CSS cleanup log

## PR A — 2026-05-23 (post-redesign conservative sweep)

Lines removed from `apps/web/app/globals.css`:

| Class family | LOC removed | Replaced by |
|---|---:|---|
| `.status-hero*`, `.status-incident*` | 162 | `SceneCard` + `PaperCard` in `StatusHero.tsx`, `StatusLastIncident.tsx` |
| `.privacy-hero*`, `.privacy-section-kicker` | 93 | `PrivacyHero` and privacy section cards with `SceneCard` / `PaperCard` |
| `.terms-hero*`, `.terms-section-kicker`, `.report-hero*`, `.report-success*`, `.faq-hearth-*` hero shell | 336 | `TermsHero`, `ReportHero`, `ReportWizard` success `EmptyState`, `FaqHearth` `SceneCard` |

**Net delta**: `apps/web/app/globals.css` went from 17,650 to 17,136 lines
in this worktree snapshot. Git diff records 591 removed CSS lines across the
three cleanup commits.

The v2 target for PR A was `< 19,000`, and this conservative sweep meets it.
Only classes with zero live references were removed.
Rules with live references, including specialized content widgets and page-local meta/action styles, were kept for a follow-up sweep after later layout migrations settle.

## Delete Protocol Summary

The conservative scan checked each class token against `apps/web/**/*.ts(x)` before deletion.
Examples of classes kept because they still have live references:

| Class | Why kept |
|---|---|
| `.status-hero-meta`, `.status-hero-dot`, `.status-hero-meta-label`, `.status-hero-refresh` | Still used inside `StatusHero.tsx` |
| `.privacy-hero-meta` | Still used inside `PrivacyHero.tsx` |
| `.privacy-section-head`, `.privacy-section-lede`, `.privacy-section-preview` | Still used by privacy content widgets |
| `.terms-hero-meta` | Still used inside `TermsHero.tsx` |
| `.report-hero-stat`, `.report-hero-stat-icon` | Still used inside `ReportHero.tsx` |
| `.report-success-reference`, `.report-success-followup`, `.report-success-actions` | Still used by the report success `EmptyState` action slot |
| `.status-tile*`, `.status-section*`, `.status-subscribe*`, `.status-legend*` | Still used by the status page shell, service tiles, subscribe, and legend |

## Verification

- Commit 1: `pnpm regression && pnpm typecheck && pnpm build` passed; `pnpm exec playwright test --config=playwright.config.ts --grep "status"` passed 4/4.
- Commit 2: `pnpm regression && pnpm typecheck && pnpm build` passed; `pnpm exec playwright test --config=playwright.config.ts --grep "privacy"` passed 6/6.
- Commit 3: `pnpm regression && pnpm typecheck && pnpm build` passed; `pnpm exec playwright test --config=playwright.config.ts --grep "terms|report|faq"` passed 22/22.

No visual baselines were updated.

## Policy

Future PRs migrating chrome to primitives must append a section here documenting which CSS class families became dead code.
Deletion stays conservative: if a class has any live reference, keep it until the owning component migrates.

## PR C — 2026-05-23 (/account + /history primitive migration)

Lines removed from `apps/web/app/globals.css`:

| Class family | LOC removed | Replaced by |
|---|---:|---|
| `.account-hero*`, `.account-section` shell, old danger dialog shell | 310 | `AccountHero` `SceneCard`, account section `PaperCard`, `AccountDangerZone` `Dialog` |
| `.case-file-head`, `.case-file-number`, old evidence empty art/CTA/ghost row shell | 78 | `CaseFileCard` `PaperCard`, `EvidenceWallEmpty` `EmptyState` + `ArtifactImage` |
| `.replay-hero*`, `.replay-hero-copy*` | 90 | replay page `SceneCard` + `Display` hero |

**Net delta**: `apps/web/app/globals.css` went from 19,819 to 19,342 lines
in this worktree snapshot (Δ -477). Git diff for the CSS file records 478
removed lines and 1 added line in the cleanup commit.

Also removed the obsolete `/account` hero banner `ResourceHints` entry after
`AccountHero` stopped rendering that banner image.

## Verification

- Delete scan: old `.account-hero*`, native `.danger-confirm-dialog`, old `.replay-hero*`, and old evidence empty shell classes have zero live JSX/TS references.
- Kept intentionally: `.case-file` and `.case-file-ghost*` because `EvidenceWallSkeleton` still uses them.
