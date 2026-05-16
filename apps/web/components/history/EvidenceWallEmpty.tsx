import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

export function EvidenceWallEmpty() {
  return (
    <section className="evidence-empty">
      <figure className="evidence-empty-figure">
        <Image
          src="/game-art/history-empty-hero-v2.webp"
          alt=""
          width={768}
          height={512}
          sizes="(max-width: 768px) 100vw, 768px"
          priority
          className="evidence-empty-art"
        />
        <figcaption className="evidence-empty-tag">Първата нощ ще остави следа тук.</figcaption>
      </figure>
      <div className="evidence-empty-cta">
        <Link href="/werewolf/create" className="btn btn-primary">
          Започни първото дело
        </Link>
        <Link href="/tutorial" className="btn btn-secondary">
          Виж как изглежда дело
        </Link>
      </div>
      <div className="evidence-ghost-row" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="case-file case-file-ghost"
            data-family={item === 1 ? "werewolves" : "mafia"}
            style={{ "--tilt": `${item === 1 ? -2 : item === 0 ? 1.5 : -1}deg` } as CSSProperties}
          >
            <span className="pushpin" />
            <div className="case-file-ghost-lines">
              <span style={{ width: "60%" }} />
              <span style={{ width: "85%" }} />
              <span style={{ width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
