import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NarratorSnapshotPanel } from "../NarratorSnapshotPanel";

describe("NarratorSnapshotPanel", () => {
  it("explains who can see the roles without describing event transport", () => {
    render(<NarratorSnapshotPanel snapshot={{ roles: [{ userId: "anna", displayName: "Анна", role: "seer", roleNameBg: "Гадателка" }] }} />);
    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByText("Гадателка")).toBeInTheDocument();
    expect(screen.getByText("Само ти виждаш тези роли. Пази ги в тайна от играчите.")).toBeInTheDocument();
    expect(screen.queryByText(/лично събитие/u)).not.toBeInTheDocument();
  });
});
