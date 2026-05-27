// POST /api/process - Main processing pipeline
// Accepts FormData with file upload, runs AI extraction, creates shipment, runs compliance shield
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest, getUserIdFromRequest, safeJsonParse, portToCountryCode, estimateZarValue } from "@/lib/api-utils";
import { generateNextReference } from "@/lib/reference-generator";
import { extractFromDocument, arrayBufferToBase64 } from "@/lib/ai-extraction";
import {
  runComplianceShield,
  type ComplianceShieldInput,
} from "@/lib/compliance-engine";
import { notifyShipment } from "@/lib/notify";

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const userId = await getUserIdFromRequest(request, orgId);

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;
    const source = (formData.get("source") as string) || "manual_upload";
    const emailId = formData.get("emailId") as string | null;

    if (!file && !textContent) {
      return NextResponse.json(
        { error: "bad_request", message: "Either a file or text content is required" },
        { status: 400 }
      );
    }

    // Step 1: Save document record to DB
    const filename = file?.name || "text-input.txt";
    const fileType = file
      ? file.type.split("/").pop() || "unknown"
      : "txt";
    const docType = formData.get("docType") as string || "unknown";

    const document = await db.document.create({
      data: {
        orgId,
        emailId: emailId || null,
        storagePath: `/uploads/${orgId}/${Date.now()}-${filename}`,
        filename,
        fileType,
        docType,
        status: "processing",
      },
    });

    // Step 2: Run AI extraction
    let extractionResult;

    if (file) {
      const buffer = await file.arrayBuffer();
      const mimeType = file.type;
      const base64 = arrayBufferToBase64(buffer);

      if (mimeType.startsWith("image/")) {
        const dataUri = `data:${mimeType};base64,${base64}`;
        extractionResult = await extractFromDocument({
          imageDataUri: dataUri,
          fileMimeType: mimeType,
        });
      } else if (mimeType === "application/pdf") {
        const dataUri = `data:application/pdf;base64,${base64}`;
        extractionResult = await extractFromDocument({
          pdfDataUri: dataUri,
          fileMimeType: mimeType,
        });
      } else {
        // Try text extraction for other file types
        const rawText = await file.text();
        extractionResult = await extractFromDocument({
          textContent: rawText,
        });
      }
    } else if (textContent) {
      extractionResult = await extractFromDocument({ textContent });
    }

    // Update document with extraction results
    await db.document.update({
      where: { id: document.id },
      data: {
        status: "processed",
        rawText: textContent || (extractionResult?.extraction_notes ?? ""),
      },
    });

    if (!extractionResult) {
      return NextResponse.json(
        { error: "extraction_failed", message: "AI extraction returned no results" },
        { status: 422 }
      );
    }

    // Helper to get field values from extraction result
    const fieldValue = (key: string): string | number | null => {
      const field = extractionResult[key as keyof typeof extractionResult];
      if (field && typeof field === "object" && "value" in field) {
        return (field as { value: string | number | null }).value ?? null;
      }
      return null;
    };

    // Step 3: Create shipment with reference
    const reference = await generateNextReference(db);

    // Build confidence scores map
    const confidenceScores: Record<string, string> = {};
    const extractionFieldKeys = [
      "shipperName", "consigneeName", "shipperAddress", "consigneeAddress",
      "originPort", "destinationPort", "cargoDescription", "hsCodePrimary",
      "grossWeight", "netWeight", "weightUnit", "numberOfPackages",
      "incoterms", "invoiceNumber", "invoiceValue", "currency", "awbOrBlNumber",
    ];
    for (const key of extractionFieldKeys) {
      const field = extractionResult[key as keyof typeof extractionResult];
      if (field && typeof field === "object" && "confidence" in field) {
        confidenceScores[key] = (field as { confidence: string }).confidence || "low";
      }
    }

    const shipment = await db.shipment.create({
      data: {
        orgId,
        reference,
        shipperName: fieldValue("shipperName") as string | null,
        shipperAddress: fieldValue("shipperAddress") as string | null,
        consigneeName: fieldValue("consigneeName") as string | null,
        consigneeAddress: fieldValue("consigneeAddress") as string | null,
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
        extractedFields: JSON.stringify(extractionResult),
        confidenceScores: JSON.stringify(confidenceScores),
        overallConfidence: extractionResult.overall_confidence,
        shieldStatus: "pending",
        source,
        status: "pending",
      },
    });

    // Step 4: Create line items (if any in extraction)
    const rawLineItems = safeJsonParse<Array<Record<string, unknown>>>(
      null,
      []
    );
    // Note: current extraction doesn't return line_items directly, but we
    // create one from hsCodePrimary if present
    if (shipment.hsCodePrimary) {
      await db.cargoLineItem.create({
        data: {
          shipmentId: shipment.id,
          lineNumber: 1,
          hsCode: shipment.hsCodePrimary,
          description: shipment.cargoDescription,
          totalWeight: shipment.grossWeight,
          totalValue: shipment.invoiceValue,
          currency: shipment.currency,
          confidence: extractionResult.hsCodePrimary?.confidence || "low",
        },
      });
    }

    // Step 5: Link document to shipment
    await db.shipmentDocument.create({
      data: { shipmentId: shipment.id, documentId: document.id },
    });

    // Step 6: Run compliance shield
    const originCountry = portToCountryCode(shipment.originPort);
    const customsValueZar = estimateZarValue(shipment.invoiceValue, shipment.currency) ?? 0;
    const dutiesZar = Math.round(customsValueZar * 0.05 * 100) / 100;
    const declaredVatZar = Math.round(customsValueZar * 0.15 * 100) / 100;

    const lineItems = await db.cargoLineItem.findMany({
      where: { shipmentId: shipment.id },
    });

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
      line_items: lineItems.map((li) => ({
        hs_code: li.hsCode || "",
        description: li.description || undefined,
      })),
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

    // Step 7: Create compliance events
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

    // Step 8: Write audit logs
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
          source,
          documentId: document.id,
          extractionConfidence: extractionResult.overall_confidence,
          shieldOverall: shieldResult.overall,
        }),
      },
    });

    await db.auditLog.create({
      data: {
        orgId,
        entityType: "shipment",
        entityId: shipment.id,
        action: "shield_checked",
        actorType: "ai_system",
        metadata: JSON.stringify({
          overall: shieldResult.overall,
          modules: shieldResult.modules.map((m) => ({
            module: m.module,
            result: m.result,
          })),
        }),
      },
    });

    // Send notification
    await notifyShipment("shipment:created", shipment.id, {
      reference: shipment.reference,
      shieldOverall: shieldResult.overall,
    });

    // Return created shipment with full data
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
    console.error("Error in processing pipeline:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Processing pipeline failed" },
      { status: 500 }
    );
  }
}
