# CSS Theme Token Migration

## 2026-05-22 Status

Migrated the five lowest-risk text-content shells to CSS variable tokens:

- `.faq-shell`
- `.privacy-shell`
- `.status-shell`
- `.terms-shell`
- `.report-shell`

The targeted light-theme override selectors were removed from
`apps/web/app/globals.css`.

## Selector Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| `html[data-theme="light"]` occurrences | 292 | 199 | -93 |
| `.faq*` light overrides | 47 | 0 | -47 |
| `.privacy*` light overrides | 13 | 0 | -13 |
| `.status*` light overrides | 10 | 0 | -10 |
| `.terms*` light overrides | 10 | 0 | -10 |
| `.report*` light overrides | 13 | 0 | -13 |

## Verification

- `pnpm regression` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- Browser smoke on `/faq`, `/privacy`, `/status`, `/terms`, and `/report` passed in dark and light themes.
- Browser smoke found no console errors, no Next.js error dialog, and no horizontal overflow on the migrated pages.

## Evidence

Screenshot:

- `audit-v3/after/css-token-migration/faq-light.png`

## Remaining Work

The remaining `html[data-theme="light"]` overrides are intentionally left in
higher-risk areas such as landing, lobby, play, tutorial, account, and role
detail surfaces. Those should move in separate CSS architecture passes.
