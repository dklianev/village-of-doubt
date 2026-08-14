#!/usr/bin/env sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${MIGRATOR_DB_PASSWORD:?MIGRATOR_DB_PASSWORD is required}"
: "${WEB_DB_PASSWORD:?WEB_DB_PASSWORD is required}"
: "${GAME_DB_PASSWORD:?GAME_DB_PASSWORD is required}"

psql \
  -X \
  -v ON_ERROR_STOP=1 \
  -v database_name="$PGDATABASE" <<'SQL'
\getenv migrator_password MIGRATOR_DB_PASSWORD
\getenv web_password WEB_DB_PASSWORD
\getenv game_password GAME_DB_PASSWORD

SET log_min_duration_statement = -1;
SET log_min_error_statement = PANIC;
SET log_statement = 'none';

BEGIN;

SELECT 'CREATE ROLE werewolf_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS PASSWORD '
  || quote_literal(:'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'werewolf_migrator')
\gexec

SELECT 'CREATE ROLE werewolf_web WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '
  || quote_literal(:'web_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'werewolf_web')
\gexec

SELECT 'CREATE ROLE werewolf_game WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '
  || quote_literal(:'game_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'werewolf_game')
\gexec

ALTER ROLE werewolf_migrator
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS
  PASSWORD :'migrator_password';
ALTER ROLE werewolf_web
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
  PASSWORD :'web_password';
ALTER ROLE werewolf_game
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
  PASSWORD :'game_password';

SELECT format('REVOKE %I FROM %I', granted_role.rolname, member_role.rolname)
FROM pg_auth_members AS membership
JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname IN (
    'werewolf',
    'werewolf_migrator',
    'pg_read_all_data',
    'pg_write_all_data'
  )
  AND member_role.rolname IN ('werewolf_web', 'werewolf_game')
ORDER BY granted_role.rolname, member_role.rolname
\gexec

COMMIT;

ALTER DATABASE :"database_name" OWNER TO werewolf_migrator;

BEGIN;

SELECT format('ALTER SCHEMA %I OWNER TO werewolf_migrator', namespace.nspname)
FROM pg_namespace AS namespace
WHERE namespace.nspname IN ('public', 'drizzle')
  AND namespace.nspowner <> (SELECT oid FROM pg_roles WHERE rolname = 'werewolf_migrator')
\gexec

SELECT format(
  'ALTER %s %I.%I OWNER TO werewolf_migrator',
  CASE relation.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'p' THEN 'TABLE'
    WHEN 'S' THEN 'SEQUENCE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    WHEN 'f' THEN 'FOREIGN TABLE'
  END,
  namespace.nspname,
  relation.relname
)
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname IN ('public', 'drizzle')
  AND relation.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
  AND relation.relowner <> (SELECT oid FROM pg_roles WHERE rolname = 'werewolf_migrator')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend AS dependency
    WHERE dependency.classid = 'pg_class'::regclass
      AND dependency.objid = relation.oid
      AND dependency.deptype = 'e'
  )
ORDER BY namespace.nspname, relation.relname
\gexec

SELECT format('ALTER TYPE %I.%I OWNER TO werewolf_migrator', namespace.nspname, type.typname)
FROM pg_type AS type
JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
WHERE namespace.nspname IN ('public', 'drizzle')
  AND type.typtype IN ('d', 'e', 'r')
  AND type.typowner <> (SELECT oid FROM pg_roles WHERE rolname = 'werewolf_migrator')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend AS dependency
    WHERE dependency.classid = 'pg_type'::regclass
      AND dependency.objid = type.oid
      AND dependency.deptype = 'e'
  )
ORDER BY namespace.nspname, type.typname
\gexec

SELECT format(
  'ALTER FUNCTION %I.%I(%s) OWNER TO werewolf_migrator',
  namespace.nspname,
  procedure.proname,
  pg_get_function_identity_arguments(procedure.oid)
)
FROM pg_proc AS procedure
JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.prokind IN ('f', 'w')
  AND procedure.proowner <> (SELECT oid FROM pg_roles WHERE rolname = 'werewolf_migrator')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend AS dependency
    WHERE dependency.classid = 'pg_proc'::regclass
      AND dependency.objid = procedure.oid
      AND dependency.deptype = 'e'
  )
ORDER BY procedure.proname, pg_get_function_identity_arguments(procedure.oid)
\gexec

