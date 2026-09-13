import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Room } from "@colyseus/sdk";
import type { GamePhase } from "@werewolf/shared";
import { useActionReceipt } from "@/hooks/play/use-action-receipt";

function transport(roomId?: string) {
  const callbacks = new Map<string, (message: unknown) => void>();
  const unsubscribe = vi.fn();
  return {
    callbacks, unsubscribe,
    room: { roomId, onMessage: (name: string, callback: (message: unknown) => void) => {
      callbacks.set(name, callback);
      return unsubscribe;
    } } as unknown as Room,
  };
}

describe("useActionReceipt", () => {
  it.each([
    ["night_action_ack", "night", { kind: "night" }],
    ["vote_ack", "voting", { kind: "vote", targetUserId: "u2" }],
  ] as const)("retains an already received %s across replacement transports for the same room and viewer", (event, phase, expected) => {
    const first = transport("physical-room-1");
    const second = transport("physical-room-1");
    const { result, rerender } = renderHook(({ room }) => useActionReceipt(room, phase, 2, {
      viewerId: "viewer-1", votingCycle: 2,
    }), { initialProps: { room: first.room } });
    const ack = { phase, round: 2, votingCycle: 2, targetUserId: "u2" };
    act(() => first.callbacks.get(event)?.(ack));
    expect(result.current).toEqual(expected);

    rerender({ room: second.room });

    expect(result.current).toEqual(expected);
    expect(first.unsubscribe).toHaveBeenCalledTimes(4);
    act(() => first.callbacks.get(event)?.({ ...ack, targetUserId: "stale-target" }));
    expect(result.current).toEqual(expected);
    act(() => second.callbacks.get(event)?.({ ...ack, targetUserId: "u3" }));
    expect(result.current).toEqual(phase === "night" ? { kind: "night" } : { kind: "vote", targetUserId: "u3" });
  });

  it.each([
    ["different room", "physical-room-1", "physical-room-2", "viewer-1", "viewer-1"],
    ["different viewer", "physical-room-1", "physical-room-1", "viewer-1", "viewer-2"],
    ["missing viewer", "physical-room-1", "physical-room-1", undefined, undefined],
    ["removed viewer", "physical-room-1", "physical-room-1", "viewer-1", undefined],
    ["newly supplied viewer", "physical-room-1", "physical-room-1", undefined, "viewer-1"],
    ["empty viewer", "physical-room-1", "physical-room-1", "", ""],
    ["missing room IDs", undefined, undefined, "viewer-1", "viewer-1"],
    ["empty room IDs", "", "", "viewer-1", "viewer-1"],
  ])("clears a receipt when the replacement has %s", (_reason, firstRoomId, secondRoomId, firstViewer, secondViewer) => {
    const first = transport(firstRoomId);
    const second = transport(secondRoomId);
    const { result, rerender } = renderHook(({ room, viewerId }) => useActionReceipt(room, "night", 2, { viewerId }), {
      initialProps: { room: first.room, viewerId: firstViewer },
    });
    act(() => first.callbacks.get("night_action_ack")?.({ phase: "night", round: 2 }));
    expect(result.current).toEqual({ kind: "night" });

    rerender({ room: second.room, viewerId: secondViewer });
    act(() => first.callbacks.get("night_action_ack")?.({ phase: "night", round: 2 }));

    expect(result.current).toBeNull();
  });

  it.each([
    ["phase", { phase: "night" as GamePhase }],
    ["round", { round: 3 }],
    ["voting cycle", { votingCycle: 3 }],
    ["voted marker", { hasVoted: false }],
    ["revote candidates", { eligible: ["u2", "u3"] }],
  ])("still clears on a changed %s while reconnecting to the same room and viewer", (_reason, change) => {
    const first = transport("physical-room-1");
    const second = transport("physical-room-1");
    const initialProps = {
      room: first.room, phase: "voting" as GamePhase, round: 2,
      votingCycle: 2, hasVoted: true, eligible: [] as string[],
    };
    const { result, rerender } = renderHook(({ room, phase, round, votingCycle, hasVoted, eligible }) =>
      useActionReceipt(room, phase, round, {
        viewerId: "viewer-1", votingCycle, hasVoted, revoteEligibleUserIds: eligible,
      }), { initialProps });
    act(() => first.callbacks.get("vote_ack")?.({ phase: "voting", round: 2, votingCycle: 2, targetUserId: "u2" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u2" });

    rerender({ ...initialProps, ...change, room: second.room });

    expect(result.current).toBeNull();
  });

  it("clears on a viewer change even when the Room instance stays the same", () => {
    const { room, callbacks } = transport("physical-room-1");
    const { result, rerender } = renderHook(({ viewerId }) => useActionReceipt(room, "night", 2, { viewerId }), {
      initialProps: { viewerId: "viewer-1" },
    });
    const oldAck = callbacks.get("night_action_ack");
    act(() => oldAck?.({ phase: "night", round: 2 }));

    rerender({ viewerId: "viewer-2" });
    act(() => oldAck?.({ phase: "night", round: 2 }));

    expect(result.current).toBeNull();
  });

  it("clears on a null room and does not restore the receipt when that room returns", () => {
    const { room, callbacks } = transport("physical-room-1");
    const { result, rerender } = renderHook(({ room }) => useActionReceipt(room, "night", 2, { viewerId: "viewer-1" }), {
      initialProps: { room: room as Room | null },
    });
    const oldAck = callbacks.get("night_action_ack");
    act(() => oldAck?.({ phase: "night", round: 2 }));

    rerender({ room: null });
    expect(result.current).toBeNull();
    act(() => oldAck?.({ phase: "night", round: 2 }));
    rerender({ room });

    expect(result.current).toBeNull();
  });

  it("does not fabricate a receipt when reconnecting before any acknowledgement arrived", () => {
    const first = transport("physical-room-1");
    const second = transport("physical-room-1");
    const { result, rerender } = renderHook(({ room }) => useActionReceipt(room, "night", 2, { viewerId: "viewer-1" }), {
      initialProps: { room: first.room },
    });
    expect(result.current).toBeNull();

    rerender({ room: second.room });
    act(() => first.callbacks.get("night_action_ack")?.({ phase: "night", round: 2 }));

    expect(result.current).toBeNull();
    act(() => second.callbacks.get("night_action_ack")?.({ phase: "night", round: 2 }));
    expect(result.current).toEqual({ kind: "night" });
  });

  it("shows only a server-acknowledged target, not the local selection", () => {
    const { room, callbacks } = transport();
    const { result } = renderHook(() => useActionReceipt(room, "voting", 2));
    expect(result.current).toBeNull();
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, targetUserId: "u2" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u2" });
  });

  it("never invents a target for the targetless night receipt", () => {
    const { room, callbacks } = transport();
    const { result } = renderHook(() => useActionReceipt(room, "night", 2));
    act(() => callbacks.get("night_action_ack")?.({ phase: "night", round: 2 }));
    expect(result.current).toEqual({ kind: "night" });
  });

  it("ignores stale and malformed acknowledgements", () => {
    const { room, callbacks } = transport();
    const { result } = renderHook(() => useActionReceipt(room, "voting", 2));
    act(() => {
      callbacks.get("vote_ack")?.({ phase: "voting", round: 1, targetUserId: "u1" });
      callbacks.get("vote_ack")?.({ phase: "voting", round: 2 });
      callbacks.get("vote_ack")?.(null);
    });
    expect(result.current).toBeNull();
  });

  it.each([
    ["vote_ack", "night"],
    ["vote_ack", "paused"],
    ["night_action_ack", "voting"],
    ["nomination_ack", "nomination"],
    ["nomination_ack", "night"],
    ["hunter_revenge_ack", "day_discussion"],
  ] as const)("rejects %s in unrelated phase %s even when its payload matches", (event, phase) => {
    const { room, callbacks } = transport();
    const { result } = renderHook(() => useActionReceipt(room, phase, 2));

    act(() => callbacks.get(event)?.({ phase, round: 2, targetUserId: "u2" }));

    expect(result.current).toBeNull();
  });

  it.each([
    ["night_action_ack", "first_night", { kind: "night" }],
    ["nomination_ack", "day_discussion", { kind: "nomination", targetUserId: "u2" }],
    ["hunter_revenge_ack", "hunter_revenge", { kind: "revenge", targetUserId: "u2" }],
    ["vote_ack", "voting", { kind: "vote", targetUserId: "skip" }],
  ] as const)("accepts %s in its authoritative phase %s", (event, phase, expected) => {
    const { room, callbacks } = transport();
    const { result } = renderHook(() => useActionReceipt(room, phase, 2));

    act(() => callbacks.get(event)?.({ phase, round: 2, targetUserId: "targetUserId" in expected ? expected.targetUserId : undefined }));

    expect(result.current).toEqual(expected);
  });

  it("clears a vote for same-round revoting even if the voted snapshot was never observed", () => {
    const { room, callbacks } = transport();
    const { result, rerender } = renderHook(
      ({ eligible }) => useActionReceipt(room, "voting", 2, { hasVoted: false, revoteEligibleUserIds: eligible }),
      { initialProps: { eligible: [] as string[] } },
    );
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, targetUserId: "u2" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u2" });
    const previousCycleAck = callbacks.get("vote_ack");

    rerender({ eligible: ["u2", "u3"] });
    act(() => previousCycleAck?.({ phase: "voting", round: 2, targetUserId: "u2" }));

    expect(result.current).toBeNull();
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, targetUserId: "u3" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u3" });
  });

  it("clears on the authoritative voted reset when a repeated revote keeps the same candidates", () => {
    const { room, callbacks } = transport();
    const { result, rerender } = renderHook(
      ({ hasVoted }) => useActionReceipt(room, "voting", 2, { hasVoted, revoteEligibleUserIds: ["u2", "u3"] }),
      { initialProps: { hasVoted: true } },
    );
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, targetUserId: "u2" }));
    const previousCycleAck = callbacks.get("vote_ack");

    rerender({ hasVoted: false });
    act(() => previousCycleAck?.({ phase: "voting", round: 2, targetUserId: "u2" }));
    expect(result.current).toBeNull();

    rerender({ hasVoted: true });
    expect(result.current).toBeNull();
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, targetUserId: "u3" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u3" });
  });

  it("clears the final voter's receipt on a repeated tied ballot without observing hasVoted=true", () => {
    const { room, callbacks } = transport();
    const { result, rerender } = renderHook(
      ({ votingCycle }) => useActionReceipt(room, "voting", 2, {
        votingCycle, hasVoted: false, revoteEligibleUserIds: ["u2", "u3"],
      }),
      { initialProps: { votingCycle: 2 } },
    );
    const ack = { phase: "voting", round: 2, votingCycle: 2, targetUserId: "u2" };
    act(() => callbacks.get("vote_ack")?.(ack));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u2" });
    const previousCycleAck = callbacks.get("vote_ack");

    rerender({ votingCycle: 3 });
    expect(result.current).toBeNull();
    act(() => {
      previousCycleAck?.(ack);
      callbacks.get("vote_ack")?.(ack);
    });
    expect(result.current).toBeNull();

    act(() => callbacks.get("vote_ack")?.({ ...ack, votingCycle: 3, targetUserId: "u3" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u3" });
    act(() => callbacks.get("vote_ack")?.(ack));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u3" });
  });

  it.each([1, 3, undefined, "2"])("rejects an unscoped or mismatched vote acknowledgement (%s)", (votingCycle) => {
    const { room, callbacks } = transport();
    const { result } = renderHook(() => useActionReceipt(room, "voting", 2, { votingCycle: 2 }));

    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, votingCycle, targetUserId: "u2" }));

    expect(result.current).toBeNull();
  });

  it("retains a valid vote through snapshot acknowledgement, reordered candidates and timer extension", () => {
    const { room, callbacks } = transport();
    const { result, rerender } = renderHook(
      ({ hasVoted, eligible, votingCycle }) => useActionReceipt(room, "voting", 2, { hasVoted, revoteEligibleUserIds: eligible, votingCycle }),
      { initialProps: { hasVoted: false, eligible: ["u2", "u3"], phaseEndsAt: 1000, votingCycle: 2 } },
    );
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 2, votingCycle: 2, targetUserId: "u2" }));
    expect(result.current).toEqual({ kind: "vote", targetUserId: "u2" });

    rerender({ hasVoted: true, eligible: ["u3", "u2"], phaseEndsAt: 5000, votingCycle: 2 });

    expect(result.current).toEqual({ kind: "vote", targetUserId: "u2" });
  });

  it("clears on the next round and ignores callbacks from the disposed room", () => {
    const first = transport();
    const second = transport();
    const { result, rerender, unmount } = renderHook(({ room, round }) => useActionReceipt(room, "night", round), {
      initialProps: { room: first.room, round: 2 },
    });
    act(() => first.callbacks.get("night_action_ack")?.({ phase: "night", round: 2 }));
    rerender({ room: second.room, round: 3 });
    act(() => first.callbacks.get("night_action_ack")?.({ phase: "night", round: 3 }));
    expect(result.current).toBeNull();
    expect(first.unsubscribe).toHaveBeenCalledTimes(4);
    unmount();
    expect(second.unsubscribe).toHaveBeenCalledTimes(4);
  });
});
