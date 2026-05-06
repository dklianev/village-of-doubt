"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSoundEnabled, playCue, setSoundEnabled } from "@/lib/sound";

type ThemePreference = "system" | "dark" | "light";

const THEME_STORAGE_KEY = "werewolf-theme";
const THEME_OPTIONS: ThemePreference[] = ["system", "dark", "light"];
const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Системна",
  dark: "Тъмна",
  light: "Светла",
};

const NAV_ITEMS = [
  { href: "/", label: "Начало" },
  { href: "/werewolf", label: "Върколак" },
  { href: "/mafia", label: "Мафия" },
  { href: "/tutorial", label: "Първа игра" },
  { href: "/history", label: "История" },
  { href: "/achievements", label: "Постижения" },
  { href: "/leaderboard", label: "Класация" },
  { href: "/friends", label: "Приятели" },
];

export function SiteChrome() {
  const pathname = usePathname();
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
    const savedTheme = readThemePreference();
    setThemePreference(savedTheme);
    applyThemePreference(savedTheme);
  }, []);

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
    <header className={`site-chrome ${pathname.startsWith("/play") ? "is-game" : ""}`}>
      <Link className="site-brand" href="/" aria-label="Към началото">
        <span className="site-brand-mark" aria-hidden="true" />
        <span>
          <strong>Върколак</strong>
          <small>Върколак · Мафия</small>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Основна навигация">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} className={active ? "is-active" : ""} href={item.href}>
              {item.label}
            </Link>
          );
        })}
        <button className="site-sound-toggle" type="button" onClick={toggleSound}>
          Звук: {soundEnabled ? "Вкл" : "Изкл"}
        </button>
        <button className="site-theme-toggle" type="button" onClick={cycleThemePreference}>
          Тема: {THEME_LABELS[themePreference]}
        </button>
      </nav>
    </header>
  );
}

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
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
