// GET /api/shipments - List shipments with filtering and pagination
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const shieldStatus = searchParams.get("shield");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (shieldStatus) where.shieldStatus = shieldStatus;
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { shipperName: { contains: search } },
        { consigneeName: { contains: search } },
        { awbOrBlNumber: { contains: search } },
      ];
    }

    const [shipments, total] = await Promise.all([
      db.shipment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          shipmentDocuments: { select: { documentId: true } },
        },
      }),
      db.shipment.count({ where }),
    ]);

    const items = shipments.map((s) => ({
      id: s.id,
      reference: s.reference,
      shipperName: s.shipperName,
      consigneeName: s.consigneeName,
      originPort: s.originPort,
      destinationPort: s.destinationPort,
      shipmentType: s.shipmentType,
      awbOrBlNumber: s.awbOrBlNumber,
      overallConfidence: s.overallConfidence,
      shieldStatus: s.shieldStatus,
      status: s.status,
      documentCount: s.shipmentDocuments?.length || 0,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("Error listing shipments:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to list shipments" },
      { status: 500 }
    );
  }
}
