-- Pre-launch hardening migration. The indexes below are transactional and can
-- take blocking locks; apply before traffic or in a declared maintenance window.
CREATE INDEX "game_events_actor_id_idx" ON "game_events" USING btree ("actor_id") WHERE "game_events"."actor_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "game_events_target_id_idx" ON "game_events" USING btree ("target_id") WHERE "game_events"."target_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "game_players_lover_user_id_idx" ON "game_players" USING btree ("lover_user_id") WHERE "game_players"."lover_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "games_status_updated_at_idx" ON "games" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_visibility_check" CHECK ("game_events"."visibility" IN ('public', 'private', 'faction', 'moderator')) NOT VALID;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_round_check" CHECK ("game_events"."round" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_death_round_check" CHECK ("game_players"."death_round" IS NULL OR "game_players"."death_round" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_status_check" CHECK ("games"."status" IN ('lobby', 'active', 'ended', 'abandoned')) NOT VALID;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winner_team_check" CHECK ("games"."winner_team" IS NULL OR "games"."winner_team" IN ('village', 'werewolves', 'vampires', 'mafia', 'maniac', 'lovers', 'draw')) NOT VALID;--> statement-breakpoint
ALTER TABLE "game_events" VALIDATE CONSTRAINT "game_events_visibility_check";--> statement-breakpoint
ALTER TABLE "game_events" VALIDATE CONSTRAINT "game_events_round_check";--> statement-breakpoint
ALTER TABLE "game_players" VALIDATE CONSTRAINT "game_players_death_round_check";--> statement-breakpoint
ALTER TABLE "games" VALIDATE CONSTRAINT "games_status_check";--> statement-breakpoint
ALTER TABLE "games" VALIDATE CONSTRAINT "games_winner_team_check";
