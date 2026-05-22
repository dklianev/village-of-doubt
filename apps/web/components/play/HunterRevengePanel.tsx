import type { PublicPlayer } from "@/lib/play/types";

export function HunterRevengePanel({
  currentUserId,
  livingPlayers,
  sendHunterRevenge,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  sendHunterRevenge: (targetUserId: string) => void;
}) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">отмъщение на Ловеца</p>
      <h2 className="mt-2 text-3xl font-black">Последен изстрел</h2>
      <p className="mt-3 text-[#ead9ba]">Ловецът падна, но може да вземе един жив играч със себе си.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {livingPlayers
          .filter((player) => player.userId !== currentUserId)
          .map((player) => (
            <button className="btn btn-primary action-btn ability-hunter" type="button" key={player.userId} onClick={() => sendHunterRevenge(player.userId)}>
              Застреляй {player.displayName}
            </button>
          ))}
      </div>
    </section>
  );
}
