# Pre-launch game balance analysis

This document is the canonical record for launch preset tuning. Read it before changing role values, role compositions, or the acceptable balance windows.

## Game balance observed structure

- Role values are system-defined and `getRoleBalanceScore(distribution)` in `packages/shared/src/game-config.ts` returns the summed score for a role distribution.
- A score of `0` is treated as numerically balanced.
- Positive scores favor the village/city side. Negative scores favor the threat side.
- Werewolf classic presets are defined in `WEREWOLF_CLASSIC_PRESETS`.
- Mafia sport is a fixed 10-player composition: 6 Civilian, 1 Commissioner, 2 Mafioso, 1 Don.
- Existing games keep their stored `games.config` JSONB snapshot. Preset changes only affect newly created games.

## Game balance issues found

### B-001 - 10-player werewolf preset is village-favored (P2)

Pre-fix composition: 4 ordinary villagers, 2 werewolves, Seer, Witch, Healer, Hunter. The score is `+10`, which is a significant village advantage. Wolves face 8 village-side players, including 4 information/protection roles.

Fix applied: drop the Healer and add one ordinary villager, keeping Seer, Witch, and Hunter. This removes one protection chain while keeping the classic Witch moment.

### B-002 - 12-player werewolf preset is village-favored (P2)

Pre-fix composition: 5 ordinary villagers, 3 werewolves, Seer, Witch, Healer, Hunter. The score is `+5`, but 4 special village roles against 3 wolves leaves a narrow wolf margin.

Fix applied: drop the Healer and add one ordinary villager.

### B-003 - 14 and 15-player presets have too many ordinary villagers (P3)

Pre-fix 14-player composition scored `+7`; pre-fix 15-player composition scored `+8`. Both favored the village because 3 wolves had to fight a large village plus 4 special roles.

Fix applied: move the fourth wolf threshold down to 14 players.

### B-004 - 6 and 7-player presets are intentionally swingy (P3)

The 6-player and 7-player setups are numerically close to even, but parity dynamics make them volatile. The current slight village lean is intentional for first-game friendliness and is not changed in this PR.

### B-005 - Balance score had no preset validation gate (P3)

`getRoleBalanceScore` existed, but preset scores were not covered by tests. This PR adds regression tests for score bounds, role counts, minimum werewolf count, and Seer presence.

### B-006 - No max-specials warning for manual lobby compositions (P3)

Manual compositions can still include too many special roles. A soft lobby warning when special roles reach at least half the table is deferred because it touches user-facing lobby behavior.

### B-007 - Mafia sport preset is well-tuned (no fix)

The 10-player sport Mafia format is intentionally tight and slightly Mafia-favored under the role-definition values. No sport Mafia composition changes are made.

## Current preset table

These are the pre-fix Werewolf classic presets that existed before this PR.

| Players | Composition | Score | Predicted win rate |
| ---: | --- | ---: | --- |
| 6 | ordinary_villager x2, werewolf x2, seer x1, healer x1 | 0 | Wolves 55-60% because small-table parity is harsh |
| 7 | ordinary_villager x3, werewolf x2, seer x1, healer x1 | +1 | Wolves 50-55% because small-table parity is harsh |
| 8 | ordinary_villager x3, werewolf x2, seer x1, healer x1, hunter x1 | +4 | Village 57-62% |
| 9 | ordinary_villager x4, werewolf x2, seer x1, witch x1, hunter x1 | +7 | Village 62-67% |
| 10 | ordinary_villager x4, werewolf x2, seer x1, witch x1, healer x1, hunter x1 | +10 | Village 65-75% |
| 11 | ordinary_villager x5, werewolf x3, seer x1, witch x1, hunter x1 | +2 | Village 53-57% |
| 12 | ordinary_villager x5, werewolf x3, seer x1, witch x1, healer x1, hunter x1 | +5 | Village 58-62% |
| 13 | ordinary_villager x6, werewolf x3, seer x1, witch x1, healer x1, hunter x1 | +6 | Village 58-63% |
| 14 | ordinary_villager x7, werewolf x3, seer x1, witch x1, healer x1, hunter x1 | +7 | Village 62-67% |
| 15 | ordinary_villager x8, werewolf x3, seer x1, witch x1, healer x1, hunter x1 | +8 | Village 62-68% |
| 16 | ordinary_villager x8, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +2 | Village 53-57% |
| 17 | ordinary_villager x9, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +3 | Village 54-58% |
| 18 | ordinary_villager x10, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +4 | Village 57-62% |
| 19 | ordinary_villager x10, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | -2 | Wolves 52-56% |
| 20 | ordinary_villager x11, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | -1 | Wolves 51-54% |
| 21 | ordinary_villager x12, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | 0 | Near 50/50 |
| 22 | ordinary_villager x13, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | +1 | Village 51-54% |
| 23 | ordinary_villager x13, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -5 | Wolves 58-63% |
| 24 | ordinary_villager x14, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -4 | Wolves 56-61% |
| 25 | ordinary_villager x15, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -3 | Wolves 54-58% |
| 26 | ordinary_villager x16, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -2 | Wolves 52-56% |
| 27 | ordinary_villager x17, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -1 | Wolves 51-54% |
| 28 | ordinary_villager x18, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | 0 | Near 50/50 |
| 29 | ordinary_villager x19, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | +1 | Village 51-54% |
| 30 | ordinary_villager x20, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | +2 | Village 53-57% |

