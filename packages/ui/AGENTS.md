# UI package guidance

`@werewolf/ui` е React-only design-system package. App и Next.js wrappers
остават в `apps/web`.

## Defaults

- Не добавяй Next.js imports в този package.
- Новите primitives използват `--ds-*` tokens и остават Tailwind-agnostic.
- Предпочитай additive props/variants пред page-level `:global()` override на
  primitive identity.
- Dialog/Sheet използват Radix, а Toast има собствен React lifecycle.
  Запази focus, dismissal и presence договорите при промяна; визуалното
  движение е CSS по default, не основание за нова runtime библиотека.
- Дръж keyboard, focus, accessible name и dismissal behavior част от публичния
  component contract.
- Добавяй abstraction само когато има реален app consumer или повтарящ се
  pattern. Storybook сам по себе си не е причина за нов primitive.

## Проверка

- Целевите tests чрез `pnpm --filter @werewolf/ui test`
- `pnpm ui:build` при exports, типове или package delivery промяна
- Засегнатите stories чрез `pnpm visual:ui` при видима, responsive или interaction промяна

Прегледай light/dark и desktop/mobile само за засегнатите stories. Не обновявай
baseline, преди да потвърдиш визуалната разлика.
