# @werewolf/database

Drizzle schema, migrations and shared query helpers for Върколак и Мафия.

## Migration workflow

Use migrations for every production schema change.

- Edit `src/schema.ts`.
- Run `pnpm --filter @werewolf/database db:generate`.
- Review the generated SQL in `packages/database/drizzle/`.
- Commit the schema change and the migration together.
- Deploy with `pnpm --filter @werewolf/database db:migrate`.

Do not use `db:push` against production. It is useful for disposable local
databases, but production changes must be reviewable SQL migrations.

## Regression guard

Root `pnpm regression` runs `drizzle-kit check --config drizzle.config.ts`.
That catches migration metadata drift without connecting to production.

## Relations

Relations live in `src/schema.ts` next to the table declarations. Prefer
`db.query.<table>.findMany({ with: { ... } })` for straightforward object
loading. Keep explicit SQL joins for aggregate reports such as leaderboard
ranking, where Postgres `COUNT`, `SUM` and `GROUP BY` are the right tool.
