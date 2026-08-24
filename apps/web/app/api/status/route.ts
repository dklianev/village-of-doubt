import { connection, NextResponse } from "next/server";
import { loadStatusSnapshot } from "@/lib/status-health";

export async function GET() {
  await connection();
  const snapshot = await loadStatusSnapshot();

  return NextResponse.json({
    services: snapshot.services,
    lastCheckedAt: snapshot.lastCheckedAt,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
