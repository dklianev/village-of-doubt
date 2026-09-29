import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("validated route design-system repairs", () => {
  it("keeps the status header unframed with a single CSS art source", () => {
    const source = readFileSync(resolve(process.cwd(), "components/status/StatusHero.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "components/status/LegacyStatus.module.css"), "utf8");
    expect(source).toContain('className="status-hero-art"');
    expect(css).toContain("var(--art-status)");
    expect(source).not.toContain("SceneCard");
    expect(source).not.toContain('from "next/image"');
    expect(source).not.toMatch(/<Image[\s\S]*?\bfill\b/);
  });

  it("keeps the missing page unframed with one scene and clear recovery destinations", () => {
    const source = readFileSync(resolve(process.cwd(), "app/not-found.tsx"), "utf8");
    expect(source).toContain('className="not-found-scene"');
    expect(source).not.toContain("PaperCard");
    expect(source).toContain('href="/join"');
    expect(source).not.toContain("семейство игри");
  });

  it("keeps the replay scene unframed and the timeline server-rendered", () => {
    const source = readFileSync(resolve(process.cwd(), "app/history/[gameId]/replay/page.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "components/history/Replay.module.css"), "utf8");
    expect(source).toContain("styles.header");
    expect(source).toContain('aria-label="Хронология на играта"');
    expect(source).not.toContain('"use client"');
    expect(source).not.toMatch(/<Image[\s\S]*?\bfill\b/);
    expect(css).toContain("var(--journal-art)");
    expect(css).toContain("replay-dawn-dark-v1.webp");
    expect(css).toContain("replay-dawn-light-v1.webp");
    expect(css).toContain("scroll-margin-top:");
  });

  it("keeps the collection header unframed with a single page heading", () => {
    const source = readFileSync(resolve(process.cwd(), "components/achievements-client.tsx"), "utf8");
    const counter = readFileSync(resolve(process.cwd(), "components/achievements/AchievementProgressWreath.tsx"), "utf8");
    expect(source).toContain('<header className="achievement-hero-frame">');
    expect(source.match(/<h1>/g)).toHaveLength(1);
    expect(source).toContain("AchievementProgressWreath");
    expect(counter).toContain('className="achievement-progress"');
    expect(counter).not.toContain("<svg");
    expect(source).toContain('className="achievement-feature"');
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("rounded-[2rem]");
    expect(source).not.toContain("<PaperCard");
  });

  it("isolates collection interaction from catalog predicates and server-rendered plaques", () => {
    const source = readFileSync(resolve(process.cwd(), "components/achievements/AchievementCollection.tsx"), "utf8");
    const plaque = readFileSync(resolve(process.cwd(), "components/achievements/AchievementPlaque.tsx"), "utf8");
    expect(source).toContain('"use client"');
    expect(source).toContain("content: ReactNode");
    expect(source).toContain("aria-pressed=");
    expect(source).not.toContain("@werewolf/shared");
    expect(source).not.toContain("AchievementPlaque");
    expect(source).not.toContain("achievement-presentation");
    expect(source).not.toContain("useEffect");
    expect(plaque).not.toContain('"use client"');
    expect(plaque).toContain('from "next/image"');
  });
});
