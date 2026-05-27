// GET /api/users - List users (filter by orgId query param)
// POST /api/users - Create a new user
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const email = searchParams.get("email");

    const where: Record<string, unknown> = {};
    if (orgId) where.orgId = orgId;
    if (email) where.email = email;

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, email, fullName, role } = body;

    if (!orgId || !email) {
      return NextResponse.json({ error: "bad_request", message: "orgId and email are required" }, { status: 400 });
    }

    // Check org exists
    const org = await db.organisation.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: "not_found", message: "Organisation not found" }, { status: 404 });
    }

    // Check duplicate
    const existing = await db.user.findUnique({
      where: { orgId_email: { orgId, email } },
    });
    if (existing) {
      return NextResponse.json({ error: "conflict", message: "User already exists in this organisation" }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        orgId,
        email,
        fullName: fullName || null,
        role: role || "operator",
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to create user" }, { status: 500 });
  }
}
