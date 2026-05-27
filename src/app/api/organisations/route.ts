// GET /api/organisations - List all organisations
// POST /api/organisations - Create a new organisation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    const where: Record<string, unknown> = {};
    if (slug) where.slug = slug;

    const orgs = await db.organisation.findMany({
      where,
      include: {
        users: { select: { id: true, email: true, fullName: true, role: true, isActive: true } },
        _count: { select: { shipments: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ organisations: orgs });
  } catch (error) {
    console.error("Error listing organisations:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list organisations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, plan, cwServerUrl, cwEnterpriseId, cwServerId } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "bad_request", message: "name and slug are required" }, { status: 400 });
    }

    const existing = await db.organisation.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "conflict", message: "Organisation slug already exists" }, { status: 409 });
    }

    const org = await db.organisation.create({
      data: {
        name,
        slug,
        plan: plan || "pilot",
        cwServerUrl: cwServerUrl || null,
        cwEnterpriseId: cwEnterpriseId || null,
        cwServerId: cwServerId || null,
      },
    });

    return NextResponse.json({ organisation: org }, { status: 201 });
  } catch (error) {
    console.error("Error creating organisation:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to create organisation" }, { status: 500 });
  }
}
