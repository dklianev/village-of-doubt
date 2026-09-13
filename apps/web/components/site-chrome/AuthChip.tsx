"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, ChevronDown, History, LogOut, Trophy, User } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import { useAuthSession, type AuthSessionView } from "@/lib/use-auth-session";

const SignOutConfirmDialog = dynamic(() => import("./SignOutConfirmDialog").then((module) => module.SignOutConfirmDialog), {
  loading: () => null,
  ssr: false,
});

export function AuthChip({
  initialSession,
  variant = "dropdown",
  pathname,
  onNavigate,
}: {
  initialSession?: AuthSessionView | null;
  variant?: "dropdown" | "drawer";
  pathname?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const sessionQuery = useAuthSession(initialSession);
  const session = sessionQuery.data;
  const isPending = sessionQuery.isPending;
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isDrawer = variant === "drawer";

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setOpen(false);
    onNavigate?.();
  }

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
        <Link href="/sign-in" className="auth-chip auth-chip-signin" prefetch={false} onClick={navigate}>
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
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    setSignOutError("");
    try {
      const { authClient } = await import("@/lib/auth-client");
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError("Излизането не успя. Опитай отново.");
        return;
      }
    } catch {
      setSignOutError("Излизането не успя. Опитай отново.");
      return;
    } finally {
      setSigningOut(false);
    }
    window.dispatchEvent(new Event("auth-session-change"));
    setConfirmSignOut(false);
    onNavigate?.();
    router.push("/");
  }

  function closeSignOut() {
    if (signingOut) {
      return;
    }
    setConfirmSignOut(false);
    setSignOutError("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="auth-chip-slot" data-auth-state="authenticated">
      <div className={isDrawer ? "site-drawer-profile" : "auth-chip auth-chip-avatar"} ref={menuRef}>
        {isDrawer ? (
          <div className="site-drawer-profile-identity">
            <span className="auth-chip-photo" aria-hidden>
              <ProfilePortrait avatarId={avatarId} decorative />
            </span>
            <span>{displayName}</span>
          </div>
        ) : (
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
        )}

        {open || isDrawer ? (
          <nav className={isDrawer ? "site-drawer-profile-actions" : "nav-dropdown nav-dropdown-user"} aria-label="Профил">
            <Link href="/account" prefetch={false} onClick={navigate} className="nav-dropdown-item" aria-current={pathname === "/account" ? "page" : undefined}>
              <User className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
              <span>Моето досие</span>
            </Link>
            {!isDrawer ? (
              <>
                <Link href="/history" prefetch={false} onClick={navigate} className="nav-dropdown-item">
                  <History className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
                  <span>История</span>
                </Link>
                <Link href="/achievements" prefetch={false} onClick={navigate} className="nav-dropdown-item">
                  <Trophy className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
                  <span>Постижения</span>
                </Link>
                <div className="nav-dropdown-divider" role="separator" />
              </>
            ) : null}
            <button
              ref={isDrawer ? triggerRef : undefined}
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
            error={signOutError}
            onCancel={closeSignOut}
            onConfirm={confirmLogout}
          />
        ) : null}
      </div>
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
