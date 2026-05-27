// GET /api/organisations/[id] - Get single organisation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";
import { safeDecrypt, isEncrypted } from "@/lib/crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authenticatedOrgId = await getOrgIdFromRequest(request);

    // Only allow access to the authenticated org
    if (id !== authenticatedOrgId) {
      return NextResponse.json(
        { error: "forbidden", message: "You can only access your own organisation" },
        { status: 403 }
      );
    }

    const org = await db.organisation.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        emailConnections: {
          select: {
            id: true,
            type: true,
            emailAddress: true,
            status: true,
            lastSyncedAt: true,
          },
        },
        _count: {
          select: {
            shipments: true,
            rlaStatuses: true,
            wisetechTransactions: true,
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

    // Decrypt cwCredentialsEnc before returning (with masking)
    let cwCredentials = null;
    if (org.cwCredentialsEnc && isEncrypted(org.cwCredentialsEnc)) {
      const decrypted = safeDecrypt(org.cwCredentialsEnc);
      if (decrypted) {
        try {
          const parsed = JSON.parse(decrypted);
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
      rlaStatusCount: org._count.rlaStatuses,
      wisetechTransactionCount: org._count.wisetechTransactions,
      users: org.users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
      })),
      emailConnections: org.emailConnections.map((ec) => ({
        ...ec,
        lastSyncedAt: ec.lastSyncedAt?.toISOString() || null,
      })),
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error getting organisation:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get organisation" },
      { status: 500 }
    );
  }
}
