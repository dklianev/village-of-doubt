import { NextResponse } from "next/server";
import { loadStatusServices } from "@/lib/status-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const services = await loadStatusServices();

  return NextResponse.json({
    services,
    lastCheckedAt: new Date().toISOString(),
  });
}
