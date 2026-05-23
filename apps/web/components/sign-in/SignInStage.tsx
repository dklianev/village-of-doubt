"use client";

import { Display, SceneCard } from "@werewolf/ui";
import { EmailPasswordForm } from "@/components/sign-in/EmailPasswordForm";
import { OAuthButton } from "@/components/sign-in/OAuthButton";

type SignInCopy = {
  kicker: string;
  title: [string, string];
  subtitle: string;
};

const DEFAULT_COPY: SignInCopy = {
  kicker: "вход на масата",
  title: ["Покажи се", "на масата"],
  subtitle: "Един профил пази историята, статистиките и поканите. Тайните роли остават на сървъра.",
};

export function SignInStage({ redirectTo }: { redirectTo: string }) {
  const copy = signInCopyForRedirect(redirectTo);
  const title = copy.title.join(" ");

  return (
    <section className="sign-in-stage">
      <div className="sign-in-table" aria-hidden />

      <article className="sign-in-plaque">
        <SceneCard eyebrow={copy.kicker.toLocaleUpperCase("bg-BG")} density="md">
          <header className="sign-in-plaque-head">
            <Display size="h2" as="h1">
              {title}
            </Display>
            <p className="sign-in-subtitle">{copy.subtitle}</p>
          </header>

          <div className="sign-in-oauth">
            <OAuthButton provider="google" redirectTo={redirectTo} />
            <OAuthButton provider="discord" redirectTo={redirectTo} />
          </div>

          <div className="sign-in-divider" role="separator" aria-label="или с имейл">
            <span>или с имейл</span>
          </div>

          <EmailPasswordForm redirectTo={redirectTo} />

          <footer className="sign-in-foot">
            <a href="/privacy" className="sign-in-foot-link">
              Поверителност
            </a>
            <span aria-hidden>·</span>
            <a href="/terms" className="sign-in-foot-link">
              Условия
            </a>
          </footer>
        </SceneCard>
      </article>
    </section>
  );
}

function signInCopyForRedirect(redirectTo: string): SignInCopy {
  if (redirectTo.startsWith("/friends")) {
    return {
      kicker: "приятели",
      title: ["Събери", "групата"],
      subtitle: "Влез, за да пазиш списъка с хората, които каниш най-често за следващата стая.",
    };
  }

  if (redirectTo.startsWith("/achievements")) {
    return {
      kicker: "постижения",
      title: ["Запази", "легендата"],
      subtitle: "Профилът отключва значки, статистики и история от игрите, които вече си преживял.",
    };
  }

  if (redirectTo.includes("/create")) {
    return {
      kicker: "нова стая",
      title: ["Стани", "стопанин"],
      subtitle: "Влез, за да създадеш частна стая, да избереш правила и да поканиш хората около масата.",
    };
  }

  if (redirectTo.includes("/join")) {
    return {
      kicker: "покана",
      title: ["Влез", "с кода"],
      subtitle: "Профилът казва на стаята кой си, без да разкрива ролята ти на никого освен на теб.",
    };
  }

  if (redirectTo.startsWith("/play/")) {
    return {
      kicker: "активна стая",
      title: ["Върни се", "в играта"],
      subtitle: "Влез със същия профил, за да те върнем при стаята, чата и личните сигнали.",
    };
  }

  if (redirectTo.startsWith("/history")) {
    return {
      kicker: "архив",
      title: ["Отвори", "историите"],
      subtitle: "Историята пази завършените стаи, ролите след края и ключовите моменти от играта.",
    };
  }

  if (redirectTo.startsWith("/account")) {
    return {
      kicker: "профил",
      title: ["Отвори", "профила"],
      subtitle: "Тук управляваш името, сесиите и данните, които пазим за игрите ти.",
    };
  }

  return DEFAULT_COPY;
}
