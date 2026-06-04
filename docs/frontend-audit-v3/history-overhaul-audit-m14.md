# M14 History Overhaul Audit

Date: 2026-05-27

## Scope

Audit target: `/history` index only. Replay remains out of scope for M14.

## Browser Findings

- Current visual route covers only `/history` empty state. There is no deterministic full archive fixture route in the visual suite.
- The page renders a strong hero banner, but the rest of the page falls back to a generic empty/card treatment rather than a distinct archive desk composition.
- Light theme intentionally washes the page art through `.history-shell.evidence-shell::before` with `opacity: 0.38`, `saturate(0.72)`, and `contrast(0.95)`. This makes the archive art feel weaker than the current homepage, `/werewolf`, and `/mafia` worlds.
- Empty state is a centered generic card with the shared sealed-letter artifact. It is functional, but it does not feel like a unique detective archive scene.
- Full archive card state exists as a server fixture behind `HISTORY_EVIDENCE_FIXTURE=1`, but it is not addressable through a visual query parameter.

## Current Repo Facts

- `--art-history` points to `bg-history-archive` desktop/mobile assets.
- `EvidenceWall` owns client filters and renders `CaseFileCard`.
- `CaseFileCard` already exposes useful data for a richer archive treatment: family, outcome, date/code, event count, and top timeline moments.
- Production DB loading can remain unchanged; only non-production visual fixture selection is needed.

## M14 Direction

- Add non-production `?visualHistory=fixture|empty` so empty and full archive states are both testable.
- Generate new history archive art sample-first and commit only the selected dark/light assets.
- Rebuild the index as an archive desk: hero entrance, stats ledger, evidence-thread filters, featured latest dossier, case drawer board, and custom empty archive scene.
