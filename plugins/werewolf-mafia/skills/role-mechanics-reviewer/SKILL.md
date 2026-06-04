---
name: role-mechanics-reviewer
description: Use before and after changes to GameRoom, game logic, protocol, role assignment, win conditions, private role payloads, or any server-side social-deduction mechanics.
---

# Role Mechanics Reviewer

Use this skill whenever a task touches:

- `apps/game-server/src/rooms/GameRoom.ts`
- `apps/game-server/src/rooms/schemas/**`
- `apps/game-server/src/game-logic/**`
- `packages/shared/src/protocol.ts`
- `packages/shared/src/role-assignment.ts`
- `packages/shared/src/win-conditions.ts`

## Required References

Read and follow:

- `AGENTS.md`
- `agents-shared/role-mechanics-review.md`

## Review Contract

1. Confirm the server remains authoritative.
2. Confirm no secret role/private state enters `GameState`, `PlayerPublicState`, public DOM, public chat, or public events.
3. Confirm any private payload is sent only with targeted `client.send(...)`.
4. Confirm server validation remains authoritative even if client UX filters are added.
5. Confirm Bulgarian `reasonBg` / `messageBg` text for any user-facing errors.
6. Confirm tests cover the changed path, including reconnect/private resend if relevant.

## Gate

Run at minimum:

```bash
pnpm typecheck && pnpm test && pnpm regression && pnpm playtest
git diff --check
```

For protocol/security changes, also inspect `apps/game-server/src/__tests__/GameRoom.security.test.ts`.

## Output

End with:

- `Role-mechanics verdict: OK` when no issues remain.
- `Role-mechanics verdict: NEEDS-CHANGES` plus exact file/line findings when risks remain.
