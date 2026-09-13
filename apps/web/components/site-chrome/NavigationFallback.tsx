import { RotateCw, X } from "lucide-react";
import { DRAWER_DESTINATIONS, SECONDARY_DESTINATIONS } from "./nav-destinations";

export function NavigationFallback({ id, mode, mobile = false, failed, isRoom = false, onRetry, onClose }: {
  id: string;
  mode: "more" | "navigation" | "play";
  mobile?: boolean;
  failed: boolean;
  isRoom?: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const links = mode === "play"
    ? [{ href: "/werewolf/create", label: "Върколак" }, { href: "/mafia/create", label: "Мафия" }, { href: "/join", label: "Имам код" }]
    : mode === "more" ? SECONDARY_DESTINATIONS
      : [{ href: "/account", label: "Моето досие" }, ...(!isRoom ? [{ href: "/join", label: "Имам код" }] : []),
        ...DRAWER_DESTINATIONS, ...SECONDARY_DESTINATIONS];

  return <nav id={id} className={`nav-dropdown nav-dropdown-overflow site-navigation-fallback${mobile ? " is-mobile" : ""}`}
    aria-label={mode === "play" ? "Нова игра" : mode === "more" ? "Още страници" : "Мобилна навигация"}>
    <p className="nav-dropdown-group-label" role={failed ? "alert" : "status"}>{failed ? "Менюто не се зареди." : "Зареждаме менюто..."}</p>
    {mobile ? <button className="nav-dropdown-item" type="button" aria-label="Затвори менюто" onClick={onClose}>
      <X className="nav-dropdown-item-icon" aria-hidden /><span>Затвори</span>
    </button> : null}
    {failed ? <button className="nav-dropdown-item" type="button" onClick={onRetry}>
      <RotateCw className="nav-dropdown-item-icon" aria-hidden /><span>Опитай отново</span>
    </button> : null}
    {links.map(({ href, label }) => <a key={href} className="nav-dropdown-item" href={href}><span aria-hidden /><span>{label}</span></a>)}
  </nav>;
}
