"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Начало" },
  { href: "/werewolf", label: "Върколак" },
  { href: "/mafia", label: "Мафия" },
  { href: "/history", label: "История" },
];

export function SiteChrome() {
  const pathname = usePathname();

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
      </nav>
    </header>
  );
}
