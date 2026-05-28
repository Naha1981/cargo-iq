import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    const where = orgId ? { id: orgId } : {};

    const orgs = await db.organisation.findMany({
      where,
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      items: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        status: o.status,
        cwServerUrl: o.cwServerUrl,
        hasCredentials: !!o.cwCredentialsEnc,
        createdAt: o.createdAt.toISOString(),
      })),
      total: orgs.length,
    });
  } catch (error) {
    console.error("Error listing organisations:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list organisations" }, { status: 500 });
  }
}
