-- Lock shared events before deriving JSON, so overlapping deletions compose.
CREATE OR REPLACE FUNCTION public.werewolf_scrub_account_events(requested_user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_anonymous_user_id text;
  updated_count integer;
BEGIN
  IF requested_user_id IS NULL OR requested_user_id = '' THEN
    RAISE EXCEPTION 'invalid account event scrub identity';
  END IF;
  SELECT anonymous_user_id INTO resolved_anonymous_user_id
  FROM public.deleted_user_identities WHERE original_user_id = requested_user_id;
  IF resolved_anonymous_user_id IS NULL THEN
    RAISE EXCEPTION 'account deletion identity is not prepared';
  END IF;

  WITH locked_events AS MATERIALIZED (
    SELECT event.id, event.payload, event.actor_id, event.target_id
    FROM public.game_events AS event
    WHERE event.actor_id IN (requested_user_id, resolved_anonymous_user_id)
      OR event.target_id IN (requested_user_id, resolved_anonymous_user_id)
      OR event.game_id IN (
        SELECT game_id FROM public.game_players
        WHERE user_id IN (requested_user_id, resolved_anonymous_user_id)
        UNION
        SELECT id FROM public.games
        WHERE host_id IN (requested_user_id, resolved_anonymous_user_id)
      )
    ORDER BY event.id
    FOR UPDATE OF event
  ), candidate_payloads AS (
    SELECT event.id, public.werewolf_scrub_account_event_value(
      event.payload, requested_user_id, resolved_anonymous_user_id, ARRAY[]::text[],
      event.actor_id IN (requested_user_id, resolved_anonymous_user_id)
        OR event.target_id IN (requested_user_id, resolved_anonymous_user_id),
      event.actor_id IN (requested_user_id, resolved_anonymous_user_id),
      array_remove(ARRAY[
        CASE WHEN event.actor_id IN (requested_user_id, resolved_anonymous_user_id) THEN '' END,
        CASE WHEN event.actor_id IN (requested_user_id, resolved_anonymous_user_id) THEN 'actor' END,
        CASE WHEN event.target_id IN (requested_user_id, resolved_anonymous_user_id) THEN 'target' END
      ], NULL), true
    ) AS scrubbed_payload
    FROM locked_events AS event
  ), updated_events AS (
    UPDATE public.game_events AS event SET payload = candidate.scrubbed_payload
    FROM candidate_payloads AS candidate
    WHERE event.id = candidate.id AND event.payload IS DISTINCT FROM candidate.scrubbed_payload
    RETURNING 1
  )
  SELECT count(*)::integer INTO updated_count FROM updated_events;
  RETURN updated_count;
END;
$$;
--> statement-breakpoint
-- Repair any identity restored by the previous concurrent-update implementation.
DO $$
DECLARE identity_row record;
BEGIN
  FOR identity_row IN
    SELECT original_user_id FROM public.deleted_user_identities ORDER BY original_user_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(identity_row.original_user_id, 0::bigint));
    PERFORM public.werewolf_scrub_account_events(identity_row.original_user_id);
  END LOOP;
END;
$$;
