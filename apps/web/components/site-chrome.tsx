"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AuthChip } from "@/components/site-chrome/AuthChip";
import { getSoundEnabled, playCue, setSoundEnabled } from "@/lib/sound";
import { safeLocalStorage } from "@/lib/safe-storage";
import type { AuthSessionView } from "@/lib/use-auth-session";
import "@/components/site-chrome/SiteChrome.module.css";

type ThemePreference = "light" | "dark";
type ChromeFamily = "werewolves" | "mafia";

const THEME_STORAGE_KEY = "werewolf-theme";
const LAST_FAMILY_STORAGE_KEY = "last-family";
const THEME_OPTIONS: ThemePreference[] = ["light", "dark"];

const MobileDrawer = dynamic(() => import("@/components/site-chrome/MobileDrawer").then((mod) => mod.MobileDrawer), {
  loading: () => null,
  ssr: false,
});

const NavDropdown = dynamic(() => import("@/components/site-chrome/NavDropdown").then((mod) => mod.NavDropdown), {
  loading: () => null,
  ssr: false,
});

export default function SiteChrome({ initialSession }: { initialSession?: AuthSessionView | null }) {
  const [pathname, setPathname] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("dark");
  const [family, setFamily] = useState<ChromeFamily | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  const routeFamily = pathname ? familyFromPath(pathname) : undefined;
  const activeFamily = routeFamily ?? family;
  const playHref = activeFamily === "mafia"
    ? "/mafia/create"
    : activeFamily === "werewolves"
      ? "/werewolf/create"
      : "/create";

  useEffect(() => {
    setMounted(true);
    setSoundEnabledState(getSoundEnabled());
    const savedTheme = readThemePreference();
    const savedFamily = readFamilyPreference();
    setThemePreference(savedTheme);
    setFamily(savedFamily);
    applyThemePreference(savedTheme);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setDrawerOpen(false);
    if (!pathname) {
      return;
    }
    const nextFamily = familyFromPath(pathname);
    if (!nextFamily) {
      return;
    }
    setFamily(nextFamily);
    safeLocalStorage.setItem(LAST_FAMILY_STORAGE_KEY, nextFamily);
  }, [pathname]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (dropdownRef.current?.contains(event.target as Node)) {
        return;
      }
      setDropdownOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  function openDrawer() {
    setDrawerOpen(true);
  }

  function toggleSound() {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    setSoundEnabledState(nextEnabled);
    if (nextEnabled) {
      playCue("phase-change");
    }
  }

  function cycleThemePreference() {
    const currentIndex = THEME_OPTIONS.indexOf(themePreference);
    const nextPreference = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length] ?? "dark";
    safeLocalStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setThemePreference(nextPreference);
    if ("startViewTransition" in document) {
      document.startViewTransition(() => applyThemePreference(nextPreference));
      return;
    }
    applyThemePreference(nextPreference);
  }

  return (
    <header className="site-chrome" data-version="v2" data-family={activeFamily ?? undefined}>
      <Suspense fallback={null}>
        <RoutePathnameSync onPathnameChange={setPathname} />
      </Suspense>
      <button ref={drawerTriggerRef} className="site-mobile-menu" type="button" aria-label="Отвори менюто" onClick={openDrawer}>
        <Menu className="site-icon" aria-hidden strokeWidth={1.9} />
      </button>

      <BrandMark compact={false} />

      <PrimaryBand
        pathname={pathname ?? ""}
        playHref={playHref}
        dropdownOpen={dropdownOpen}
        dropdownRef={dropdownRef}
        onToggleDropdown={() => setDropdownOpen((open) => !open)}
      />

      <UtilityCluster
        soundEnabled={soundEnabled}
        themePreference={themePreference}
        {...(initialSession === undefined ? {} : { initialSession })}
        onToggleSound={toggleSound}
        onCycleTheme={cycleThemePreference}
      />

      <Link className="site-play-cta site-play-cta-mobile" href={playHref} prefetch={false}>
        <Play className="site-icon" aria-hidden strokeWidth={1.9} />
        <span>Играй</span>
      </Link>

      {mounted ? (
        <MobileDrawer
          open={drawerOpen}
          pathname={pathname ?? ""}
          soundEnabled={soundEnabled}
          themePreference={themePreference}
          {...(initialSession === undefined ? {} : { initialSession })}
          playHref={playHref}
          triggerRef={drawerTriggerRef}
          onOpenChange={setDrawerOpen}
          onToggleSound={toggleSound}
          onCycleTheme={cycleThemePreference}
        />
      ) : null}
    </header>
  );
}

function RoutePathnameSync({
  onPathnameChange,
}: {
  onPathnameChange: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    onPathnameChange(pathname);
  }, [onPathnameChange, pathname]);

  return null;
}

