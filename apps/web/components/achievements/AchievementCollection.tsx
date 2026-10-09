"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import { Check, LayoutGrid, LockKeyhole } from "lucide-react";

interface CollectionItem {
  id: string;
  isUnlocked: boolean;
  content: ReactNode;
}

const filters = [
  { id: "all", label: "Всички", Icon: LayoutGrid },
  { id: "unlocked", label: "Отключени", Icon: Check },
  { id: "locked", label: "Заключени", Icon: LockKeyhole },
] as const;

export function AchievementCollection({ items, hasFeatured }: { items: CollectionItem[]; hasFeatured: boolean }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const id = useId();
  const unlockedCount = items.filter((item) => item.isUnlocked).length;
  const counts = { all: items.length, unlocked: unlockedCount, locked: items.length - unlockedCount };
  const visible = items.filter((item) => filter === "all" || item.isUnlocked === (filter === "unlocked"));

  return (
    <section className="achievement-collection" aria-labelledby={`${id}-title`}>
      <div className="achievement-collection-toolbar">
        <h2 id={`${id}-title`}>{hasFeatured ? "Останалите отличия" : "Всички отличия"}</h2>
        <div className="achievement-filters" role="group" aria-label={hasFeatured ? "Филтър за останалите отличия" : "Филтър за колекцията"}>
          {filters.map(({ id: value, label, Icon }) => (
            <button key={value} type="button" aria-pressed={filter === value} aria-controls={`${id}-results`} onClick={() => setFilter(value)}>
              <Icon size={16} aria-hidden="true" />
              {label} <span className="achievement-filter-count">({counts[value]})</span>
            </button>
          ))}
        </div>
      </div>
      <p className="achievement-collection-count" role="status">
        Показани: {visible.length} от {items.length} {hasFeatured ? "останали отличия" : "отличия"}
      </p>
      <div id={`${id}-results`}>
        {visible.length > 0 ? (
          <div className="plaque-wall">
            {visible.map((item) => <Fragment key={item.id}>{item.content}</Fragment>)}
          </div>
        ) : (
          <p className="achievement-filter-empty">
            {filter === "locked" ? "Няма заключени отличия."
              : filter === "unlocked" ? (hasFeatured ? "Няма други отключени отличия." : "Няма отключени отличия.")
              : "Няма други отличия."}
          </p>
        )}
      </div>
    </section>
  );
}
