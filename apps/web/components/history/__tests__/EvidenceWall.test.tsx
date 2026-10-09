import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { EvidenceWall } from "../EvidenceWall";

vi.mock("next/form", () => ({ default: ({ children, ...props }: { children: ReactNode }) => <form {...props}>{children}</form> }));

describe("EvidenceWall route states", () => {
  it("distinguishes an unavailable archive from an empty archive", () => {
    const { rerender } = render(<EvidenceWall games={[]} status="unavailable" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Архивът не отговори");
    expect(screen.queryByText("Първата нощ ще остави следа тук.")).not.toBeInTheDocument();

    rerender(<EvidenceWall games={[]} status="ready" />);

    expect(screen.getByText("Първата нощ ще остави следа тук.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes a filtered empty page and preserves independent URL filters", () => {
    render(<EvidenceWall games={[]} selection={{ family: "mafia", outcome: "village" }} />);
    expect(screen.getByLabelText("Игра")).toHaveValue("mafia");
    expect(screen.getByLabelText("Победител")).toHaveValue("village");
    expect(screen.getByRole("heading", { name: "Няма дела с тази развръзка" })).toBeInTheDocument();
    expect(screen.queryByText("Първата нощ ще остави следа тук.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Покажи всички дела" })).toHaveAttribute("href", "/history");
  });

  it("preserves filters and cursor when retrying an unavailable page", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    render(<EvidenceWall games={[]} status="unavailable" selection={{ family: "mafia", outcome: "village", before: id }} />);
    expect(screen.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", `/history?family=mafia&outcome=village&before=${id}`);
  });

  it("removes pretend loading cards and describes the tutorial honestly", () => {
    const { container } = render(<EvidenceWall games={[]} />);
    expect(container.querySelector(".case-file-ghost")).toBeNull();
    expect(screen.getByRole("link", { name: /Първи стъпки/ })).toHaveAttribute("href", "/tutorial");
    expect(screen.getByText(/Частните вечери/)).toBeInTheDocument();
    const action = screen.getByRole("link", { name: /Избери игра/ });
    const art = container.querySelector('img[alt=""]')!;
    expect(action.compareDocumentPosition(art) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
