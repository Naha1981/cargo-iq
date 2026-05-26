// POST /api/shipments/[id]/reject - Reject a shipment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.reason || body.reason.length < 3) {
      return NextResponse.json(
        { error: "bad_request", message: "Rejection reason required (min 3 characters)" },
        { status: 400 }
      );
    }

    const shipment = await db.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json({ error: "not_found", message: "Shipment not found" }, { status: 404 });
    }

    await db.shipment.update({
      where: { id },
      data: { status: "rejected", reviewedAt: new Date(), reviewNotes: body.reason },
    });

    await db.auditLog.create({
      data: {
        orgId: shipment.orgId, entityType: "shipment", entityId: id,
        action: "rejected", actorType: "user",
        metadata: JSON.stringify({ reason: body.reason }),
      },
    });

    return NextResponse.json({ status: "rejected" });
  } catch (error) {
    console.error("Error rejecting shipment:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to reject" }, { status: 500 });
  }
}
