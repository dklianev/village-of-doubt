# Asset prompt catalog

Целта на този каталог е всяко бъдещо изображение да има ясен prompt, output path и reject criteria. Не генерираме “каквото стане”; всяка картинка трябва да служи на конкретен UI state.

Workflow:
1. Избери prompt файл.
2. Генерирай с built-in imagegen flow.
3. Запази final PNG в declared output path.
4. Пусни `pnpm optimize:assets`.
5. Обнови `docs/missing-assets.md`, ако asset-ът вече не липсва.

Основни правила:
- Без текст в изображенията, без водни знаци, без реални лица, без чужди лога.
- Role cards са 1024x1024, централен персонаж, достатъчно въздух за UI overlay.
- Hero/phase backgrounds са 1792x1024, key action в централната безопасна зона.
- Role/card/icon UI използва `object-fit: contain`; hero/background UI използва `cover`.

Style guides:
- `style-guide-werewolf.md`
- `style-guide-mafia.md`

Prompt sets:
- `roles-werewolf-missing.md`
- `roles-mafia-missing.md`
- `frontend-scenes.md`
