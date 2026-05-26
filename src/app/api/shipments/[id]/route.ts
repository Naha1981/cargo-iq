// GET /api/shipments/[id] - Get shipment detail
// PATCH /api/shipments/[id] - Update shipment fields
// POST /api/shipments/[id]/approve - Approve shipment
// POST /api/shipments/[id]/reject - Reject shipment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipment = await db.shipment.findUnique({
      where: { id },
      include: {
        shipmentDocuments: { include: { document: true } },
        lineItems: { orderBy: { lineNumber: "asc" } },
        complianceEvents: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "not_found", message: "Shipment not found" },
        { status: 404 }
      );
    }

    const detail = {
      ...shipment,
      extractedFields: JSON.parse(shipment.extractedFields || "{}"),
      confidenceScores: JSON.parse(shipment.confidenceScores || "{}"),
      shieldResults: JSON.parse(shipment.shieldResults || "{}"),
      lineItems: shipment.lineItems.map((li) => ({
        ...li,
        quantity: li.quantity ? Number(li.quantity) : null,
        unitWeight: li.unitWeight ? Number(li.unitWeight) : null,
        totalWeight: li.totalWeight ? Number(li.totalWeight) : null,
        unitValue: li.unitValue ? Number(li.unitValue) : null,
        totalValue: li.totalValue ? Number(li.totalValue) : null,
      })),
      documents: shipment.shipmentDocuments.map((sd) => ({
        ...sd.document,
      })),
      grossWeight: shipment.grossWeight ? Number(shipment.grossWeight) : null,
      netWeight: shipment.netWeight ? Number(shipment.netWeight) : null,
      invoiceValue: shipment.invoiceValue ? Number(shipment.invoiceValue) : null,
      numberOfPackages: shipment.numberOfPackages,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      eta: shipment.eta ? shipment.eta.toISOString() : null,
      etd: shipment.etd ? shipment.etd.toISOString() : null,
      reviewedAt: shipment.reviewedAt ? shipment.reviewedAt.toISOString() : null,
    };

    return NextResponse.json(detail);
  } catch (error) {
    console.error("Error getting shipment:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get shipment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      "shipperName", "shipperAddress", "consigneeName", "consigneeAddress",
      "notifyParty", "originPort", "destinationPort", "cargoDescription",
      "hsCodePrimary", "grossWeight", "netWeight", "weightUnit",
      "numberOfPackages", "incoterms", "invoiceNumber", "invoiceValue",
      "currency", "awbOrBlNumber", "vesselOrFlight", "shipmentType",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "bad_request", message: "No valid fields to update" },
        { status: 400 }
      );
    }

    const shipment = await db.shipment.update({
      where: { id },
      data: updates,
    });

    // Write to audit log
    await db.auditLog.create({
      data: {
        orgId: shipment.orgId,
        entityType: "shipment",
        entityId: id,
        action: "user_edited",
        actorType: "user",
        afterState: JSON.stringify(updates),
      },
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to update shipment" },
      { status: 500 }
    );
  }
}
