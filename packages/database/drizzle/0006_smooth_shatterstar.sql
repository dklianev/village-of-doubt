CREATE TABLE "deleted_user_identities" (
	"original_user_id" text PRIMARY KEY NOT NULL,
	"anonymous_user_id" text NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deleted_user_identities_anonymous_user_id_unique" UNIQUE("anonymous_user_id")
);
--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "games_code_unique";--> statement-breakpoint
WITH "legacy_deleted_players" AS (
	SELECT
		"id",
		'deleted_legacy_' || replace("id"::text, '-', '') AS "anonymous_user_id"
	FROM "game_players"
	WHERE "user_id" = '00000000-0000-0000-0000-000000000000'
)
INSERT INTO "user" (
	"id",
	"name",
	"email",
	"email_verified",
	"image",
	"created_at",
	"updated_at"
)
SELECT
	"anonymous_user_id",
	'Изтрит играч',
	"anonymous_user_id" || '@deleted.invalid',
	false,
	null,
	now(),
	now()
FROM "legacy_deleted_players"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
WITH "legacy_deleted_players" AS (
	SELECT
		"id",
		'deleted_legacy_' || replace("id"::text, '-', '') AS "anonymous_user_id"
	FROM "game_players"
	WHERE "user_id" = '00000000-0000-0000-0000-000000000000'
)
UPDATE "game_players"
SET "user_id" = "legacy_deleted_players"."anonymous_user_id"
FROM "legacy_deleted_players"
WHERE "game_players"."id" = "legacy_deleted_players"."id";--> statement-breakpoint
DO $$
DECLARE
	"conflicting_duplicate" record;
BEGIN
	SELECT
		"game_id",
		"user_id",
		count(*) AS "row_count"
	INTO "conflicting_duplicate"
	FROM "game_players"
	GROUP BY "game_id", "user_id"
	HAVING count(*) > 1
		AND count(DISTINCT ROW(
			"display_name",
			"role",
			"is_alive",
			"death_round",
			"death_cause",
			"is_lover",
			"lover_user_id"
		)) > 1
	ORDER BY "game_id", "user_id"
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Conflicting duplicate game_players rows for game_id %, user_id % (% rows)',
			"conflicting_duplicate"."game_id",
			"conflicting_duplicate"."user_id",
			"conflicting_duplicate"."row_count"
			USING HINT = 'Resolve differing player state before applying 0006_smooth_shatterstar.';
	END IF;
END $$;--> statement-breakpoint
WITH "ranked_game_players" AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "game_id", "user_id"
		ORDER BY "created_at", "id"
	) AS "duplicate_rank"
	FROM "game_players"
)
DELETE FROM "game_players"
USING "ranked_game_players"
WHERE "game_players"."id" = "ranked_game_players"."id"
	AND "ranked_game_players"."duplicate_rank" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_game_user_idx" ON "game_players" USING btree ("game_id","user_id");
