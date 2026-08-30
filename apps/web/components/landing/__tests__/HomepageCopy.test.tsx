import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("homepage copy", () => {
  it("говори за преживяването, а не за вътрешната архитектура", () => {
    const homepageCopy = [
      "apps/web/app/layout.tsx",
      "apps/web/app/page.tsx",
      "apps/web/components/landing-experience.tsx",
      "apps/web/components/landing/UniversalHowToPlay.tsx",
    ]
      .map(readRepoFile)
      .join("\n");

    expect(homepageCopy).not.toMatch(/авторитетен игрови сървър/iu);
    expect(homepageCopy).not.toMatch(/без бот игра/iu);
    expect(homepageCopy).not.toMatch(/два отделни речника/iu);
    expect(homepageCopy).not.toMatch(/Сървърът ти показва/iu);
  });

  it("използва ясни действия за двете игри", () => {
    const landing = readRepoFile("apps/web/components/landing-experience.tsx");

    expect(landing).toContain("Играй Върколак");
    expect(landing).toContain("Играй Мафия");
  });
});
