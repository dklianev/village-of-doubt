/** Replaces room codes and game ids in an app pathname so monitoring and telemetry never carry an invite. */
export function normalizePrivateRoute(pathname: string) {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized
    .replace(/^(\/(?:(?:mafia|werewolf)\/)?(?:play|lobby|join))\/[^/]+$/, "$1/[code]")
    .replace(/^(\/(?:api\/)?rooms)\/[^/]+\/preview$/, "$1/[code]/preview")
    .replace(/^\/history\/[^/]+\/replay$/, "/history/[gameId]/replay");
}
