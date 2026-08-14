CREATE OR REPLACE FUNCTION public.werewolf_prepare_account_deletion(
  requested_user_id text,
  proposed_anonymous_user_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_anonymous_user_id text;
BEGIN
  IF requested_user_id IS NULL OR requested_user_id = ''
    OR proposed_anonymous_user_id !~ '^deleted_[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'invalid account deletion identity';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(requested_user_id, 0::bigint));
  PERFORM 1 FROM public."user" WHERE id = requested_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.deleted_user_identities (original_user_id, anonymous_user_id)
  VALUES (requested_user_id, proposed_anonymous_user_id)
  ON CONFLICT (original_user_id) DO NOTHING;

  SELECT anonymous_user_id INTO resolved_anonymous_user_id
  FROM public.deleted_user_identities
  WHERE original_user_id = requested_user_id;

  INSERT INTO public."user" (id, name, email, email_verified, created_at, updated_at)
  VALUES (
    resolved_anonymous_user_id,
    'Изтрит играч',
    resolved_anonymous_user_id || '@deleted.invalid',
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN resolved_anonymous_user_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.werewolf_scrub_account_event_value(
  source_value jsonb,
  requested_user_id text,
  anonymous_user_id text,
  display_names text[],
  strip_secret_roles boolean,
  redact_root_message boolean,
  contextual_name_stems text[],
  at_root boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  item record;
  canonical_key text;
  identity_stem text;
  name_stem text;
  matched_identity_stems text[] := COALESCE(contextual_name_stems, ARRAY[]::text[]);
  references_deleted_identity boolean;
  result jsonb;
BEGIN
  IF source_value IS NULL OR jsonb_typeof(source_value) NOT IN ('object', 'array') THEN
    RETURN source_value;
  END IF;

  IF jsonb_typeof(source_value) = 'array' THEN
    SELECT COALESCE(
      jsonb_agg(
        public.werewolf_scrub_account_event_value(
          element.value,
          requested_user_id,
          anonymous_user_id,
          display_names,
          false,
          false,
          ARRAY[]::text[],
          false
        )
        ORDER BY element.ordinality
      ),
      '[]'::jsonb
    )
    INTO result
    FROM jsonb_array_elements(source_value) WITH ORDINALITY AS element(value, ordinality);
    RETURN result;
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(source_value)
  LOOP
    IF jsonb_typeof(item.value) <> 'string' OR item.value #>> '{}' <> requested_user_id THEN
      CONTINUE;
    END IF;
    IF item.key !~* '(?:^|_)(?:user|player|actor|target|host)?id$|userid$' THEN
      CONTINUE;
    END IF;

    canonical_key := lower(regexp_replace(item.key, '[^a-zA-Z0-9]', '', 'g'));
    identity_stem := CASE
      WHEN canonical_key IN ('id', 'userid', 'playerid') THEN ''
      WHEN right(canonical_key, 6) = 'userid' THEN left(canonical_key, -6)
      WHEN right(canonical_key, 2) = 'id' THEN left(canonical_key, -2)
      ELSE NULL
    END;
    IF identity_stem IS NOT NULL AND NOT identity_stem = ANY(matched_identity_stems) THEN
      matched_identity_stems := array_append(matched_identity_stems, identity_stem);
    END IF;
  END LOOP;

  references_deleted_identity := strip_secret_roles
    OR COALESCE(array_length(matched_identity_stems, 1), 0) > 0;
  result := '{}'::jsonb;

  FOR item IN SELECT key, value FROM jsonb_each(source_value)
  LOOP
    canonical_key := lower(regexp_replace(item.key, '[^a-zA-Z0-9]', '', 'g'));

    IF item.key = requested_user_id THEN
      CONTINUE;
    END IF;
    IF redact_root_message AND at_root AND canonical_key = 'message' THEN
      CONTINUE;
    END IF;
    IF references_deleted_identity AND (
      lower(item.key) LIKE '%role%'
      OR canonical_key IN ('targetbecame', 'stolenrole')
    ) THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(item.value) = 'string'
      AND item.value #>> '{}' = requested_user_id
      AND item.key ~* '(?:^|_)(?:user|player|actor|target|host)?id$|userid$' THEN
      result := result || jsonb_build_object(item.key, anonymous_user_id);
      CONTINUE;
    END IF;

    name_stem := CASE
      WHEN canonical_key IN ('name', 'displayname', 'playername') THEN ''
      WHEN right(canonical_key, 11) = 'displayname' THEN left(canonical_key, -11)
      WHEN right(canonical_key, 4) = 'name' THEN left(canonical_key, -4)
      ELSE NULL
    END;
    IF name_stem IS NOT NULL
      AND name_stem = ANY(matched_identity_stems)
      AND jsonb_typeof(item.value) = 'string'
      AND item.value #>> '{}' = ANY(display_names)
      AND item.value #>> '{}' <> 'Изтрит играч' THEN
      result := result || jsonb_build_object(item.key, 'Изтрит играч');
      CONTINUE;
    END IF;

    result := result || jsonb_build_object(
      item.key,
      public.werewolf_scrub_account_event_value(
        item.value,
        requested_user_id,
        anonymous_user_id,
        display_names,
        false,
        false,
        ARRAY[]::text[],
        false
      )
    );
  END LOOP;

  RETURN result;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.werewolf_scrub_account_events(
  requested_user_id text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_anonymous_user_id text;
  known_display_names text[];
  updated_count integer;
BEGIN
  IF requested_user_id IS NULL OR requested_user_id = '' THEN
    RAISE EXCEPTION 'invalid account event scrub identity';
  END IF;

  SELECT anonymous_user_id INTO resolved_anonymous_user_id
  FROM public.deleted_user_identities
  WHERE original_user_id = requested_user_id;
  IF resolved_anonymous_user_id IS NULL THEN
    RAISE EXCEPTION 'account deletion identity is not prepared';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT identity.display_name), ARRAY[]::text[])
  INTO known_display_names
  FROM (
    SELECT name AS display_name FROM public."user" WHERE id = requested_user_id
    UNION ALL
    SELECT display_name FROM public.game_players WHERE user_id = requested_user_id
  ) AS identity
  WHERE identity.display_name IS NOT NULL AND identity.display_name <> '';

  WITH candidate_payloads AS (
    SELECT
      event.id,
      public.werewolf_scrub_account_event_value(
        event.payload,
        requested_user_id,
        resolved_anonymous_user_id,
        known_display_names,
        event.actor_id = requested_user_id OR event.target_id = requested_user_id,
        event.actor_id = requested_user_id,
        array_remove(ARRAY[
          CASE WHEN event.actor_id = requested_user_id THEN '' END,
          CASE WHEN event.actor_id = requested_user_id THEN 'actor' END,
          CASE WHEN event.target_id = requested_user_id THEN 'target' END
        ], NULL),
        true
      ) AS scrubbed_payload
    FROM public.game_events AS event
    WHERE event.actor_id = requested_user_id
      OR event.target_id = requested_user_id
      OR event.game_id IN (
        SELECT game_id FROM public.game_players WHERE user_id = requested_user_id
        UNION
        SELECT id FROM public.games WHERE host_id = requested_user_id
      )
  ), updated_events AS (
    UPDATE public.game_events AS event
    SET payload = candidate.scrubbed_payload
    FROM candidate_payloads AS candidate
    WHERE event.id = candidate.id
      AND event.payload IS DISTINCT FROM candidate.scrubbed_payload
    RETURNING 1
  )
  SELECT count(*)::integer INTO updated_count FROM updated_events;

  RETURN updated_count;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.werewolf_finalize_account_deletion(
  requested_user_id text,
  resolved_anonymous_user_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.deleted_user_identities
    WHERE original_user_id = requested_user_id
      AND anonymous_user_id = resolved_anonymous_user_id
  ) THEN
    RAISE EXCEPTION 'account deletion identity mismatch';
  END IF;

  UPDATE public.game_players
  SET user_id = resolved_anonymous_user_id, display_name = 'Изтрит играч'
  WHERE user_id = requested_user_id;
  UPDATE public.game_players
  SET lover_user_id = resolved_anonymous_user_id
  WHERE lover_user_id = requested_user_id;
  UPDATE public.game_events
  SET actor_id = resolved_anonymous_user_id
  WHERE actor_id = requested_user_id;
  UPDATE public.game_events
  SET target_id = resolved_anonymous_user_id
  WHERE target_id = requested_user_id;
  UPDATE public.games
  SET host_id = resolved_anonymous_user_id
  WHERE host_id = requested_user_id;
  DELETE FROM public.user_achievements WHERE user_id = requested_user_id;
  DELETE FROM public.verification
  WHERE identifier = requested_user_id OR value = requested_user_id;
  DELETE FROM public."user" WHERE id = requested_user_id;

  RETURN FOUND;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.werewolf_delete_account(
  requested_user_id text,
  proposed_anonymous_user_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_anonymous_user_id text;
BEGIN
  resolved_anonymous_user_id := public.werewolf_prepare_account_deletion(
    requested_user_id,
    proposed_anonymous_user_id
  );
  IF resolved_anonymous_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public.werewolf_scrub_account_events(requested_user_id);
  RETURN public.werewolf_finalize_account_deletion(
    requested_user_id,
    resolved_anonymous_user_id
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.werewolf_prepare_account_deletion(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.werewolf_scrub_account_event_value(jsonb, text, text, text[], boolean, boolean, text[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.werewolf_scrub_account_events(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.werewolf_finalize_account_deletion(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.werewolf_delete_account(text, text) FROM PUBLIC;
