import { GameCycle } from "./GameCycle";

const PHASES = [
  { label: "Нощ", body: "Мафията договаря жертва. Ролите с нощни способности разследват или пазят тайно.", art: "/game-art/mafia/night-2-don.webp" },
  { label: "Обсъждане", body: "Градът задава въпроси. Помниш кой какво е казал и търсиш пукнатина в алибито.", art: "/game-art/mafia/night-3-sheriff.webp" },
  { label: "Гласуване", body: "Обвиненията стигат до вот. Градът търси Мафиот. Мафията има друга цел.", art: "/game-art/mafia/night-5-morning.webp" },
] as const;

export function MafiaNightTimeline() {
  return <GameCycle family="mafia" title="Нощта има свидетели. Всеки разказва различно." phases={PHASES} />;
}
