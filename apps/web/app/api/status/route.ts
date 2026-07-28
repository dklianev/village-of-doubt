import { NextResponse } from "next/server";
import { loadStatusSnapshot } from "@/lib/status-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await loadStatusSnapshot();

  return NextResponse.json({
    services: snapshot.services,
    lastCheckedAt: snapshot.lastCheckedAt,
  });
}
