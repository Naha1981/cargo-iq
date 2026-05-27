// POST /api/cargowise/execute - Execute CargoWise draft creation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest, getUserIdFromRequest } from "@/lib/api-utils";
import { safeDecrypt } from "@/lib/crypto";
import { generateShipmentXml, type ShipmentData, type OrgData } from "@/lib/cargowise-xml";
import { simulateCargowiseEntry } from "@/lib/cargowise-playwright";
import { notifyCw } from "@/lib/notify";

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const userId = await getUserIdFromRequest(request, orgId);
    const body = await request.json();

    const { shipmentId } = body as { shipmentId?: string };

    if (!shipmentId) {
      return NextResponse.json(
        { error: "bad_request", message: "shipmentId is required" },
        { status: 400 }
      );
    }

    // Fetch shipment with org's CW config
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "not_found", message: "Shipment not found" },
        { status: 404 }
      );
    }

    if (shipment.orgId !== orgId) {
      return NextResponse.json(
        { error: "forbidden", message: "Shipment does not belong to your organisation" },
        { status: 403 }
      );
    }

    // Block if shield status is "fail"
    if (shipment.shieldStatus === "fail") {
      return NextResponse.json(
        { error: "compliance_blocked", message: "Cannot push to CargoWise: Compliance Shield has FAIL status. Resolve compliance issues first." },
        { status: 403 }
      );
    }

    // Fetch org with CW config
    const org = await db.organisation.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json(
        { error: "not_found", message: "Organisation not found" },
        { status: 404 }
      );
    }

    // Build ShipmentData for XML generation
    const shipmentData: ShipmentData = {
      reference: shipment.reference,
      shipperName: shipment.shipperName,
      shipperAddress: shipment.shipperAddress,
      consigneeName: shipment.consigneeName,
      consigneeAddress: shipment.consigneeAddress,
      notifyParty: shipment.notifyParty,
      originPort: shipment.originPort,
      destinationPort: shipment.destinationPort,
      cargoDescription: shipment.cargoDescription,
      hsCodePrimary: shipment.hsCodePrimary,
      grossWeight: shipment.grossWeight,
      netWeight: shipment.netWeight,
      weightUnit: shipment.weightUnit,
      numberOfPackages: shipment.numberOfPackages,
      incoterms: shipment.incoterms,
      invoiceNumber: shipment.invoiceNumber,
      invoiceValue: shipment.invoiceValue,
      currency: shipment.currency,
      awbOrBlNumber: shipment.awbOrBlNumber,
      vesselOrFlight: shipment.vesselOrFlight,
      eta: shipment.eta,
      etd: shipment.etd,
      shipmentType: shipment.shipmentType,
      lineItems: shipment.lineItems.map((li) => ({
        lineNumber: li.lineNumber,
        hsCode: li.hsCode,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitWeight: li.unitWeight,
        totalWeight: li.totalWeight,
        unitValue: li.unitValue,
        totalValue: li.totalValue,
        currency: li.currency,
      })),
    };

    const orgData: OrgData = {
      id: org.id,
      name: org.name,
      cwServerUrl: org.cwServerUrl,
      cwEnterpriseId: org.cwEnterpriseId,
      cwServerId: org.cwServerId,
    };

    // Generate eAdaptor XML
    const xmlPayload = generateShipmentXml(shipmentData, orgData);

    const startTime = Date.now();
    let executionType: "eadaptor_xml" | "playwright" = "eadaptor_xml";
    let executionStatus: "success" | "failed" = "success";
    let cwResponse: string | null = null;
    let errorMessage: string | null = null;
    let screenshotUrl: string | null = null;
    let draftUrl: string | null = null;

    // Try eAdaptor first
    if (org.cwServerUrl) {
      try {
        // Decrypt CW credentials
        let credentials: { username?: string; password?: string } | null = null;
        if (org.cwCredentialsEnc) {
          const decrypted = safeDecrypt(org.cwCredentialsEnc);
          if (decrypted) {
            try {
              credentials = JSON.parse(decrypted);
            } catch {
              credentials = null;
            }
          }
        }

        // POST to eAdaptor endpoint with Basic auth
        const headers: Record<string, string> = {
          "Content-Type": "application/xml",
        };

        if (credentials?.username && credentials?.password) {
          const auth = Buffer.from(
            `${credentials.username}:${credentials.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${auth}`;
        }

        const eadaptorUrl = `${org.cwServerUrl}/eAdaptor`;
        const response = await fetch(eadaptorUrl, {
          method: "POST",
          headers,
          body: xmlPayload,
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          cwResponse = await response.text();
          executionStatus = "success";
          draftUrl = `${org.cwServerUrl}/shipment/${shipment.reference}/draft`;
        } else {
          throw new Error(`eAdaptor returned ${response.status}: ${response.statusText}`);
        }
      } catch (eadaptorError) {
        // Fall back to Playwright simulation
        console.warn(
          "[cw-execute] eAdaptor failed, falling back to Playwright simulation:",
          eadaptorError instanceof Error ? eadaptorError.message : eadaptorError
        );
        executionType = "playwright";

        try {
          const simulation = await simulateCargowiseEntry(shipmentData, orgData);
          executionStatus = simulation.success ? "success" : "failed";
          screenshotUrl = simulation.screenshotUrl;
          draftUrl = simulation.draftUrl;
          cwResponse = JSON.stringify(simulation.stepsLog);
        } catch (simError) {
          executionStatus = "failed";
          errorMessage = simError instanceof Error ? simError.message : "Playwright simulation failed";
        }
      }
    } else {
      // No CW server URL configured — use Playwright simulation
      executionType = "playwright";

      try {
        const simulation = await simulateCargowiseEntry(shipmentData, orgData);
        executionStatus = simulation.success ? "success" : "failed";
        screenshotUrl = simulation.screenshotUrl;
        draftUrl = simulation.draftUrl;
        cwResponse = JSON.stringify(simulation.stepsLog);
      } catch (simError) {
        executionStatus = "failed";
        errorMessage = simError instanceof Error ? simError.message : "Playwright simulation failed";
      }
    }

    const durationMs = Date.now() - startTime;

    // Create CwExecution record
    const execution = await db.cwExecution.create({
      data: {
        orgId,
        shipmentId,
        executionType,
        status: executionStatus,
        xmlPayload,
        screenshotUrl,
        cwResponse,
        durationMs,
        errorMessage,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      },
    });

    // Update shipment status
    await db.shipment.update({
      where: { id: shipmentId },
      data: {
        status: executionStatus === "success" ? "cw_draft_created" : "error",
        cargowiseDraftUrl: draftUrl,
      },
    });

    // Write AuditLog
    await db.auditLog.create({
      data: {
        orgId,
        entityType: "shipment",
        entityId: shipmentId,
        action: "pushed_to_cw",
        actorType: "user",
        actorId: userId,
        metadata: JSON.stringify({
          executionId: execution.id,
          executionType,
          executionStatus,
          durationMs,
          reference: shipment.reference,
        }),
      },
    });

    // Send notification
    await notifyCw(
      executionStatus === "success" ? "cw:draft_created" : "cw:push_failed",
      shipmentId,
      {
        executionId: execution.id,
        executionType,
        reference: shipment.reference,
      }
    );

    return NextResponse.json({
      executionId: execution.id,
      executionType,
      status: executionStatus,
      durationMs,
      draftUrl,
      screenshotUrl,
      errorMessage,
    });
  } catch (error) {
    console.error("Error executing CargoWise draft creation:", error);
    return NextResponse.json(
      { error: "internal_error", message: "CargoWise execution failed" },
      { status: 500 }
    );
  }
}
