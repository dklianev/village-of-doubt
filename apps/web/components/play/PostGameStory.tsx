import type { GameSnapshot } from "@/lib/play/types";

export function PostGameStory({ snapshot }: { snapshot: GameSnapshot }) {
  const deaths = snapshot.players.filter((player) => player.playing && !player.alive).length;
  const finalLiving = snapshot.players.filter((player) => player.playing && player.alive).length;
  const lastEvents = snapshot.publicEvents.slice(-5);

  return (
    <section className="post-game-story mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">история на нощта</p>
      <h2 className="mt-2 text-3xl font-black">Как ще я разказвате след играта</h2>
      <div className="post-game-badges mt-5">
        <span>оцеляха {finalLiving}</span>
        <span>паднаха {deaths}</span>
        <span>рундове {snapshot.round}</span>
      </div>
      <ol className="mt-5">
        {lastEvents.map((event) => (
          <li key={event.id}>{event.messageBg}</li>
        ))}
      </ol>
    </section>
  );
}
