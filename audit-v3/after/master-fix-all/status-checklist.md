# Master Audit Plan Status

Дата: 2026-05-22

## Затворено

- Phase 1 privacy/security: replay guard, `/create` auth gate, hashed `/stats` room codes, opt-in dev auth, nonce replay protection, SQL leaderboard, typed GDPR confirmation, `manual_only` server enforcement, env placeholders, bounded persistence queue, bounded achievement events, timer override rules.
- Phase 3 lobby architecture: `lobby-form` split, `StepRoom` split, structured warning codes, `aria-live`, memoized recipe/role filters, shared modal hook for the key custom modals.
- `/play`: update handler no longer calls full `toSnapshot` per Colyseus state change; each slice is mapped and committed only when its comparator detects a real change.
- `/play`: phase curtain is suppressed on initial join and reconnect snapshot; it only appears after an observed phase change.
- `/play`: players panel is single-mount inline, with memoized player tiles and comparator coverage.
- `/play`: chat messages now have runtime type validation before truncation.
- `/lobby/[code]`: invite page polls the room preview every 5 seconds while the tab is visible, shows only public live presence, and falls back to static invite UI when the room/server is missing.
- CSS hygiene: `apps/web/app/globals.css` is `17 248` lines, below the `< 19 500` target.
- Role search: deferred search now uses cached haystacks plus a compact Cyrillic normalization map instead of a long `replaceAll` chain.
- `/tutorial?step=3`: navigation is visible before the slide content, so “Напред” is reachable without scrolling.
- Remaining cleanup Phase A: `useTimerCountdown` is extracted and covered by hook tests.
- Remaining cleanup Phase A: `onJoin` is rate-limited to 5 attempts per 10 seconds per user and covered by a security test that asserts `safe_error` plus close code `4029`.

## Accepted Exceptions

- `AccountDangerZone` keeps native `<dialog>` because it is a browser-modal destructive confirmation with built-in modal semantics and typed confirmation; custom `useModal` remains for non-native overlays.
- Cookie/welcome surfaces are not migrated to `useModal` because they are status/notice surfaces, not blocking dialogs.
- `.game-shell-backdrop` was not added; the current play backdrop is kept because this pass focused on the strict update/overlay/presence work without visual rearchitecture.

## Verified

- `pnpm regression`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @werewolf/web test`
- `pnpm --filter @werewolf/game-server test`
- `pnpm --filter @werewolf/web test hooks/__tests__/use-timer-countdown.test.tsx`
- `pnpm --filter @werewolf/game-server test src/__tests__/GameRoom.security.test.ts`
- Browser QA on `/lobby/QA123`, `/play/QA123`, `/create`, `/achievements`, `/werewolf/roles`, `/tutorial?step=3`
