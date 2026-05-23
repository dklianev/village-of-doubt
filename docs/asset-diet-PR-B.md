# Asset diet report — PR B

Date: 2026-05-23

## Scope

`scripts/optimize-assets.mjs` now supports `--report-only` CSV output and a
budgeted optimization pass for `apps/web/public/game-art`.

No original PNG fallback files were deleted. Existing PNG paths were preserved
and recompressed/downscaled in place so CSS `image-set()` fallbacks remain valid.

## Before / after

| Metric | Before | After |
|---|---:|---:|
| Total `game-art` size | 456.15 MB | 95.56 MB |
| PNG total | 419.77 MB | 62.66 MB |
| WebP total | 31.50 MB | 26.44 MB |
| PNG files | 180 | 180 |
| WebP files | 289 | 289 |
| AVIF files | 0 | 65 |
| PNG files > 1 MB | 170 | 0 |
| Files > 500 KB | 170+ | 0 |
| Report rows over budget | 172 | 0 |
| Largest PNG fallback | 3,777.5 KB | 499.9 KB |
| Largest WebP | 564.5 KB | 336.7 KB |
| Largest AVIF | 0 KB | 267.3 KB |

## Largest PNGs before

| File | Before PNG | Before WebP |
|---|---:|---:|
| `legal/replay-banner.png` | 3,777.5 KB | 175.8 KB |
| `faq/library-catalog-hero.png` | 3,660.4 KB | 225.8 KB |
| `legal/lobby-banner.png` | 3,645.0 KB | 165.1 KB |
| `card-back-secret.png` | 3,587.9 KB | 456.8 KB |
| `legal/status-banner.png` | 3,526.4 KB | 88.9 KB |
| `village-map.png` | 3,477.9 KB | 564.5 KB |
| `legal/faq-hearth-banner.png` | 3,391.6 KB | 134.2 KB |
| `account/account-hero-banner.png` | 3,368.9 KB | 59.0 KB |
| `mafia/card-back-secret.png` | 3,271.6 KB | 365.6 KB |
| `legal/offline-banner.png` | 3,101.8 KB | 52.8 KB |

## Largest files after

| File | Size |
|---|---:|
| `role-civilian.png` | 499.9 KB |
| `bg-narrator-panel.png` | 499.5 KB |
| `role-mayor.png` | 498.5 KB |
| `empty-lobby.png` | 497.2 KB |
| `role-jester.png` | 496.3 KB |
| `role-hunter.png` | 496.0 KB |
| `faq/library-catalog-hero.png` | 488.8 KB |
| `bg-day-discussion.png` | 488.2 KB |
| `mafia/faction-village.png` | 487.4 KB |
| `bg-voting.png` | 487.0 KB |

## Commands

```bash
node scripts/optimize-assets.mjs --report-only > $TEMP/asset-diet-before.csv
node scripts/optimize-assets.mjs
node scripts/optimize-assets.mjs --report-only > $TEMP/asset-diet-after.csv
```

## Notes

- `mobile/mobile` nested output is prevented by skipping derivative mobile
  generation for PNGs already under `game-art/mobile/`.
- `thumbs/` remains a generated derivative directory and is not reprocessed as
  a source asset tree.
- Hero-like assets now receive AVIF companions for future `<picture>` or
  `image-set()` adoption.
- The regression contract now checks the PR B budgets directly instead of using
  the old WebP-vs-unoptimized-PNG ratio.
