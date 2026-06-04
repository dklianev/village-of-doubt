# Play hooks

Извадени от `PlayRoomClient` в PR G. Всеки hook държи една отговорност и има
самостоятелни тестове, за да остане `PlayRoomClient` тънък orchestrator.

| Hook | Отговорност | Текущ размер | Тест |
|---|---|---:|---|
| `useGameRoom` | Colyseus връзка, reconnect, public snapshot, private messages | 697 реда | `use-game-room.test.tsx` |
| `useCueMode` | Звук, вибрация и localStorage режим | 54 реда | `use-cue-mode.test.tsx` |
| `usePhaseTransitions` | Phase overlay, cue pulse, kill/win cue, start countdown | 136 реда | `use-phase-transitions.test.tsx` |

`apps/web/components/play-room-client.tsx` е 729 реда след PR G и остава
координатор за layout, keyboard shortcuts, action submit и chat submit.

## Правила

- Game server-ът остава source of truth. Тези hooks не решават game logic.
- Тайните роли идват само през private messages и не се записват в public snapshot.
- `useGameRoom` пази reconnect token-а в `sessionStorage` със същия prefix като
  предишния client component.
- `usePhaseTransitions` не добавя `prefers-reduced-motion` guard; проектната
  конвенция е да няма такъв guard.
