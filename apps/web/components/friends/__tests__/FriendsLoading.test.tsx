import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import FriendsLoading from "@/app/friends/loading";

test("loading uses the guestbook identity without claims about reservations", () => {
  render(<FriendsLoading />);
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Познати на масата");
  expect(screen.getByRole("status")).toHaveTextContent("Зареждаме гостовата книга");
  expect(screen.queryByText(/запазени места/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
