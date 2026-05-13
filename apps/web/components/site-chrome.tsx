"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSoundEnabled, playCue, setSoundEnabled } from "@/lib/sound";

type ThemePreference = "system" | "light" | "dark";
type ChromeFamily = "werewolves" | "mafia";

const THEME_STORAGE_KEY = "werewolf-theme";
const LAST_FAMILY_STORAGE_KEY = "last-family";
const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

const SECONDARY_LINKS = [
  { href: "/history", label: "История" },
  { href: "/achievements", label: "Постижения" },
  { href: "/leaderboard", label: "Класация" },
  { href: "/friends", label: "Приятели" },
  { href: "/tutorial", label: "Първа игра" },
  { href: "/sign-in", label: "Вход" },
];

const DRAWER_LINKS = [
  { href: "/", label: "Начало" },
  { href: "/werewolf", label: "Върколак" },
  { href: "/mafia", label: "Мафия" },
  ...SECONDARY_LINKS,
];

export default function SiteChrome() {
  const pathname = usePathname();
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [family, setFamily] = useState<ChromeFamily>("werewolves");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const drawerCloseTimer = useRef<number | undefined>(undefined);

  const routeFamily = familyFromPath(pathname);
  const activeFamily = routeFamily ?? family;
  const playHref = activeFamily === "mafia" ? "/mafia/create" : "/werewolf/create";

  useEffect(() => {
    setMounted(true);
    setSoundEnabledState(getSoundEnabled());
    const savedTheme = readThemePreference();
    const savedFamily = readFamilyPreference();
    setThemePreference(savedTheme);
    setFamily(routeFamily ?? savedFamily);
    applyThemePreference(savedTheme);
  }, [routeFamily]);

  useEffect(() => {
    setDropdownOpen(false);
    setDrawerOpen(false);
    setDrawerClosing(false);
    const nextFamily = familyFromPath(pathname);
    if (!nextFamily) {
      return;
    }
    setFamily(nextFamily);
    window.localStorage.setItem(LAST_FAMILY_STORAGE_KEY, nextFamily);
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

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimer.current) {
        window.clearTimeout(drawerCloseTimer.current);
      }
    };
  }, []);

  function openDrawer() {
    if (drawerCloseTimer.current) {
      window.clearTimeout(drawerCloseTimer.current);
    }
    setDrawerClosing(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (!drawerOpen) {
      return;
    }
    setDrawerClosing(true);
    if (drawerCloseTimer.current) {
      window.clearTimeout(drawerCloseTimer.current);
    }
    drawerCloseTimer.current = window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
    }, 180);
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
    const nextPreference = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length] ?? "system";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setThemePreference(nextPreference);
    applyThemePreference(nextPreference);
  }

  return (
    <header className="site-chrome" data-version="v2" data-family={activeFamily}>
      <button className="site-mobile-menu" type="button" aria-label="Отвори менюто" onClick={openDrawer}>
        <MenuIcon />
      </button>

      <BrandMark compact={false} />

      <PrimaryBand
        pathname={pathname}
        playHref={playHref}
        dropdownOpen={dropdownOpen}
        dropdownRef={dropdownRef}
        onToggleDropdown={() => setDropdownOpen((open) => !open)}
      />

      <UtilityCluster
        soundEnabled={soundEnabled}
        themePreference={themePreference}
        onToggleSound={toggleSound}
        onCycleTheme={cycleThemePreference}
      />

      <Link className="site-play-cta site-play-cta-mobile" href={playHref} prefetch={false}>
        <PlayIcon />
        <span>Играй</span>
      </Link>

      {mounted && drawerOpen
        ? createPortal(
            <MobileDrawer
              pathname={pathname}
              soundEnabled={soundEnabled}
              themePreference={themePreference}
              playHref={playHref}
              closing={drawerClosing}
              onClose={closeDrawer}
              onToggleSound={toggleSound}
              onCycleTheme={cycleThemePreference}
            />,
            document.body,
          )
        : null}
    </header>
  );
}

