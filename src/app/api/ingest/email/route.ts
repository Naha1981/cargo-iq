// POST /api/ingest/email - Email ingestion webhook
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest, safeJsonParse } from "@/lib/api-utils";
import { generateNextReference } from "@/lib/reference-generator";
import { extractFromDocument, arrayBufferToBase64 } from "@/lib/ai-extraction";
import {
  runComplianceShield,
  type ComplianceShieldInput,
} from "@/lib/compliance-engine";
import { portToCountryCode, estimateZarValue } from "@/lib/api-utils";
import { notifyShipment } from "@/lib/notify";

// Freight keywords for simple heuristic classification
const FREIGHT_KEYWORDS = [
  "shipment", "cargo", "freight", "bill of lading", "b/l", "awb",
  "airway bill", "container", "customs", "import", "export", "port",
  "vessel", "shipping", "logistics", "forwarding", "clearing",
  "consignment", "deliver", "eta", "etd", "incoterm", "fob", "cif",
  "packing list", "commercial invoice", "hs code", "duties", "vat",
  "sars", "customs value", "border", "manifest", "warehouse",
];

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const body = await request.json();

    const { fromAddress, subject, bodyPreview, attachments } = body as {
      fromAddress?: string;
      subject?: string;
      bodyPreview?: string;
      attachments?: Array<{
        filename: string;
        contentType: string;
        content?: string; // base64 encoded
        size?: number;
      }>;
    };

    if (!fromAddress && !subject) {
      return NextResponse.json(
        { error: "bad_request", message: "fromAddress or subject is required" },
        { status: 400 }
      );
    }

    // Step 1: Create InboundEmail record
    const inboundEmail = await db.inboundEmail.create({
      data: {
        orgId,
        fromAddress: fromAddress || null,
        subject: subject || null,
        bodyPreview: bodyPreview || null,
        receivedAt: new Date(),
        classification: "unknown",
        status: "processing",
      },
    });

    // Step 2: Create Document records for attachments
    const documentIds: string[] = [];
    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        const doc = await db.document.create({
          data: {
            orgId,
            emailId: inboundEmail.id,
            storagePath: `/emails/${orgId}/${inboundEmail.id}/${attachment.filename}`,
            filename: attachment.filename,
            fileType: attachment.contentType?.split("/").pop() || "unknown",
            docType: "unknown",
            status: "pending",
          },
        });
        documentIds.push(doc.id);
      }
    }

    // Step 3: Classify freight vs non-freight (simple heuristic)
    const textToClassify = `${subject || ""} ${bodyPreview || ""}`.toLowerCase();
    const isFreight = FREIGHT_KEYWORDS.some((keyword) =>
      textToClassify.includes(keyword.toLowerCase())
    );

    // Update email classification
    await db.inboundEmail.update({
      where: { id: inboundEmail.id },
      data: {
        classification: isFreight ? "freight" : "non_freight",
        status: isFreight ? "processing" : "ignored",
      },
    });

    if (!isFreight) {
      return NextResponse.json({
        id: inboundEmail.id,
        classification: "non_freight",
        status: "ignored",
        message: "Email classified as non-freight — no processing required",
      });
    }

    // Step 4: If freight, trigger full processing pipeline
    // For now, process the first attachment if available
    let extractionResult = null;

    if (attachments && attachments.length > 0 && attachments[0].content) {
      const firstAttachment = attachments[0];
      const base64Content = firstAttachment.content;
      const mimeType = firstAttachment.contentType;

      if (mimeType.startsWith("image/")) {
        const dataUri = `data:${mimeType};base64,${base64Content}`;
        extractionResult = await extractFromDocument({
          imageDataUri: dataUri,
          fileMimeType: mimeType,
        });
      } else if (mimeType === "application/pdf") {
        const dataUri = `data:application/pdf;base64,${base64Content}`;
        extractionResult = await extractFromDocument({
          pdfDataUri: dataUri,
          fileMimeType: mimeType,
        });
      } else {
        // Try as text
        try {
          const rawText = atob(base64Content);
          extractionResult = await extractFromDocument({ textContent: rawText });
        } catch {
          extractionResult = null;
        }
      }
    } else if (bodyPreview) {
      // Fall back to body text extraction
      extractionResult = await extractFromDocument({ textContent: bodyPreview });
    }

    // Update documents as processed
    for (const docId of documentIds) {
      await db.document.update({
        where: { id: docId },
        data: { status: extractionResult ? "processed" : "failed" },
      });
    }

    if (!extractionResult) {
      await db.inboundEmail.update({
        where: { id: inboundEmail.id },
        data: { status: "processed" },
      });
      return NextResponse.json({
        id: inboundEmail.id,
        classification: "freight",
        status: "processed",
        message: "Email classified as freight but extraction failed",
        documentIds,
      });
    }

    // Create shipment from extraction
    const fieldValue = (key: string): string | number | null => {
      const field = extractionResult![key as keyof typeof extractionResult!];
      if (field && typeof field === "object" && "value" in field) {
        return (field as { value: string | number | null }).value ?? null;
      }
      return null;
    };

    const reference = await generateNextReference(db);

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
        source: "email",
        status: "pending",
      },
    });

    // Link documents
    for (const docId of documentIds) {
      await db.shipmentDocument.create({
        data: { shipmentId: shipment.id, documentId: docId },
      });
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

    // Update email status
    await db.inboundEmail.update({
      where: { id: inboundEmail.id },
      data: { status: "processed" },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        orgId,
        entityType: "shipment",
        entityId: shipment.id,
        action: "extracted",
        actorType: "ai_system",
        metadata: JSON.stringify({
          reference: shipment.reference,
          source: "email",
          emailId: inboundEmail.id,
          fromAddress: fromAddress || null,
          shieldOverall: shieldResult.overall,
        }),
      },
    });

    // Notification
    await notifyShipment("shipment:created", shipment.id, {
      reference: shipment.reference,
      source: "email",
      fromAddress,
    });

    return NextResponse.json(
      {
        id: inboundEmail.id,
        classification: "freight",
        status: "processed",
        shipmentId: shipment.id,
        reference: shipment.reference,
        shieldOverall: shieldResult.overall,
        documentIds,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing email ingestion:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Email ingestion failed" },
      { status: 500 }
    );
  }
}
