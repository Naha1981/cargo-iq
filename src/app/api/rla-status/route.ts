// GET /api/rla-status - RLA status for the authenticated org
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const { searchParams } = new URL(request.url);

    // Optional filters
    const rlaStatus = searchParams.get("status");
    const importerCode = searchParams.get("importerCode");

    const where: Record<string, unknown> = { orgId };

    if (rlaStatus) where.rlaStatus = rlaStatus;
    if (importerCode) where.importerCode = importerCode;

    const statuses = await db.rlaStatus.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Summary stats
    const total = statuses.length;
    const active = statuses.filter((s) => s.rlaStatus === "active").length;
    const suspended = statuses.filter((s) => s.rlaStatus === "suspended").length;
    const inactive = statuses.filter((s) => s.rlaStatus === "inactive").length;
    const unverified = statuses.filter((s) => s.rlaStatus === "unverified").length;
    const alertsPending = statuses.filter((s) => s.alertSent && s.rlaStatus === "suspended").length;

    return NextResponse.json({
      items: statuses.map((s) => ({
        id: s.id,
        orgId: s.orgId,
        importerCode: s.importerCode,
        importerName: s.importerName,
        rlaStatus: s.rlaStatus,
        lastCheckedAt: s.lastCheckedAt?.toISOString() || null,
        suspendedSince: s.suspendedSince?.toISOString() || null,
        alertSent: s.alertSent,
        createdAt: s.createdAt.toISOString(),
      })),
      summary: {
        total,
        active,
        suspended,
        inactive,
        unverified,
        alertsPending,
      },
    });
  } catch (error) {
    console.error("Error getting RLA status:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get RLA status" },
      { status: 500 }
    );
  }
}