CREATE SCHEMA IF NOT EXISTS werewolf_observability AUTHORIZATION werewolf;
ALTER SCHEMA werewolf_observability OWNER TO werewolf;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA werewolf_observability;
SELECT format(
  'ALTER EXTENSION pg_stat_statements SET SCHEMA %I',
  'werewolf_observability'
)
FROM pg_extension AS extension
JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
WHERE extension.extname = 'pg_stat_statements'
  AND namespace.nspname <> 'werewolf_observability'
\gexec
REVOKE ALL PRIVILEGES ON SCHEMA werewolf_observability FROM PUBLIC, werewolf_web, werewolf_game;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA werewolf_observability
  FROM PUBLIC, werewolf_web, werewolf_game;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA werewolf_observability
  FROM PUBLIC, werewolf_web, werewolf_game;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA werewolf_observability
  FROM PUBLIC, werewolf_web, werewolf_game;

REVOKE CONNECT, TEMPORARY ON DATABASE :"database_name" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON DATABASE :"database_name" FROM werewolf_web, werewolf_game;
GRANT CONNECT ON DATABASE :"database_name" TO werewolf_web, werewolf_game;
GRANT CONNECT, TEMPORARY ON DATABASE :"database_name" TO werewolf_migrator;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM werewolf_web, werewolf_game;
GRANT USAGE ON SCHEMA public TO werewolf_web, werewolf_game;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, werewolf_web, werewolf_game;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, werewolf_web, werewolf_game;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, werewolf_web, werewolf_game;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO werewolf_web, werewolf_game;

SELECT format(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO werewolf_web',
  relation.relname
)
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND relation.relname IN ('user', 'session', 'account', 'verification')
ORDER BY relation.relname
\gexec

SELECT format(
  'GRANT %s ON TABLE public.%I TO werewolf_web',
  CASE relation.relname
    WHEN 'deleted_user_identities' THEN 'SELECT'
    WHEN 'games' THEN 'SELECT'
    WHEN 'game_players' THEN 'SELECT'
    WHEN 'game_events' THEN 'SELECT'
    WHEN 'user_achievements' THEN 'SELECT'
    WHEN 'game_session_revocations' THEN 'SELECT, INSERT, UPDATE'
  END,
  relation.relname
)
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND relation.relname IN (
    'deleted_user_identities',
    'games',
    'game_players',
    'game_events',
    'user_achievements',
    'game_session_revocations'
  )
ORDER BY relation.relname
\gexec

SELECT format(
  'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, werewolf_web, werewolf_game',
  function_name
)
FROM unnest(ARRAY[
  'public.werewolf_prepare_account_deletion(text, text)',
  'public.werewolf_scrub_account_event_value(jsonb, text, text, text[], boolean, boolean, text[], boolean)',
  'public.werewolf_scrub_account_events(text)',
  'public.werewolf_finalize_account_deletion(text, text)',
  'public.werewolf_delete_account(text, text)'
]) AS function_name
WHERE to_regprocedure(function_name) IS NOT NULL
\gexec

SELECT format(
  'GRANT EXECUTE ON FUNCTION %s TO werewolf_web',
  function_name
)
FROM unnest(ARRAY[
  'public.werewolf_delete_account(text, text)'
]) AS function_name
WHERE to_regprocedure(function_name) IS NOT NULL
\gexec

SELECT format(
  'GRANT %s ON TABLE public.%I TO werewolf_game',
  CASE relation.relname
    WHEN 'user' THEN 'SELECT, INSERT'
    WHEN 'deleted_user_identities' THEN 'SELECT'
    WHEN 'games' THEN 'SELECT, INSERT, UPDATE'
    WHEN 'game_players' THEN 'SELECT, INSERT, UPDATE'
    WHEN 'game_events' THEN 'SELECT, INSERT'
    WHEN 'user_achievements' THEN 'SELECT, INSERT'
    WHEN 'game_session_revocations' THEN 'SELECT'
  END,
  relation.relname
)
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND relation.relname IN (
    'user',
    'deleted_user_identities',
    'games',
    'game_players',
    'game_events',
    'user_achievements',
    'game_session_revocations'
  )
ORDER BY relation.relname
\gexec

ALTER DEFAULT PRIVILEGES FOR ROLE werewolf_migrator IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE werewolf_migrator IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE werewolf_migrator IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER ROLE werewolf_migrator IN DATABASE :"database_name"
  SET application_name TO 'werewolf-migrator';
ALTER ROLE werewolf_web IN DATABASE :"database_name"
  SET application_name TO 'werewolf-web';
ALTER ROLE werewolf_game IN DATABASE :"database_name"
  SET application_name TO 'werewolf-game';

COMMIT;
SQL
