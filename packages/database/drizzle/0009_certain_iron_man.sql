ALTER TABLE "games" ADD COLUMN "room_visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX "games_visibility_status_ended_at_idx" ON "games" USING btree ("room_visibility","status","ended_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_room_visibility_check" CHECK ("games"."room_visibility" IN ('private', 'public'));