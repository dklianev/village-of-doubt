"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, History, LogOut, Trophy, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { type AuthSessionView, useAuthSession } from "@/lib/use-auth-session";

export function AuthChip({ initialSession }: { initialSession: AuthSessionView | null }) {
  const router = useRouter();
  const { data: session, isPending, refresh } = useAuthSession(initialSession);
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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
        <span className="auth-chip-mark" aria-hidden>
          <KeyholeIcon />
        </span>
        <span className="auth-chip-text">Влез</span>
        <ArrowRight className="auth-chip-arrow" aria-hidden strokeWidth={2.2} />
      </Link>
    );
  }

  const displayName = session.user.name ?? "Играч";
  const avatarUrl = session.user.image ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  async function confirmLogout() {
    setSigningOut(true);
    await authClient.signOut();
    window.dispatchEvent(new Event("auth-session-change"));
    await refresh();
    setConfirmSignOut(false);
    setSigningOut(false);
    router.push("/");
    router.refresh();
  }

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
        <ChevronDown className="auth-chip-chevron" aria-hidden strokeWidth={2.2} />
      </button>

      {open ? (
        <div className="nav-dropdown nav-dropdown-user" role="menu">
          <Link href="/account" role="menuitem" prefetch={false} onClick={() => setOpen(false)} className="nav-dropdown-item">
            <User className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
            <span>Моят профил</span>
          </Link>
          <Link href="/history" role="menuitem" prefetch={false} onClick={() => setOpen(false)} className="nav-dropdown-item">
            <History className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
            <span>История</span>
          </Link>
          <Link href="/achievements" role="menuitem" prefetch={false} onClick={() => setOpen(false)} className="nav-dropdown-item">
            <Trophy className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
            <span>Постижения</span>
          </Link>
          <div className="nav-dropdown-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="nav-dropdown-item nav-dropdown-item-danger"
            onClick={() => {
              setOpen(false);
              setConfirmSignOut(true);
            }}
          >
            <LogOut className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
            <span>Изход</span>
          </button>
        </div>
      ) : null}

      {confirmSignOut ? (
        <SignOutConfirmDialog
          userName={displayName}
          pending={signingOut}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={confirmLogout}
        />
      ) : null}
    </div>
  );
}

function SignOutConfirmDialog({
  userName,
  pending,
  onCancel,
  onConfirm,
}: {
  userName: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="signout-modal-backdrop" role="presentation" onClick={onCancel}>
      <dialog className="signout-modal" open aria-labelledby="signout-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="signout-modal-close" onClick={onCancel} aria-label="Затвори" disabled={pending}>
          <X aria-hidden strokeWidth={2} />
        </button>
        <header className="signout-modal-head">
          <span className="signout-modal-icon" aria-hidden>
            <LogOut strokeWidth={1.8} />
          </span>
          <h2 id="signout-title">Излизаш ли от масата?</h2>
          <p>Здрасти, {userName}. Сесията ще се затвори и ще се върнеш на началната страница.</p>
        </header>
        <div className="signout-modal-actions">
          <button type="button" className="signout-modal-cancel" onClick={onCancel} disabled={pending}>
            Отказ
          </button>
          <button type="button" className="signout-modal-confirm" onClick={onConfirm} disabled={pending}>
            {pending ? "Излизане..." : "Излизам"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

function KeyholeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.75a5.25 5.25 0 0 0-2.2 10.02l-1.05 5.48h6.5l-1.05-5.48A5.25 5.25 0 0 0 12 3.75Z" />
      <path d="M9.8 14.05h4.4" />
    </svg>
  );
}
