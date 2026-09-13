# Workflow: преглед на българския продуктов текст

Целта е видимият текст да звучи естествено, последователно и подходящо за
играта. Това не е забрана за латиница или технически термини.

## Обхват

Преглеждай:

- JSX children, headings, buttons, labels и table content;
- `placeholder`, `aria-label`, `title` и съдържателен `alt`;
- validation, empty, loading, offline и error states;
- server messages, които достигат клиента чрез `messageBg`, `causeBg`,
  `safe_error`, system или private events;
- role names, mechanics, phase guidance и win/loss copy;
- metadata title/description, когато промяната ги засяга.

Не третирай като продуктов текст:

- TypeScript identifiers, protocol/role/phase codes и route paths;
- logs, stack traces, test descriptions и internal-only errors;
- URLs и machine-readable values.

Brand имена и точни технически термини като Discord, OAuth, WebSocket, token и
server могат да останат на установения език, когато български заместител би бил
неясен. Следвай `docs/dictionary.md`.

## Глас

- Използвай естествен съвременен български, без буквален превод от английски.
- В един flow използвай последователно едно обръщение.
- Кажи действието и последицата конкретно. Избягвай generic marketing фрази и
  текст, който обяснява очевидния UI.
- Role description започва с механиката; атмосферният текст е кратък и не я
  прикрива.
- Error съобщението казва какво се случи и каква е следващата полезна стъпка,
  без да излага вътрешна грешка.
- Причините за смърт и динамичните изречения работят с имена от всеки род.

## Проверка на diff-а

Започни от променените файлове, после разшири само ако shared mapping е засегнат:

```powershell
git diff --name-only
rg -n 'placeholder=|aria-label=|title=|alt=' apps/web -g '*.tsx' -g '*.ts'
rg -n 'messageBg|causeBg|safe_error|client\.send|addPublicEvent' apps packages -g '*.ts' -g '*.tsx'
pnpm check:dict
```

За нов role/phase/team code провери, че има canonical BG label и че всички
exhaustive mappings компилират. Използвай `rg` по самия code; не поддържай
ръчен списък от предполагаеми файлове.

## Преценка

Автоматичният речник е сигнал, не автор на copy. Провери всеки match в неговия
UI контекст. Не променяй правилен brand, identifier или вътрешен log само за да
изчезне предупреждение.

Отчетът е `OK` или `NEEDS-CHANGES`. При проблем дай `file:line`, текущия текст,
предложен текст и кратка причина. Не добавяй стилови nitpicks без осезаем ефект
върху яснота, тон или последователност.
