"use client";

import { useRef, type RefObject } from "react";
import Link from "next/link";
import { Moon, Sun, Volume2, VolumeX, KeyRound } from "lucide-react";
import { Sheet } from "@werewolf/ui";
import { AuthChip } from "@/components/site-chrome/AuthChip";
import { DRAWER_LINKS } from "@/components/site-chrome/nav-links";
import { PlayChoices } from "@/components/site-chrome/PlayChoices";
import type { AuthSessionView } from "@/lib/use-auth-session";

type ThemePreference = "light" | "dark";

export function MobileDrawer({
  open,
  pathname,
  soundEnabled,
  themePreference,
  mode = "navigation",
  isRoom = false,
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
  mode?: "navigation" | "play";
  isRoom?: boolean;
  initialSession?: AuthSessionView | null;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  onToggleSound: () => void;
  onCycleTheme: () => void;
}) {
  const navigating = useRef(false);
  function navigate() {
    navigating.current = true;
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open} onOpenChange={onOpenChange}
      title={mode === "play" ? "Какво ще играем?" : "Навигация"}
      description={mode === "play" ? "Избор на игра или присъединяване с код." : "Навигация и настройки за играта."}
      closeLabel={mode === "play" ? "Затвори избора" : "Затвори менюто"}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!navigating.current) triggerRef?.current?.focus();
        navigating.current = false;
      }}
    >
      {mode === "play" ? <PlayChoices onNavigate={navigate} includeJoin /> : (
      <div className="site-drawer">
        <div className="site-drawer-content">
          <div className="site-drawer-auth">
            <AuthChip
              {...(initialSession === undefined ? {} : { initialSession })}
              variant="drawer"
              pathname={pathname}
              onNavigate={navigate}
            />
          </div>
          <nav className="site-drawer-nav" aria-label="Мобилна навигация">
            {!isRoom ? <Link href="/join" prefetch={false} onNavigate={navigate}><KeyRound className="site-drawer-icon" aria-hidden /><span>Имам код</span></Link> : null}
            {DRAWER_LINKS.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={`${item.href}:${item.label}`} className={active ? "is-active" : ""} href={item.href} prefetch={false} aria-current={pathname === item.href ? "page" : active ? "location" : undefined} onNavigate={navigate}>
                  {Icon ? <Icon aria-hidden strokeWidth={1.8} className="site-drawer-icon" /> : null}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="site-drawer-footer">
          <DrawerUtilityCluster
            soundEnabled={soundEnabled}
            themePreference={themePreference}
            onToggleSound={onToggleSound}
            onCycleTheme={onCycleTheme}
          />
        </div>
      </div>)}
    </Sheet>
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
      <button className="site-icon-button" type="button" aria-label={soundEnabled ? "Изключи звука" : "Включи звука"} onClick={onToggleSound}>
        {soundEnabled ? (
          <Volume2 className="site-icon" aria-hidden strokeWidth={1.9} />
        ) : (
          <VolumeX className="site-icon" aria-hidden strokeWidth={1.9} />
        )}
      </button>
      <button className="site-icon-button" type="button" aria-label={themePreference === "dark" ? "Смени на светла тема" : "Смени на тъмна тема"} onClick={onCycleTheme}>
        {themePreference === "dark" ? (
          <Moon className="site-icon" aria-hidden strokeWidth={1.9} />
        ) : (
          <Sun className="site-icon" aria-hidden strokeWidth={1.9} />
        )}
      </button>
    </div>
  );
}
