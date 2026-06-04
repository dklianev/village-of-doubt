# Hero restoration audit - 2026-05-25

## Baseline

| Metric | Current |
|---|---:|
| `apps/web/app/globals.css` | 3,295 LOC |
| CSS modules under `apps/web` | 48 |
| Inline `style={{ ... }}` occurrences in app/components TSX | 36 |
| `SceneCard` consumers in `apps/web` | 13 |
| `pnpm regression` | green, 17 contracts |
| `pnpm perf:budget` | green, 470.4 KB JS gzip / 550 KB budget |
| Largest optimized art | `mafia/card-back-secret.webp` - 301.4 KB |

## Per-page inventory

| Page | Hero state | Asset available | Primitive override risk | Polish needed | Risk | PR |
|---|---|---|---|---|---|---|
| `/account` | Flat `SceneCard` | `account/account-hero-banner.{avif,webp,png}` | none found | dossier warmth, avatar/stat hierarchy | low | M2 |
| `/status` | Flat `SceneCard` | `legal/status-banner.{avif,webp,png}` | none found | calm watchtower hero, badge contrast | low | M2 |
| `/history` | Flat replay hero; list cards forced through PaperCard overrides | `bg-history-archive.{avif,webp,png}`, `legal/replay-banner.{avif,webp,png}` | high: `History.module.css` overrides `.paper-card` and `[data-ds-paper-card]` | full archive rebuild | high | M3 |
| `/privacy` | Flat `SceneCard` | `legal/privacy-banner.{avif,webp,png}` | none found | open-vault warmth, brass accents | low | M4 |
| `/terms` | Flat `SceneCard` | `legal/terms-banner.{avif,webp,png}` | none found | formal sealed-document rhythm | low | M4 |
| `/report` | Flat `SceneCard` | `legal/report-banner.{avif,webp,png}` | none found | lighthouse/beacon wizard polish | low | M5 |
| `/faq` | Flat `SceneCard` | `legal/faq-hearth-banner.{avif,webp,png}` | none found | hearth glow, focused search | low | M5 |
| `/friends` | Flat `SceneCard` | `legal/friends-banner.{avif,webp,png}` | none found | social table warmth | low | M6 |
| `/achievements` | Flat `SceneCard` | `achievement-badges-sheet.{png,webp}`, OG hero assets | none found | legends shelf/medallion hierarchy | medium | M6 |
| `/leaderboard` | Flat `SceneCard` | `leaderboard-headline-portrait.{png,webp}`, OG hero assets | none found | evening newspaper identity | medium | M6 |
| `/tutorial` | Flat `SceneCard` | `tutorial-day-scene.{png,webp}`, `tutorial-night-scene.{png,webp}`, OG hero assets | none found | first-steps atmosphere without noise | medium | M6 |
| `/sign-in` | Flat `SceneCard` | `sign-in-table.{png,webp}`, OG hero assets | medium: `SignInStage.module.css` reaches `[data-ds-scene-card]` | threshold/invitation warmth | medium | M6 |
| `/create`, `/werewolf/create`, `/mafia/create` | Tavern shell already exists; faction theme uses legacy `data-theme` | `legal/lobby-banner.{avif,webp,png}`, `bg-lobby-tavern` token | medium: legacy faction selectors stay for bridge-first policy | default-theme tavern visibility, faction accents | medium | M6 |

## Primitive override inventory

Known direct or wrapper-scoped primitive selectors at audit time:

- `apps/web/components/history/History.module.css` overrides `.paper-card` and `[data-ds-paper-card]`. This is the primary anti-pattern to remove in M3.
- `apps/web/components/lobby/LobbyWizard.module.css` reaches `[data-ds-scene-card]` for frame spacing. This should be reviewed during M6.
- `apps/web/components/sign-in/SignInStage.module.css` reaches `[data-ds-display]` and `[data-ds-scene-card]`. This should be reviewed during M6.

The regression guard introduced in M1 starts in warn mode because these known violations exist before restoration. It flips to fail in M7 after touched pages are clean.

## Asset policy

Existing assets cover the restoration pass. Image generation is not needed by default.

| Page | Existing assets cover it? | Imagegen action |
|---|---|---|
| `/achievements` | partial: badge sheet and OG assets exist | propose only if visual audit after M6 still feels flat |
| `/sign-in` | yes: `sign-in-table` exists | none |
| `/tutorial` | yes: day/night scenes exist | none |
| `/leaderboard` | yes: headline portrait exists | none |

## Implementation notes

- Use `var(--art-*)` tokens for every `SceneCard.background.image`; do not inline raw `image-set(...)` strings in page components.
- New primitives read `data-faction` for faction accents. Existing legacy `[data-theme="werewolves" | "mafia"]` selectors stay as compatibility fallback for this engagement.
- `packages/ui` remains React-only: no `next/image`, `next/link`, or Next-specific props.
