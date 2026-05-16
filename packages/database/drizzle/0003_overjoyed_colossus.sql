CREATE INDEX "games_status_ended_at_idx" ON "games" USING btree ("status","ended_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");