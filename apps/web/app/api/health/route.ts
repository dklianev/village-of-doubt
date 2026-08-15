export function GET() {
  return Response.json(
    {
      ok: true,
      service: "werewolf-web",
      kind: "liveness",
      environment: process.env.NODE_ENV ?? "development",
      release: process.env.RELEASE_VERSION?.trim() || "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
