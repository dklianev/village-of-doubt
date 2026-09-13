import type { GameSnapshot, PublicEvent } from "@/lib/play/types";

const MOMENT_PRIORITY: Partial<Record<PublicEvent["type"], number>> = {
  death: 3,
  hunter_shot: 3,
  reveal: 3,
  vote: 2,
  nomination: 1,
  mayor: 1,
};

export function PostGameStory({ snapshot }: { snapshot: GameSnapshot }) {
  const deaths = snapshot.players.filter((player) => player.playing && !player.alive).length;
  const finalLiving = snapshot.players.filter((player) => player.playing && player.alive).length;
  // Keep consequential public moments, then restore the server's chronology.
  const moments = snapshot.publicEvents
    .map((event, index) => ({ event, index, priority: MOMENT_PRIORITY[event.type] ?? 0 }))
    .filter(({ priority }) => priority > 0)
    .sort((a, b) => b.priority - a.priority || b.index - a.index)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index);

  return (
    <section className="post-game-story mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">история на нощта</p>
      <h2 className="mt-2 text-3xl font-black">Как ще я разказвате след играта</h2>
      <div className="post-game-badges mt-5">
        <span>оцеляха {finalLiving}</span>
        <span>паднаха {deaths}</span>
        <span>рундове {snapshot.round}</span>
      </div>
      {moments.length > 0 ? (
        <ol className="mt-5">
          {moments.map(({ event }) => (
            <li key={event.id}>{event.messageBg}</li>
          ))}
        </ol>
      ) : (
        <p className="mt-5">Няма записани ключови публични събития.</p>
      )}
    </section>
  );
}
