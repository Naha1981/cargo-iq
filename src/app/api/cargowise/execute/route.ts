// CargoIQ — CargoWise Execution API
// POST /api/cargowise/execute
// Executes a CargoWise draft creation for a shipment.
// Tries eAdaptor first, falls back to Playwright simulation.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateShipmentXml } from "@/lib/cargowise-xml";
import { createCwDraftViaPlaywright } from "@/lib/cargowise-playwright";
import { notifyCw } from "@/lib/notify";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { shipmentId } = body;

    if (!shipmentId || typeof shipmentId !== "string") {
      return NextResponse.json(
        { error: "shipmentId is required" },
        { status: 400 }
      );
    }

    // 1. Fetch shipment from DB with org's CargoWise config
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        organisation: true,
        lineItems: true,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    const org = shipment.organisation;

    // Check if shipment can have a CW draft created
    const blockedStatuses = ["cw_draft_created", "in_cargowise"];
    if (blockedStatuses.includes(shipment.status)) {
      return NextResponse.json(
        {
          error: `Shipment already in CargoWise (status: ${shipment.status})`,
          status: shipment.status,
        },
        { status: 409 }
      );
    }

    // Check if compliance shield blocks CW submission
    if (shipment.shieldStatus === "fail") {
      return NextResponse.json(
        {
          error: "CargoWise submission BLOCKED — compliance shield has FAIL results",
          shieldStatus: shipment.shieldStatus,
        },
        { status: 403 }
      );
    }

    // Prepare shipment data for XML generation
    const shipmentData = {
      id: shipment.id,
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
      eta: shipment.eta?.toISOString() ?? null,
      etd: shipment.etd?.toISOString() ?? null,
      shipmentType: shipment.shipmentType,
      lineItems: shipment.lineItems.map((li) => ({
        lineNumber: li.lineNumber,
        hsCode: li.hsCode,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        totalWeight: li.totalWeight,
        totalValue: li.totalValue,
        currency: li.currency,
      })),
    };

    const orgData = {
      id: org.id,
      name: org.name,
      cwEnterpriseId: org.cwEnterpriseId,
      cwServerId: org.cwServerId,
    };

    // 2. Generate eAdaptor XML
    const xmlPayload = generateShipmentXml(shipmentData, orgData);

    // 3. Try eAdaptor, fall back to Playwright
    let executionType: string;
    let cwResponse: string | null = null;
    let screenshotUrl: string | null = null;
    let draftUrl: string | null = null;
    let errorMessage: string | null = null;
    let success = false;

    const hasEadaptor = !!(org.cwServerUrl && org.cwCredentialsEnc);

    if (hasEadaptor) {
      // Try eAdaptor
      executionType = "eadaptor_xml";
      try {
        const eadaptorResponse = await fetch(org.cwServerUrl!, {
          method: "POST",
          headers: {
            "Content-Type": "application/xml",
            Authorization: `Basic ${org.cwCredentialsEnc}`,
          },
          body: xmlPayload,
          signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (eadaptorResponse.ok) {
          cwResponse = await eadaptorResponse.text();
          success = true;
          draftUrl = `eadaptor://shipment/${shipment.reference || shipment.id}`;
        } else {
          errorMessage = `eAdaptor returned ${eadaptorResponse.status}: ${eadaptorResponse.statusText}`;
          console.warn(`[CW Execute] eAdaptor failed: ${errorMessage} — falling back to Playwright`);

          // Fall back to Playwright
          executionType = "playwright";
          const playwrightResult = await createCwDraftViaPlaywright(shipmentData, orgData);
          success = playwrightResult.success;
          screenshotUrl = playwrightResult.screenshotUrl ?? null;
          draftUrl = playwrightResult.draftUrl ?? null;
          errorMessage = playwrightResult.errorMessage ?? null;
          cwResponse = playwrightResult.stepsLog.join("\n");
        }
      } catch (eadaptorError) {
        errorMessage = eadaptorError instanceof Error ? eadaptorError.message : "eAdaptor connection failed";
        console.warn(`[CW Execute] eAdaptor error: ${errorMessage} — falling back to Playwright`);

        // Fall back to Playwright
        executionType = "playwright";
        const playwrightResult = await createCwDraftViaPlaywright(shipmentData, orgData);
        success = playwrightResult.success;
        screenshotUrl = playwrightResult.screenshotUrl ?? null;
        draftUrl = playwrightResult.draftUrl ?? null;
        errorMessage = playwrightResult.errorMessage ?? null;
        cwResponse = playwrightResult.stepsLog.join("\n");
      }
    } else {
      // No eAdaptor config — use Playwright simulation
      executionType = "playwright";
      const playwrightResult = await createCwDraftViaPlaywright(shipmentData, orgData);
      success = playwrightResult.success;
      screenshotUrl = playwrightResult.screenshotUrl ?? null;
      draftUrl = playwrightResult.draftUrl ?? null;
      errorMessage = playwrightResult.errorMessage ?? null;
      cwResponse = playwrightResult.stepsLog.join("\n");
    }

    const durationMs = Date.now() - startTime;

    // 4. Create CwExecution record
    const execution = await db.cwExecution.create({
      data: {
        orgId: shipment.orgId,
        shipmentId: shipment.id,
        executionType,
        status: success ? "success" : "failed",
        xmlPayload,
        screenshotUrl,
        cwResponse,
        durationMs,
        errorMessage,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      },
    });

    // 5. Update shipment status on success
    if (success) {
      await db.shipment.update({
        where: { id: shipmentId },
        data: {
          status: "cw_draft_created",
          cargowiseDraftUrl: draftUrl,
          updatedAt: new Date(),
        },
      });
    }

    // 6. Write AuditLog
    await db.auditLog.create({
      data: {
        orgId: shipment.orgId,
        entityType: "integration",
        entityId: shipmentId,
        action: success ? "pushed_to_cw" : "cw_push_failed",
        actorType: "system",
        beforeState: JSON.stringify({ status: shipment.status }),
        afterState: JSON.stringify({
          status: success ? "cw_draft_created" : shipment.status,
          executionType,
          executionId: execution.id,
        }),
        metadata: JSON.stringify({
          executionType,
          durationMs,
          success,
          errorMessage,
        }),
      },
    });

    // 7. Notify via WebSocket
    if (success) {
      await notifyCw("cw:draft_created", shipmentId, {
        reference: shipment.reference,
        executionType,
        executionId: execution.id,
        durationMs,
      });
    } else {
      await notifyCw("cw:draft_failed", shipmentId, {
        reference: shipment.reference,
        executionType,
        executionId: execution.id,
        errorMessage,
      });
    }

    return NextResponse.json({
      success,
      execution: {
        id: execution.id,
        executionType,
        status: execution.status,
        durationMs,
        screenshotUrl,
        draftUrl,
        errorMessage,
      },
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to execute CargoWise operation",
      },
      { status: 500 }
    );
  }
}
