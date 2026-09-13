"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Moon, Play, Sun, Volume2, VolumeX } from "lucide-react";
import { AuthChip } from "@/components/site-chrome/AuthChip";
import { BrandLogo } from "@/components/site-chrome/BrandLogo";
import { NavigationFallback } from "@/components/site-chrome/NavigationFallback";
import { useNavigationPanels } from "@/components/site-chrome/use-navigation-panels";
import { getSoundEnabled, playCue, setSoundEnabled } from "@/lib/sound";
import { safeLocalStorage } from "@/lib/safe-storage";
import type { AuthSessionView } from "@/lib/use-auth-session";
import "@/components/site-chrome/SiteChrome.module.css";

type ThemePreference = "light" | "dark";
type Disclosure = "play" | "more";
const THEME_STORAGE_KEY = "werewolf-theme";
const transientButtonAttributes = { autoComplete: "off" } as const;

export default function SiteChrome({ initialSession }: { initialSession?: AuthSessionView | null }) {
  const pathname = usePathname();
  const isRoom = pathname.startsWith("/play/");
  const [interactive, setInteractive] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("dark");
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);
  const [drawer, setDrawer] = useState<"navigation" | "play" | null>(null);
  const [drawerMode, setDrawerMode] = useState<"navigation" | "play">("navigation");
  const [drawerMounted, setDrawerMounted] = useState(false);
  const { panels, status: navigationStatus, preload, retry } = useNavigationPanels();
  const mobileFallbackRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const playTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const ids = useId();

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
    const saved = safeLocalStorage.getItem(THEME_STORAGE_KEY);
    const theme = saved === "light" || saved === "dark"
      ? saved
      : document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setThemePreference(theme);
    applyThemePreference(theme);
    setInteractive(true);
  }, []);

  useEffect(() => {
    setDisclosure(null);
    setDrawer(null);
    if (pathname === "/mafia" || pathname.startsWith("/mafia/")) {
      safeLocalStorage.setItem("last-family", "mafia");
    } else if (pathname === "/werewolf" || pathname.startsWith("/werewolf/")) {
      safeLocalStorage.setItem("last-family", "werewolves");
    }
  }, [pathname]);

  useEffect(() => {
    const mobileFallback = drawer !== null && !panels;
    if (!disclosure && !mobileFallback) return;
    const container = mobileFallback ? mobileFallbackRef : disclosure === "play" ? playRef : moreRef;
    const trigger = mobileFallback ? mobileTriggerRef : disclosure === "play" ? playTriggerRef : moreTriggerRef;
    function close() {
      setDisclosure(null);
      setDrawer(null);
    }
    function outside(event: Event) {
      if (event.target instanceof Node && !container.current?.contains(event.target)
        && !trigger.current?.contains(event.target)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        trigger.current?.focus();
      }
    }
    if (mobileFallback) container.current?.querySelector<HTMLElement>("a")?.focus();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [disclosure, drawer, panels]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function closeAtBreakpoint() {
      setDisclosure(null);
      setDrawer(null);
    }
    media.addEventListener("change", closeAtBreakpoint);
    return () => media.removeEventListener("change", closeAtBreakpoint);
  }, []);

  function openDrawer(mode: "navigation" | "play", trigger: HTMLButtonElement) {
    preload();
    mobileTriggerRef.current = trigger;
    setDisclosure(null);
    setDrawerMounted(true);
    setDrawerMode(mode);
    setDrawer(mode);
  }

  function toggleSound() {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    setSoundEnabledState(enabled);
    if (enabled) playCue("phase-change");
  }

  function toggleTheme() {
    const next = themePreference === "dark" ? "light" : "dark";
    safeLocalStorage.setItem(THEME_STORAGE_KEY, next);
    setThemePreference(next);
    if ("startViewTransition" in document) document.startViewTransition(() => applyThemePreference(next));
    else applyThemePreference(next);
  }

  const soundLabel = soundEnabled ? "Изключи звука" : "Включи звука";
  const themeLabel = themePreference === "dark" ? "Смени на светла тема" : "Смени на тъмна тема";
  const authProps = initialSession === undefined ? {} : { initialSession };

  return (
    <header className="site-chrome" data-version="v2" data-room={isRoom ? "true" : undefined}>
      <button
        className="site-mobile-menu" type="button" aria-label="Отвори менюто"
        aria-haspopup={panels ? "dialog" : undefined} aria-expanded={drawer === "navigation"}
        aria-busy={drawer === "navigation" && navigationStatus === "pending"}
        {...transientButtonAttributes} disabled={!interactive}
        onPointerEnter={preload} onFocus={preload}
        onClick={(event) => openDrawer("navigation", event.currentTarget)}
      >
        <Menu className="site-icon" aria-hidden strokeWidth={1.9} />
      </button>

      <Link className="site-brand" href="/" aria-label="Сенките, начало"><BrandLogo /></Link>

      <nav className="site-primary-band" aria-label="Основна навигация">
        {!isRoom ? <>
          <FamilyLink pathname={pathname} href="/werewolf" label="Върколак" />
          <FamilyLink pathname={pathname} href="/mafia" label="Мафия" />
        </> : null}
        <div className="site-more-menu" ref={moreRef}>
          <button
            ref={moreTriggerRef} className="site-more-trigger" type="button" aria-label="Още страници"
            aria-expanded={disclosure === "more"} aria-controls={`${ids}-more`}
            aria-busy={disclosure === "more" && navigationStatus === "pending"}
            onPointerEnter={preload} onFocus={preload}
            {...transientButtonAttributes} disabled={!interactive}
            onClick={() => { preload(); setDisclosure((open) => open === "more" ? null : "more"); }}
          >
            <span>Още</span><ChevronDown className="site-icon" aria-hidden />
          </button>
          {disclosure === "more" ? panels
            ? <panels.NavDropdown id={`${ids}-more`} pathname={pathname} onNavigate={() => setDisclosure(null)} />
            : <NavigationFallback id={`${ids}-more`} mode="more" failed={navigationStatus === "error"}
              onRetry={() => { moreTriggerRef.current?.focus(); retry(); }} onClose={() => setDisclosure(null)} />
            : null}
        </div>
      </nav>

      {!isRoom ? <div className="site-entry-actions">
        <Link className="site-join-link" href="/join" prefetch={false}>Имам код</Link>
        <div className="site-play-menu" ref={playRef}>
          <button
            ref={playTriggerRef} className="site-play-cta" type="button"
            aria-expanded={disclosure === "play"} aria-controls={`${ids}-play`}
            aria-busy={disclosure === "play" && navigationStatus === "pending"}
            onPointerEnter={preload} onFocus={preload}
            {...transientButtonAttributes} disabled={!interactive}
            onClick={() => { preload(); setDisclosure((open) => open === "play" ? null : "play"); }}
          >
            <Play className="site-icon" aria-hidden strokeWidth={1.9} /><span>Играй</span>
          </button>
          {disclosure === "play" ? panels ? <div id={`${ids}-play`} className="nav-dropdown site-play-panel">
            <p className="site-play-panel-title">Какво ще играем?</p>
            <panels.PlayChoices onNavigate={() => setDisclosure(null)} />
          </div> : <NavigationFallback id={`${ids}-play`} mode="play" failed={navigationStatus === "error"}
            onRetry={() => { playTriggerRef.current?.focus(); retry(); }} onClose={() => setDisclosure(null)} /> : null}
        </div>
      </div> : null}

      <div className="site-utility-cluster" aria-label="Настройки">
        {isRoom ? <button className="site-icon-button" type="button" aria-label={soundLabel} data-tooltip={soundLabel} disabled={!interactive} onClick={toggleSound}>
          {soundEnabled ? <Volume2 className="site-icon" aria-hidden /> : <VolumeX className="site-icon" aria-hidden />}
        </button> : null}
        <button className="site-icon-button" type="button" aria-label={themeLabel} data-tooltip={themeLabel} disabled={!interactive} onClick={toggleTheme}>
          {themePreference === "dark" ? <Moon className="site-icon" aria-hidden /> : <Sun className="site-icon" aria-hidden />}
        </button>
        <span className="site-utility-separator" aria-hidden />
        <AuthChip {...authProps} pathname={pathname} />
      </div>

      {!isRoom ? <button
        className="site-play-cta site-play-cta-mobile" type="button" aria-haspopup={panels ? "dialog" : undefined}
        aria-expanded={drawer === "play"} disabled={!interactive}
        aria-busy={drawer === "play" && navigationStatus === "pending"}
        onPointerEnter={preload} onFocus={preload}
        onClick={(event) => openDrawer("play", event.currentTarget)}
      >
        <Play className="site-icon" aria-hidden strokeWidth={1.9} /><span>Играй</span>
      </button> : <button className="site-icon-button site-room-sound" type="button" aria-label={soundLabel} disabled={!interactive} onClick={toggleSound}>
        {soundEnabled ? <Volume2 className="site-icon" aria-hidden /> : <VolumeX className="site-icon" aria-hidden />}
      </button>}

      {drawerMounted && panels ? <panels.MobileDrawer
        open={drawer !== null} mode={drawerMode} isRoom={isRoom} pathname={pathname}
        soundEnabled={soundEnabled} themePreference={themePreference} {...authProps}
        triggerRef={mobileTriggerRef} onOpenChange={(open) => { if (!open) setDrawer(null); }}
        onToggleSound={toggleSound} onCycleTheme={toggleTheme}
      /> : null}
      {drawer && !panels ? <div className="site-navigation-fallback-host" ref={mobileFallbackRef}>
        <NavigationFallback id={`${ids}-mobile`} mode={drawer} mobile isRoom={isRoom}
          failed={navigationStatus === "error"} onRetry={retry}
          onClose={() => { setDrawer(null); mobileTriggerRef.current?.focus(); }} />
      </div> : null}
    </header>
  );
}

function FamilyLink({ pathname, href, label }: { pathname: string; href: string; label: string }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return <Link className={active ? "site-family-link is-active" : "site-family-link"} href={href}
    aria-current={pathname === href ? "page" : active ? "location" : undefined}>{label}</Link>;
}

function applyThemePreference(preference: ThemePreference) {
  if (document.documentElement.dataset.theme === preference) return;
  document.documentElement.dataset.vt = "theme";
  document.documentElement.dataset.theme = preference;
  window.setTimeout(() => { delete document.documentElement.dataset.vt; }, 320);
}
