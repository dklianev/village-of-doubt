import { GameCycle } from "./GameCycle";

const PHASES = [
  { label: "Нощ", body: "Върколаците избират жертва. Ролите с нощни способности действат тайно.", art: "/game-art/werewolf/night-3-wolves.webp" },
  { label: "Обсъждане", body: "Селото научава какво се е случило. Сравняваш историите и решаваш на кого да вярваш.", art: "/game-art/werewolf/night-5-dawn.webp" },
  { label: "Гласуване", body: "Решавате кого да отстраните. Един убедителен глас може да спаси селото. Или да го заблуди.", art: "/game-art/werewolf/night-1-fog.webp" },
] as const;

export function WerewolfNightTimeline() {
  return <GameCycle family="werewolves" title="Селото заспива. Подозрението остава." phases={PHASES} />;
}
