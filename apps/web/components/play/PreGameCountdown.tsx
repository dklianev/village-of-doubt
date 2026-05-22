export function PreGameCountdown({ value }: { value: number | null }) {
  if (value === null) {
    return null;
  }

  return (
    <div className="pre-game-countdown" aria-live="assertive" aria-atomic="true">
      <span>ролите се разбъркват</span>
      <strong>{value}</strong>
      <small>Не показвай екрана си на другите.</small>
    </div>
  );
}
