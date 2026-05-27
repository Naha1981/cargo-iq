// POST /api/public/email-inbound — SendGrid Inbound Parse Webhook
// This is a PUBLIC endpoint (no auth required) that receives emails from SendGrid.
// SendGrid posts multipart/form-data with email headers, body, and attachments.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { extractFromDocument } from "@/lib/ai-extraction";
import { generateReference } from "@/lib/reference-generator";
import { runComplianceShield } from "@/lib/compliance-engine";
import type { DocumentType, ExtractionResult } from "@/lib/prompts";
import { notify } from "@/lib/notify";
import { portToCountryCode, estimateZarValue } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // SendGrid Inbound Parse sends multipart/form-data
    const formData = await request.formData();

    // Extract email metadata from SendGrid's standard fields
    const from = (formData.get("from") as string) || "";
    const subject = (formData.get("subject") as string) || "";
    const text = (formData.get("text") as string) || "";
    const _html = (formData.get("html") as string) || "";
    const to = (formData.get("to") as string) || "";

    // Parse the 'from' address
    const fromAddress = from.replace(/.*<(.+)>.*/, "$1").trim() || from;

    // Extract org ID from the to address pattern: inbound+{orgId}@domain.com
    // Or from X-Org-Id header
    let orgId: string | null = (request.headers.get("X-Org-Id") ||
      request.nextUrl.searchParams.get("orgId"));

    // Try to extract orgId from the 'to' address
    if (!orgId && to) {
      const match = to.match(/inbound\+([a-z0-9]+)/i);
      if (match) orgId = match[1];
    }

    // Resolve organisation
    const org = await db.organisation.findFirst({
      where: orgId ? { id: orgId } : undefined,
    });

    if (!org) {
      console.warn(`[Email Inbound] No org found for: ${to} (orgId: ${orgId})`);
      return NextResponse.json(
        { error: "org_not_found", message: "No matching organisation found" },
        { status: 404 }
      );
    }

    const resolvedOrgId = org.id;

    // Freight classification heuristic
    const freightKeywords = [
      "shipment", "cargo", "freight", "b/l", "bill of lading",
      "awb", "airway bill", "invoice", "customs", "import", "export",
      "container", "vessel", "booking", "delivery", "consignment",
      "packing list", "ci-", "sinv-", "commercial invoice", "bl-",
    ];

    const textToCheck = `${subject} ${text}`.toLowerCase();
    const isFreight = freightKeywords.some(kw => textToCheck.includes(kw));

    // Create InboundEmail record
    const inboundEmail = await db.inboundEmail.create({
      data: {
        orgId: resolvedOrgId,
        fromAddress,
        subject,
        bodyPreview: text.substring(0, 500),
        classification: isFreight ? "freight" : "non_freight",
        status: isFreight ? "processing" : "received",
        receivedAt: new Date(),
      },
    });

    console.log(`[Email Inbound] ${isFreight ? "FREIGHT" : "NON-FREIGHT"} email from ${fromAddress}: "${subject}"`);

    // Save attachments
    const documentIds: string[] = [];
    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    // SendGrid sends attachments with names like "attachment1", "attachment2", etc.
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("attachment") && value instanceof File) {
        const file = value as File;
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const fileName = `${Date.now()}-${file.name}`;
          const filePath = path.join(uploadDir, fileName);
          await writeFile(filePath, buffer);

          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const document = await db.document.create({
            data: {
              orgId: resolvedOrgId,
              emailId: inboundEmail.id,
              storagePath: filePath,
              filename: file.name,
              fileType: ext === "jpeg" ? "jpg" : ext,
              docType: "unknown",
              status: isFreight ? "processing" : "pending",
            },
          });
          documentIds.push(document.id);
        } catch (err) {
          console.error(`Failed to save attachment ${file.name}:`, err);
        }
      }
    }

    // If not freight, stop here
    if (!isFreight) {
      await notify("email:ingested", {
        emailId: inboundEmail.id,
        classification: "non_freight",
        from: fromAddress,
        subject,
      });

      return NextResponse.json({
        emailId: inboundEmail.id,
        classification: "non_freight",
        documentsCreated: documentIds.length,
        shipmentCreated: false,
      });
    }

    // ── Freight email: trigger processing pipeline ────────────────────────
    let shipmentCreated = false;
    let shipmentId: string | null = null;
    let extractionResult: ExtractionResult | null = null;

    // Try AI extraction on first attachment
    if (documentIds.length > 0) {
      const firstDoc = await db.document.findUnique({ where: { id: documentIds[0] } });
      if (firstDoc) {
        try {
          const { readFile } = await import("fs/promises");
          const fileBuffer = await readFile(firstDoc.storagePath);
          const mimeType = firstDoc.fileType === "pdf" ? "application/pdf"
            : firstDoc.fileType === "jpg" || firstDoc.fileType === "jpeg" ? "image/jpeg"
            : firstDoc.fileType === "png" ? "image/png"
            : "application/octet-stream";

          const file = new File([fileBuffer], firstDoc.filename || "document", { type: mimeType });
          extractionResult = await extractFromDocument({ file, documentType: firstDoc.docType as DocumentType || undefined });

          await db.document.update({ where: { id: firstDoc.id }, data: { status: "processed" } });
        } catch (err) {
          console.error("AI extraction failed for email attachment:", err);
          const { defaultExtraction } = await import("@/lib/prompts");
          extractionResult = defaultExtraction();
          extractionResult.extraction_notes = `AI extraction failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      }
    } else if (text) {
      try {
        extractionResult = await extractFromDocument({ textContent: text });
      } catch (err) {
        console.error("AI text extraction failed:", err);
        const { defaultExtraction } = await import("@/lib/prompts");
        extractionResult = defaultExtraction();
      }
    }

    // Create shipment
    if (extractionResult) {
      const reference = await generateReference(resolvedOrgId);

      const numVal = (key: keyof ExtractionResult): number | null => {
        const field = extractionResult![key];
        if (field && typeof field === "object" && "value" in field) {
          const v = (field as { value: unknown }).value;
          if (v !== null && v !== undefined && !isNaN(Number(v))) return Number(v);
        }
        return null;
      };

      const strVal = (key: keyof ExtractionResult): string | null => {
        const field = extractionResult![key];
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
          consigneeName: strVal("consignee_name"),
          originPort: strVal("origin_port"),
          destinationPort: strVal("destination_port"),
          cargoDescription: strVal("cargo_description"),
          hsCodePrimary: strVal("hs_code_primary"),
          grossWeight: numVal("gross_weight"),
          netWeight: numVal("net_weight"),
          weightUnit: strVal("weight_unit") || "KGS",
          numberOfPackages: numVal("number_of_packages") ? Math.round(numVal("number_of_packages")!) : null,
          incoterms: strVal("incoterms"),
          invoiceNumber: strVal("invoice_number"),
          invoiceValue: numVal("invoice_value"),
          currency: strVal("currency") || "USD",
          awbOrBlNumber: strVal("awb_or_bl_number"),
          extractedFields: JSON.stringify(extractionResult),
          confidenceScores: JSON.stringify({}),
          overallConfidence: extractionResult.overall_confidence,
          shieldStatus: "pending",
          shieldResults: "{}",
          status: "pending",
          source: "email",
        },
      });

      shipmentId = shipment.id;
      shipmentCreated = true;

      // Create line items
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
            totalWeight: numVal("gross_weight"),
            totalValue: numVal("invoice_value"),
            currency: strVal("currency") || "USD",
            confidence: extractionResult.overall_confidence,
          },
        });
      }

      // Link documents
      for (const docId of documentIds) {
        await db.shipmentDocument.create({ data: { shipmentId: shipment.id, documentId: docId } });
      }

      // Run compliance shield
      const lineItems = extractionResult.line_items?.length > 0
        ? extractionResult.line_items.map(li => ({ hs_code: li.hs_code || "" }))
        : strVal("hs_code_primary") ? [{ hs_code: strVal("hs_code_primary")! }] : [];

      const customsValueZar = estimateZarValue(numVal("invoice_value"), strVal("currency"));
      const estimatedDutiesZar = Math.round(customsValueZar * 0.15 * 100) / 100;
      const declaredVatZar = Math.round(customsValueZar * 0.15 * 100) / 100;

      const shieldResult = runComplianceShield({
        invoice_data: {
          gross_weight: numVal("gross_weight") || 0,
          net_weight: numVal("net_weight") || 0,
          total_value: numVal("invoice_value") || 0,
          package_count: numVal("number_of_packages") ? Math.round(numVal("number_of_packages")!) : 0,
        },
        packing_list_data: {
          gross_weight: numVal("gross_weight") || 0,
          net_weight: numVal("net_weight") || 0,
          package_count: numVal("number_of_packages") ? Math.round(numVal("number_of_packages")!) : 0,
        },
        line_items: lineItems,
        origin_country_code: portToCountryCode(strVal("origin_port")),
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
          action: "extracted",
          actorType: "ai_system",
          metadata: JSON.stringify({ reference, source: "email", emailId: inboundEmail.id, fromAddress }),
        },
      });
    }

    await db.inboundEmail.update({
      where: { id: inboundEmail.id },
      data: { status: shipmentCreated ? "processed" : "ignored" },
    });

    // Notify via WebSocket
    await notify("email:ingested", {
      emailId: inboundEmail.id,
      shipmentCreated,
      shipmentId,
      from: fromAddress,
      subject,
      processingTimeMs: Date.now() - startTime,
    });

    if (shipmentCreated && shipmentId) {
      await notify("shipment:created", {
        shipmentId,
        source: "email",
        from: fromAddress,
      });
    }

    return NextResponse.json({
      success: true,
      emailId: inboundEmail.id,
      documentsCreated: documentIds.length,
      shipmentCreated,
      shipmentId,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to process inbound email" },
      { status: 500 }
    );
  }
}
