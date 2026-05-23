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
| Total `game-art` size | 456.15 MB | 94.68 MB |
| PNG files | 180 | 180 |
| WebP files | 289 | 289 |
| AVIF files | 0 | 65 |
| PNG files > 1 MB | 170 | 0 |
| Files > 500 KB | 170+ | 0 |
| Report rows over budget | 178 | 0 |
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

| File | PNG | WebP | AVIF |
|---|---:|---:|---:|
| `role-civilian.png` | 499.9 KB | 133.0 KB | 0 KB |
| `role-werewolf.png` | 497.4 KB | 216.8 KB | 0 KB |
| `role-cupid.png` | 496.0 KB | 209.6 KB | 0 KB |
| `village-map.png` | 495.6 KB | 336.7 KB | 259.9 KB |
| `card-back-secret.png` | 493.4 KB | 280.8 KB | 248.8 KB |
| `bg-narrator-panel.png` | 493.0 KB | 196.0 KB | 152.1 KB |
| `texture-parchment.png` | 492.3 KB | 242.7 KB | 185.7 KB |
| `event-death.png` | 491.5 KB | 161.6 KB | 0 KB |
| `bg-day-discussion.png` | 491.4 KB | 227.8 KB | 183.0 KB |
| `mafia/faction-village.png` | 491.2 KB | 197.4 KB | 0 KB |

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
