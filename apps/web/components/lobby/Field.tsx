"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  error = "",
  actionLabel,
  onAction,
  children,
}: {
  label: string;
  hint: string;
  error?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input-wrap" data-has-action={Boolean(onAction)}>
        {children}
        {onAction ? (
          <button type="button" className="field-action" aria-label={actionLabel} title={actionLabel} onClick={onAction}>
            <RefreshIcon />
          </button>
        ) : null}
      </span>
      {error ? (
        <span className="field-error" role="alert">
          ⚠ {error}
        </span>
      ) : (
        <span className="field-hint">{hint}</span>
      )}
    </label>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M3 12a9 9 0 0 1 15.1-6.6L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 0 1-15.1 6.6L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
