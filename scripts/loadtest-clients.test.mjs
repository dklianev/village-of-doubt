import test from "node:test";
import assert from "node:assert/strict";
import { findHostClient } from "./loadtest-clients.mjs";

test("findHostClient selects the public host regardless of join completion order", () => {
  const lateHost = {
    userId: "host",
    room: {
      state: {
        players: new Map([
          ["guest-session", { userId: "guest", host: false }],
          ["host-session", { userId: "host", host: true }],
        ]),
      },
    },
  };
  const earlyGuest = {
    userId: "guest",
    room: lateHost.room,
  };

  assert.equal(findHostClient([earlyGuest, lateHost]), lateHost);
});
