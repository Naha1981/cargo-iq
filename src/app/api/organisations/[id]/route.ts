import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const org = await db.organisation.findUnique({ where: { id } });

    if (!org) {
      return NextResponse.json({ error: "not_found", message: "Organisation not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      cwServerUrl: org.cwServerUrl,
      hasCredentials: !!org.cwCredentialsEnc,
    });
  } catch (error) {
    console.error("Error getting organisation:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to get organisation" }, { status: 500 });
  }
}
