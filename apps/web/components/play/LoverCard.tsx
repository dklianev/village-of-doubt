import type { PrivateLover } from "@/lib/play/types";

export function LoverCard({ lover }: { lover: PrivateLover }) {
  return (
    <article className="winner-card faction-lovers paper-card mt-8 rounded-[2rem] p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">само за теб</p>
      <h2 className="mt-2 text-3xl font-black">Влюбен си в {lover.loverName}</h2>
      <p className="mt-3 text-[#4f3829]">
        Ако един от вас умре, другият умира от разбито сърце. Ако останете последните двама от различни страни, печелите заедно.
      </p>
    </article>
  );
}
