import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const users = await db.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      items: users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
      })),
      total: users.length,
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list users" }, { status: 500 });
  }
}
