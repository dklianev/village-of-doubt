import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayStage } from "@/components/play/PlayStage";
import type { PublicPlayer } from "@/lib/play/types";

const PRIVATE_CANARY = "PRIVATE-CANARY-ROLE-CAPABILITIES";
const PRIVATE_ROLE_NAME = "Ясновидка";
const PLAY_STAGE_CSS = readFileSync(resolve(process.cwd(), "components/play/PlayStage.module.css"), "utf8");

function ruleDeclarations(stylesheet: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

function publicPlayer(): PublicPlayer {
  return {
    userId: "viewer-1",
    displayName: "Искра",
    avatarId: "portrait-f01",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: false,
    mayor: false,
    hasVoted: false,
    actedThisPhase: true,
    revealedRole: "",
  };
}

describe("PlayStage private-data boundary", () => {
  it("projects public seat fields and drops injected private canaries", () => {
    const injectedPlayer = Object.assign(publicPlayer(), {
      role: "seer",
      roleNameBg: PRIVATE_ROLE_NAME,
      privateRole: PRIVATE_CANARY,
      privateResult: PRIVATE_CANARY,
      nightActionCapabilities: { canary: PRIVATE_CANARY },
    });

    const { container } = render(
      <PlayStage
        code="VISUAL"
        phase="night"
        mode="werewolves_classic"
        family="werewolves"
        round={2}
        phaseEndsAt={0}
        isPending={false}
        players={[injectedPlayer]}
        hasSnapshot
        narratorMode="automatic"
        communicationMode="integrated_chat"
        ownPlayer={injectedPlayer}
        targetableIds={new Set()}
        shortcutNumbers={new Map()}
        selectedTargetId=""
        secondTargetId=""
        voteCounts={new Map()}
        currentSpeakerUserId="viewer-1"
        currentDefenseUserId=""
        nomineeIds={new Set(["viewer-1"])}
        onSelectSeat={vi.fn()}
        onMakeNarrator={vi.fn()}
        onMakeMayor={vi.fn()}
      />,
    );

    const stage = screen.getByRole("region", { name: "Нощ" });
    expect(stage).toHaveTextContent("Искра");
    expect(stage).not.toHaveTextContent(PRIVATE_ROLE_NAME);
    expect(stage).not.toHaveTextContent(PRIVATE_CANARY);
    expect(stage.querySelector("[data-private-dossier]")).toBeNull();
    expect(stage.querySelector("[data-acted-this-phase]")).toBeNull();
    expect(container.innerHTML).not.toContain(PRIVATE_CANARY);
  });

  it("marks the stage ready after its first valid layout measurement", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(
      <PlayStage
        code="VISUAL"
        phase="night"
        mode="werewolves_classic"
        family="werewolves"
        round={2}
        phaseEndsAt={0}
        isPending={false}
        players={[publicPlayer()]}
        hasSnapshot
        narratorMode="automatic"
        communicationMode="integrated_chat"
        ownPlayer={publicPlayer()}
        targetableIds={new Set()}
        shortcutNumbers={new Map()}
        selectedTargetId=""
        secondTargetId=""
        voteCounts={new Map()}
        currentSpeakerUserId=""
        currentDefenseUserId=""
        nomineeIds={new Set()}
        onSelectSeat={vi.fn()}
        onMakeNarrator={vi.fn()}
        onMakeMayor={vi.fn()}
      />,
    );

    act(() => resizeCallback?.([], {} as ResizeObserver));

    expect(screen.getByRole("region", { name: "Нощ" })).toHaveAttribute("data-layout-ready", "true");
    vi.unstubAllGlobals();
  });
});

describe("PlayStage stylesheet accessibility contracts", () => {
  it("keeps every meaningful stage label at or above 0.68rem", () => {
    const fontSizes = [...PLAY_STAGE_CSS.matchAll(/font-size:\s*(?:clamp\(\s*)?([\d.]+)rem/g)].map((match) => Number(match[1]));

    expect(fontSizes.filter((size) => size < 0.68)).toEqual([]);
  });

  it("maintains a strong copy scrim over phase art in both themes", () => {
    const kickerRule = ruleDeclarations(PLAY_STAGE_CSS, ".kicker");
    const statusRule = ruleDeclarations(PLAY_STAGE_CSS, ".status");

    expect(PLAY_STAGE_CSS).toMatch(/:global\(html\[data-theme="dark"\]\) \.stage:global\(\.play-section\)\s*\{[^}]*background:/s);
    expect(PLAY_STAGE_CSS).toMatch(/:global\(html\[data-theme="light"\]\) \.stage:global\(\.play-section\)\s*\{[^}]*background:/s);
    expect(kickerRule).toContain("text-shadow: var(--play-stage-copy-shadow);");
    expect(statusRule).toContain("color: #fff7df;");
    expect(statusRule).toContain("text-shadow: var(--play-stage-copy-shadow);");
  });

  it("promotes only clipped animated night layers without a reduced-motion override", () => {
    expect(PLAY_STAGE_CSS).toMatch(
      /\.stage\[data-night="true"\] \.atmosphereBack::before,\s*\.stage\[data-night="true"\] \.atmosphereFront::before\s*\{[^}]*will-change:\s*opacity, transform;/s,
    );
    expect(PLAY_STAGE_CSS).toMatch(
      /\.atmosphereBack,\s*\.atmosphereFront\s*\{[^}]*overflow:\s*hidden;/s,
    );
    expect(ruleDeclarations(PLAY_STAGE_CSS, ".atmosphereBack")).not.toContain("will-change");
    expect(ruleDeclarations(PLAY_STAGE_CSS, ".skeletonPortrait")).toContain("will-change: opacity, transform;");
    expect(PLAY_STAGE_CSS).not.toContain("prefers-reduced-motion");
  });
});
