"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastItems, type ToastKind } from "@/lib/toast";

const TOAST_KIND_BG: Record<ToastKind, string> = {
  info: "съобщение",
  error: "грешка",
  success: "готово",
  warning: "внимание",
};

export function ToastHost() {
  const { items, dismiss } = useToastItems();

  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="toast-host" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <article key={item.id} className="toast-card" data-kind={item.kind}>
          <span className="toast-icon" aria-hidden>
            <ToastIcon kind={item.kind} />
          </span>
          <div className="toast-copy">
            <span>{TOAST_KIND_BG[item.kind]}</span>
            <strong>{item.message}</strong>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(item.id)}
            aria-label="Затвори"
          >
            <X aria-hidden strokeWidth={2} />
          </button>
          <span className="toast-progress" style={{ animationDuration: `${item.duration}ms` }} aria-hidden />
        </article>
      ))}
    </aside>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") {
    return <CheckCircle2 strokeWidth={2} />;
  }
  if (kind === "info") {
    return <Info strokeWidth={2} />;
  }
  return <AlertCircle strokeWidth={2} />;
}
