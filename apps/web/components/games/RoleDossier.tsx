import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ROLE_DEFINITIONS, getRoleRuntimeStatus, getRolesForFamily, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";
import { RoleArt } from "./RoleArt";

type RoleDossierProps = {
  family: GameFamily;
  role: RoleCode;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function RoleDossier(props: RoleDossierProps) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const valid = getRolesForFamily(props.family).includes(props.role);
  const close = useEffectEvent(props.onClose);
  useEffect(() => {
    if (!valid) {
      close();
      return;
    }
    setTarget(document.body);
  }, [valid]);
  return target && valid ? createPortal(<RoleDossierContent {...props} />, target) : null;
}

function RoleDossierContent({ family, role, onClose, returnFocusRef }: RoleDossierProps) {
  const definition = ROLE_DEFINITIONS[role];
  const runtimeStatus = getRoleRuntimeStatus(role);
  const titleId = useId();
  const { ref, closeRef } = useDossierModal(onClose, returnFocusRef);

  return (
    <div ref={ref} className="role-codex-detail" role="dialog" aria-modal="true" aria-labelledby={titleId} data-role-dossier data-family={family} data-faction={family}>
      <button type="button" className="role-codex-detail-backdrop" aria-label="Затвори досието" onClick={onClose} />
      <article className="role-codex-detail-panel">
        <header className="role-codex-detail-heading">
          <div>
            <p className="section-kicker">{teamLabelBg(definition.team, family)}</p>
            <h2 id={titleId}>{definition.nameBg}</h2>
          </div>
          <button type="button" ref={closeRef} className="role-codex-detail-close" aria-label="Затвори досието" onClick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="role-codex-detail-body">
          <RoleArt role={role} family={family} detail />
          <div className="role-codex-detail-copy">
            <p>{definition.fullDescriptionBg}</p>
            <blockquote className="role-table-quote">{roleQuoteBg(role, family)}</blockquote>
            <dl className="role-codex-facts" aria-label="Данни за ролята">
              <div><dt>Стойност</dt><dd>{formatValue(definition.value)}</dd></div>
              <div><dt>Нощен ред</dt><dd>{definition.nightOrder ?? "Без нощен ред"}</dd></div>
              <div><dt>Играчи</dt><dd>{definition.minPlayers}+</dd></div>
              <div><dt>Копия</dt><dd>{definition.maxCopies === 1 ? "1 копие" : `До ${definition.maxCopies} копия`}</dd></div>
            </dl>
            <div className="role-table-advice">
              <section><h3>С тази роля</h3><p>{roleStrategyBg(role, family)}</p></section>
              <section><h3>Срещу тази роля</h3><p>{roleCounterplayBg(role, family)}</p></section>
            </div>
            <div className="role-codex-tags">
              <span>{runtimeStatus === "playable" ? "Работи в автоматична игра" : "За ръчно водене"}</span>
              {definition.isDefaultEnabled ? <span>Стартова игра</span> : null}
              {definition.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            {definition.dependencies.length > 0 ? (
              <div className="role-warning">
                {definition.dependencies.map((dependency) => (
                  <span key={dependency.roleId}>{dependency.reasonBg}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

function useDossierModal(onClose: () => void, returnFocusRef?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useEffectEvent(onClose);

  useLayoutEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const previousFocus = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const overflow = document.body.style.overflow;
    const position = { top: window.scrollY, left: window.scrollX };
    const isolated: { element: HTMLElement; inert: string | null; hidden: string | null }[] = [];

    // The portal is a direct body child, so isolating its siblings cannot inert the dossier.
    for (const element of document.body.children) {
      if (element === layer || !(element instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(element.tagName)) continue;
      isolated.push({ element, inert: element.getAttribute("inert"), hidden: element.getAttribute("aria-hidden") });
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        const buttons = Array.from(layer!.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus({ preventScroll: true });
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      for (const { element, inert, hidden } of isolated) {
        if (inert === null) element.removeAttribute("inert");
        else element.setAttribute("inert", inert);
        if (hidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", hidden);
      }
      document.body.style.overflow = overflow;
      previousFocus?.focus({ preventScroll: true });
      if (window.scrollY !== position.top || window.scrollX !== position.left) {
        window.scrollTo({ ...position, behavior: "instant" });
      }
    };
  }, [returnFocusRef]);
  return { ref, closeRef };
}

function formatValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function roleQuoteBg(role: RoleCode, family: GameFamily) {
  const quotes: Partial<Record<RoleCode, string>> = {
    seer: "Картите казват истината, но не казват кога да я кажеш.",
    oracle: "Истината идва на части. Паниката я прави безполезна.",
    hunter: "Когато падаш, един от тях пада с теб.",
    witch: "Една отвара спасява нощта. Другата я приключва.",
    healer: "Най-добрата защита е тази, за която никой не разбира.",
    priest: "Благословията е тиха, но остава до края.",
    werewolf: "Селото спи. Гората брои.",
    vampire: "Не всяка смърт идва сутрин.",
    mafioso: "Спите в хор. Лъжете поотделно.",
    don: "Не командваш силно. Командваш така, че да изглежда случайно.",
    commissioner: "Проверката е оръжие само ако оцелееш да я използваш.",
    doctor: "Понякога спасяваш човека, който утре ще те обвини.",
    jester: "Истинската победа е всички да сбъркат по твоя план.",
  };

  return quotes[role] ?? (family === "mafia" ? "В този град всяко алиби има цена." : "В това село тишината също говори.");
}

function roleStrategyBg(role: RoleCode, family: GameFamily) {
  const definition = ROLE_DEFINITIONS[role];
  if (definition.team === "mafia" || definition.team === "werewolves" || definition.team === "vampires") {
    return family === "mafia"
      ? "Говори рано, но не води всяко гласуване. Най-доброто алиби е малко несъвършено."
      : "Не се защитавайте като отбор. Оставете селото само да стигне до грешния извод.";
  }
  if (hasRoleTag(role, "разследваща")) {
    return "Събирай информация, преди да се разкриеш. Един навременен намек може да е по-полезен от открито обвинение.";
  }
  if (hasRoleTag(role, "защитна")) {
    return "Пази хората, които печелят доверие, не само най-шумните. Те често са следващата нощна цел.";
  }
  if (hasRoleTag(role, "атакуваща")) {
    return "Атакувай само когато имаш причина, която можеш да защитиш след това.";
  }
  if (definition.team === "neutral" || definition.team === "lovers") {
    return "Следи собствената си цел, дори когато останалите спорят за друго. Не разкривай твърде рано какво ти е нужно, за да спечелиш.";
  }
  return "Гледай как хората гласуват, не само какво казват. Сравнявай днешните им обвинения с вчерашните решения.";
}

function roleCounterplayBg(role: RoleCode, family: GameFamily) {
  const definition = ROLE_DEFINITIONS[role];
  if (definition.team === "mafia" || definition.team === "werewolves" || definition.team === "vampires") {
    return family === "mafia"
      ? "Търси резки смени на версията и прекалено удобни обвинения."
      : "Следи кой подхвърля подозрения, а после оставя другите да обвиняват вместо него.";
  }
  if (hasRoleTag(role, "разследваща")) {
    return "Увереният тон не доказва проверка. Сравнявай казаното с вече разкритата информация.";
  }
  if (hasRoleTag(role, "защитна")) {
    return "Ако няма смърт, не приемай автоматично, че защитникът е доказан.";
  }
  if (hasRoleTag(role, "атакуваща")) {
    return "Питай за причината за избора, не само за резултата.";
  }
  if (role === "jester") {
    return "Ако някой прекалено много иска да бъде изгонен, може би му помагате.";
  }
  return "Следи кого подкрепя този играч при гласуване и кога сменя позицията си.";
}

function hasRoleTag(role: RoleCode, tag: string) {
  return (ROLE_DEFINITIONS[role].tags as readonly string[]).includes(tag);
}
