import Link from "next/link";
import { GROUP_LABELS, GROUP_ORDER, SECONDARY_LINKS } from "@/components/site-chrome/nav-links";

export function NavDropdown({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav className="nav-dropdown nav-dropdown-overflow" aria-label="Още страници">
      {GROUP_ORDER.map((groupKey) => {
        const groupLinks = SECONDARY_LINKS.filter((item) => item.group === groupKey);
        if (groupLinks.length === 0) {
          return null;
        }

        return (
          <div key={groupKey} className="nav-dropdown-group">
            <p className="nav-dropdown-group-label">{GROUP_LABELS[groupKey]}</p>
            {groupLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} prefetch={false} onClick={onNavigate} className="nav-dropdown-item">
                  <Icon className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
