export function AchievementProgressWreath({ unlocked, total }: { unlocked: number; total: number }) {
  return (
    <p className="achievement-progress" aria-label={`${unlocked} от ${total} легенди отключени`}>
      {unlocked} от {total} отключени
    </p>
  );
}
