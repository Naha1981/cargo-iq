// GET /api/cargowise/executions - Execution history with filtering and pagination
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const { searchParams } = new URL(request.url);

    // Filters
    const shipmentId = searchParams.get("shipmentId");
    const status = searchParams.get("status");
    const executionType = searchParams.get("executionType");

    // Pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause with orgId scoping
    const where: Record<string, unknown> = { orgId };

    if (shipmentId) where.shipmentId = shipmentId;
    if (status) where.status = status;
    if (executionType) where.executionType = executionType;

    const [executions, total] = await Promise.all([
      db.cwExecution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          shipment: {
            select: {
              reference: true,
              shipperName: true,
              status: true,
            },
          },
        },
      }),
      db.cwExecution.count({ where }),
    ]);

    const hasMore = offset + limit < total;

    return NextResponse.json({
      items: executions.map((e) => ({
        id: e.id,
        orgId: e.orgId,
        shipmentId: e.shipmentId,
        shipmentReference: e.shipment?.reference || null,
        executionType: e.executionType,
        status: e.status,
        durationMs: e.durationMs,
        screenshotUrl: e.screenshotUrl,
        errorMessage: e.errorMessage,
        startedAt: e.startedAt?.toISOString() || null,
        completedAt: e.completedAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
      hasMore,
    });
  } catch (error) {
    console.error("Error listing CW executions:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to list executions" },
      { status: 500 }
    );
  }
}
