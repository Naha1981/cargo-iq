import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const txns = await db.wisetechTransaction.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ items: txns, total: txns.length });
  } catch (error) {
    console.error("Error listing WiseLayer data:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list WiseLayer data" }, { status: 500 });
  }
}
