// POST /api/shipments/create-from-extraction — Create shipment from pre-extracted data
// Used by email ingestion service and other automated pipelines
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/reference-generator";
import { runComplianceShield, ComplianceModule } from "@/lib/compliance-engine";
import { portToCountryCode, estimateZarValue, safeJsonParse, sanitizeError } from '@/lib/api-utils';

interface ExtractedLineItem {
  hsCode?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitWeight?: number | null;
  totalWeight?: number | null;
  unitValue?: number | null;
  totalValue?: number | null;
  currency?: string | null;
  confidence?: string | null;
}

interface CreateFromExtractionBody {
  orgId?: string;
  source?: string;
  documentIds?: string[];
  extractedFields: {
    shipperName?: string | null;
    shipperAddress?: string | null;
    consigneeName?: string | null;
    consigneeAddress?: string | null;
    originPort?: string | null;
    destinationPort?: string | null;
    cargoDescription?: string | null;
    hsCodePrimary?: string | null;
    grossWeight?: number | null;
    netWeight?: number | null;
    weightUnit?: string | null;
    numberOfPackages?: number | null;
    incoterms?: string | null;
    invoiceNumber?: string | null;
    invoiceValue?: number | null;
    currency?: string | null;
    awbOrBlNumber?: string | null;
    vesselOrFlight?: string | null;
    shipmentType?: string | null;
    eta?: string | null;
    etd?: string | null;
    notifyParty?: string | null;
  };
  confidenceScores?: Record<string, string>;
  overallConfidence?: string;
  extractionNotes?: string;
  lineItems?: ExtractedLineItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateFromExtractionBody = await request.json();

    if (!body.extractedFields) {
      return NextResponse.json(
        { error: "bad_request", message: "extractedFields is required" },
        { status: 400 }
      );
    }

    // Resolve org
    const org = await db.organisation.findFirst({
      where: body.orgId ? { id: body.orgId } : undefined,
    });
    if (!org) {
      return NextResponse.json(
        { error: "not_found", message: "Organisation not found" },
        { status: 404 }
      );
    }
    const resolvedOrgId = org.id;

    const fields = body.extractedFields;
    const reference = await generateReference(resolvedOrgId);

    // Create shipment
    const shipment = await db.shipment.create({
      data: {
        orgId: resolvedOrgId,
        reference,
        shipperName: fields.shipperName || null,
        shipperAddress: fields.shipperAddress || null,
        consigneeName: fields.consigneeName || null,
        consigneeAddress: fields.consigneeAddress || null,
        notifyParty: fields.notifyParty || null,
        originPort: fields.originPort || null,
        destinationPort: fields.destinationPort || null,
        cargoDescription: fields.cargoDescription || null,
        hsCodePrimary: fields.hsCodePrimary || null,
        grossWeight: fields.grossWeight || null,
        netWeight: fields.netWeight || null,
        weightUnit: fields.weightUnit || "KGS",
        numberOfPackages: fields.numberOfPackages || null,
        incoterms: fields.incoterms || null,
        invoiceNumber: fields.invoiceNumber || null,
        invoiceValue: fields.invoiceValue || null,
        currency: fields.currency || "USD",
        awbOrBlNumber: fields.awbOrBlNumber || null,
        vesselOrFlight: fields.vesselOrFlight || null,
        shipmentType: fields.shipmentType || null,
        eta: fields.eta ? new Date(fields.eta) : null,
        etd: fields.etd ? new Date(fields.etd) : null,
        extractedFields: JSON.stringify(body.extractedFields),
        confidenceScores: JSON.stringify(body.confidenceScores || {}),
        overallConfidence: (body.overallConfidence as "high" | "medium" | "low") || "low",
        shieldStatus: "pending",
        shieldResults: "{}",
        status: "pending",
        source: body.source === "email" || body.source === "whatsapp" || body.source === "manual_upload"
          ? body.source
          : "email",
      },
    });

    await db.auditLog.create({
      data: {
        orgId: resolvedOrgId,
        entityType: "shipment",
        entityId: shipment.id,
        action: "extracted",
        actorType: "ai_system",
        metadata: JSON.stringify({
          reference,
          source: body.source || "email",
          overall_confidence: body.overallConfidence || "low",
          extraction_notes: body.extractionNotes || "",
        }),
      },
    });

