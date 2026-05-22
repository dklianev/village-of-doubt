import type { NarratorRoleSnapshot } from "@/lib/play/types";

export function NarratorSnapshotPanel({ snapshot }: { snapshot: NarratorRoleSnapshot }) {
  return (
    <section className="narrator-kit-card paper-card mt-8 rounded-[2rem] p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">само за Пълния Разказвач</p>
      <h2 className="mt-2 text-3xl font-black">Тайни роли</h2>
      <p className="mt-3 text-[#4f3829]">
        Това табло се изпраща само като лично събитие към избрания Пълен Разказвач.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {snapshot.roles.map((item) => (
          <div key={item.userId} className="rounded-2xl bg-white/40 px-4 py-3">
            <strong className="block">{item.displayName}</strong>
            <span>{item.roleNameBg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
