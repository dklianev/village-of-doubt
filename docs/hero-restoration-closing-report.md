# Hero restoration closing report — 2026-05-25

## Summary

- Pages restored with `SceneCard.background`: 14 route surfaces across account, status, history, replay, privacy, terms, report, FAQ, friends, achievements, leaderboard, tutorial, sign-in and lobby/create.
- Primitive identity overrides removed from touched pages: guard count is now 0 and `pnpm regression` enforces it as a hard failure.
- New primitive capabilities: `SceneCard.background`, `Pill` shimmer/tracked/faction intent, `PaperCard`/`SceneCard` interactive and accent props.
- Motion polish stayed inside the existing three Motion primitive files: `Dialog.tsx`, `Sheet.tsx`, `Toast.tsx`.
- Bundle budget after restoration: 471.5 KB total JS gzip / 550 KB budget.

## Final Metrics

| Metric | Result |
|---|---:|
| `apps/web/app/globals.css` | 3309 LOC |
| CSS modules in `apps/web` | 51 |
| `:global()` primitive class overrides | 0 |
| `:global([data-ds-*])` primitive overrides | 0 |
| Inline `style={{ ... }}` in app/components TSX | 18 |
| Motion primitive files | 3 |
| Legacy `data-theme="werewolves|mafia"` occurrences | 65 (report-only legacy bridge scope) |
| `SceneCard.background` route consumers | 14 |
| Raw inline `image-set(...)` in hero backgrounds | 0 |

## Per-page Outcomes

| Page | Outcome |
|---|---|
| `/account` | Dossier hero restored with `--art-account`, avatar ring and stat tally hierarchy. |
| `/status` | Harbor/watchtower hero restored with veil overlay and clearer service badge states. |
| `/history` | Archive hero restored, filters use `Pill`, case files use `SceneCard interactive accent`, and pushpin/tilt/primitive overrides were removed. |
| `/history/[gameId]/replay` | Replay hero uses `--art-replay`; content sections use `PaperCard` primitives. |
| `/privacy` | Open-vault hero restored with warm brass trust accents. |
| `/terms` | Formal hero restored with restrained legal hierarchy. |
| `/report` | Lighthouse hero restored and wizard steps polished with enriched `Pill` chrome. |
| `/faq` | Hearth hero restored with warm expanded-answer and search focus states. |
| `/friends` | Social-table hero restored; friend actions feel like invitations around the table. |
| `/achievements` | Legends-shelf art restored through page hero treatment and medallion/card hierarchy. |
| `/leaderboard` | Editorial masthead art restored with newspaper-like ranking rhythm. |
| `/tutorial` | First-steps atmosphere restored with day/night art tokens while keeping instructional clarity. |
| `/sign-in` | Invitation-stage hero restored and OAuth buttons moved to enriched `Pill` styling. |
| `/create` / `/lobby` | Tavern background is visible in the default theme; new faction accents read from `data-faction` with legacy `data-theme` bridge intact. |

## Primitive API Health

| Primitive | Public props | Status |
|---|---:|---|
| `Dialog` | 6 | ok |
| `Display` | 3 | ok |
| `EmptyState` | 4 | ok |
| `Eyebrow` | 2 | ok |
| `Medallion` | 2 | ok |
| `PaperCard` | 6 | ok |
| `Pill` | 6 | ok |
| `SceneCard` | 7 | ok |
| `Sheet` | 5 | ok |
| `Surface` | 5 | ok |
| `Toast` | 5 | ok |

No primitive exceeds the 7-prop composition threshold.

## Architectural Invariants Verified

- Zero primitive identity overrides in CSS modules; enforced by `pnpm regression`.
- Motion file count remains 3.
- Hero `SceneCard.background` consumers use `var(--art-*)` tokens rather than raw inline `image-set(...)` strings.
- `globals.css` stayed far below the 3850 LOC ceiling after adding art tokens.
- No new dependencies were added.
- No code-level `prefers-reduced-motion` guard was introduced in this restoration work.
- `data-faction` is available for new faction accents while legacy `data-theme="werewolves|mafia"` selectors remain intentionally bridged for a later dedicated cleanup PR.

## Verification

- `pnpm regression`
- `pnpm typecheck`
- `pnpm build`
- `E2E_LOCAL_ONLY=true pnpm verify`
- `pnpm perf:budget`
