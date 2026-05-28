// POST /api/shipments/create-from-extraction - Create shipment from pre-extracted data
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest, getUserIdFromRequest, safeJsonParse } from "@/lib/api-utils";
import { generateNextReference } from "@/lib/reference-generator";
import {
  runComplianceShield,
  type ComplianceShieldInput,
} from "@/lib/compliance-engine";
import { portToCountryCode, estimateZarValue } from "@/lib/api-utils";

interface ExtractedField {
  value: string | number | null;
  confidence: string;
}

interface ExtractedData {
  [key: string]: ExtractedField;
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const userId = await getUserIdFromRequest(request, orgId);
    const body = await request.json();

    const { extractedFields, documentIds, source } = body as {
      extractedFields?: ExtractedData;
      documentIds?: string[];
      source?: string;
    };

    if (!extractedFields || typeof extractedFields !== "object") {
      return NextResponse.json(
        { error: "bad_request", message: "extractedFields is required" },
        { status: 400 }
      );
    }

    // Helper to safely extract a value from extracted fields
    const fieldValue = (key: string): string | number | null => {
      const f = extractedFields[key];
      if (!f || typeof f !== "object") return null;
      return f.value ?? null;
    };

    const fieldConfidence = (key: string): string => {
      const f = extractedFields[key];
      if (!f || typeof f !== "object") return "low";
      return f.confidence || "low";
    };

    // Generate reference
    const reference = await generateNextReference(db);

    // Build confidence scores map
    const confidenceScores: Record<string, string> = {};
    for (const [key, val] of Object.entries(extractedFields)) {
      if (val && typeof val === "object" && "confidence" in val) {
        confidenceScores[key] = (val as ExtractedField).confidence || "low";
      }
    }

    // Calculate overall confidence
    const highCount = Object.values(confidenceScores).filter((c) => c === "high").length;
    const totalFields = Object.keys(confidenceScores).length || 1;
    const overallConfidence =
      highCount / totalFields > 0.6 ? "high" : highCount / totalFields > 0.3 ? "medium" : "low";

    // Create shipment
    const shipment = await db.shipment.create({
      data: {
        orgId,
        reference,
        shipperName: fieldValue("shipperName") as string | null,
        shipperAddress: fieldValue("shipperAddress") as string | null,
        consigneeName: fieldValue("consigneeName") as string | null,
        consigneeAddress: fieldValue("consigneeAddress") as string | null,
        notifyParty: fieldValue("notifyParty") as string | null,
        originPort: fieldValue("originPort") as string | null,
        destinationPort: fieldValue("destinationPort") as string | null,
        cargoDescription: fieldValue("cargoDescription") as string | null,
        hsCodePrimary: fieldValue("hsCodePrimary") as string | null,
        grossWeight: fieldValue("grossWeight") != null ? Number(fieldValue("grossWeight")) : null,
        netWeight: fieldValue("netWeight") != null ? Number(fieldValue("netWeight")) : null,
        weightUnit: (fieldValue("weightUnit") as string) || "KGS",
        numberOfPackages: fieldValue("numberOfPackages") != null ? Number(fieldValue("numberOfPackages")) : null,
        incoterms: fieldValue("incoterms") as string | null,
        invoiceNumber: fieldValue("invoiceNumber") as string | null,
        invoiceValue: fieldValue("invoiceValue") != null ? Number(fieldValue("invoiceValue")) : null,
        currency: (fieldValue("currency") as string) || "USD",
        awbOrBlNumber: fieldValue("awbOrBlNumber") as string | null,
        vesselOrFlight: fieldValue("vesselOrFlight") as string | null,
        shipmentType: fieldValue("shipmentType") as string | null,
        extractedFields: JSON.stringify(extractedFields),
        confidenceScores: JSON.stringify(confidenceScores),
        overallConfidence,
        shieldStatus: "pending",
        source: source || "manual_upload",
        status: "pending",
      },
    });

    // Link documents
    if (documentIds && Array.isArray(documentIds)) {
      for (const docId of documentIds) {
        const doc = await db.document.findUnique({ where: { id: docId } });
        if (doc && doc.orgId === orgId) {
          await db.shipmentDocument.create({
            data: { shipmentId: shipment.id, documentId: docId },
          });
        }
      }
    }

    // Run compliance shield
    const originCountry = portToCountryCode(shipment.originPort);
    const customsValueZar = estimateZarValue(shipment.invoiceValue, shipment.currency) ?? 0;
    const dutiesZar = Math.round(customsValueZar * 0.05 * 100) / 100;
    const declaredVatZar = Math.round(customsValueZar * 0.15 * 100) / 100;

    const shieldInput: ComplianceShieldInput = {
      invoice_data: {
        gross_weight: shipment.grossWeight ?? 0,
        net_weight: shipment.netWeight ?? 0,
        total_value: shipment.invoiceValue ?? 0,
        package_count: shipment.numberOfPackages ?? 0,
      },
      packing_list_data: {
        gross_weight: shipment.grossWeight ?? 0,
        net_weight: shipment.netWeight ?? 0,
        package_count: shipment.numberOfPackages ?? 0,
      },
      line_items: [],
      origin_country_code: originCountry,
      customs_value_zar: customsValueZar,
      duties_zar: dutiesZar,
      declared_vat_zar: declaredVatZar,
    };

    const shieldResult = runComplianceShield(shieldInput);

    // Update shipment with shield results
    await db.shipment.update({
      where: { id: shipment.id },
      data: {
        shieldStatus: shieldResult.overall,
        shieldResults: JSON.stringify(shieldResult),
        status: shieldResult.block_cargowise ? "review_required" : "pending",
      },
    });

    // Create compliance events
    for (const mod of shieldResult.modules) {
      await db.complianceEvent.create({
        data: {
          orgId,
          shipmentId: shipment.id,
          module: mod.module,
          result: mod.result,
          detail: JSON.stringify(mod.detail),
          penaltyRisk: mod.penalty_risk,
        },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        orgId,
        entityType: "shipment",
        entityId: shipment.id,
        action: "extracted",
        actorType: "ai_system",
        actorId: userId,
        metadata: JSON.stringify({
          reference: shipment.reference,
          source: source || "manual_upload",
          shieldOverall: shieldResult.overall,
        }),
      },
    });

    // Return created shipment
    const result = await db.shipment.findUnique({
      where: { id: shipment.id },
      include: {
        shipmentDocuments: { include: { document: true } },
        lineItems: { orderBy: { lineNumber: "asc" } },
        complianceEvents: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json(
      {
        ...result,
        extractedFields: safeJsonParse(result?.extractedFields, {}),
        confidenceScores: safeJsonParse(result?.confidenceScores, {}),
        shieldResults: safeJsonParse(result?.shieldResults, {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating shipment from extraction:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to create shipment from extraction" },
      { status: 500 }
    );
  }
}
