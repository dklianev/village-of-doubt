import type { PrivateLover } from "@/lib/play/types";

export function LoverCard({ lover }: { lover: PrivateLover }) {
  return (
    <article className="play-personal-context lover-card">
      <p className="section-kicker">само за теб</p>
      <h2>Влюбен си в {lover.loverName}</h2>
      <p>
        Ако един от вас умре, другият умира от разбито сърце. Ако останете последните двама от различни страни, печелите заедно.
      </p>
    </article>
  );
}
