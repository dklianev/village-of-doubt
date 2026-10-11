import { formatBulgarianDateTime } from "@/lib/date-time";

export function Masthead({ asOf }: { asOf?: Date | undefined }) {
  return (
    <header className="masthead">
      <p className="masthead-kicker">Класацията на масата</p>
      <h1 className="masthead-title">Вечерен брой</h1>
      <p className="masthead-meta">
        <span>Последните 7 дни</span>
        <span>Публични завършени игри</span>
        {asOf ? <time dateTime={asOf.toISOString()}>{formatBulgarianDateTime(asOf, { day: "2-digit", month: "2-digit", year: "numeric" })}</time> : null}
      </p>
    </header>
  );
}
