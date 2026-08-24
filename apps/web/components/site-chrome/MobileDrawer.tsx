"use client";

import { useMemo, type RefObject } from "react";
import Link from "next/link";
import { Moon, Sun, Volume2, VolumeX, X } from "lucide-react";
import { Sheet } from "@werewolf/ui";
import { AuthChip } from "@/components/site-chrome/AuthChip";
import { DRAWER_LINKS, type DrawerLink } from "@/components/site-chrome/nav-links";
import type { AuthSessionView } from "@/lib/use-auth-session";

type ThemePreference = "light" | "dark";

export function MobileDrawer({
  open,
  pathname,
  soundEnabled,
  themePreference,
  playHref,
  initialSession,
  triggerRef,
  onOpenChange,
  onToggleSound,
  onCycleTheme,
}: {
  open: boolean;
  pathname: string;
  soundEnabled: boolean;
  themePreference: ThemePreference;
  playHref: string;
  initialSession?: AuthSessionView | null;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  onToggleSound: () => void;
  onCycleTheme: () => void;
}) {
  const drawerLinks = useMemo<ReadonlyArray<DrawerLink>>(() => [{ href: playHref, label: "Играй" }, ...DRAWER_LINKS], [playHref]);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.requestAnimationFrame(() => triggerRef?.current?.focus());
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title="Навигация" description="Навигация и настройки за играта.">
      <div className="site-drawer">
        <div className="site-drawer-header">
          <DrawerBrandMark />
          <button className="site-icon-button" type="button" aria-label="Затвори менюто" onClick={() => handleOpenChange(false)}>
            <X className="site-icon" aria-hidden strokeWidth={1.9} />
          </button>
        </div>
        <nav className="site-drawer-nav" aria-label="Мобилна навигация">
          {drawerLinks.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={`${item.href}:${item.label}`} className={active ? "is-active" : ""} href={item.href} prefetch={false} onClick={() => handleOpenChange(false)}>
                {Icon ? <Icon aria-hidden strokeWidth={1.8} className="site-drawer-icon" /> : null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="site-drawer-footer">
          <DrawerUtilityCluster
            soundEnabled={soundEnabled}
            themePreference={themePreference}
            onToggleSound={onToggleSound}
            onCycleTheme={onCycleTheme}
          />
          <div className="site-drawer-auth">
            <AuthChip {...(initialSession === undefined ? {} : { initialSession })} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function DrawerBrandMark() {
  return (
    <Link className="site-brand" href="/" prefetch={false}>
      <span className="site-brand-mark" aria-hidden="true" />
      <span className="site-brand-text">
        <span className="site-brand-wordmark is-compact">
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

function DrawerUtilityCluster({
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
        {soundEnabled ? (
          <Volume2 className="site-icon" aria-hidden strokeWidth={1.9} />
        ) : (
          <VolumeX className="site-icon" aria-hidden strokeWidth={1.9} />
        )}
      </button>
      <button className="site-icon-button" type="button" aria-label={themePreference === "dark" ? "Тъмна тема" : "Светла тема"} onClick={onCycleTheme}>
        {themePreference === "dark" ? (
          <Moon className="site-icon" aria-hidden strokeWidth={1.9} />
        ) : (
          <Sun className="site-icon" aria-hidden strokeWidth={1.9} />
        )}
      </button>
    </div>
  );
}
