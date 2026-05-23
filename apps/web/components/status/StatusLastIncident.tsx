"use client";

import Link from "next/link";
import { Display, EmptyState, PaperCard, Pill } from "@werewolf/ui";
import { EMPTY_STATES } from "@werewolf/ui/states";
import { ArtifactImage } from "@/components/ArtifactImage";

const INCIDENT: {
  date: string;
  durationMinutes: number;
  summary: string;
  resolutionDetail: string;
} | null = null;

interface StatusLastIncidentProps {
  majorOutage: boolean;
}

export function StatusLastIncident({ majorOutage }: StatusLastIncidentProps) {
  const outageState = EMPTY_STATES["status-major-outage"];

  if (majorOutage) {
    return (
      <section aria-label="Последен инцидент">
        <EmptyState
          artifact={<ArtifactImage artifact={outageState.artifact} />}
          title={outageState.title}
          body={outageState.body}
          action={
            <Pill as="a" href="#status-subscribe" intent="secondary">
              {outageState.action?.label ?? "Абонирай се за известия"}
            </Pill>
          }
        />
      </section>
    );
  }

  return (
    <section aria-label="Последен инцидент">
      <PaperCard eyebrow="ПОСЛЕДЕН ИНЦИДЕНТ" density="md">
        <Display as="h2" size="h4">
          Какво се е счупвало напоследък.
        </Display>

        {INCIDENT ? (
          <article style={{ display: "grid", gap: "12px" }}>
            <header style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "space-between" }}>
              <time style={{ color: "var(--ds-accent-gold-deep)", fontWeight: 700 }} dateTime={INCIDENT.date}>
                {new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short" }).format(
                  new Date(INCIDENT.date),
                )}
              </time>
              <span style={{ color: "var(--ds-accent-blood-deep)", fontWeight: 700 }}>
                {INCIDENT.durationMinutes} мин. прекъсване
              </span>
            </header>
            <Display as="h3" size="h4">
              {INCIDENT.summary}
            </Display>
            <p style={{ color: "var(--ds-ink-soft)", lineHeight: 1.65, margin: 0 }}>{INCIDENT.resolutionDetail}</p>
          </article>
        ) : (
          <p style={{ color: "var(--ds-ink-soft)", lineHeight: 1.65, margin: 0 }}>
            Няма скорошни инциденти, за които да си заслужава да говорим. Ако нещо ти изглежда счупено,{" "}
            <Link href="/report" style={{ color: "var(--ds-accent-blood-deep)", fontWeight: 700 }}>
              подай сигнал
            </Link>
            .
          </p>
        )}
      </PaperCard>
    </section>
  );
}
