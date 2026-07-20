"use client";

import { useEffect } from "react";
import "@/components/system/SystemPages.module.css";

export function RouteErrorState({
  error,
  reset,
  title,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell route-state-shell">
      <section className="paper-card route-error-card" role="alert">
        <p className="eyebrow">неочаквано прекъсване</p>
        <h1>{title}</h1>
        <p>Страницата не можа да се подреди докрай. Опитай отново, без да напускаш масата.</p>
        <button className="btn btn-primary" type="button" onClick={reset}>
          Опитай отново
        </button>
      </section>
    </main>
  );
}