## Post-fix preset table

These are the launch presets after this PR. The target range remains `[-3, +6]`, with documented launch exceptions for exact requested compositions and advanced large tables.

| Players | Composition | Score | Predicted win rate |
| ---: | --- | ---: | --- |
| 6 | ordinary_villager x2, werewolf x2, seer x1, healer x1 | 0 | Wolves 55-60% because small-table parity is harsh |
| 7 | ordinary_villager x3, werewolf x2, seer x1, healer x1 | +1 | Wolves 50-55% because small-table parity is harsh |
| 8 | ordinary_villager x3, werewolf x2, seer x1, healer x1, hunter x1 | +4 | Village 57-62% |
| 9 | ordinary_villager x4, werewolf x2, seer x1, witch x1, hunter x1 | +7 | Village 62-67%; documented edge case |
| 10 | ordinary_villager x5, werewolf x2, seer x1, witch x1, hunter x1 | +8 | Village 62-68%; less protection than before |
| 11 | ordinary_villager x5, werewolf x3, seer x1, witch x1, hunter x1 | +2 | Village 53-57% |
| 12 | ordinary_villager x6, werewolf x3, seer x1, witch x1, hunter x1 | +3 | Village 54-58% |
| 13 | ordinary_villager x6, werewolf x3, seer x1, witch x1, healer x1, hunter x1 | +6 | Village 58-63% |
| 14 | ordinary_villager x6, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | 0 | Near 50/50 |
| 15 | ordinary_villager x7, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +1 | Village 51-54% |
| 16 | ordinary_villager x8, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +2 | Village 53-57% |
| 17 | ordinary_villager x9, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +3 | Village 54-58% |
| 18 | ordinary_villager x10, werewolf x4, seer x1, witch x1, healer x1, hunter x1 | +4 | Village 57-62% |
| 19 | ordinary_villager x10, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | -2 | Wolves 52-56% |
| 20 | ordinary_villager x11, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | -1 | Wolves 51-54% |
| 21 | ordinary_villager x12, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | 0 | Near 50/50 |
| 22 | ordinary_villager x13, werewolf x5, seer x1, witch x1, healer x1, hunter x1 | +1 | Village 51-54% |
| 23 | ordinary_villager x13, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -5 | Wolves 58-63%; advanced-table edge case |
| 24 | ordinary_villager x14, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -4 | Wolves 56-61%; advanced-table edge case |
| 25 | ordinary_villager x15, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -3 | Wolves 54-58% |
| 26 | ordinary_villager x16, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -2 | Wolves 52-56% |
| 27 | ordinary_villager x17, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | -1 | Wolves 51-54% |
| 28 | ordinary_villager x18, werewolf x6, seer x1, witch x1, healer x1, hunter x1 | 0 | Near 50/50 |
| 29 | ordinary_villager x18, werewolf x7, seer x1, witch x1, healer x1, hunter x1 | -6 | Wolves 60-65%; advanced-table edge case |
| 30 | ordinary_villager x19, werewolf x7, seer x1, witch x1, healer x1, hunter x1 | -5 | Wolves 58-63%; advanced-table edge case |

## Validation strategy

The new `packages/shared/src/__tests__/balance-score.test.ts` suite checks:

- every Werewolf classic preset from 6-18 has a documented balance score;
- every scaling Werewolf preset from 19-30 has a documented balance score;
- every Werewolf preset has the correct total role count;
- Werewolf presets always include at least 2 werewolves;
- Werewolf presets always include a Seer;
- Mafia sport and Mafia free presets remain inside the current Mafia balance window.

The standard Werewolf range is `[-3, +6]`. The test includes explicit documented edge windows for 9, 10, 23, 24, 29, and 30 players because the launch request locks those exact compositions while preserving advanced large-table threat pressure.

## Tuning protocol

This PR does not implement analytics. After 4 weeks of public play:

1. Collect completed game outcomes grouped by preset family and player count.
2. Compute actual win rates per faction.
3. Compare actual win rates to the predicted ranges above.
4. Flag any preset where actual results deviate by more than 15 percentage points from 50/50.
5. Propose preset-only adjustments:
   - village wins too often: increase wolf count or decrease village specials;
   - wolves win too often: decrease wolf count or restore/add village utility.
6. Update this document with measured win rates and the new post-fix table.
7. Ship changes in a normal PR. Historical games remain unchanged because each game stores its original config snapshot.

The corresponding follow-up is tracked in `docs/post-launch-todo.md`.
