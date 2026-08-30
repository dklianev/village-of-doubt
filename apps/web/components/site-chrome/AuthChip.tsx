"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, ChevronDown, History, LogOut, Trophy, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import { useAuthSession, type AuthSessionView } from "@/lib/use-auth-session";

const Dialog = dynamic(() => import("@werewolf/ui").then((module) => module.Dialog), {
  loading: () => null,
  ssr: false,
});

export function AuthChip({ initialSession }: { initialSession?: AuthSessionView | null }) {
  const router = useRouter();
  const sessionQuery = useAuthSession(initialSession);
  const session = sessionQuery.data;
  const isPending = sessionQuery.isPending;
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
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
    return (
      <div className="auth-chip-slot" data-auth-state="pending" aria-hidden="true">
        <span className="auth-chip auth-chip-loading" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-chip-slot" data-auth-state="guest">
        <Link href="/sign-in" className="auth-chip auth-chip-signin" prefetch={false}>
          <span className="auth-chip-mark" aria-hidden>
            <KeyholeIcon />
          </span>
          <span className="auth-chip-text">Влез</span>
          <ArrowRight className="auth-chip-arrow" aria-hidden strokeWidth={2.2} />
        </Link>
      </div>
    );
  }

  const displayName = session.user.name ?? "Играч";
  const avatarId = avatarIdForUser(session.user.id, session.user.avatarId);

  async function confirmLogout() {
    setSigningOut(true);
    const { authClient } = await import("@/lib/auth-client");
    await authClient.signOut();
    window.dispatchEvent(new Event("auth-session-change"));
    setConfirmSignOut(false);
    setSigningOut(false);
    router.push("/");
  }

  function closeSignOut() {
    if (signingOut) {
      return;
    }
    setConfirmSignOut(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="auth-chip-slot" data-auth-state="authenticated">
      <div className="auth-chip auth-chip-avatar" ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          className="auth-chip-trigger"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`Меню на ${displayName}`}
        >
          <span className="auth-chip-photo" aria-hidden>
            <ProfilePortrait avatarId={avatarId} decorative />
          </span>
          <span className="auth-chip-name">{displayName}</span>
          <ChevronDown className="auth-chip-chevron" aria-hidden strokeWidth={2.2} />
        </button>

        {open ? (
          <nav className="nav-dropdown nav-dropdown-user" aria-label="Профил">
            <Link href="/account" prefetch={false} onClick={() => setOpen(false)} className="nav-dropdown-item">
              <User className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
              <span>Моето досие</span>
            </Link>
            <Link href="/history" prefetch={false} onClick={() => setOpen(false)} className="nav-dropdown-item">
              <History className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
              <span>История</span>
            </Link>
            <Link href="/achievements" prefetch={false} onClick={() => setOpen(false)} className="nav-dropdown-item">
              <Trophy className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
              <span>Легенди</span>
            </Link>
            <div className="nav-dropdown-divider" role="separator" />
            <button
              type="button"
              className="nav-dropdown-item nav-dropdown-item-danger"
              onClick={() => {
                setOpen(false);
                setConfirmSignOut(true);
              }}
            >
              <LogOut className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
              <span>Изход</span>
            </button>
          </nav>
        ) : null}

        {confirmSignOut ? (
          <SignOutConfirmDialog
            userName={displayName}
            pending={signingOut}
            onCancel={closeSignOut}
            onConfirm={confirmLogout}
          />
        ) : null}
      </div>
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onCancel();
        }
      }}
      title="Излизаш ли от масата?"
      description={`Здрасти, ${userName}. Сесията ще се затвори и ще се върнеш на началната страница.`}
      footer={
        <>
          <button type="button" className="signout-modal-cancel" onClick={onCancel} disabled={pending}>
            Отказ
          </button>
          <button type="button" className="signout-modal-confirm" onClick={onConfirm} disabled={pending}>
            {pending ? "Излизане..." : "Излизам"}
          </button>
        </>
      }
    >
      <div className="signout-modal-head">
        <button type="button" className="signout-modal-close" onClick={onCancel} aria-label="Затвори" disabled={pending}>
          <X aria-hidden strokeWidth={2} />
        </button>
        <span className="signout-modal-icon" aria-hidden>
          <LogOut strokeWidth={1.8} />
        </span>
      </div>
    </Dialog>
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
