// GET /api/organisations - List organisations (scoped to authenticated org)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";
import { safeDecrypt, isEncrypted } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);

    // Fetch the authenticated org
    const org = await db.organisation.findUnique({
      where: { id: orgId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            shipments: true,
            emailConnections: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "not_found", message: "Organisation not found" },
        { status: 404 }
      );
    }

    // Decrypt cwCredentialsEnc if present
    let cwCredentials = null;
    if (org.cwCredentialsEnc && isEncrypted(org.cwCredentialsEnc)) {
      const decrypted = safeDecrypt(org.cwCredentialsEnc);
      if (decrypted) {
        try {
          const parsed = JSON.parse(decrypted);
          // Mask the password for security
          cwCredentials = {
            username: parsed.username || null,
            password: parsed.password ? "••••••••" : null,
            hasCredentials: !!(parsed.username && parsed.password),
          };
        } catch {
          cwCredentials = { hasCredentials: false };
        }
      }
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      cwServerUrl: org.cwServerUrl,
      cwEnterpriseId: org.cwEnterpriseId,
      cwServerId: org.cwServerId,
      cwCredentials,
      confidenceAutoApprove: org.confidenceAutoApprove,
      confidenceReviewRequired: org.confidenceReviewRequired,
      settings: (() => {
        try {
          return JSON.parse(org.settings);
        } catch {
          return {};
        }
      })(),
      shipmentCount: org._count.shipments,
      emailConnectionCount: org._count.emailConnections,
      userCount: org.users.length,
      users: org.users,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error listing organisation:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get organisation" },
      { status: 500 }
    );
  }
}
