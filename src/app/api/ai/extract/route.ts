// POST /api/ai/extract - AI document extraction endpoint
// Uses z-ai-web-dev-sdk for AI-powered extraction (VLM for images, LLM for text/PDF)
import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FieldExtraction {
  value: string | number | null;
  confidence: "high" | "medium" | "low";
}

interface ExtractionResult {
  shipper_name: FieldExtraction;
  shipper_address: FieldExtraction;
  consignee_name: FieldExtraction;
  consignee_address: FieldExtraction;
  origin_port: FieldExtraction;
  destination_port: FieldExtraction;
  cargo_description: FieldExtraction;
  hs_code_primary: FieldExtraction;
  gross_weight: FieldExtraction;
  net_weight: FieldExtraction;
  weight_unit: FieldExtraction;
  number_of_packages: FieldExtraction;
  incoterms: FieldExtraction;
  invoice_number: FieldExtraction;
  invoice_value: FieldExtraction;
  currency: FieldExtraction;
  awb_or_bl_number: FieldExtraction;
  overall_confidence: "high" | "medium" | "low";
  extraction_notes: string;
}

type DocumentType =
  | "commercial_invoice"
  | "packing_list"
  | "bill_of_lading"
  | "airway_bill"
  | "customs_declaration"
  | "other";

// ─── Default empty extraction result ─────────────────────────────────────────

function defaultExtraction(): ExtractionResult {
  return {
    shipper_name: { value: null, confidence: "low" },
    shipper_address: { value: null, confidence: "low" },
    consignee_name: { value: null, confidence: "low" },
    consignee_address: { value: null, confidence: "low" },
    origin_port: { value: null, confidence: "low" },
    destination_port: { value: null, confidence: "low" },
    cargo_description: { value: null, confidence: "low" },
    hs_code_primary: { value: null, confidence: "low" },
    gross_weight: { value: null, confidence: "low" },
    net_weight: { value: null, confidence: "low" },
    weight_unit: { value: "KGS", confidence: "high" },
    number_of_packages: { value: null, confidence: "low" },
    incoterms: { value: null, confidence: "low" },
    invoice_number: { value: null, confidence: "low" },
    invoice_value: { value: null, confidence: "low" },
    currency: { value: "USD", confidence: "medium" },
    awb_or_bl_number: { value: null, confidence: "low" },
    overall_confidence: "low",
    extraction_notes: "",
  };
}

// ─── System prompt for extraction ────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a specialist freight forwarding document extraction AI for the South African market.
You extract structured shipment data from logistics emails and documents.

CRITICAL RULES:
1. Set confidence to HIGH only when the value is explicitly and clearly stated in the source material.
2. If a field is not present in the documents, leave value as null — never guess.
3. For weights, always note the unit (KGS, LBS, CBM).
4. For HS codes, extract exactly as written — do not correct or expand.
5. For ports, use standard port codes where identifiable (ZADUR, ZACPT, CNSHA).
6. South African ports: ZADUR (Durban), ZACPT (Cape Town), ZAPLZ (Port Elizabeth)
7. HS codes must be 8 digits for SARS — note if extracted code is not 8 digits
8. Common incoterms in SA: FOB, CIF, CFR, DAP, DDP, EXW

