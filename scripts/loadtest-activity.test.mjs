import test from "node:test";
import assert from "node:assert/strict";
import { runActiveHold } from "./loadtest-activity.mjs";

test("active load hold exercises commands and public chat when the phase allows it", async () => {
  let now = 0;
  const sent = [];
  const group = {
    code: "WOLF42",
    clients: [
      { room: { state: { phase: "role_reveal" }, send: (type, payload) => sent.push([type, payload]) } },
      { room: { state: { phase: "role_reveal" }, send: (type, payload) => sent.push([type, payload]) } },
    ],
  };

  const result = await runActiveHold({
    groups: [group],
    holdMs: 3_000,
    activityIntervalMs: 1_000,
    now: () => now,
    sleep: async (milliseconds) => {
      now += milliseconds;
      if (now >= 1_000) {
        for (const client of group.clients) client.room.state.phase = "day_discussion";
      }
    },
  });

  assert.ok(result.commandsSent >= 6);
  assert.deepEqual(result.phasesSeen.sort(), ["day_discussion", "role_reveal"]);
  assert.equal(sent.some(([type]) => type === "sendChat"), true);
  assert.equal(sent.filter(([type]) => type === "sendChat").length, 1);
});
