import { SceneCard } from "@werewolf/ui/server";
import { EmailPasswordForm } from "@/components/sign-in/EmailPasswordForm";
import { OAuthButton } from "@/components/sign-in/OAuthButton";
import "@/components/sign-in/LegacySignIn.module.css";

type SignInCopy = {
  kicker: string;
  title: [string, string];
  subtitle: string;
};

const DEFAULT_COPY: SignInCopy = {
  kicker: "вход на масата",
  title: ["Покажи се", "на масата"],
  subtitle: "Едно досие пази историята, статистиките и поканите. Тайните роли остават на сървъра.",
};

export function SignInStage({ redirectTo }: { redirectTo: string }) {
  const copy = signInCopyForRedirect(redirectTo);
  const title = copy.title.join(" ");

  return (
    <section className="sign-in-stage">
      <SceneCard
        density="lg"
        background={{
          image: "var(--art-sign-in)",
          overlay: "veil",
          focalX: 42,
          focalY: 50,
          minHeight: "100%",
        }}
      >
        <div className="sign-in-stage-frame">
          <header className="sign-in-scene-copy">
            <p className="sign-in-kicker">{copy.kicker}</p>
            <h1 aria-label={title}>
              <span>{copy.title[0]}</span>{" "}
              <span>{copy.title[1]}</span>
            </h1>
            <p className="sign-in-subtitle">{copy.subtitle}</p>
          </header>

          <section className="sign-in-ledger" aria-labelledby="sign-in-ledger-title">
            <span className="sign-in-ledger-seal" aria-hidden>
              В
            </span>
            <span className="sign-in-ledger-stitch" aria-hidden />
            <header className="sign-in-form-head">
              <p className="sign-in-ledger-eyebrow">ВХОД</p>
              <h2 id="sign-in-ledger-title">Отвори досието си</h2>
              <p>Избери бърз вход или използвай имейл и парола.</p>
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
          </section>
        </div>
      </SceneCard>
    </section>
  );
}

function signInCopyForRedirect(redirectTo: string): SignInCopy {
  if (redirectTo.startsWith("/friends")) {
    return {
      kicker: "познати",
      title: ["Събери", "групата"],
      subtitle: "Влез, за да пазиш списъка с хората, които каниш най-често за следващата стая.",
    };
  }

  if (redirectTo.startsWith("/achievements")) {
    return {
      kicker: "легенди",
      title: ["Запази", "легендата"],
      subtitle: "Досието отключва значки, статистики и история от игрите, които вече си преживял.",
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
      subtitle: "Досието казва на стаята кой си, без да разкрива ролята ти на никого освен на теб.",
    };
  }

  if (redirectTo.startsWith("/play/")) {
    return {
      kicker: "активна стая",
      title: ["Върни се", "в играта"],
      subtitle: "Влез със същото досие, за да те върнем при стаята, чата и личните сигнали.",
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
      kicker: "досие",
      title: ["Отвори", "досието"],
      subtitle: "Тук управляваш името, сесиите и данните, които пазим за игрите ти.",
    };
  }

  return DEFAULT_COPY;
}
