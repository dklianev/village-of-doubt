# Landing & game-home components

## Page -> component map

### `/` (homepage)
- `LandingExperience` (server) - hero card + ModeChoiceCards
- `<UniversalHowToPlay />` - 5-step generic onboarding
- `<LiveTickerCard family={null} />` - combined werewolf + mafia stats
- `<RecentEndingsCard family={null} />` - last 3 endings from any family

### `/werewolf`
- `GameHomePage(family="werewolves")` - hero
- `<WerewolfNightTimeline />` - 5 atmospheric night phases with painterly panels
- `<RoleSpotlight family="werewolves" />` - 5 classic werewolf roles with art
- `<VariantsChips family="werewolves" />` - classic, lovers, vampires, madman
- `<LiveTickerCard family="werewolves" />` - werewolf-only stats
- `<RecentEndingsCard family="werewolves" />` - last 3 werewolf endings

### `/mafia`
- `GameHomePage(family="mafia")` - hero
- `<MafiaNightTimeline />` - 5 noir night phases with painterly panels
- `<RoleSpotlight family="mafia" />` - 5 mafia roles with art
- `<MafiaMechanicsCallouts />` - alibis, signal, investigation explainer
- `<SportMafiaCallout />` - Sport Mafia mode highlight
- `<LiveTickerCard family="mafia" />` - mafia-only stats
- `<RecentEndingsCard family="mafia" />` - last 3 mafia endings

## Shared chrome
- `.quickstart-mini-card` styles apply to `<LiveTickerCard />` and `<RecentEndingsCard />` across all 3 pages.
