import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: useSession,
}));

vi.mock("@/components/landing/LastFamilyPill", () => ({
  LastFamilyPill: () => null,
}));

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

const games = [
  {
    id: "werewolf",
    family: "werewolves",
    title: "Върколак",
    eyebrow: "фолклорен хорър",
    description: "Описание",
    line: "Ред",
    href: "/werewolf",
    recommendedPlayers: "6-30 играчи, най-добре 8-18.",
  },
] as const satisfies readonly ModeChoiceGame[];

describe("ModeChoiceCards", () => {
  beforeEach(() => {
    useSession.mockReset();
  });

  it("пази неутрално и работещо действие, докато клиентската сесия се зарежда", () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    render(<ModeChoiceCards games={games} initialSession={null} />);

    const link = screen.getByRole("link", { name: "Създай стая" });
    expect(link).toHaveAttribute("href", "/werewolf/create");
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Влез и играй")).not.toBeInTheDocument();
  });

  it("изпраща госта през вход след приключило зареждане", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    render(<ModeChoiceCards games={games} initialSession={null} />);

    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Fwerewolf%2Fcreate",
    );
  });

  it("offers invited players a direct join path without sending them through room creation", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    render(<ModeChoiceCards games={games} initialSession={null} />);
    expect(screen.getByRole("link", { name: "Имам код" })).toHaveAttribute("href", "/werewolf/join");
  });

  it("keeps the protected create destination when the session check fails", () => {
    useSession.mockReturnValue({ data: null, isPending: false, isError: true });
    render(<ModeChoiceCards games={games} initialSession={null} />);
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/werewolf/create");
    expect(screen.getByRole("link", { name: "Създай стая" })).not.toHaveAttribute("aria-busy");
  });

  it("gives hosts practical group-size guidance before choosing a game", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    render(<ModeChoiceCards games={games} initialSession={null} />);
    expect(screen.getByText(games[0].recommendedPlayers)).toBeVisible();
  });

  it("keeps an authenticated host on the direct creation path during session refresh", () => {
    const session = { user: { id: "homepage-test-host", name: "Тестов домакин" } };
    useSession.mockReturnValue({ data: null, isPending: true });
    render(<ModeChoiceCards games={games} initialSession={session} />);
    const create = screen.getByRole("link", { name: "Създай стая" });
    expect(create).toHaveAttribute("href", "/werewolf/create");
    expect(create).not.toHaveAttribute("aria-busy");
  });

  it.each([
    { game: games[0], version: "v7", fetchPriority: "high" },
    {
      game: { ...games[0], id: "mafia", family: "mafia", title: "Мафия", href: "/mafia" },
      version: "v5",
      fetchPriority: "low",
    },
  ] as const)("uses the full $game.id master for every responsive candidate without eagerly fetching the hidden theme", async ({ game, version, fetchPriority }) => {
    useSession.mockReturnValue({ data: null, isPending: false });

    const { container } = render(<ModeChoiceCards games={[game]} initialSession={null} />);
    for (const theme of ["dark", "light"]) {
      const picture = container.querySelector(`.game-choice-art--${theme}`);
      const image = picture?.querySelector("img");
      const metadata = await sharp(resolve(process.cwd(), `public/game-art/homepage/choice-${game.id}-${theme}-${version}.webp`)).metadata();
      expect(metadata).toMatchObject({ width: 1536, height: game.id === "mafia" ? 1022 : 1024 });
      expect(image).toHaveAttribute("width", String(metadata.width));
      expect(image).toHaveAttribute("height", String(metadata.height));
      expect(image).toHaveAttribute("fetchpriority", fetchPriority);
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
      for (const element of picture!.querySelectorAll("img, source")) {
        const candidates = element.getAttribute("srcset")!.split(", ");
        expect(candidates.length).toBeGreaterThan(2);
        for (const candidate of candidates) {
          const [url, descriptor] = candidate.split(" ");
          expect(new URL(url!, "http://localhost").searchParams.get("url")).toBe(`/game-art/homepage/choice-${game.id}-${theme}-${version}.webp`);
          expect(descriptor).toMatch(/^\d+w$/);
        }
        expect(element).toHaveAttribute("sizes");
      }
      expect(image).toHaveAttribute("alt", "");
      expect(picture).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("не prefetch-ва шест тежки route дървета от първия екран", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    render(<ModeChoiceCards games={games} initialSession={null} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });
});
