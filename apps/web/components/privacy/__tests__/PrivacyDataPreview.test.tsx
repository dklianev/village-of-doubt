import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyDataPreview } from "../PrivacyDataPreview";
import type { PrivacyUserSnapshot } from "../PrivacyDashboard";

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/components/account/account-export", () => ({ downloadCompleteAccountExport: download }));

const snapshot: PrivacyUserSnapshot = {
  name: "Тестов играч", email: "synthetic@example.test", emailVerified: true,
  memberSince: new Date("2026-03-10T10:00:00.000Z"), totalGames: 537, totalAchievements: 3,
  achievementTotal: 20, providersUsed: 1,
};
function row(label: string) {
  return within(screen.getByText(label).closest(".privacy-data-row") as HTMLElement);
}

describe("privacy data summary", () => {
  beforeEach(() => download.mockReset());

  it("labels the preview as a summary and preserves full counts", () => {
    render(<PrivacyDataPreview snapshot={snapshot} />);
    expect(screen.getByRole("heading", { name: "Обобщение на твоите данни." })).toBeVisible();
    expect(row("Завършени игри").getByText("537 игри")).toBeVisible();
    expect(row("Легенди").getByText("3 от 20 отключени")).toBeVisible();
    expect(row("Свързани начини за вход").getByText("1")).toBeVisible();
    expect(screen.queryByText(/целият списък|нищо скрито/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Не виждаме твоя IP адрес/)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders successful zeroes as empty, not as a loading failure", () => {
    render(<PrivacyDataPreview snapshot={{ ...snapshot, totalGames: 0, totalAchievements: 0, providersUsed: 0 }} />);
    expect(row("Завършени игри").getByText("още няма")).toBeVisible();
    expect(row("Легенди").getByText("0 от 20 отключени")).toBeVisible();
    expect(row("Свързани начини за вход").getByText("0")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    ["totalGames", "Завършени игри"], ["totalAchievements", "Легенди"], ["providersUsed", "Свързани начини за вход"],
  ] as const)("shows %s as unavailable independently", (key, label) => {
    render(<PrivacyDataPreview snapshot={{ ...snapshot, [key]: null }} />);
    expect(row(label).getByText("Временно недостъпни")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Това не означава, че липсват.");
    expect(screen.queryByText("още няма")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Изтегли моите данни/ })).toBeEnabled();
  });

  it.each([null, new Date("invalid")])("handles a missing or invalid membership date: %s", (memberSince) => {
    render(<PrivacyDataPreview snapshot={{ ...snapshot, memberSince }} />);
    expect(row("Регистриран").getByText("Няма налична дата")).toBeVisible();
  });

  it.each([
    ["2026-03-10T10:00:00.000Z", "Pacific/Pago_Pago"],
    ["2026-03-09T22:30:00.000Z", "America/Los_Angeles"],
    ["2026-03-09T22:30:00.000Z", "Asia/Tokyo"],
  ])("hydrates the canonical membership date %s with a %s client timezone", async (memberSince, clientTimeZone) => {
    const DateTimeFormat = Intl.DateTimeFormat;
    let defaultTimeZone = "UTC";
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) {
      return new DateTimeFormat(locales, { timeZone: defaultTimeZone, ...options });
    });
    const preview = <PrivacyDataPreview snapshot={{ ...snapshot, memberSince: new Date(memberSince) }} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(preview);
    document.body.append(container);
    expect(container).toHaveTextContent("10 март 2026 г.");
    const serverMarkup = container.innerHTML;
    const onRecoverableError = vi.fn();

    defaultTimeZone = clientTimeZone;
    await act(async () => {
      render(preview, { container, hydrate: true, onRecoverableError });
    });

    expect(row("Регистриран").getByText("10 март 2026 г.")).toBeVisible();
    expect(container.innerHTML).toBe(serverMarkup);
    expect(onRecoverableError).not.toHaveBeenCalled();
  });

  it("uses the existing complete export helper, prevents repeat clicks, and exposes recoverable failure", async () => {
    const user = userEvent.setup();
    let rejectDownload!: (reason: Error) => void;
    download.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectDownload = reject; }));
    render(<PrivacyDataPreview snapshot={snapshot} />);
    await user.click(screen.getByRole("button", { name: /Изтегли моите данни/ }));
    expect(screen.getByRole("button", { name: /Подготвяме данните/ })).toBeDisabled();
    expect(download).toHaveBeenCalledTimes(1);
    await act(async () => rejectDownload(new Error("synthetic-export-error")));
    expect(screen.getByRole("alert")).toHaveTextContent("Не успяхме да подготвим данните.");
    download.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole("button", { name: /Изтегли моите данни/ }));
    expect(download).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
