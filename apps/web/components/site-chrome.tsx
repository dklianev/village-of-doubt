"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSoundEnabled, playCue, setSoundEnabled } from "@/lib/sound";

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

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
  }, []);

  function toggleSound() {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    setSoundEnabledState(nextEnabled);
    if (nextEnabled) {
      playCue("phase-change");
    }
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
      </nav>
    </header>
  );
}
