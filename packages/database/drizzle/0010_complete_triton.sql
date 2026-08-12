CREATE TABLE "game_session_revocations" (
	"user_id" text PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
