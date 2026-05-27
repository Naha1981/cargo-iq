// GET /api/organisations/[id] - Get organisation by ID
// PATCH /api/organisations/[id] - Update organisation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const org = await db.organisation.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, fullName: true, role: true, isActive: true } },
        emailConnections: true,
        rlaStatuses: true,
        _count: { select: { shipments: true, users: true } },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "not_found", message: "Organisation not found" }, { status: 404 });
    }

    return NextResponse.json({ organisation: org });
  } catch (error) {
    console.error("Error getting organisation:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to get organisation" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      "name", "slug", "plan", "status",
      "cwServerUrl", "cwEnterpriseId", "cwServerId", "cwCredentialsEnc",
      "confidenceAutoApprove", "confidenceReviewRequired", "settings",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "bad_request", message: "No valid fields to update" }, { status: 400 });
    }

    const org = await db.organisation.update({ where: { id }, data: updates });

    return NextResponse.json({ organisation: org });
  } catch (error) {
    console.error("Error updating organisation:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to update organisation" }, { status: 500 });
  }
}
