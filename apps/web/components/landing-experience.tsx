import { Mail } from "lucide-react";
import { Display } from "@werewolf/ui/server";
import { GAME_MODE_DEFINITIONS } from "@werewolf/shared";
import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";
import { UniversalHowToPlay } from "@/components/landing/UniversalHowToPlay";
import { NextLinkPill } from "@/components/next-link-pill";
import "@/components/landing/LandingSurface.module.css";

export type LandingSession = { user: { id: string; name?: string | null } } | null;

const GAMES = [
  {
    id: "werewolf",
    family: "werewolves",
    title: "Върколак",
    eyebrow: "фолклорен хорър",
    description:
      "Село, тайни роли и нощни събуждания. Сред вас се крият Върколаци, а понякога и нещо по-старо.",
    line: "Денем сте съседи. Нощем не всички сте хора.",
    href: "/werewolf",
    recommendedPlayers: GAME_MODE_DEFINITIONS.werewolves_classic.recommendedPlayersBg,
  },
  {
    id: "mafia",
    family: "mafia",
    title: "Мафия",
    eyebrow: "градска мистерия",
    description:
      "Градска игра на алибита, натиск и премерени лъжи. Мафията знае своите; Градът трябва да ги разкрие.",
    line: "Дъждът измива улицата, но не и алибитата.",
    href: "/mafia",
    recommendedPlayers: GAME_MODE_DEFINITIONS.mafia_free.recommendedPlayersBg,
  },
] as const satisfies readonly ModeChoiceGame[];

export function LandingExperience({ initialSession }: { initialSession: LandingSession }) {
  return (
    <main className="shell landing-shell">
      <section className="landing-hero-card">
        <div className="landing-hero-art" aria-hidden="true" />
        <p className="section-kicker">избери игра</p>
        <h1 className="landing-title">
          Върколак или Мафия
        </h1>
        <p className="landing-hero-copy">
          Една компания. Тайни роли. На кого ще повярваш?
        </p>

        <ModeChoiceCards games={GAMES} initialSession={initialSession} />
      </section>
      <UniversalHowToPlay />
      <FinalLandingCta />
    </main>
  );
}

export function FinalLandingCta() {
  return (
    <section className="landing-final-cta" aria-label="Готов ли си да седнеш на масата">
      <div className="landing-final-invitation">
        <picture className="landing-final-art landing-final-art--dark" aria-hidden="true">
          <source media="(max-width: 767px)" srcSet="/game-art/mobile/homepage/invitation-v1.webp" type="image/webp" />
          <img src="/game-art/homepage/invitation-v1.webp" alt="" width={1536} height={512} loading="lazy" decoding="async" />
        </picture>
        <picture className="landing-final-art landing-final-art--light" aria-hidden="true">
          <source media="(max-width: 767px)" srcSet="/game-art/mobile/homepage/invitation-light-v1.webp" type="image/webp" />
          <img src="/game-art/homepage/invitation-light-v1.webp" alt="" width={1536} height={512} loading="lazy" decoding="async" />
        </picture>
        <div className="landing-final-copy">
          <p className="section-kicker"><Mail size={16} aria-hidden="true" /> За следващата ви вечер</p>
          <Display size="h2">Кого ще поканиш?</Display>
          <p>Събери приятелите. Виж кой умее да пази тайна.</p>
          <div className="landing-final-actions">
            <NextLinkPill href="/werewolf/create" className="landing-invite-action" intent="primary" size="sm" tracked prefetch={false}>
              Играй Върколак
            </NextLinkPill>
            <NextLinkPill href="/mafia/create" className="landing-invite-action" intent="secondary" size="sm" tracked prefetch={false}>
              Играй Мафия
            </NextLinkPill>
          </div>
        </div>
      </div>
    </section>
  );
}
