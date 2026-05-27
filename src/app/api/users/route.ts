// GET /api/users - List users scoped to authenticated org
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);

    const users = await db.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
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
    return NextResponse.json(
      { error: "internal_error", message: "Failed to list users" },
      { status: 500 }
    );
  }
}
