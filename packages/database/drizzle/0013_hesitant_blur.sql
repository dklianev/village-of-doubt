DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "games"
    WHERE "status" IN ('lobby', 'active')
    GROUP BY "code"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Conflicting live game codes must be resolved before migration 0013 can continue.'
      USING ERRCODE = '23505';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "games_live_code_uidx" ON "games" USING btree ("code") WHERE "games"."status" IN ('lobby', 'active');
