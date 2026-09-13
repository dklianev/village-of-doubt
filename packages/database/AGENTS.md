# Database guidance

## Defaults

- Drizzle schema и generated SQL migration се променят заедно.
- Използвай `db.query.<table>` за обикновено relation loading и explicit SQL за
  aggregate/reporting заявки, когато това дава по-ясен plan.
- Използвай transaction за един business invariant, не за произволно голяма
  поредица от несвързани операции.
- Не добавяй индекс по предположение. Потвърди query shape и, когато е възможно,
  `EXPLAIN (ANALYZE, BUFFERS)` с представителни данни.
- Запази privacy и deletion semantics. Не връщай PII в logs, fixtures или
  публични query резултати.
- Външни inputs минават през typed query parameters; не сглобявай SQL strings.

## Миграции

- Генерирай с `pnpm --filter @werewolf/database db:generate`.
- Production използва `db:migrate`, никога `db:push`.
- Следвай expand/contract за промени, които трябва да останат съвместими с
  текущата и предишната application версия.
- За index build, table rewrite или lock-sensitive DDL провери production
  runbook-а и избери maintenance/concurrent стратегия според реалния риск.
- Не редактирай вече приложена migration. Добави нова коригираща migration.

## Проверка

- Засегнатите query/privacy тестове чрез `pnpm --filter @werewolf/database test`
- `pnpm check:migrations` и `pnpm test:migrations` при schema или migration промяна

При performance промяна запази before/after plan или измерване, а не само
теоретично очакване.
