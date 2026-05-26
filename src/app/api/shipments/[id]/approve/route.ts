// POST /api/shipments/[id]/approve - Approve a shipment for CargoWise
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const shipment = await db.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json(
        { error: "not_found", message: "Shipment not found" },
        { status: 404 }
      );
    }

    if (shipment.shieldStatus === "fail") {
      return NextResponse.json(
        { error: "compliance_blocked", message: "Cannot approve: Compliance Shield has FAIL status." },
        { status: 422 }
      );
    }

    if (shipment.shieldStatus === "hold" && !body.acknowledgeRisks) {
      return NextResponse.json(
        { error: "compliance_hold", message: "Compliance Shield has HOLD status. Acknowledge risks to proceed." },
        { status: 422 }
      );
    }

    await db.shipment.update({
      where: { id },
      data: { status: "approved", reviewedAt: new Date(), reviewNotes: body.notes || null },
    });

    await db.auditLog.create({
      data: {
        orgId: shipment.orgId, entityType: "shipment", entityId: id,
        action: "approved", actorType: "user",
        metadata: JSON.stringify({ acknowledgedRisks: body.acknowledgeRisks || false }),
      },
    });

    await db.cwExecution.create({
      data: { orgId: shipment.orgId, shipmentId: id, executionType: "eadaptor_xml", status: "queued" },
    });

    return NextResponse.json({ status: "approved", executionQueued: true });
  } catch (error) {
    console.error("Error approving shipment:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to approve" }, { status: 500 });
  }
}
