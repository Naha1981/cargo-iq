// POST /api/process — Document Processing Pipeline
// Full flow: upload → AI extraction → shipment creation → compliance shield
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { extractFromDocument } from "@/lib/ai-extraction";
import { generateReference } from "@/lib/reference-generator";
import { runComplianceShield, ComplianceModule } from "@/lib/compliance-engine";
import type { ExtractionResult, DocumentType } from "@/lib/prompts";

// ─── Helper: derive origin country code from port ───────────────────────────

function portToCountryCode(port: string | null): string {
  if (!port) return "";
  const prefix = port.substring(0, 2).toUpperCase();
  return prefix;
}

// ─── Helper: estimate ZAR value ─────────────────────────────────────────────

function estimateZarValue(valueUsd: number | null, currency: string | null): number {
  if (!valueUsd) return 0;
  const rate = currency === "GBP" ? 23.5 : currency === "EUR" ? 20.0 : 18.5; // rough ZAR rates
  return Math.round(valueUsd * rate * 100) / 100;
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orgId = formData.get("orgId") as string | null;
    const docType = formData.get("docType") as string | null;
    const source = (formData.get("source") as string) || "manual_upload";

    if (!file) {
      return NextResponse.json(
        { error: "bad_request", message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate org exists
    const org = await db.organisation.findFirst({
      where: orgId ? { id: orgId } : undefined,
    });
    if (!org) {
      return NextResponse.json(
        { error: "not_found", message: "Organisation not found" },
        { status: 404 }
      );
    }
    const resolvedOrgId = org.id;

    // ── Step 1: Save document to disk ─────────────────────────────────────
    const allowedTypes = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedTypes.includes(ext)) {
      return NextResponse.json(
        { error: "bad_request", message: `File type ${ext} not allowed` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Create Document record
    const document = await db.document.create({
      data: {
        orgId: resolvedOrgId,
        storagePath: filePath,
        filename: file.name,
        fileType: ext === "jpeg" ? "jpg" : ext,
        docType: docType || "unknown",
        status: "processing",
      },
    });

    await db.auditLog.create({
      data: {
        orgId: resolvedOrgId,
        entityType: "document",
        entityId: document.id,
        action: "uploaded",
        actorType: "user",
        metadata: JSON.stringify({ filename: file.name, sizeBytes: buffer.length, source }),
      },
    });

    // ── Step 2: AI extraction ─────────────────────────────────────────────
    let extractionResult: ExtractionResult;
    try {
      extractionResult = await extractFromDocument({
        file,
        documentType: (docType as DocumentType) || undefined,
      });

      await db.document.update({
        where: { id: document.id },
        data: { status: "processed" },
      });

      await db.auditLog.create({
        data: {
          orgId: resolvedOrgId,
          entityType: "document",
          entityId: document.id,
          action: "extracted",
          actorType: "ai_system",
          metadata: JSON.stringify({
            overall_confidence: extractionResult.overall_confidence,
            fields_extracted: Object.entries(extractionResult)
              .filter(
                ([k, v]) =>
                  k !== "extraction_notes" &&
                  k !== "line_items" &&
                  v &&
                  typeof v === "object" &&
                  "value" in (v as object) &&
                  (v as { value: unknown }).value !== null
              )
              .length,
          }),
        },
      });
    } catch (error) {
      console.error("AI extraction failed in pipeline:", error);
      const { defaultExtraction } = await import("@/lib/prompts");
      extractionResult = defaultExtraction();
      extractionResult.extraction_notes =
        `AI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}. Manual entry required.`;

      await db.document.update({
        where: { id: document.id },
        data: { status: "failed" },
      });

      await db.auditLog.create({
        data: {
          orgId: resolvedOrgId,
          entityType: "document",
          entityId: document.id,
          action: "extracted",
          actorType: "ai_system",
          metadata: JSON.stringify({ error: true, message: "AI extraction failed" }),
        },
      });
    }

    // ── Step 3: Create Shipment ───────────────────────────────────────────
    const reference = await generateReference(resolvedOrgId);

    // Build confidence scores map
    const confidenceScores: Record<string, string> = {};
    const fieldMap: Record<string, string> = {
      shipper_name: "shipperName",
      shipper_address: "shipperAddress",
      consignee_name: "consigneeName",
      consignee_address: "consigneeAddress",
      origin_port: "originPort",
      destination_port: "destinationPort",
      cargo_description: "cargoDescription",
      hs_code_primary: "hsCodePrimary",
      gross_weight: "grossWeight",
      net_weight: "netWeight",
      weight_unit: "weightUnit",
      number_of_packages: "numberOfPackages",
      incoterms: "incoterms",
      invoice_number: "invoiceNumber",
      invoice_value: "invoiceValue",
      currency: "currency",
      awb_or_bl_number: "awbOrBlNumber",
    };

    for (const [extractionKey, dbKey] of Object.entries(fieldMap)) {
      const field = extractionResult[extractionKey as keyof ExtractionResult];
      if (field && typeof field === "object" && "confidence" in field) {
        confidenceScores[dbKey] = (field as { confidence: string }).confidence;
      }
    }

    const numVal = (key: keyof ExtractionResult): number | null => {
      const field = extractionResult[key];
      if (field && typeof field === "object" && "value" in field) {
        const v = (field as { value: unknown }).value;
        if (v !== null && v !== undefined && !isNaN(Number(v))) return Number(v);
      }
      return null;
    };

    const strVal = (key: keyof ExtractionResult): string | null => {
      const field = extractionResult[key];
      if (field && typeof field === "object" && "value" in field) {
        const v = (field as { value: unknown }).value;
        return v !== null && v !== undefined ? String(v) : null;
      }
      return null;
    };

    const shipment = await db.shipment.create({
      data: {
        orgId: resolvedOrgId,
        reference,
        shipperName: strVal("shipper_name"),
        shipperAddress: strVal("shipper_address"),
        consigneeName: strVal("consignee_name"),
        consigneeAddress: strVal("consignee_address"),
        originPort: strVal("origin_port"),
        destinationPort: strVal("destination_port"),
        cargoDescription: strVal("cargo_description"),
        hsCodePrimary: strVal("hs_code_primary"),
        grossWeight: numVal("gross_weight"),
        netWeight: numVal("net_weight"),
        weightUnit: strVal("weight_unit") || "KGS",
        numberOfPackages: numVal("number_of_packages")
          ? Math.round(numVal("number_of_packages")!)
          : null,
        incoterms: strVal("incoterms"),
        invoiceNumber: strVal("invoice_number"),
        invoiceValue: numVal("invoice_value"),
        currency: strVal("currency") || "USD",
        awbOrBlNumber: strVal("awb_or_bl_number"),
        extractedFields: JSON.stringify(extractionResult),
        confidenceScores: JSON.stringify(confidenceScores),
        overallConfidence: extractionResult.overall_confidence,
        shieldStatus: "pending",
        shieldResults: "{}",
        status: "pending",
        source:
          source === "email" || source === "whatsapp" || source === "manual_upload"
            ? source
            : "manual_upload",
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
          overall_confidence: extractionResult.overall_confidence,
        }),
      },
    });

    // ── Step 4: Create CargoLineItem records ──────────────────────────────
    if (extractionResult.line_items && extractionResult.line_items.length > 0) {
      for (let i = 0; i < extractionResult.line_items.length; i++) {
        const li = extractionResult.line_items[i];
        await db.cargoLineItem.create({
          data: {
            shipmentId: shipment.id,
            lineNumber: i + 1,
            hsCode: li.hs_code,
            description: li.description,
            quantity: li.quantity,
            unit: li.unit,
            unitWeight: li.unit_weight,
            totalWeight: li.total_weight,
            unitValue: li.unit_value,
            totalValue: li.total_value,
            currency: li.currency,
            confidence: li.confidence,
          },
        });
      }
    } else if (strVal("hs_code_primary")) {
      await db.cargoLineItem.create({
        data: {
          shipmentId: shipment.id,
          lineNumber: 1,
          hsCode: strVal("hs_code_primary"),
          description: strVal("cargo_description"),
          quantity: numVal("number_of_packages"),
          unitWeight: numVal("gross_weight"),
          totalWeight: numVal("gross_weight"),
          totalValue: numVal("invoice_value"),
          currency: strVal("currency") || "USD",
          confidence: extractionResult.overall_confidence,
        },
      });
    }

    // ── Step 5: Link Document to Shipment ─────────────────────────────────
    await db.shipmentDocument.create({
      data: {
        shipmentId: shipment.id,
        documentId: document.id,
      },
    });

    // ── Step 6: Run Compliance Shield ─────────────────────────────────────
    const lineItems =
      extractionResult.line_items && extractionResult.line_items.length > 0
        ? extractionResult.line_items.map((li) => ({ hs_code: li.hs_code || "" }))
        : strVal("hs_code_primary")
          ? [{ hs_code: strVal("hs_code_primary")! }]
          : [];

    const customsValueZar = estimateZarValue(numVal("invoice_value"), strVal("currency"));
    const estimatedDutiesZar = Math.round(customsValueZar * 0.15 * 100) / 100;
    const declaredVatZar = Math.round(customsValueZar * 0.15 * 100) / 100;

    const shieldResult = runComplianceShield({
      invoice_data: {
        gross_weight: numVal("gross_weight") || 0,
        net_weight: numVal("net_weight") || 0,
        total_value: numVal("invoice_value") || 0,
        package_count: numVal("number_of_packages")
          ? Math.round(numVal("number_of_packages")!)
          : 0,
      },
      packing_list_data: {
        gross_weight: numVal("gross_weight") || 0,
        net_weight: numVal("net_weight") || 0,
        package_count: numVal("number_of_packages")
          ? Math.round(numVal("number_of_packages")!)
          : 0,
      },
      line_items: lineItems,
      origin_country_code: portToCountryCode(strVal("origin_port")),
      customs_value_zar: customsValueZar,
      duties_zar: estimatedDutiesZar,
      declared_vat_zar: declaredVatZar,
    });

    // Determine shipment status based on shield
    const shipmentStatus =
      shieldResult.overall === "pass" ? "pending" : "review_required";

    await db.shipment.update({
      where: { id: shipment.id },
      data: {
        shieldStatus: shieldResult.overall,
        shieldResults: JSON.stringify(shieldResult),
        status: shipmentStatus,
      },
    });

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
          penalty_risk: shieldResult.penalty_risk_detected,
        }),
      },
    });

    // ── Step 7: Create ComplianceEvent records ────────────────────────────
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

    // ── Return full result ────────────────────────────────────────────────
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
        shipperName: fullShipment!.shipperName,
        consigneeName: fullShipment!.consigneeName,
        originPort: fullShipment!.originPort,
        destinationPort: fullShipment!.destinationPort,
        extractedFields: JSON.parse(fullShipment!.extractedFields || "{}"),
        confidenceScores: JSON.parse(fullShipment!.confidenceScores || "{}"),
        shieldResults: JSON.parse(fullShipment!.shieldResults || "{}"),
        lineItems: fullShipment!.lineItems,
        complianceEvents: fullShipment!.complianceEvents,
        documents: fullShipment!.shipmentDocuments.map((sd) => ({
          id: sd.document.id,
          filename: sd.document.filename,
          docType: sd.document.docType,
          status: sd.document.status,
        })),
        createdAt: fullShipment!.createdAt.toISOString(),
        updatedAt: fullShipment!.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in processing pipeline:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : "Processing pipeline failed",
      },
      { status: 500 }
    );
  }
}
