# agents-shared/

Cross-CLI workflow guides. Тези markdown файлове описват очакваното покритие
на повтаряеми задачи, без да налагат фиксиран механичен процес. Те са четими от:

- **Claude Code** - през локални wrappers в `.claude/skills/`, когато са
  конфигурирани
- **Codex CLI** - чрез routing секцията в root `AGENTS.md`
- **Друг agent CLI** - използвай релевантното покритие за текущата задача

## Workflow guides

| Файл | Кога |
|---|---|
| [add-role.md](add-role.md) | Добавяш или променяш роля в играта |
| [role-mechanics-review.md](role-mechanics-review.md) | Променена механика, authority, protocol или room lifecycle |
| [bg-copy-review.md](bg-copy-review.md) | Редакционен преглед на продуктов текст, включително точни технически термини |

## Защо точно тук, а не в .claude/

`.claude/skills/` са Claude-only wrappers. Canonical логиката живее тук, за
да не се разминават различните agent инструменти. Wrapper-ът трябва да сочи към
guide-а, а не да копира неговите стъпки, команди или бройки.
