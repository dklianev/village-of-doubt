"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./Account.module.css";

const SECTIONS = [
  { id: "chronicle", title: "Хроника" },
  { id: "identity", title: "Образ и достъп" },
  { id: "security", title: "Данни и сигурност" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function scrollToAccountTarget(id: string) {
  const target = document.getElementById(id);
  // Desktop groups use display: contents; scroll the actual section box.
  const section = target?.matches("[data-account-section]") ? target.querySelector("section") : target;
  section?.scrollIntoView({ block: "start", behavior: "instant" });
}

export function AccountSections({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SectionId>("chronicle");
  const navigationRef = useRef<HTMLElement>(null);
  const scrollTargetRef = useRef<string | null>(null);
  const shouldScrollRef = useRef(false);

  useEffect(() => {
    function followHash() {
      const target = window.location.hash.slice(1);
      const section = target === "account-data-export" ? "security"
        : SECTIONS.find(({ id }) => target === `account-${id}`)?.id;
      if (!section) return;
      scrollTargetRef.current = target;
      shouldScrollRef.current = true;
      setSelected(section);
      // Same-section anchors also need scrolling after the hidden panel is revealed.
      requestAnimationFrame(() => scrollToAccountTarget(target));
    }
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  useEffect(() => {
    if (!shouldScrollRef.current) return;
    const target = scrollTargetRef.current;
    const frame = requestAnimationFrame(() => {
      // A cancelled frame must leave the intent pending for effect reactivation.
      shouldScrollRef.current = false;
      if (target) {
        scrollToAccountTarget(target);
      } else if (window.matchMedia("(max-width: 760px)").matches) {
        navigationRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      } else {
        scrollToAccountTarget(`account-${selected}`);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  return (
    <div className={styles.accountSections} data-active-section={selected}>
      <nav ref={navigationRef} className={styles.accountNavigation} aria-label="Раздели на досието">
        {SECTIONS.map(({ id, title }) => (
          <div key={id} className={styles.accountNavigationItem}>
            <input
              className={styles.accountGroupToggle}
              type="radio"
              name="account-section"
              id={`account-section-${id}`}
              aria-label={title}
              aria-controls={`account-${id}`}
              checked={selected === id}
              onChange={() => {
                scrollTargetRef.current = null;
                shouldScrollRef.current = true;
                setSelected(id);
              }}
            />
            <label className={styles.accountGroupSummary} htmlFor={`account-section-${id}`}>{title}</label>
          </div>
        ))}
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
