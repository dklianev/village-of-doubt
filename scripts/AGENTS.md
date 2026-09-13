# Scripts and operations guidance

## Defaults

- Предпочитай cross-platform Node `.mjs` scripts. Ако shell е необходим,
  поддържай текущите production платформи и quote-вай filesystem inputs.
- Production проверки, release verification, backup, restore и rollback са
  fail-closed. Не превръщай failure в warning само за да мине CI.
- Dry-run и test fixture не трябва да достигат production credentials или
  външни услуги.
- При промяна на script contract обнови засегнатите callers, tests и runbook.
  Променяй `package.json` само ако command wiring действително се променя.
- Не hard-code-вай текущ test count, asset count, commit hash или календарна
  версия в agent guidance.
- Логовете са структурирани и не съдържат secrets, tokens, room codes или PII.

## Проверка

- Script-specific test или dry-run
- Засегнатите operations тестове за deploy/backup/restore/runtime scripts;
  `pnpm operations:test` при общ operational contract или release проверка
- `pnpm release:manifest:test` за release manifest промени
- `pnpm regression` за package wiring или contract промени
- `pnpm check:prod-env` само с подходящ production fixture/environment

Не стартирай deploy, restore или production migration като форма на тест.
