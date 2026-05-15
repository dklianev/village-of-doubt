"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthChip() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (ref.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending) {
    return <span className="auth-chip auth-chip-loading" aria-hidden />;
  }

  if (!session) {
    return (
      <Link href="/sign-in" className="auth-chip auth-chip-signin" prefetch={false}>
        <span className="auth-chip-text">Влез</span>
        <span className="auth-chip-arrow" aria-hidden>
          →
        </span>
      </Link>
    );
  }

  const displayName = session.user.name ?? "Играч";
  const avatarUrl = session.user.image ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="auth-chip auth-chip-avatar" ref={ref}>
      <button
        type="button"
        className="auth-chip-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Меню на ${displayName}`}
      >
        <span className="auth-chip-photo" aria-hidden>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="auth-chip-initial">{initial}</span>
          )}
        </span>
        <span className="auth-chip-name">{displayName}</span>
        <span className="auth-chip-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="auth-chip-dropdown paper-card" role="menu">
          <Link href="/account" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>
            Моят профил
          </Link>
          <Link href="/history" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>
            История
          </Link>
          <Link href="/achievements" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>
            Постижения
          </Link>
          <div className="auth-chip-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="auth-chip-signout"
            onClick={async () => {
              setOpen(false);
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            Изход
          </button>
        </div>
      ) : null}
    </div>
  );
}
