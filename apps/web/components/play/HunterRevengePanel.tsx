import type { PublicPlayer } from "@/lib/play/types";

export function HunterRevengePanel({
  currentUserId,
  livingPlayers,
  selectedTargetId,
  sendHunterRevenge,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  selectedTargetId: string;
  sendHunterRevenge: (targetUserId: string) => void;
}) {
  const selectedTarget = livingPlayers.find((player) => player.userId === selectedTargetId && player.userId !== currentUserId);

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">отмъщение на Ловеца</p>
      <h2 className="mt-2 text-3xl font-black">Последен изстрел</h2>
      <div className="play-selected-target mt-5" data-filled={selectedTarget ? "true" : undefined}>
        <span>последна цел</span>
        <strong>{selectedTarget?.displayName ?? "избери играч от масата"}</strong>
      </div>
      <div className="play-action-buttons mt-5 flex flex-wrap gap-3">
        <button
          className="btn btn-primary action-btn ability-hunter"
          type="button"
          disabled={!selectedTarget}
          onClick={() => selectedTarget && sendHunterRevenge(selectedTarget.userId)}
        >
          {selectedTarget ? `Застреляй ${selectedTarget.displayName}` : "Потвърди изстрела"}
        </button>
      </div>
      <p className="mt-3 text-[#ead9ba]">Ловецът падна, но може да вземе един жив играч със себе си.</p>
    </section>
  );
}
