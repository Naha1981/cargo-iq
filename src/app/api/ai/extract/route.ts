// POST /api/ai/extract - AI document extraction endpoint
// Uses z-ai-web-dev-sdk for AI-powered extraction
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, text } = body;

    if (!text && !documentId) {
      return NextResponse.json(
        { error: "bad_request", message: "Provide documentId or text to extract" },
        { status: 400 }
      );
    }

    let extractionText = text || "";

    // If documentId provided, get the stored text
    if (documentId) {
      const document = await db.document.findUnique({ where: { id: documentId } });
      if (!document) {
        return NextResponse.json({ error: "not_found", message: "Document not found" }, { status: 404 });
      }
      extractionText = document.rawText || "";
    }

    if (!extractionText.trim()) {
      return NextResponse.json({ error: "bad_request", message: "No text content to extract from" }, { status: 400 });
    }

    // Use the z-ai-web-dev-sdk LLM for structured extraction
    try {
      const { LLM } = await import("z-ai-web-dev-sdk");
      const llm = new LLM();

      const extractionPrompt = `You are a specialist freight-forwarding document extraction AI for South African customs compliance.
Extract structured shipment data from the following logistics document text.

CRITICAL RULES:
1. Only extract values that are explicitly stated in the text. Never guess.
2. For HS codes, extract exactly as written.
3. For ports, use standard UN/LOCODE where identifiable (ZADUR, ZACPT, CNSHA, etc.).
4. SA ports: ZADUR (Durban), ZACPT (Cape Town), ZAPLZ (Port Elizabeth).
5. HS codes must be 8 digits for SARS.

Extract the following as a JSON object with these fields (use null for missing):
{
  "shipperName": null,
  "shipperAddress": null,
  "consigneeName": null,
  "consigneeAddress": null,
  "originPort": null,
  "destinationPort": null,
  "shipmentType": null,
  "cargoDescription": null,
  "hsCodePrimary": null,
  "grossWeight": null,
  "weightUnit": "KGS",
  "netWeight": null,
  "numberOfPackages": null,
  "incoterms": null,
  "invoiceNumber": null,
  "invoiceValue": null,
  "currency": "USD",
  "awbOrBlNumber": null,
  "vesselOrFlight": null,
  "eta": null,
  "etd": null,
  "overallConfidence": "low",
  "extractionNotes": null
}

DOCUMENT TEXT:
${extractionText.substring(0, 30000)}`;

      const result = await llm.chat({
        messages: [{ role: "user", content: extractionPrompt }],
        temperature: 0.1,
        maxTokens: 2048,
      });

      let extracted: Record<string, unknown> = {};
      try {
        const content = result.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
      } catch {
        extracted = { extractionNotes: "Failed to parse AI response", overallConfidence: "low" };
      }

      if (documentId) {
        const document = await db.document.findUnique({ where: { id: documentId } });
        if (document) {
          let org = await db.organisation.findFirst();
          if (!org) org = await db.organisation.create({ data: { name: "Demo Organisation", slug: "demo" } });

          const shipmentCount = await db.shipment.count({ where: { orgId: org.id } });
          const reference = `CIQ-${new Date().getFullYear()}-${String(shipmentCount + 1).padStart(5, "0")}`;

          const shipment = await db.shipment.create({
            data: {
              orgId: org.id, reference, source: "manual_upload", status: "pending",
              shipperName: (extracted.shipperName as string) || null,
              shipperAddress: (extracted.shipperAddress as string) || null,
              consigneeName: (extracted.consigneeName as string) || null,
              consigneeAddress: (extracted.consigneeAddress as string) || null,
              originPort: (extracted.originPort as string) || null,
              destinationPort: (extracted.destinationPort as string) || null,
              shipmentType: (extracted.shipmentType as string) || null,
              cargoDescription: (extracted.cargoDescription as string) || null,
              hsCodePrimary: (extracted.hsCodePrimary as string) || null,
              grossWeight: extracted.grossWeight ? Number(extracted.grossWeight) : null,
              weightUnit: (extracted.weightUnit as string) || "KGS",
              netWeight: extracted.netWeight ? Number(extracted.netWeight) : null,
              numberOfPackages: extracted.numberOfPackages ? Number(extracted.numberOfPackages) : null,
              incoterms: (extracted.incoterms as string) || null,
              invoiceNumber: (extracted.invoiceNumber as string) || null,
              invoiceValue: extracted.invoiceValue ? Number(extracted.invoiceValue) : null,
              currency: (extracted.currency as string) || "USD",
              awbOrBlNumber: (extracted.awbOrBlNumber as string) || null,
              vesselOrFlight: (extracted.vesselOrFlight as string) || null,
              overallConfidence: (extracted.overallConfidence as string) || "low",
              shieldStatus: "pending",
            },
          });

          await db.shipmentDocument.create({ data: { shipmentId: shipment.id, documentId } });
          await db.document.update({ where: { id: documentId }, data: { status: "processed" } });
          await db.auditLog.create({
            data: { orgId: org.id, entityType: "shipment", entityId: shipment.id, action: "extracted", actorType: "ai_system", afterState: JSON.stringify(extracted) },
          });

          return NextResponse.json({ shipmentId: shipment.id, reference: shipment.reference, extracted });
        }
      }

      return NextResponse.json({ extracted });
    } catch (aiError) {
      console.error("AI extraction error:", aiError);
      return NextResponse.json({
        extracted: { overallConfidence: "low", extractionNotes: "AI extraction temporarily unavailable." },
        error: "ai_unavailable",
      });
    }
  } catch (error) {
    console.error("Error in AI extraction:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to extract data" }, { status: 500 });
  }
}