Respond with valid JSON only, no additional text. Use this schema:
{
  "shipper_name": {"value": null, "confidence": "low"},
  "shipper_address": {"value": null, "confidence": "low"},
  "consignee_name": {"value": null, "confidence": "low"},
  "consignee_address": {"value": null, "confidence": "low"},
  "origin_port": {"value": null, "confidence": "low"},
  "destination_port": {"value": null, "confidence": "low"},
  "cargo_description": {"value": null, "confidence": "low"},
  "hs_code_primary": {"value": null, "confidence": "low"},
  "gross_weight": {"value": null, "confidence": "low"},
  "net_weight": {"value": null, "confidence": "low"},
  "weight_unit": {"value": "KGS", "confidence": "high"},
  "number_of_packages": {"value": null, "confidence": "low"},
  "incoterms": {"value": null, "confidence": "low"},
  "invoice_number": {"value": null, "confidence": "low"},
  "invoice_value": {"value": null, "confidence": "low"},
  "currency": {"value": "USD", "confidence": "medium"},
  "awb_or_bl_number": {"value": null, "confidence": "low"},
  "overall_confidence": "low",
  "extraction_notes": ""
}`;

// ─── Helper: determine if file is an image ───────────────────────────────────

function isImageFile(contentType: string): boolean {
  return contentType === "image/png" || contentType === "image/jpeg" || contentType === "image/jpg" || contentType === "image/webp";
}

function isPdfFile(contentType: string): boolean {
  return contentType === "application/pdf";
}

// ─── Helper: convert ArrayBuffer to base64 ───────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Helper: parse AI response JSON ──────────────────────────────────────────

function parseExtractionResponse(content: string): ExtractionResult {
  const defaults = defaultExtraction();
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ...defaults,
        extraction_notes: "AI response did not contain valid JSON structure.",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: ExtractionResult = { ...defaults };

    // Map each field, validating structure
    const fields = [
      "shipper_name", "shipper_address", "consignee_name", "consignee_address",
      "origin_port", "destination_port", "cargo_description", "hs_code_primary",
      "gross_weight", "net_weight", "weight_unit", "number_of_packages",
      "incoterms", "invoice_number", "invoice_value", "currency", "awb_or_bl_number",
    ] as const;

    for (const field of fields) {
      if (parsed[field] && typeof parsed[field] === "object") {
        result[field] = {
          value: parsed[field].value ?? null,
          confidence: ["high", "medium", "low"].includes(parsed[field].confidence)
            ? parsed[field].confidence
            : "low",
        };
      }
    }

    // Overall confidence
    if (["high", "medium", "low"].includes(parsed.overall_confidence)) {
      result.overall_confidence = parsed.overall_confidence;
    } else {
      // Calculate overall confidence from field confidences
      const highCount = fields.filter(
        (f) => result[f].confidence === "high" && result[f].value !== null
      ).length;
      const nonNullCount = fields.filter((f) => result[f].value !== null).length;

      if (nonNullCount === 0) {
        result.overall_confidence = "low";
      } else if (highCount / nonNullCount > 0.6) {
        result.overall_confidence = "high";
      } else if (highCount / nonNullCount > 0.3) {
        result.overall_confidence = "medium";
      } else {
        result.overall_confidence = "low";
      }
    }

    // Extraction notes
    if (parsed.extraction_notes && typeof parsed.extraction_notes === "string") {
      result.extraction_notes = parsed.extraction_notes;
    }

    return result;
  } catch {
    return {
      ...defaults,
      extraction_notes: "Failed to parse AI extraction response.",
    };
  }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Support both FormData (file upload) and JSON (text extraction) modes
    let file: File | null = null;
    let documentType: DocumentType | undefined;
    let textContent: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // FormData mode — file upload
      const formData = await request.formData();
      file = formData.get("file") as File | null;
      documentType = (formData.get("documentType") as DocumentType) || undefined;
      textContent = (formData.get("text") as string) || null;

      if (!file && !textContent) {
        return NextResponse.json(
          { error: "bad_request", message: "Provide a 'file' (FormData upload) or 'text' field" },
          { status: 400 }
        );
      }
    } else {
      // JSON mode — text extraction only
      const body = await request.json();
      textContent = body.text || null;
      documentType = body.documentType || undefined;

      if (!textContent) {
        return NextResponse.json(
          { error: "bad_request", message: "Provide a 'file' (FormData upload) or 'text' field" },
          { status: 400 }
        );
      }
    }

    // Initialize ZAI SDK
    const zai = await ZAI.create();

    let extractionResult: ExtractionResult;

    // ── Image extraction path (VLM) ────────────────────────────────────────
    if (file && isImageFile(file.type)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:${file.type};base64,${base64}`;

      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      const userMessage: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        {
          type: "text",
          text: `Extract all shipment fields from this logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
        },
        {
          type: "image_url",
          image_url: { url: dataUri },
        },
      ];

      const response = await zai.chat.completions.createVision({
        model: "default",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || "";
      extractionResult = parseExtractionResponse(content);
      extractionResult.extraction_notes =
        (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
        `Extracted via VLM from image (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;
    }
    // ── PDF extraction path (VLM with file_url or LLM with extracted text) ─
    else if (file && isPdfFile(file.type)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:application/pdf;base64,${base64}`;

      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      // Try VLM with PDF file_url first
      try {
        const userMessage = [
          {
            type: "text",
            text: `Extract all shipment fields from this PDF logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
          },
          {
            type: "file_url",
            file_url: { url: dataUri },
          },
        ];

        const response = await zai.chat.completions.createVision({
          model: "default",
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: userMessage as any },
          ],
          stream: false,
        });

        const content = response?.choices?.[0]?.message?.content || "";
        extractionResult = parseExtractionResponse(content);
        extractionResult.extraction_notes =
          (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
          `Extracted via VLM from PDF (${(file.size / 1024).toFixed(1)}KB)`;
      } catch {
        // Fallback: if VLM with PDF fails, return default with note
        extractionResult = defaultExtraction();
        extractionResult.extraction_notes =
          `PDF extraction via VLM failed. File size: ${(file.size / 1024).toFixed(1)}KB. Consider extracting text separately.`;
      }
    }
    // ── Text extraction path (LLM) ─────────────────────────────────────────
    else if (textContent) {
      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      const response = await zai.chat.completions.create({
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract all shipment fields from the following logistics document text.${docTypeHint}\n\nDOCUMENT TEXT:\n${textContent.substring(0, 30000)}`,
          },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || "";
      extractionResult = parseExtractionResponse(content);
      extractionResult.extraction_notes =
        (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
        "Extracted via LLM from text input";
    }
    // ── Other file type — attempt with VLM ─────────────────────────────────
    else if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:${file.type};base64,${base64}`;

      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      const userMessage = [
        {
          type: "text",
          text: `Extract all shipment fields from this document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
        },
        {
          type: "image_url",
          image_url: { url: dataUri },
        },
      ];

      try {
        const response = await zai.chat.completions.createVision({
          model: "default",
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: userMessage as any },
          ],
          stream: false,
        });

        const content = response?.choices?.[0]?.message?.content || "";
        extractionResult = parseExtractionResponse(content);
        extractionResult.extraction_notes =
          (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
          `Extracted via VLM from file (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;
      } catch {
        extractionResult = defaultExtraction();
        extractionResult.extraction_notes =
          `Extraction failed for file type: ${file.type}. Unsupported format.`;
      }
    } else {
      return NextResponse.json(
        { error: "bad_request", message: "No file or text provided for extraction" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      extracted: extractionResult,
      document_type: documentType || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in AI extraction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : "Failed to extract data",
        extracted: defaultExtraction(),
      },
      { status: 500 }
    );
  }
}
