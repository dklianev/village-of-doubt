export function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-pill rounded-2xl px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.2em] text-[#c18a38]">{label}</span>
      <strong className="mt-1 block">{value}</strong>
    </div>
  );
}
