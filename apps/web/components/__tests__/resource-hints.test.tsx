import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceHints } from "@/components/resource-hints";

describe("ResourceHints", () => {
  it("marks only explicitly critical image preloads as high priority", () => {
    const html = renderToStaticMarkup(
      <ResourceHints
        images={[
          { href: "/critical.avif", type: "image/avif", fetchPriority: "high" },
          { href: "/secondary.webp" },
        ]}
      />,
    );

    expect(html).toContain('href="/critical.avif"');
    expect(html).toContain('fetchPriority="high"');
    expect(html.match(/fetchPriority=/g)).toHaveLength(1);
  });
});
