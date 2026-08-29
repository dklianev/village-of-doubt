export async function runActiveHold({
  groups,
  holdMs,
  activityIntervalMs,
  now = Date.now,
  sleep = delay,
}) {
  const startedAt = now();
  const phasesSeen = new Set();
  const chatSentForRoom = new Set();
  let commandsSent = 0;
  let active = false;

  while (now() - startedAt < holdMs) {
    active = !active;
    for (const group of groups) {
      const phase = group.clients[0]?.room.state?.phase;
      if (typeof phase === "string") phasesSeen.add(phase);

      for (const client of group.clients) {
        client.room.send("typing", { channel: "public", active });
        commandsSent += 1;
      }

      if (phase === "day_discussion" && !chatSentForRoom.has(group.code)) {
        group.clients[0]?.room.send("sendChat", {
          channel: "public",
          message: "Натоварващ тест: дневният чат работи.",
        });
        chatSentForRoom.add(group.code);
        commandsSent += 1;
      }
    }

    const remainingMs = holdMs - (now() - startedAt);
    if (remainingMs > 0) {
      await sleep(Math.min(activityIntervalMs, remainingMs));
    }
  }

  return {
    commandsSent,
    phasesSeen: [...phasesSeen],
    roomsWithPublicChat: chatSentForRoom.size,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
