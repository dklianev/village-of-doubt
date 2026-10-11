import { describe, expect, it } from "vitest";
import { tutorialDestination } from "../tutorial-destination";

describe("saved tutorial destination copy", () => {
  it.each([
    ["/mafia/create?mode=mafia_sport", { name: "Спортна Мафия", invitation: false }],
    ["/mafia/create?mode=mafia_free", { name: "Мафия", invitation: false }],
    ["/werewolf/create", { name: "Върколак", invitation: false }],
    ["/create", { name: null, invitation: false }],
    ["/account?redirect=/play/ABC123", { name: null, invitation: false }],
    ["/play/ABC123", { name: null, invitation: true }],
    ["/lobby/ABC123?from=friend", { name: null, invitation: true }],
  ])("recognizes %s without changing the destination", (href, destination) => {
    expect(tutorialDestination(href)).toEqual(destination);
  });
});
