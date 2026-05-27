// CargoIQ — Shared AI Prompts
// Extraction prompt used by /api/ai/extract and /api/process

export interface FieldExtraction {
  value: string | number | null;
  confidence: "high" | "medium" | "low";
}

export interface ExtractionResult {
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
  line_items?: Array<{
    hs_code: string | null;
    description: string | null;
    quantity: number | null;
    unit: string | null;
    unit_weight: number | null;
    total_weight: number | null;
    unit_value: number | null;
    total_value: number | null;
    currency: string | null;
    confidence: "high" | "medium" | "low";
  }>;
}

export type DocumentType =
  | "commercial_invoice"
  | "packing_list"
  | "bill_of_lading"
  | "airway_bill"
  | "customs_declaration"
  | "other";

export const EXTRACTION_SYSTEM_PROMPT = `You are a specialist freight forwarding document extraction AI for the South African market.
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

If the document contains line items (multiple products in an invoice or packing list), include them in the "line_items" array.

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
  "extraction_notes": "",
  "line_items": [
    {
      "hs_code": null,
      "description": null,
      "quantity": null,
      "unit": null,
      "unit_weight": null,
      "total_weight": null,
      "unit_value": null,
      "total_value": null,
      "currency": null,
      "confidence": "low"
    }
  ]
}`;

export function defaultExtraction(): ExtractionResult {
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

export function parseExtractionResponse(content: string): ExtractionResult {
  const defaults = defaultExtraction();
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ...defaults,
        extraction_notes: "AI response did not contain valid JSON structure.",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: ExtractionResult = { ...defaults };

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

    // Parse line items if present
    if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
      result.line_items = parsed.line_items.map((item: Record<string, unknown>) => ({
        hs_code: (item.hs_code as string) || null,
        description: (item.description as string) || null,
        quantity: typeof item.quantity === "number" ? item.quantity : null,
        unit: (item.unit as string) || null,
        unit_weight: typeof item.unit_weight === "number" ? item.unit_weight : null,
        total_weight: typeof item.total_weight === "number" ? item.total_weight : null,
        unit_value: typeof item.unit_value === "number" ? item.unit_value : null,
        total_value: typeof item.total_value === "number" ? item.total_value : null,
        currency: (item.currency as string) || null,
        confidence: ["high", "medium", "low"].includes(item.confidence as string)
          ? (item.confidence as "high" | "medium" | "low")
          : "low",
      }));
    }

    // Overall confidence
    if (["high", "medium", "low"].includes(parsed.overall_confidence)) {
      result.overall_confidence = parsed.overall_confidence;
    } else {
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
