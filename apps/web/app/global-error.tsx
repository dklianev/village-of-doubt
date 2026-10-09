"use client";

import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { captureClientException } from "@/lib/sentry-client";
import styles from "./GlobalError.module.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("werewolf-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // CSS follows the OS theme when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
    captureClientException(error);
  }, [error]);

  return (
    <html lang="bg" className={styles.document} data-theme={theme}>
      <head>
        <title>Страницата не се зареди | Сенките</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </head>
      <body className={styles.body}>
        <header className={styles.brand} aria-label="Сенките">Сенките</header>
        <main className={styles.main}>
          <section className={styles.content} role="alert" aria-labelledby="global-error-heading" aria-describedby="global-error-description">
            <TriangleAlert className={styles.symbol} size={32} aria-hidden="true" />
            <p className={styles.eyebrow}>Нещо се обърка</p>
            <h1 className={styles.heading} ref={headingRef} id="global-error-heading" tabIndex={-1}>Страницата не се зареди.</h1>
            <p className={styles.description} id="global-error-description">Възникна неочакван проблем. Опитай отново или се върни към началото. Ако проблемът се повтори, подай сигнал.</p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={retry}>
                <RotateCcw size={18} aria-hidden="true" />
                Опитай отново
              </button>
              <a className={styles.secondary} href="/" referrerPolicy="no-referrer">
                <Home size={18} aria-hidden="true" />
                Към началото
              </a>
            </div>
            <a className={styles.report} href="/report" referrerPolicy="no-referrer">Подай сигнал</a>
          </section>
        </main>
      </body>
    </html>
  );
}
