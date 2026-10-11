import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const SECTIONS = [
  ["rules-objective", "Цел на играта"],
  ["rules-basics", "Преди началото"],
  ["rules-phases", "Ход на играта"],
  ["rules-details", "Особености"],
] as const;

export function GameRulesContents({ familyPath }: { familyPath: "werewolf" | "mafia" }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  const [edges, setEdges] = useState({ overflow: false, start: true, end: false });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => setEdges({
      overflow: rail.scrollWidth > rail.clientWidth + 1,
      start: rail.scrollLeft <= 1,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
    });
    const locate = () => {
      let current: string = SECTIONS[0][0];
      for (const [id] of SECTIONS) {
        const section = document.getElementById(id);
        if (!section) continue;
        const bounds = section.getBoundingClientRect();
        const offset = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 96;
        if (bounds.height > 0 && bounds.top <= offset + 24) current = id;
      }
      setActive(current);
    };
    const fromHash = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      const section = SECTIONS.find(([id]) => target?.closest(`#${id}`));
      if (section) setActive(section[0]);
      else locate();
    };
    const resize = () => { measure(); locate(); };
    measure();
    fromHash();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    rail.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("scroll", locate, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("hashchange", fromHash);
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", locate);
      window.removeEventListener("resize", resize);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    const link = rail?.querySelector<HTMLAnchorElement>(`a[href="#${active}"]`);
    if (!rail || !link || rail.scrollWidth <= rail.clientWidth) return;
    if (link.offsetLeft < rail.scrollLeft || link.offsetLeft + link.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollTo({ left: link.offsetLeft - 8, behavior: "instant" });
    }
  }, [active]);

  function scroll(direction: number) {
    const rail = railRef.current;
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth * .75, behavior: "instant" });
  }

  return (
    <nav className="rules-contents" aria-label="В правилата" data-overflow={edges.overflow}>
      <button type="button" className="rules-contents-arrow" aria-label="Предишни раздели" title="Предишни раздели" disabled={edges.start} onClick={() => scroll(-1)}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div className="rules-contents-rail" ref={railRef}>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => setActive(id)}>{label}</a>
        ))}
        <Link href={`/${familyPath}/roles`} prefetch={false}>Всички роли <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      <button type="button" className="rules-contents-arrow" aria-label="Следващи раздели" title="Следващи раздели" disabled={edges.end} onClick={() => scroll(1)}>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
