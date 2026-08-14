import { render, screen } from "@testing-library/react";
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
  },
] as const satisfies readonly ModeChoiceGame[];

describe("ModeChoiceCards", () => {
  beforeEach(() => {
    useSession.mockReset();
  });

  it("пази неутрално и работещо действие, докато клиентската сесия се зарежда", () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    render(<ModeChoiceCards games={games} initialSession={null} />);

    const link = screen.getByRole("link", { name: "Играй" });
    expect(link).toHaveAttribute("href", "/werewolf/create");
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Влез и играй")).not.toBeInTheDocument();
  });

  it("изпраща госта през вход след приключило зареждане", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    render(<ModeChoiceCards games={games} initialSession={null} />);

    expect(screen.getByRole("link", { name: "Влез и играй" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Fwerewolf%2Fcreate",
    );
  });

  it("прави първото игрово изображение discoverable, без да блокира main thread при decode", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    const { container } = render(<ModeChoiceCards games={games} initialSession={null} />);
    const image = container.querySelector(".game-choice-art img");
    const mobileSource = container.querySelector('.game-choice-art source[media="(max-width: 767px)"]');

    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("decoding", "async");
    expect(mobileSource).toHaveAttribute("srcset", "/game-art/mobile/bg-lobby-tavern.webp");
  });

  it("не prefetch-ва шест тежки route дървета от първия екран", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    render(<ModeChoiceCards games={games} initialSession={null} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });
});
