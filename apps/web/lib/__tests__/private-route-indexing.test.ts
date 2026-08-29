import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("private game route indexing", () => {
  it("sends noindex headers for every create and join route family", async () => {
    const configuredHeaders = await nextConfig.headers?.();
    const noindexSources = configuredHeaders
      ?.filter(({ headers }) => headers.some(({ key, value }) => (
        key === "X-Robots-Tag" && value === "noindex, nofollow"
      )))
      .map(({ source }) => source);

    expect(noindexSources).toEqual([
      "/mafia/create",
      "/mafia/join/:path*",
      "/werewolf/create",
      "/werewolf/join/:path*",
    ]);
  });
});
