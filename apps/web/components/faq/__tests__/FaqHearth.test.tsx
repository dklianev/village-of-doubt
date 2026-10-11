import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    window.history.replaceState(null, "", "/faq");
    localStorage.clear();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adopts search typed before hydration and keeps it through later renders", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<FaqHearth items={items} />);
    document.body.append(container);
    const input = within(container).getByRole("searchbox") as HTMLInputElement;
    input.value = "личното досие";

    render(<FaqHearth items={items} />, { container, hydrate: true });
    expect(screen.getByRole("searchbox")).toBe(input);
    expect(input).toHaveValue("личното досие");
    expect(screen.queryByRole("button", { name: items[0]!.question })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: items[1]!.question }));
    expect(input).toHaveValue("личното досие");
    expect(screen.getByText("1 отговор")).toBeVisible();
  });

  it("only pins the toolbar when its full height fits, including text resize", () => {
    let resized = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resized = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const { container, unmount } = render(<FaqHearth items={items} />);
    const toolbar = container.querySelector(".faq-hearth-toolbar") as HTMLElement;
    Object.defineProperty(toolbar, "offsetHeight", { configurable: true, value: 900 });
    resized();
    expect(toolbar).toHaveAttribute("data-sticky", "false");
    Object.defineProperty(toolbar, "offsetHeight", { configurable: true, value: 400 });
    resized();
    expect(toolbar).toHaveAttribute("data-sticky", "true");
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
  it("identifies help literally while keeping the hearth as secondary copy", () => {
    render(<FaqHearth items={items} />);

    expect(screen.getByRole("heading", { level: 1, name: "Помощ" })).toBeInTheDocument();
    expect(screen.getByText("седни до огъня")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Търси въпрос...");
  });

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
    expect(screen.queryByText("Няма намерени отговори")).not.toBeInTheDocument();
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

  it("clears an empty search and returns focus to the input", () => {
    render(<FaqHearth items={items} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "непознато" } });
    const empty = screen.getByRole("heading", { name: "Няма намерени отговори" }).parentElement!;
    fireEvent.click(within(empty).getByRole("button"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(screen.getByRole("button", { name: items[0]!.question })).toBeVisible();
  });

  it("uses a labelled category selector with the same filter state", () => {
    render(<FaqHearth items={items} />);
    fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "account" } });
    expect(screen.getByRole("button", { name: "Досие и сесия" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: items[0]!.question })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: items[1]!.question })).toBeVisible();
  });

  it("hides collapsed answer controls without imposing a content height limit", () => {
    const { container } = render(<FaqHearth items={items} />);
    const answer = container.querySelector("#faq-answer-technical-answer")!;
    expect(answer).toHaveAttribute("hidden");
    const handle = screen.getByRole("button", { name: items[0]!.question });
    expect(handle).toHaveAttribute("aria-controls", answer.id);
    fireEvent.click(handle);
    expect(answer).not.toHaveAttribute("hidden");
    fireEvent.click(handle);
    expect(answer).toHaveAttribute("hidden");
    expect(faqCss).not.toMatch(/max-height:\s*1600px/);
  });

  it("opens a direct answer and follows browser history without stale category filters", () => {
    window.history.replaceState(null, "", "/faq?q=technical-answer");
    render(<FaqHearth items={items} />);
    expect(screen.getByRole("button", { name: items[0]!.question })).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "несъществуващо" } });
    act(() => {
      window.history.replaceState(null, "", "/faq?q=account-answer");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: items[1]!.question })).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores malformed stored feedback", () => {
    localStorage.setItem("faq-feedback", JSON.stringify(["up"]));
    render(<FaqHearth items={items} />);
    fireEvent.click(screen.getByRole("button", { name: items[0]!.question }));
    expect(screen.getByRole("button", { name: "Да, помогна" })).toHaveAttribute("aria-pressed", "false");
  });
});
