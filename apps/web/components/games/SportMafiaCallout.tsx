import { ArrowRight, UserRound } from "lucide-react";
import { NextLinkPill } from "@/components/next-link-pill";

export function SportMafiaCallout() {
  return (
    <section className="sport-mafia-callout" aria-label="Спортна Мафия">
      <div className="sport-mafia-callout__plaque family-section-heading">
        <p className="section-kicker">спортен формат</p>
        <h2>Спортна Мафия</h2>
        <p>10 играчи. Фиксиран състав и време за всеки глас.</p>
      </div>
      <figure className="sport-mafia-lineup" aria-label="Състав: 7 от Града срещу 3 от Мафията">
        <div className="sport-mafia-lineup__seats" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} data-sport-team={index < 7 ? "town" : "mafia"}>
              <UserRound size={20} />
            </span>
          ))}
        </div>
        <figcaption>
          <span><b>7</b> от Града</span>
          <span><b>3</b> от Мафията</span>
        </figcaption>
      </figure>
      <NextLinkPill href="/mafia/create?mode=mafia_sport" className="sport-mafia-callout__cta">
        Създай маса<ArrowRight size={17} aria-hidden="true" />
      </NextLinkPill>
    </section>
  );
}