    // Create line items
    if (body.lineItems && body.lineItems.length > 0) {
      for (let i = 0; i < body.lineItems.length; i++) {
        const li = body.lineItems[i];
        await db.cargoLineItem.create({
          data: {
            shipmentId: shipment.id,
            lineNumber: i + 1,
            hsCode: li.hsCode || null,
            description: li.description || null,
            quantity: li.quantity || null,
            unit: li.unit || null,
            unitWeight: li.unitWeight || null,
            totalWeight: li.totalWeight || null,
            unitValue: li.unitValue || null,
            totalValue: li.totalValue || null,
            currency: li.currency || null,
            confidence: (li.confidence as "high" | "medium" | "low") || "low",
          },
        });
      }
    } else if (fields.hsCodePrimary) {
      await db.cargoLineItem.create({
        data: {
          shipmentId: shipment.id,
          lineNumber: 1,
          hsCode: fields.hsCodePrimary,
          description: fields.cargoDescription,
          quantity: fields.numberOfPackages,
          unitWeight: fields.grossWeight,
          totalWeight: fields.grossWeight,
          totalValue: fields.invoiceValue,
          currency: fields.currency || "USD",
          confidence: body.overallConfidence as "high" | "medium" | "low" || "low",
        },
      });
    }

    // Link documents
    if (body.documentIds && body.documentIds.length > 0) {
      for (const docId of body.documentIds) {
        const doc = await db.document.findUnique({ where: { id: docId } });
        if (doc) {
          await db.shipmentDocument.create({
            data: {
              shipmentId: shipment.id,
              documentId: docId,
            },
          });
        }
      }
    }

    // Run compliance shield
    const lineItems =
      body.lineItems && body.lineItems.length > 0
        ? body.lineItems.map((li) => ({ hs_code: li.hsCode || "" }))
        : fields.hsCodePrimary
          ? [{ hs_code: fields.hsCodePrimary }]
          : [];

    const customsValueZar = estimateZarValue(fields.invoiceValue, fields.currency);
    const estimatedDutiesZar = Math.round(customsValueZar * 0.15 * 100) / 100;
    const declaredVatZar = Math.round(customsValueZar * 0.15 * 100) / 100;

    const shieldResult = runComplianceShield({
      invoice_data: {
        gross_weight: fields.grossWeight || 0,
        net_weight: fields.netWeight || 0,
        total_value: fields.invoiceValue || 0,
        package_count: fields.numberOfPackages || 0,
      },
      packing_list_data: {
        gross_weight: fields.grossWeight || 0,
        net_weight: fields.netWeight || 0,
        package_count: fields.numberOfPackages || 0,
      },
      line_items: lineItems,
      origin_country_code: portToCountryCode(fields.originPort),
      customs_value_zar: customsValueZar,
      duties_zar: estimatedDutiesZar,
      declared_vat_zar: declaredVatZar,
    });

    const shipmentStatus = shieldResult.overall === "pass" ? "pending" : "review_required";

    await db.shipment.update({
      where: { id: shipment.id },
      data: {
        shieldStatus: shieldResult.overall,
        shieldResults: JSON.stringify(shieldResult),
        status: shipmentStatus,
      },
    });

    // Create compliance events
    for (const mod of shieldResult.modules) {
      await db.complianceEvent.create({
        data: {
          orgId: resolvedOrgId,
          shipmentId: shipment.id,
          module: mod.module,
          result: mod.result,
          detail: JSON.stringify(mod.detail),
          penaltyRisk: mod.penalty_risk,
        },
      });
    }

    await db.auditLog.create({
      data: {
        orgId: resolvedOrgId,
        entityType: "shipment",
        entityId: shipment.id,
        action: "shield_checked",
        actorType: "ai_system",
        metadata: JSON.stringify({
          overall: shieldResult.overall,
          modules: shieldResult.modules.map((m: ComplianceModule) => ({
            module: m.module,
            result: m.result,
          })),
        }),
      },
    });

    const fullShipment = await db.shipment.findUnique({
      where: { id: shipment.id },
      include: {
        shipmentDocuments: { include: { document: true } },
        lineItems: { orderBy: { lineNumber: "asc" } },
        complianceEvents: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({
      success: true,
      shipment: {
        id: fullShipment!.id,
        reference: fullShipment!.reference,
        status: fullShipment!.status,
        shieldStatus: fullShipment!.shieldStatus,
        overallConfidence: fullShipment!.overallConfidence,
        extractedFields: safeJsonParse<Record<string, unknown>>(fullShipment!.extractedFields, {}),
        shieldResults: safeJsonParse<Record<string, unknown>>(fullShipment!.shieldResults, {}),
        lineItems: fullShipment!.lineItems,
        complianceEvents: fullShipment!.complianceEvents,
        createdAt: fullShipment!.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: sanitizeError(error),
      },
      { status: 500 }
    );
  }
}
