"use client";

import { useToastItems } from "@/lib/toast";

const TOAST_KIND_BG = {
  info: "съобщение",
  error: "грешка",
  success: "готово",
} as const;

export function ToastHost() {
  const { items, dismiss } = useToastItems();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <button
          key={item.id}
          className={`toast-card toast-${item.kind}`}
          type="button"
          onClick={() => dismiss(item.id)}
        >
          <span>{TOAST_KIND_BG[item.kind]}</span>
          <strong>{item.message}</strong>
        </button>
      ))}
    </div>
  );
}
