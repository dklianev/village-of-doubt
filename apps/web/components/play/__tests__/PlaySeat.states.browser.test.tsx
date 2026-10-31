import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PublicPlayer } from "@/lib/play/types";

const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve("vitest/package.json"))("lightningcss");
const css = ["play/PlaySeat", "ProfilePortrait"].map(name => {
  const filename = resolve(process.cwd(), `components/${name}.module.css`);
  const compiled = transform({ filename, code: readFileSync(filename), cssModules: true });
  vi.doMock(filename, () => ({ default: Object.fromEntries(
    Object.entries(compiled.exports as Record<string, { name: string }>).map(([key, value]) => [key, value.name]),
  ) }));
  return compiled.code.toString();
}).join("\n");
const tokens = readFileSync(resolve(process.cwd(), "../../packages/ui/src/tokens.css"), "utf8");
const { PlaySeat } = await import("@/components/play/PlaySeat");

type Case = { targetable?: boolean; selected?: boolean; speaking?: boolean; voted?: boolean; leader?: boolean; own?: boolean };
const CASES: Record<string, Case> = {
  base: {},
  voted: { voted: true },
  speaking: { speaking: true },
  speakingVoted: { speaking: true, voted: true },
  targetable: { targetable: true },
  targetableSpeaking: { targetable: true, speaking: true },
  leader: { leader: true },
  leaderTargetable: { leader: true, targetable: true },
  selected: { selected: true, targetable: true },
  selectedLeaderVoted: { selected: true, targetable: true, leader: true, voted: true },
  own: { own: true },
};

function seatMarkup(name: string, state: Case) {
  const player: PublicPlayer = {
    userId: `synthetic-${name}`, displayName: "Искра", avatarId: "portrait-f01",
    connected: true, ready: true, playing: true, alive: true, host: false, narrator: false,
    acceptedFullNarrator: false, mayor: false, hasVoted: Boolean(state.voted), actedThisPhase: false, revealedRole: "",
  };
  const { container } = render(
    <div data-case={name} data-vote-leader={state.leader ? "true" : undefined} style={{ width: 120 }}>
      <PlaySeat player={player} own={Boolean(state.own)} phase="voting" narratorMode="automatic"
        targetable={Boolean(state.targetable)} selected={Boolean(state.selected)} secondSelected={false}
        voteCount={state.leader ? 3 : 0} speaking={Boolean(state.speaking)} defending={false} nominee={false}
        canManageNarrator={false} canManageMayor={false} menuId={`menu-${name}`} menuOpen={false}
        menuTriggerRef={() => {}} onMenuToggle={() => {}} onMenuActionComplete={() => {}} onSelect={() => {}}
        onMakeNarrator={() => {}} onMakeMayor={() => {}} />
    </div>,
  );
  const html = container.innerHTML;
  cleanup();
  return html;
}

let browser: Awaited<ReturnType<typeof chromium.launch>>;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });
afterEach(() => { cleanup(); });

async function readSeatLayers(theme: "dark" | "light") {
  const page = await browser.newPage();
  try {
    const markup = Object.entries(CASES).map(([name, state]) => seatMarkup(name, state)).join("");
    await page.setContent(`<html data-theme="${theme}"><head><style>${tokens}\n${css}</style></head><body>${markup}</body></html>`);
    return await page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>("[data-case]")].map((root) => {
      const portrait = root.querySelector("[data-seat-portrait]")!;
      const ring = getComputedStyle(portrait, "::before");
      const plate = root.querySelector("[data-seat-own]")?.getBoundingClientRect();
      return [root.dataset.case!, {
        ring: ring.boxShadow,
        breath: ring.animationDuration,
        stain: getComputedStyle(portrait, "::after").backgroundImage !== "none",
        seal: getComputedStyle(root.querySelector("[data-seat-name]")!, "::after").content !== "none",
        plate: Boolean(plate && plate.width > 0 && plate.height > 0),
      }];
    })));
  } finally {
    await page.close();
  }
}

describe("seat state layers in a real browser", () => {
  it.each(["dark", "light"] as const)("compose in one priority order in the %s theme", async (theme) => {
    const seats = await readSeatLayers(theme);

    expect(seats.base!.ring).toBe("none");
    expect(seats.voted!.ring, "a cast vote adds a seal, not a ring").toBe("none");
    expect(seats.speaking!.ring).not.toBe("none");
    expect(seats.speakingVoted!.ring).toBe(seats.speaking!.ring);
    expect(seats.targetable!.ring).not.toBe(seats.speaking!.ring);
    expect(seats.targetableSpeaking!.ring, "targetable outranks speaking").toBe(seats.targetable!.ring);
    expect(seats.leaderTargetable!.ring, "leading outranks targetable").toBe(seats.leader!.ring);
    expect(seats.leader!.ring).not.toBe(seats.targetable!.ring);
    expect(seats.selectedLeaderVoted!.ring, "selected outranks leading").toBe(seats.selected!.ring);
    expect(seats.selected!.ring).not.toBe(seats.leader!.ring);

    expect(seats.targetable!.breath, "only a plain targetable ring breathes").not.toBe("0s");
    expect([seats.leaderTargetable!.breath, seats.selected!.breath, seats.speaking!.breath]).toEqual(["0s", "0s", "0s"]);

    expect(Object.entries(seats).filter(([, seat]) => seat.stain).map(([name]) => name))
      .toEqual(["leader", "leaderTargetable", "selectedLeaderVoted"]);
    expect(Object.entries(seats).filter(([, seat]) => seat.seal).map(([name]) => name))
      .toEqual(["voted", "speakingVoted", "selectedLeaderVoted"]);
    expect(Object.entries(seats).filter(([, seat]) => seat.plate).map(([name]) => name)).toEqual(["own"]);
  });
});
