<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project web defaults

- Генерираният блок по-горе е authoritative за Next.js API и conventions.
  Отвори само релевантния локален guide. Ако няма засегнат Next API/convention
  (например чист copy/CSS edit), няма framework справка за зареждане.
  Не отваряй несвързана документация само за да изпълниш формална стъпка.
- Server Components са default. Добавяй `"use client"` само когато компонентът
  има реална browser state, effect или interaction граница.
- Клиентът не решава game outcomes и не реконструира тайни роли. Използвай
  protocol events и публичния server state.
- Видимият текст следва `docs/dictionary.md`. Технически имена и brand имена не
  се превеждат насила.
- Използвай `@werewolf/ui` и съществуващите app-level wrappers, когато пасват.
  Page CSS може да композира primitive, но не да пренаписва неговата identity.
- При визуален дизайн/polish използвай [дизайн контекста](../../docs/design-context-bg.md).
  Той описва продукта, не налага нова концепция при всяка локална поправка.
- Проверявай responsive layout, light/dark и двете game families само за
  повърхностите, които промяната засяга.
- Не обновявай visual baseline преди да прегледаш screenshot разликата.
- При image промяна провери focal point, crop, mobile asset и runtime формата.
