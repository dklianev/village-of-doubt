import Link from "next/link";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementIcon } from "@/components/achievements/AchievementIcon";

interface Props {
  unlockedIds: string[];
  total: number;
}

export function AccountAchievements({ unlockedIds, total }: Props) {
  const unlockedSet = new Set(unlockedIds);
  const top3 = ACHIEVEMENTS.filter((definition) => unlockedSet.has(definition.id)).slice(0, 3);

  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Постижения</h2>
        <p>
          {unlockedIds.length} от {total} легенди отключени.
        </p>
      </header>

      {top3.length > 0 ? (
        <ul className="account-achievement-row">
          {top3.map((definition) => (
            <li key={definition.id}>
              <article
                className="account-achievement-mini"
                data-tier={definition.tier ?? "bronze"}
                data-family={definition.family ?? "universal"}
              >
                <AchievementIcon id={definition.id} className="account-achievement-icon" />
                <p className="account-achievement-title">{definition.titleBg}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-empty-note">
          Заключени са все още. Завърши първата игра, за да гравираш плоча.
        </p>
      )}

      <Link href="/achievements" className="account-section-link">
        Виж всички постижения →
      </Link>
    </section>
  );
}
