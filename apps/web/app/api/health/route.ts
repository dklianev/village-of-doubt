export function GET() {
  return Response.json({
    ok: true,
    service: "werewolf-web",
    time: new Date().toISOString(),
  });
}
