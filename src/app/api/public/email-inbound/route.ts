// POST /api/public/email-inbound - Public email inbound webhook (no auth required)
// Receives email webhooks from SendGrid/Mailgun
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateNextReference } from "@/lib/reference-generator";
import { extractFromDocument } from "@/lib/ai-extraction";
import {
  runComplianceShield,
  type ComplianceShieldInput,
} from "@/lib/compliance-engine";
import { portToCountryCode, estimateZarValue } from "@/lib/api-utils";
import { notifyShipment } from "@/lib/notify";

// Freight keywords for classification
const FREIGHT_KEYWORDS = [
  "shipment", "cargo", "freight", "bill of lading", "b/l", "awb",
  "airway bill", "container", "customs", "import", "export", "port",
  "vessel", "shipping", "logistics", "forwarding", "clearing",
  "consignment", "deliver", "eta", "etd", "incoterm", "fob", "cif",
  "packing list", "commercial invoice", "hs code", "duties", "vat",
  "sars", "customs value", "border", "manifest", "warehouse",
];

// Simple org resolution from email domain or header
async function resolveOrgId(request: NextRequest): Promise<string | null> {
  // Try X-Org-Id header
  const headerOrgId = request.headers.get("x-org-id");
  if (headerOrgId) return headerOrgId;

  // Try orgId query param
  const queryOrgId = request.nextUrl.searchParams.get("orgId");
  if (queryOrgId) return queryOrgId;

  // Try to match by email domain
  try {
    const body = await request.clone().json().catch(() => ({}));
      const fromAddress = (body as Record<string, unknown>).from as string | undefined;
    if (fromAddress && typeof fromAddress === "string") {
      const domain = fromAddress.split("@")[1]?.toLowerCase();
      if (domain) {
        const org = await db.organisation.findFirst({
          where: { slug: domain },
        });
        if (org) return org.id;
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Fall back to first org
  const firstOrg = await db.organisation.findFirst({
    orderBy: { createdAt: "asc" },
  });
  return firstOrg?.id || null;
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await resolveOrgId(request);
    if (!orgId) {
      return NextResponse.json(
        { error: "no_org", message: "Could not determine organisation for this email" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Support both SendGrid and Mailgun webhook formats
    const fromAddress =
      (body.from as string) ||
      (body.fromAddress as string) ||
      (body.sender as string) ||
      null;
    const subject =
      (body.subject as string) || null;
    const bodyPreview =
      (body.text as string) ||
      (body.bodyPreview as string) ||
      (body.stripped_text as string) ||
      (body.html as string) ||
      null;
    const attachments = (body.attachments as Array<{
      filename: string;
      contentType: string;
      content?: string; // base64 encoded
      size?: number;
    }>) || [];

    if (!fromAddress && !subject) {
      return NextResponse.json(
        { error: "bad_request", message: "Email must contain from address or subject" },
        { status: 400 }
      );
    }

    // Create InboundEmail record
    const inboundEmail = await db.inboundEmail.create({
      data: {
        orgId,
        fromAddress,
        subject,
        bodyPreview: bodyPreview?.substring(0, 2000) || null,
        receivedAt: new Date(),
        classification: "unknown",
        status: "processing",
      },
    });

    // Create Document records for attachments
    const documentIds: string[] = [];
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

    // Classify freight vs non-freight
    const textToClassify = `${subject || ""} ${bodyPreview || ""}`.toLowerCase();
    const isFreight = FREIGHT_KEYWORDS.some((keyword) =>
      textToClassify.includes(keyword.toLowerCase())
    );

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
      });
    }

    // If freight, trigger processing pipeline
    let extractionResult = null;

    if (attachments.length > 0 && attachments[0].content) {
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
        try {
          const rawText = atob(base64Content);
          extractionResult = await extractFromDocument({ textContent: rawText });
        } catch {
          extractionResult = null;
        }
      }
    } else if (bodyPreview) {
      extractionResult = await extractFromDocument({ textContent: bodyPreview });
    }

    // Update document statuses
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
        message: "Extraction failed",
        documentIds,
      });
    }

    // Create shipment
    const fieldValue = (key: string): string | number | null => {
      const field = extractionResult[key as keyof typeof extractionResult];
      if (field && typeof field === "object" && "value" in field) {
        return (field as { value: string | number | null }).value ?? null;
      }
      return null;
    };

    const reference = await generateNextReference(db);

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
        confidenceScores: JSON.stringify(
          Object.fromEntries(
            Object.entries(extractionResult)
              .filter(([, v]) => v && typeof v === "object" && "confidence" in v)
              .map(([k, v]) => [k, (v as { confidence: string }).confidence])
          )
        ),
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

    // Compliance events
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
          fromAddress,
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
    console.error("Error processing inbound email webhook:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Email webhook processing failed" },
      { status: 500 }
    );
  }
}
