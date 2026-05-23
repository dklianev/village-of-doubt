import Image from "next/image";
import { Display, SceneCard } from "@werewolf/ui/server";

interface AccountHeroProps {
  name: string;
  image: string | null;
  memberSince: Date | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
}

export function AccountHero(props: AccountHeroProps) {
  const initial = (props.name[0] ?? "?").toUpperCase();
  const memberSinceLabel = props.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { year: "numeric", month: "long" }).format(props.memberSince)
    : null;

  return (
    <header aria-label="Досие" style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px 0" }}>
      <SceneCard eyebrow="ДОСИЕ" density="lg">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            alignItems: "center",
            gap: "18px 24px",
          }}
        >
          <div
            style={{
              display: "grid",
              width: "96px",
              height: "96px",
              placeItems: "center",
              overflow: "hidden",
              border: "3px solid var(--ds-accent-gold)",
              borderRadius: "999px",
              background: "var(--ds-surface-scene-deep)",
              boxShadow: "0 12px 28px oklch(0 0 0 / 0.45)",
            }}
          >
            {props.image ? (
              <Image src={props.image} alt="" width={96} height={96} sizes="96px" unoptimized />
            ) : (
              <span
                style={{
                  color: "var(--ds-accent-gold)",
                  fontFamily: '"Noto Serif Display", "Noto Serif", "Iowan Old Style", serif',
                  fontSize: "2.4rem",
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {initial}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: "8px", minWidth: 0, overflowWrap: "anywhere" }}>
            <Display size="h1">{props.name || "Без име"}</Display>
            {memberSinceLabel ? (
              <p style={{ color: "var(--ds-ink-scene-soft)", fontSize: "var(--ds-type-body-sm)", margin: 0 }}>
                Член от {memberSinceLabel}
              </p>
            ) : null}
          </div>
        </div>

        {props.totalGames > 0 ? (
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
              gap: "12px",
              margin: 0,
              padding: 0,
            }}
          >
            <div>
              <dt style={quickStatLabelStyle}>Игри</dt>
              <dd style={quickStatValueStyle}>{props.totalGames}</dd>
            </div>
            <div>
              <dt style={quickStatLabelStyle}>Победи</dt>
              <dd style={quickStatValueStyle}>{props.totalWins}</dd>
            </div>
            <div>
              <dt style={quickStatLabelStyle}>Процент</dt>
              <dd style={quickStatValueStyle}>{props.winRate}%</dd>
            </div>
          </dl>
        ) : (
          <p style={{ color: "var(--ds-ink-scene-soft)", fontSize: "var(--ds-type-body)", fontStyle: "italic", margin: 0 }}>
            Първото дело още чака име.
          </p>
        )}
      </SceneCard>
    </header>
  );
}

const quickStatLabelStyle = {
  color: "var(--ds-ink-scene-soft)",
  fontFamily: "ui-monospace, 'Cascadia Mono', monospace",
  fontSize: "var(--ds-type-meta)",
  fontWeight: 700,
  letterSpacing: "0.12em",
  margin: "0 0 4px",
  textTransform: "uppercase",
} as const;

const quickStatValueStyle = {
  color: "var(--ds-ink-scene)",
  fontFamily: '"Noto Serif Display", "Noto Serif", "Iowan Old Style", serif',
  fontSize: "var(--ds-type-h3)",
  fontWeight: 900,
  lineHeight: 1,
  margin: 0,
} as const;
