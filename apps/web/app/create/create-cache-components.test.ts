import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const createRoutes = [
  "app/create/page.tsx",
  "app/werewolf/create/page.tsx",
  "app/mafia/create/page.tsx",
];

const intentionallyBlockingRoutes = [
  "app/account/page.tsx",
  "app/achievements/page.tsx",
  "app/friends/page.tsx",
  "app/history/[gameId]/replay/page.tsx",
  "app/lobby/page.tsx",
  "app/lobby/[code]/page.tsx",
  "app/mafia/join/[[...roomCode]]/page.tsx",
  "app/privacy/page.tsx",
  "app/report/page.tsx",
  "app/roles/page.tsx",
  "app/sign-in/page.tsx",
  "app/status/page.tsx",
  "app/terms/page.tsx",
  "app/werewolf/join/[[...roomCode]]/page.tsx",
];

describe("Cache Components route boundaries", () => {
  it.each(createRoutes)("streams request-bound work behind Suspense in %s", (route) => {
    const source = readFileSync(resolve(process.cwd(), route), "utf8");

    expect(source).toContain('import { Suspense } from "react"');
    expect(source).toMatch(/export default function \w*CreatePage/);
    expect(source).toContain("<Suspense");
    expect(source).toMatch(/async function \w*CreateRouteContent/);
  });

  it("streams the request-bound play route behind Suspense", () => {
    const source = readFileSync(resolve(process.cwd(), "app/play/[code]/page.tsx"), "utf8");

    expect(source).toContain('import { Suspense } from "react"');
    expect(source).toMatch(/export default function PlayPage/);
    expect(source).toContain("<Suspense");
    expect(source).toMatch(/async function PlayRouteContent/);
  });

  it.each(intentionallyBlockingRoutes)("declares intentional request blocking in %s", (route) => {
    const source = readFileSync(resolve(process.cwd(), route), "utf8");

    expect(source).toContain("export const instant = false;");
  });
});
