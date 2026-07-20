ALTER TABLE "game_players" ADD COLUMN "won" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "game_players" AS player
SET "won" = true
FROM "games" AS game
WHERE player."game_id" = game."id"
  AND game."status" = 'ended'
  AND (
    (game."winner_team" = 'village' AND player."role" IN (
      'ordinary_villager', 'healer', 'witch', 'seer', 'hunter', 'red_riding_hood',
      'cupid', 'mayor', 'oracle', 'priest', 'cook', 'blacksmith', 'insomniac',
      'vampire_hunter', 'investigator', 'stray_cat', 'guard_dog', 'little_girl',
      'civilian', 'commissioner', 'doctor', 'detective', 'bodyguard', 'vigilante',
      'medium', 'mafia_mayor'
    ))
    OR (game."winner_team" = 'werewolves' AND player."role" = 'werewolf')
    OR (game."winner_team" = 'vampires' AND player."role" = 'vampire')
    OR (game."winner_team" = 'mafia' AND player."role" IN ('mafioso', 'don', 'lawyer', 'informant'))
    OR (game."winner_team" = 'maniac' AND player."role" = 'maniac')
  );