function BrandMark({ compact }: { compact: boolean }) {
  return (
    <Link className="site-brand" href="/" aria-label="Към началото" prefetch={false}>
      <span className="site-brand-mark" aria-hidden="true" />
      <span className={compact ? "site-brand-wordmark is-compact" : "site-brand-wordmark"}>
        <span>Върколак</span>
        <span className="site-brand-dot" aria-hidden="true">
          ·
        </span>
        <span>Мафия</span>
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
        <PlayIcon />
        <span>Играй</span>
      </Link>
      <div className="site-family-switcher" aria-label="Семейство игри">
        <FamilyLink href="/werewolf" label="Върколак" active={pathname.startsWith("/werewolf")} family="werewolves" />
        <span className="site-family-divider" aria-hidden="true" />
        <FamilyLink href="/mafia" label="Мафия" active={pathname.startsWith("/mafia")} family="mafia" />
      </div>
      <div className="site-more-menu" ref={dropdownRef}>
        <button className="site-icon-button" type="button" aria-label="Още страници" aria-expanded={dropdownOpen} onClick={onToggleDropdown}>
          <DotsIcon />
        </button>
        {dropdownOpen ? (
          <div className="site-dropdown paper-card" role="menu">
            {SECONDARY_LINKS.map((item) => (
              <Link key={item.href} href={item.href} role="menuitem" prefetch={false}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
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
  onToggleSound,
  onCycleTheme,
}: {
  soundEnabled: boolean;
  themePreference: ThemePreference;
  onToggleSound: () => void;
  onCycleTheme: () => void;
}) {
  return (
    <div className="site-utility-cluster" aria-label="Настройки">
      <button className="site-icon-button" type="button" aria-label={soundEnabled ? "Звук включен" : "Звук изключен"} onClick={onToggleSound}>
        {soundEnabled ? <SpeakerWaveIcon /> : <SpeakerXIcon />}
      </button>
      <button className="site-icon-button" type="button" aria-label={themeLabel(themePreference)} onClick={onCycleTheme}>
        <ThemeIcon preference={themePreference} />
      </button>
    </div>
  );
}

function MobileDrawer({
  pathname,
  soundEnabled,
  themePreference,
  playHref,
  closing,
  onClose,
  onToggleSound,
  onCycleTheme,
}: {
  pathname: string;
  soundEnabled: boolean;
  themePreference: ThemePreference;
  playHref: string;
  closing: boolean;
  onClose: () => void;
  onToggleSound: () => void;
  onCycleTheme: () => void;
}) {
  const drawerLinks = useMemo(() => [{ href: playHref, label: "Играй" }, ...DRAWER_LINKS], [playHref]);

  return (
    <div className={closing ? "site-drawer-layer is-closing" : "site-drawer-layer"}>
      <button className="site-drawer-backdrop" type="button" aria-label="Затвори менюто" onClick={onClose} />
      <aside className="site-drawer" aria-label="Навигация">
        <div className="site-drawer-header">
          <BrandMark compact />
          <button className="site-icon-button" type="button" aria-label="Затвори менюто" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <nav className="site-drawer-nav" aria-label="Мобилна навигация">
          {drawerLinks.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={`${item.href}:${item.label}`} className={active ? "is-active" : ""} href={item.href} prefetch={false} onClick={onClose}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="site-drawer-footer">
          <UtilityCluster soundEnabled={soundEnabled} themePreference={themePreference} onToggleSound={onToggleSound} onCycleTheme={onCycleTheme} />
        </div>
      </aside>
    </div>
  );
}

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
}

function readFamilyPreference(): ChromeFamily {
  if (typeof window === "undefined") {
    return "werewolves";
  }

  const saved = window.localStorage.getItem(LAST_FAMILY_STORAGE_KEY);
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

  const resolvedTheme =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : preference;
  document.documentElement.dataset.theme = resolvedTheme;
}

function themeLabel(preference: ThemePreference) {
  if (preference === "light") {
    return "Светла тема";
  }
  if (preference === "dark") {
    return "Тъмна тема";
  }
  return "Системна тема";
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function MenuIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

function DotsIcon() {
  return (
    <Icon>
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
    </Icon>
  );
}

function PlayIcon() {
  return (
    <Icon>
      <path d="M9 6.8v10.4L17.2 12 9 6.8z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

function SpeakerWaveIcon() {
  return (
    <Icon>
      <path d="M4 14.5h3.3L12 18V6L7.3 9.5H4v5z" />
      <path d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.7a8 8 0 0 1 0 10.6" />
    </Icon>
  );
}

function SpeakerXIcon() {
  return (
    <Icon>
      <path d="M4 14.5h3.3L12 18V6L7.3 9.5H4v5z" />
      <path d="M16 9l5 5M21 9l-5 5" />
    </Icon>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.8v2M12 19.2v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.8 12h2M19.2 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </Icon>
    );
  }
  if (preference === "dark") {
    return (
      <Icon>
        <path d="M19.2 14.8A7.2 7.2 0 0 1 9.2 4.8 8 8 0 1 0 19.2 14.8z" />
      </Icon>
    );
  }
  return (
    <Icon>
      <path d="M12 3a9 9 0 1 0 0 18V3z" />
      <path d="M12 3a9 9 0 0 1 0 18" />
    </Icon>
  );
}
