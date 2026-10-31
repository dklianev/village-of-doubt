#!/usr/bin/env sh

restore_bootstrap_import_roles() {
  # Dumps reference cluster roles, but the full reconciler also creates DB objects.
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres <<'SQL'
SELECT format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE', role_name)
FROM (VALUES ('werewolf_migrator'), ('werewolf_web'), ('werewolf_game')) AS required(role_name)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name)
\gexec
SQL
}

restore_validate_database_structure() {
  database_name="$1"
  validation_result="$(
    compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$database_name" -Atqc "
      SELECT CASE
        WHEN to_regclass('public.user') IS NOT NULL
          AND to_regclass('public.session') IS NOT NULL
          AND to_regclass('public.account') IS NOT NULL
          AND to_regclass('public.verification') IS NOT NULL
          AND to_regclass('public.games') IS NOT NULL
          AND to_regclass('public.game_players') IS NOT NULL
          AND to_regclass('public.game_events') IS NOT NULL
          AND to_regclass('public.user_achievements') IS NOT NULL
          AND to_regclass('public.game_session_revocations') IS NOT NULL
          AND to_regclass('public.deleted_user_identities') IS NOT NULL
          AND to_regclass('drizzle.__drizzle_migrations') IS NOT NULL
        THEN 'ok'
        ELSE 'invalid'
      END;
    "
  )"
  test "$validation_result" = "ok"
}

restore_validate_database_semantics() {
  database_name="$1"
  semantic_result="$(
    compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$database_name" -Atqc "
      /* restore_semantic_check */
      SELECT CASE WHEN
        (SELECT count(*) FROM drizzle.__drizzle_migrations) > 0
        AND to_regprocedure('public.werewolf_delete_account(text, text)') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM (VALUES
            ('werewolf_web', 'public.\"user\"', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
            ('werewolf_web', 'public.session', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
            ('werewolf_web', 'public.account', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
            ('werewolf_web', 'public.verification', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
            ('werewolf_web', 'public.games', ARRAY['SELECT','UPDATE']),
            ('werewolf_web', 'public.game_players', ARRAY['SELECT']),
            ('werewolf_web', 'public.game_events', ARRAY['SELECT','DELETE']),
            ('werewolf_web', 'public.user_achievements', ARRAY['SELECT']),
            ('werewolf_game', 'public.\"user\"', ARRAY['SELECT','INSERT']),
            ('werewolf_game', 'public.games', ARRAY['SELECT','INSERT','UPDATE']),
            ('werewolf_game', 'public.game_players', ARRAY['SELECT','INSERT','UPDATE']),
            ('werewolf_game', 'public.game_events', ARRAY['SELECT','INSERT']),
            ('werewolf_game', 'public.user_achievements', ARRAY['SELECT','INSERT'])
          ) AS required(role_name, table_name, privileges)
          CROSS JOIN LATERAL unnest(required.privileges) AS privilege(name)
          WHERE NOT COALESCE(has_table_privilege(
            (SELECT oid FROM pg_roles WHERE rolname = required.role_name),
            required.table_name,
            privilege.name
          ), false)
        )
        AND COALESCE(has_function_privilege(
          (SELECT oid FROM pg_roles WHERE rolname = 'werewolf_web'),
          'public.werewolf_delete_account(text, text)',
          'EXECUTE'
        ), false)
        AND NOT EXISTS (
          SELECT 1 FROM public.session AS session
          LEFT JOIN public.\"user\" AS account_user ON account_user.id = session.user_id
          WHERE account_user.id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.account AS account
          LEFT JOIN public.\"user\" AS account_user ON account_user.id = account.user_id
          WHERE account_user.id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.game_players AS player
          LEFT JOIN public.games AS game ON game.id = player.game_id
          WHERE game.id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.game_events AS event
          LEFT JOIN public.games AS game ON game.id = event.game_id
          WHERE game.id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_achievements AS achievement
          LEFT JOIN public.\"user\" AS account_user ON account_user.id = achievement.user_id
          WHERE account_user.id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.deleted_user_identities AS tombstone
          WHERE EXISTS (SELECT 1 FROM public.\"user\" WHERE id = tombstone.original_user_id)
            OR EXISTS (SELECT 1 FROM public.games WHERE host_id = tombstone.original_user_id)
            OR EXISTS (
              SELECT 1 FROM public.game_players
              WHERE user_id = tombstone.original_user_id
                OR lover_user_id = tombstone.original_user_id
            )
            OR EXISTS (SELECT 1 FROM public.game_events WHERE actor_id = tombstone.original_user_id)
            OR EXISTS (
              SELECT 1 FROM public.game_events
              WHERE strpos(payload::text, tombstone.original_user_id) > 0
            )
        )
      THEN 'ok' ELSE 'invalid' END;
    "
  )"
  test "$semantic_result" = "ok"
}

restore_verify_captured_tombstones() {
  database_name="$1"
  tombstone_file="$2"
  tombstone_sql_file="$3"
  if [ ! -s "$tombstone_file" ]; then
    return
  fi

  {
    cat <<'SQL'
-- restore_tombstone_semantic_check
CREATE TEMP TABLE expected_deleted_user_identities (
  original_user_id text PRIMARY KEY,
  anonymous_user_id text NOT NULL UNIQUE
);
\copy expected_deleted_user_identities (original_user_id, anonymous_user_id) FROM STDIN
SQL
    cat "$tombstone_file"
    cat <<'SQL'
\.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expected_deleted_user_identities AS expected
    LEFT JOIN public.deleted_user_identities AS actual
      ON actual.original_user_id = expected.original_user_id
      AND actual.anonymous_user_id = expected.anonymous_user_id
    WHERE actual.original_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'captured deletion tombstone was not preserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expected_deleted_user_identities AS expected
    WHERE EXISTS (SELECT 1 FROM public."user" WHERE id = expected.original_user_id)
      OR EXISTS (SELECT 1 FROM public.games WHERE host_id = expected.original_user_id)
      OR EXISTS (
        SELECT 1 FROM public.game_players
        WHERE user_id = expected.original_user_id
          OR lover_user_id = expected.original_user_id
      )
      OR EXISTS (SELECT 1 FROM public.game_events WHERE actor_id = expected.original_user_id)
      OR EXISTS (
        SELECT 1 FROM public.game_events
        WHERE strpos(payload::text, expected.original_user_id) > 0
      )
  ) THEN
    RAISE EXCEPTION 'captured deleted identity was reintroduced';
  END IF;
END
$$;
SQL
  } > "$tombstone_sql_file"

  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$database_name" < "$tombstone_sql_file"
}
