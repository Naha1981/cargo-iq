import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const rlas = await db.rlaStatus.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items: rlas, total: rlas.length });
  } catch (error) {
    console.error("Error listing RLA statuses:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list RLA statuses" }, { status: 500 });
  }
}
