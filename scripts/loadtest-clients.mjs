export function findHostClient(clients) {
  return clients.find(({ room, userId }) => Array.from(room.state?.players?.values?.() ?? [])
    .some((player) => player.userId === userId && player.host === true));
}
