"use client";

import { useEffect, useRef } from "react";
import { captureClientException } from "@/lib/sentry-client";
import "@/components/system/SystemPages.module.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    captureClientException(error);
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <html lang="bg">
      <body>
        <main className="global-error-screen">
          <section className="paper-card global-error-card" role="alert" aria-labelledby="global-error-heading">
            <p className="eyebrow">Нещо се обърка</p>
            <h1 ref={headingRef} id="global-error-heading" tabIndex={-1}>Играта спря за момент.</h1>
            <p>Опитай по-късно или презареди. Ако проблемът се повтори, ще го проследим по записа на грешката.</p>
            <div className="global-error-actions">
              <button className="btn btn-primary" type="button" onClick={reset}>
                Опитай отново
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>
                Презареди страницата
              </button>
              <a className="btn btn-secondary" href="/">Към началото</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
