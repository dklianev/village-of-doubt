"use client";

import { Home, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { captureClientException } from "@/lib/sentry-client";
import "@/components/system/SystemPages.module.css";

export type RouteErrorBoundaryProps = {
  error: unknown;
  retry: () => void;
};

export function RouteErrorState({
  error,
  retry,
  title,
  description,
}: RouteErrorBoundaryProps & {
  title: string;
  description: string;
}) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    captureClientException(error);
  }, [error]);

  return (
    <main className="shell route-state-shell">
      <section className="route-error-card" role="alert" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}>
        <p className="route-error-kicker">Неочаквано прекъсване</p>
        <h1 ref={headingRef} id={`${id}-heading`} tabIndex={-1}>{title}</h1>
        <p id={`${id}-description`}>{description}</p>
        <div className="route-error-actions">
          <button className="btn btn-primary" type="button" onClick={retry}>
            <RotateCcw size={18} aria-hidden="true" />
            Опитай отново
          </button>
          <a className="btn btn-secondary" href="/" referrerPolicy="no-referrer">
            <Home size={18} aria-hidden="true" />
            Към началото
          </a>
        </div>
        <p className="route-error-report">
          <a href="/report" referrerPolicy="no-referrer">Подай сигнал</a>
        </p>
      </section>
    </main>
  );
}
