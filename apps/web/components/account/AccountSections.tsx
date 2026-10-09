"use client";

import { Activity, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Fingerprint, ShieldCheck } from "lucide-react";
import styles from "./Account.module.css";

const SECTIONS = [
  { id: "chronicle", title: "Хроника", icon: BookOpen },
  { id: "identity", title: "Образ и достъп", icon: Fingerprint },
  { id: "security", title: "Данни и сигурност", icon: ShieldCheck },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function AccountSections(props: Record<SectionId, ReactNode>) {
  const [selected, setSelected] = useState<SectionId>("chronicle");
  const [anchor, setAnchor] = useState("");
  const lastHash = useRef<string | null>(null);
  const savedScroll = useRef<{ top: number; left: number } | null>(null);
  const tabs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({});

  useLayoutEffect(() => {
    const position = savedScroll.current;
    const route = window.location.pathname + window.location.search;
    function rememberScroll() {
      if (window.location.pathname + window.location.search === route) {
        savedScroll.current = { top: window.scrollY, left: window.scrollX };
      }
    }
    // Native history can restore before Activity reveals the full-height panel.
    const frame = position && lastHash.current === window.location.hash
      ? requestAnimationFrame(() => window.scrollTo({ ...position, behavior: "instant" })) : null;
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", rememberScroll);
    };
  }, []);

  useEffect(() => {
    function followHash() {
      if (lastHash.current === window.location.hash) return;
      lastHash.current = window.location.hash;
      const target = window.location.hash.slice(1);
      if (!target) {
        setSelected("chronicle");
        setAnchor("");
        return;
      }
      const section = target === "account-data-export" ? "security"
        : SECTIONS.find(({ id }) => target === `account-${id}`)?.id;
      if (!section) return;
      setSelected(section);
      setAnchor(target);
    }
    // Activity resumes effects on Back. An unchanged hash must not override restored scroll.
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  useEffect(() => {
    if (!anchor) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: "start", behavior: "instant" });
      setAnchor("");
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, anchor]);

  function select(id: SectionId) {
    setSelected(id);
    setAnchor("");
    // Replace the section hash without a native anchor jump or extra history entry.
    const url = new URL(window.location.href);
    url.hash = `account-${id}`;
    lastHash.current = url.hash;
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className={styles.accountSections} data-active-section={selected}>
      <div className={styles.accountNavigation} role="tablist" aria-label="Раздели на досието">
        {SECTIONS.map(({ id, title, icon: Icon }, index) => (
          <button key={id} ref={(node) => { tabs.current[id] = node; }} type="button" role="tab"
            className={styles.accountNavigationItem} id={`account-section-${id}`}
            aria-controls={`account-${id}`} aria-selected={selected === id} tabIndex={selected === id ? 0 : -1}
            onClick={() => select(id)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % SECTIONS.length
                : event.key === "ArrowLeft" ? (index + SECTIONS.length - 1) % SECTIONS.length
                : event.key === "Home" ? 0 : event.key === "End" ? SECTIONS.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const target = SECTIONS[next]!.id;
              select(target);
              tabs.current[target]?.focus();
            }}>
            <Icon size={18} aria-hidden="true" /><span>{title}</span>
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {SECTIONS.map(({ id }) => (
          <Activity key={id} mode={selected === id ? "visible" : "hidden"}>
            <div id={`account-${id}`} className={styles.accountGroup} data-account-section={id}
              role="tabpanel" aria-labelledby={`account-section-${id}`} tabIndex={0}>
              {props[id]}
            </div>
          </Activity>
        ))}
      </div>
    </div>
  );
}
