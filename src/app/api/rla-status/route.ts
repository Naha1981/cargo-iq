// GET /api/rla-status - List RLA statuses for an org
// POST /api/rla-status - Add/update an RLA status
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "bad_request", message: "orgId query parameter required" }, { status: 400 });
    }

    const rlaStatuses = await db.rlaStatus.findMany({
      where: { orgId },
      orderBy: { importerName: "asc" },
    });

    // Flag any suspended RLA statuses
    const alerts = rlaStatuses.filter(r => r.rlaStatus === "suspended" || r.rlaStatus === "inactive");

    return NextResponse.json({ rlaStatuses, alertCount: alerts.length });
  } catch (error) {
    console.error("Error listing RLA statuses:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list RLA statuses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, importerCode, importerName, rlaStatus } = body;

    if (!orgId || !importerCode) {
      return NextResponse.json({ error: "bad_request", message: "orgId and importerCode are required" }, { status: 400 });
    }

    const rla = await db.rlaStatus.upsert({
      where: { orgId_importerCode: { orgId, importerCode } },
      update: { importerName, rlaStatus, lastCheckedAt: new Date() },
      create: { orgId, importerCode, importerName, rlaStatus, lastCheckedAt: new Date() },
    });

    // If status is suspended/inactive, set alert flag
    if (rlaStatus === "suspended" || rlaStatus === "inactive") {
      await db.rlaStatus.update({
        where: { id: rla.id },
        data: { alertSent: true, suspendedSince: rlaStatus === "suspended" ? new Date() : undefined },
      });
    }

    return NextResponse.json({ rlaStatus: rla });
  } catch (error) {
    console.error("Error creating/updating RLA status:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to create/update RLA status" }, { status: 500 });
  }
}
