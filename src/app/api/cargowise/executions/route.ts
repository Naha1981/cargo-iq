// CargoIQ — CargoWise Execution History API
// GET /api/cargowise/executions
// Lists CW execution history with filtering.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const shipmentId = searchParams.get("shipmentId");
    const status = searchParams.get("status"); // queued | running | success | failed
    const executionType = searchParams.get("executionType"); // eadaptor_xml | playwright
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Record<string, unknown> = {};
    if (orgId) where.orgId = orgId;
    if (shipmentId) where.shipmentId = shipmentId;
    if (status) where.status = status;
    if (executionType) where.executionType = executionType;

    const [executions, total] = await Promise.all([
      db.cwExecution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          shipment: {
            select: {
              id: true,
              reference: true,
              shipperName: true,
              consigneeName: true,
              originPort: true,
              destinationPort: true,
              status: true,
            },
          },
        },
      }),
      db.cwExecution.count({ where }),
    ]);

    // Format executions for response
    const formatted = executions.map((exec) => ({
      id: exec.id,
      orgId: exec.orgId,
      shipmentId: exec.shipmentId,
      executionType: exec.executionType,
      status: exec.status,
      durationMs: exec.durationMs,
      screenshotUrl: exec.screenshotUrl,
      errorMessage: exec.errorMessage,
      startedAt: exec.startedAt?.toISOString() ?? null,
      completedAt: exec.completedAt?.toISOString() ?? null,
      createdAt: exec.createdAt.toISOString(),
      shipment: exec.shipment,
    }));

    return NextResponse.json({
      executions: formatted,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to list executions",
      },
      { status: 500 }
    );
  }
}
