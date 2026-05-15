"use client";

import { EmailPasswordForm } from "@/components/sign-in/EmailPasswordForm";
import { OAuthButton } from "@/components/sign-in/OAuthButton";

export function SignInStage({ redirectTo }: { redirectTo: string }) {
  return (
    <section className="sign-in-stage">
      <div className="sign-in-table" aria-hidden />

      <article className="sign-in-plaque">
        <header className="sign-in-plaque-head">
          <p className="sign-in-kicker">вход на масата</p>
          <h1>Покажи се на масата</h1>
          <p className="sign-in-subtitle">
            Един профил пази историята, статистиките и поканите. Тайните роли остават на сървъра.
          </p>
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
      </article>
    </section>
  );
}
