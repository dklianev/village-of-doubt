# Post-launch follow-up items

- Wire the live stats endpoint to return stable per-family active room counts for the landing quickstart strip.
- Revisit the last-winner badge after history payloads consistently expose the game family.
- Enforce the promo roles rule flow at runtime before surfacing it as a primary lobby option.

## Balance tuning protocol (post-launch)

After 4 weeks of public play, collect game outcomes:

1. Query: for each preset (by player count + family), compute actual win rates per faction.
2. Compare actual win rates to predicted (based on balance score).
3. If actual deviation > 15% from 50/50, adjust preset:
   - Village wins too often: increase wolf count or decrease specials.
   - Wolves win too often: opposite.
4. Push adjustments via PR. Update `docs/balance-analysis.md` post-fix table.

Tracking: `docs/balance-analysis.md` "Tuning protocol" section.

Implementation deferred until we have analytics. See `docs/decisions/` for related decisions.
