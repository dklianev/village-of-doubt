import { ACHIEVEMENTS } from "@werewolf/shared";
import { useModal } from "@/lib/use-modal";

export function AchievementUnlockModal({ achievementIds, onClose }: { achievementIds: string[]; onClose: () => void }) {
  const achievements = ACHIEVEMENTS.filter((achievement) => achievementIds.includes(achievement.id));
  const { ref } = useModal<HTMLElement>({ open: achievements.length > 0, onClose });
  if (achievements.length === 0) {
    return null;
  }

  return (
    <div className="achievement-unlock-backdrop" role="presentation" onClick={onClose}>
      <aside ref={ref} className="achievement-unlock-modal" role="dialog" aria-label="Отключени легенди" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose}>
          затвори
        </button>
        <p className="section-kicker">нова легенда</p>
        <h2>Отключи постижение</h2>
        <div>
          {achievements.map((achievement) => (
            <article key={achievement.id}>
              <span>{achievement.iconBg}</span>
              <strong>{achievement.titleBg}</strong>
              <p>{achievement.descriptionBg}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