function BrandMark({ compact }: { compact: boolean }) {
  return (
    <Link className="site-brand" href="/" prefetch={false}>
      <span className="site-brand-mark" aria-hidden="true" />
      <span className="site-brand-text">
        <span className={compact ? "site-brand-wordmark is-compact" : "site-brand-wordmark"}>
          <span>Върколак</span>
          <span className="site-brand-dot" aria-hidden="true">
            ·
          </span>
          <span>Мафия</span>
        </span>
        {process.env.NEXT_PUBLIC_SHOW_BETA_BADGE !== "false" ? (
          <span className="site-beta-badge">
            БЕТА
          </span>
        ) : null}
        <span className="site-brand-subtitle">Социална игра на сенки</span>
      </span>
    </Link>
  );
}

function PrimaryBand({
  pathname,
  playHref,
  dropdownOpen,
  dropdownRef,
  onToggleDropdown,
}: {
  pathname: string;
  playHref: string;
  dropdownOpen: boolean;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onToggleDropdown: () => void;
}) {
  return (
    <nav className="site-primary-band" aria-label="Основна навигация">
      <Link className="site-play-cta" href={playHref} prefetch={false}>
        <Play className="site-icon" aria-hidden strokeWidth={1.9} />
        <span>Играй</span>
      </Link>
      <div className="site-family-switcher" aria-label="Семейство игри">
        <FamilyLink href="/werewolf" label="Върколак" active={pathname.startsWith("/werewolf")} family="werewolves" />
        <span className="site-family-divider" aria-hidden="true" />
        <FamilyLink href="/mafia" label="Мафия" active={pathname.startsWith("/mafia")} family="mafia" />
      </div>
      <div className="site-more-menu" ref={dropdownRef}>
        <button className="site-icon-button" type="button" aria-label="Още страници" aria-expanded={dropdownOpen} onClick={onToggleDropdown}>
          <MoreHorizontal className="site-icon" aria-hidden strokeWidth={1.9} />
        </button>
        {dropdownOpen ? <NavDropdown onNavigate={onToggleDropdown} /> : null}
      </div>
    </nav>
  );
}

function FamilyLink({ href, label, active, family }: { href: string; label: string; active: boolean; family: ChromeFamily }) {
  return (
    <Link className={active ? "site-family-link is-active" : "site-family-link"} data-family={family} href={href} prefetch={false}>
      <span>{label}</span>
    </Link>
  );
}

function UtilityCluster({
  soundEnabled,
  themePreference,
  initialSession,
  onToggleSound,
  onCycleTheme,
  showAuth = true,
}: {
  soundEnabled: boolean;
  themePreference: ThemePreference;
  initialSession?: AuthSessionView | null;
  onToggleSound: () => void;
  onCycleTheme: () => void;
  showAuth?: boolean;
}) {
  return (
    <div className="site-utility-cluster" aria-label="Настройки">
      <button className="site-icon-button" type="button" aria-label={soundEnabled ? "Звук включен" : "Звук изключен"} onClick={onToggleSound}>
        {soundEnabled ? (
          <Volume2 className="site-icon" aria-hidden strokeWidth={1.9} />
        ) : (
          <VolumeX className="site-icon" aria-hidden strokeWidth={1.9} />
        )}
      </button>
      <button className="site-icon-button" type="button" aria-label={themeLabel(themePreference)} onClick={onCycleTheme}>
        {themePreference === "dark" ? (
          <Moon className="site-icon" aria-hidden strokeWidth={1.9} />
        ) : (
          <Sun className="site-icon" aria-hidden strokeWidth={1.9} />
        )}
      </button>
      {showAuth ? (
        <>
          <span className="site-utility-separator" aria-hidden />
          <AuthChip {...(initialSession === undefined ? {} : { initialSession })} />
        </>
      ) : null}
    </div>
  );
}

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = safeLocalStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    return saved;
  }

  const resolvedTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  safeLocalStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  return resolvedTheme;
}

function readFamilyPreference(): ChromeFamily {
  if (typeof window === "undefined") {
    return "werewolves";
  }

  const saved = safeLocalStorage.getItem(LAST_FAMILY_STORAGE_KEY);
  return saved === "mafia" ? "mafia" : "werewolves";
}

function familyFromPath(pathname: string): ChromeFamily | undefined {
  if (pathname.startsWith("/mafia")) {
    return "mafia";
  }
  if (pathname.startsWith("/werewolf")) {
    return "werewolves";
  }
  return undefined;
}

function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  if (document.documentElement.dataset.theme === preference) {
    return;
  }

  document.documentElement.dataset.vt = "theme";
  document.documentElement.dataset.theme = preference;
  window.setTimeout(() => {
    delete document.documentElement.dataset.vt;
  }, 320);
}

function themeLabel(preference: ThemePreference) {
  return preference === "dark" ? "Тъмна тема" : "Светла тема";
}
