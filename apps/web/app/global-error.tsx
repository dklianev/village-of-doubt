"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="bg">
      <body>
        <main className="global-error-screen">
          <section className="paper-card global-error-card">
            <p className="eyebrow">Нещо се обърка</p>
            <h1>Играта спря за момент.</h1>
            <p>Опитай по-късно или презареди. Ако проблемът се повтори, ще го проследим по записа на грешката.</p>
            <button className="btn btn-primary" type="button" onClick={reset}>
              Опитай отново
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
