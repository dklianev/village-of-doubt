import { renderToStaticMarkup } from "react-dom/server";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { describe, expect, it } from "vitest";
import * as werewolf from "@/app/werewolf/rules/page";
import * as mafia from "@/app/mafia/rules/page";
import * as faq from "@/app/faq/page";
import * as terms from "@/app/terms/page";

describe.each([
  {
    path: "/werewolf/rules", route: werewolf, title: "Правила за Върколак",
    content: "#rules-objective li", minimumItems: 2, schema: "HowTo",
  },
  {
    path: "/mafia/rules", route: mafia, title: "Правила за Мафия",
    content: "#rules-objective li", minimumItems: 2, schema: "HowTo",
  },
  {
    path: "/faq", route: faq, title: "Помощ",
    content: ".faq-hearth-item-question", minimumItems: 10, schema: "FAQPage",
  },
  {
    path: "/terms", route: terms, title: "Условия за ползване",
    content: ".terms-annex-body", minimumItems: 6, schema: "WebPage",
  },
])("$path partial prefetch pilot", ({ path, route, title, content, minimumItems, schema }) => {
  it("opts the destination into partial prefetch with complete static server output", () => {
    expect(route.prefetch).toBe("partial");
    expect(route.ensureStatic).toBe("navigation");
  });

  it("keeps meaningful server HTML and matching metadata without hydration", () => {
    // This guards page content, not Next's prerender validation or Link prefetching.
    // Those require the parent's production build and partial-prefetch-pilot.spec.ts.
    const Page = route.default;
    const html = renderToStaticMarkup(
      <ImageConfigContext.Provider value={{ ...imageConfigDefault, qualities: [75, 85] }}>
        <Page />
      </ImageConfigContext.Provider>,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelectorAll("main h1")).toHaveLength(1);
    expect(document.querySelector("main h1")?.textContent).toBe(title);
    const items = [...document.querySelectorAll(content)];
    expect(items.length).toBeGreaterThanOrEqual(minimumItems);
    expect(items.every((item) => Boolean(item.textContent?.trim()))).toBe(true);

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const structuredData = JSON.parse(scripts[0]!.textContent!);
    expect(structuredData).toMatchObject({ "@type": schema, inLanguage: "bg-BG" });
    expect(new URL(structuredData.url).pathname).toBe(path);
    expect(route.metadata.alternates?.canonical).toBe(structuredData.url);
  });
});
