"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown, History, LogIn, LogOut, Trophy, User } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { safeLocalStorage } from "@/lib/safe-storage";
import { leaveAuthenticatedDocument, LOGOUT_REVISION_KEY } from "@/lib/auth-session-document";
import { useAuthSession, type AuthSessionView } from "@/lib/use-auth-session";

const AuthPortrait = dynamic(() => import("./AuthPortrait"), { ssr: false });

const SignOutConfirmDialog = dynamic(() => import("./SignOutConfirmDialog"), {
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
  const { data: session, isPending } = useAuthSession(initialSession);
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Undefined is a guest document; null is an authenticated one without storage.
  const logoutRevision = useRef<string | null | undefined>(undefined);
  const isDrawer = variant === "drawer";

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setOpen(false);
    onNavigate?.();
  }

  useEffect(() => {
    if (session?.user.id && logoutRevision.current === undefined) {
      const revision = safeLocalStorage.getItem(LOGOUT_REVISION_KEY) ?? "0";
      logoutRevision.current = safeLocalStorage.setItem(LOGOUT_REVISION_KEY, revision) ? revision : null;
    }

    function revalidateRestoredDocument(event: PageTransitionEvent) {
      if (!event.persisted || logoutRevision.current === undefined) return;
      const revision = safeLocalStorage.getItem(LOGOUT_REVISION_KEY);
      if (revision !== null && revision === logoutRevision.current) return;
      // A later logout can leave older native BFCache documents behind. Guest and
      // unchanged-session restores stay intact, including when navigating offline.
      leaveAuthenticatedDocument();
    }
    window.addEventListener("pageshow", revalidateRestoredDocument);
    return () => window.removeEventListener("pageshow", revalidateRestoredDocument);
  }, [session?.user.id]);

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
    if (pathname === "/sign-in") {
      return (
        <div className="auth-chip-slot" data-auth-state="guest">
          <span className="auth-chip auth-chip-signin" aria-current="page">
            <User className="auth-chip-login-icon" aria-hidden="true" />
            <span className="auth-chip-text">Вход</span>
          </span>
        </div>
      );
    }
    return (
      <div className="auth-chip-slot" data-auth-state="guest">
        <Link href="/sign-in" className="auth-chip auth-chip-signin" prefetch={false} onClick={navigate}>
          <LogIn className="auth-chip-login-icon" aria-hidden="true" />
          <span className="auth-chip-text">Влез</span>
        </Link>
      </div>
    );
  }

  const displayName = session.user.name ?? "Играч";

  async function confirmLogout() {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    setSignOutError("");
    let endSession: () => void;
    try {
      const [{ authClient }, { endAuthSession }] = await Promise.all([
        import("@/lib/auth-client"),
        import("@/lib/auth-session-end"),
      ]);
      endSession = endAuthSession;
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
    setConfirmSignOut(false);
    onNavigate?.();
    endSession();
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
              <AuthPortrait userId={session.user.id} avatarId={session.user.avatarId} />
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
              <AuthPortrait userId={session.user.id} avatarId={session.user.avatarId} />
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
