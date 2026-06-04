---
name: bg-copy-reviewer
description: Use whenever JSX, UI labels, aria labels, toast text, error text, docs-visible product copy, or Bulgarian reason/message payloads change.
---

# Bulgarian Copy Reviewer

This project ships user-facing UI in Bulgarian Cyrillic. System identifiers may remain English in code, but visible product text must be Bulgarian.

## Required References

Read and follow:

- `AGENTS.md`
- `agents-shared/bg-copy-review.md`
- `docs/dictionary.md`

## Checks

1. Search changed JSX/TS/CSS content for English user-facing strings.
2. Ensure `messageBg`, `reasonBg`, labels, aria labels, button text, and empty states are Bulgarian.
3. Prefer established terms from `docs/dictionary.md`.
4. Keep commit messages in English.
5. Do not rewrite legacy accepted copy unless the task requests a copy migration.

## Gate

Run:

```bash
pnpm check:dict
```

If code changed, include the task's normal gate too.

## Output

Report hard warnings first. If clean, say `BG copy verdict: OK`.
