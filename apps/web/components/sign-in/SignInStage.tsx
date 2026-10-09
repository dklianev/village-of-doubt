import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { EmailPasswordForm } from "@/components/sign-in/EmailPasswordForm";
import { OAuthButton } from "@/components/sign-in/OAuthButton";
import "./SignInStage.module.css";
import { ThemedHeroPreload } from "@/components/themed-hero-preload";

export const SIGN_IN_PROVIDERS = {
  google: {
    label: "Продължи с Google",
    pendingLabel: "Отваряме Google...",
    errorMessage: "Не успяхме да отворим Google. Опитай отново.",
  },
  discord: {
    label: "Продължи с Discord",
    pendingLabel: "Отваряме Discord...",
    errorMessage: "Не успяхме да отворим Discord. Опитай отново.",
  },
};

export function SignInStage({ redirectTo }: { redirectTo: string }) {
  const copy = signInCopyForRedirect(redirectTo);

  return (
    <section className="sign-in-stage">
      <ThemedHeroPreload scene="sign-in" />
      <div className="sign-in-art" aria-hidden="true" />
      <div className="sign-in-content">
        <section className="sign-in-panel" aria-label="Вход и регистрация">
          <EmailPasswordForm redirectTo={redirectTo}
            intro={<header className="sign-in-heading"><h1>{copy.title}</h1><p>{copy.description}</p></header>}
            registrationIntro={<header className="sign-in-heading"><h1>Създай профил</h1><p>Един профил за Върколак и Мафия.</p></header>}
            icons={{
              showPassword: <Eye size={18} aria-hidden="true" />,
              hidePassword: <EyeOff size={18} aria-hidden="true" />,
              submit: <ArrowRight size={18} aria-hidden="true" />,
            }}
          >
            <OAuthButton provider="google" redirectTo={redirectTo} {...SIGN_IN_PROVIDERS.google}>
              <span className="oauth-button-logo" aria-hidden="true">
                <img src="/brand/google-g.svg" alt="" width={24} height={24} />
              </span>
            </OAuthButton>
            <OAuthButton provider="discord" redirectTo={redirectTo} {...SIGN_IN_PROVIDERS.discord}>
              <span className="oauth-button-logo" aria-hidden="true">
                <img src="/brand/discord-mark.svg" alt="" width={24} height={24} />
              </span>
            </OAuthButton>
          </EmailPasswordForm>
          <footer className="sign-in-foot">
            <a href="/privacy">Поверителност</a>
            <span aria-hidden="true">·</span>
            <a href="/terms">Условия</a>
          </footer>
        </section>
      </div>
    </section>
  );
}

function signInCopyForRedirect(redirectTo: string) {
  if (redirectTo.includes("/join")) {
    return { title: "Вход в играта", description: "Влез или създай профил, за да продължиш към поканата." };
  }
  if (redirectTo.includes("/create")) {
    return { title: "Събери компанията", description: "Влез, за да създадеш стая и да поканиш приятели." };
  }
  if (redirectTo.startsWith("/play/")) {
    return { title: "Върни се в играта", description: "Влез със същия профил, за да се върнеш в стаята." };
  }
  if (redirectTo.startsWith("/friends")) {
    return { title: "Влез в Сенките", description: "Приятелите ти и поканите за следващата игра са тук." };
  }
  if (redirectTo.startsWith("/history") || redirectTo.startsWith("/achievements")) {
    return { title: "Влез в Сенките", description: "Върни се към своите игри, истории и постижения." };
  }
  if (redirectTo.startsWith("/account")) {
    return { title: "Влез в профила си", description: "Името, настройките и историята ти са на едно място." };
  }
  return { title: "Влез в Сенките", description: "Компанията е позната. Ролите са тайни." };
}
