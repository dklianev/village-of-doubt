import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { FaqItem } from "@/lib/faq-data";
import { FaqHearth } from "../FaqHearth";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img {...props} />,
}));

vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const items: FaqItem[] = [
  {
    slug: "technical-answer",
    category: "tech",
    question: "Как да проверя връзката?",
    answer: [{ type: "paragraph", text: "Провери връзката към сървъра." }],
    searchableText: "как да проверя връзката провери връзката към сървъра.",
  },
  {
    slug: "account-answer",
    category: "account",
    question: "Как да сменя името?",
    answer: [{ type: "paragraph", text: "Отвори личното досие." }],
    searchableText: "как да сменя името отвори личното досие.",
  },
];

const faqCss = readFileSync(resolve(process.cwd(), "components/faq/LegacyFaq.module.css"), "utf8");
const faqPageSource = readFileSync(resolve(process.cwd(), "app/faq/page.tsx"), "utf8");

describe("FaqHearth search", () => {
  it("reuses one preloaded AVIF for the ambient and hero art", () => {
    const { container } = render(<FaqHearth items={items} />);
    const banner = container.querySelector(".faq-hearth-banner");

    expect(banner).toHaveAttribute("aria-hidden", "true");
    expect(banner?.querySelector("img")).toBeNull();
    expect(faqCss).toContain("background: var(--art-faq) center 38% / cover no-repeat;");
    expect(faqPageSource).toContain('href: "/game-art/legal/faq-hearth-banner.avif"');
    expect(faqPageSource).not.toContain('href: "/game-art/legal/faq-hearth-banner.webp"');
  });

  it("searches across every category instead of preserving a stale category filter", () => {
    render(<FaqHearth items={items} />);

    fireEvent.click(screen.getByRole("button", { name: "Технически" }));
    expect(screen.queryByText("Как да сменя името?")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "личното досие" } });

    expect(screen.getByRole("button", { name: "Всички" })).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Как да сменя името?")).toBeInTheDocument();
    expect(screen.queryByText("Никой не е питал това още. Опитай друга дума.")).not.toBeInTheDocument();
  });

  it("announces filter, feedback and copied-link state", async () => {
    window.history.replaceState(null, "", "/faq");
    render(<FaqHearth items={items} />);

    const technical = screen.getByRole("button", { name: "Технически" });
    expect(technical).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(technical);
    expect(technical).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Как да проверя връзката?" }));
    const helpful = screen.getByRole("button", { name: "Да, помогна" });
    expect(helpful).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(helpful);
    expect(helpful).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Копирай линк/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Линкът е копиран");
  });
});
