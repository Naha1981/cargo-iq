// CargoIQ — AI Extraction Prompts & Types
// Shared prompts, types, and parsers for SA freight document extraction

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";

export interface FieldExtraction {
  value: string | number | null;
  confidence: Confidence;
}

export interface ExtractionResult {
  shipperName: FieldExtraction;
  consigneeName: FieldExtraction;
  shipperAddress: FieldExtraction;
  consigneeAddress: FieldExtraction;
  originPort: FieldExtraction;
  destinationPort: FieldExtraction;
  cargoDescription: FieldExtraction;
  hsCodePrimary: FieldExtraction;
  grossWeight: FieldExtraction;
  netWeight: FieldExtraction;
  weightUnit: FieldExtraction;
  numberOfPackages: FieldExtraction;
  incoterms: FieldExtraction;
  invoiceNumber: FieldExtraction;
  invoiceValue: FieldExtraction;
  currency: FieldExtraction;
  awbOrBlNumber: FieldExtraction;
  overall_confidence: Confidence;
  extraction_notes: string;
}

export type DocumentType =
  | "commercial_invoice"
  | "packing_list"
  | "bill_of_lading"
  | "airway_bill"
  | "customs_declaration"
  | "certificate_of_origin"
  | "other";

// ---------------------------------------------------------------------------
// Extraction field keys (for iteration)
// ---------------------------------------------------------------------------

export const EXTRACTION_FIELDS = [
  "shipperName",
  "consigneeName",
  "shipperAddress",
  "consigneeAddress",
  "originPort",
  "destinationPort",
  "cargoDescription",
  "hsCodePrimary",
  "grossWeight",
  "netWeight",
  "weightUnit",
  "numberOfPackages",
  "incoterms",
  "invoiceNumber",
  "invoiceValue",
  "currency",
  "awbOrBlNumber",
] as const;

export type ExtractionFieldKey = (typeof EXTRACTION_FIELDS)[number];

// ---------------------------------------------------------------------------
// Default empty extraction result
// ---------------------------------------------------------------------------

export function defaultExtraction(): ExtractionResult {
  return {
    shipperName: { value: null, confidence: "low" },
    consigneeName: { value: null, confidence: "low" },
    shipperAddress: { value: null, confidence: "low" },
    consigneeAddress: { value: null, confidence: "low" },
    originPort: { value: null, confidence: "low" },
    destinationPort: { value: null, confidence: "low" },
    cargoDescription: { value: null, confidence: "low" },
    hsCodePrimary: { value: null, confidence: "low" },
    grossWeight: { value: null, confidence: "low" },
    netWeight: { value: null, confidence: "low" },
    weightUnit: { value: "KGS", confidence: "high" },
    numberOfPackages: { value: null, confidence: "low" },
    incoterms: { value: null, confidence: "low" },
    invoiceNumber: { value: null, confidence: "low" },
    invoiceValue: { value: null, confidence: "low" },
    currency: { value: "USD", confidence: "medium" },
    awbOrBlNumber: { value: null, confidence: "low" },
    overall_confidence: "low",
    extraction_notes: "",
  };
}

// ---------------------------------------------------------------------------
// System Prompt — SA Freight Document Extraction
// ---------------------------------------------------------------------------

export const EXTRACTION_SYSTEM_PROMPT = `You are a specialist freight forwarding document extraction AI for the South African market.
You extract structured shipment data from logistics emails, invoices, packing lists, bills of lading, and airway bills.

CRITICAL RULES:
1. Set confidence to HIGH only when the value is explicitly and clearly stated in the source material.
2. If a field is not present in the documents, leave value as null — never guess or infer.
3. For weights, always note the unit (KGS, LBS, CBM). Default to KGS if not specified.
4. For HS codes, extract exactly as written — do not correct or expand. Note if the extracted code is not 8 digits.
5. For ports, use standard UN/LOCODE port codes where identifiable.
6. South African port codes (MEMORISE):
   - ZADUR  → Durban (largest port)
   - ZACPT  → Cape Town
   - ZAJNB  → Johannesburg (dry port / City Deep)
   - ZAPLG  → Port Elizabeth / Gqeberha
   - ZAELS  → East London
   - ZARBY  → Richards Bay
   - ZASDB  → Saldanha Bay
7. HS codes must be 8 numeric digits for SARS (South African Revenue Service). If the extracted code has fewer or more digits, set confidence to LOW and add a note.
8. Common incoterms in South African trade: FOB, CIF, CFR, DAP, DDP, EXW, FCA, CPT, CIP.
9. Currency: South African imports are typically invoiced in USD, EUR, GBP, or ZAR. Default to USD if unclear.
10. AWB numbers are typically 11 digits (3-digit airline prefix + 8-digit number). BL numbers vary by shipping line.

CONFIDENCE SCORING:
- HIGH: Value is explicitly and clearly stated in the document (e.g., "Gross Weight: 500 KGS")
- MEDIUM: Value can be reasonably inferred from context (e.g., shipper address from letterhead)
- LOW: Value is absent, ambiguous, or could not be extracted

Respond with valid JSON only, no additional text, no markdown fences. Use this exact schema:
{
  "shipperName": {"value": null, "confidence": "low"},
  "consigneeName": {"value": null, "confidence": "low"},
  "shipperAddress": {"value": null, "confidence": "low"},
  "consigneeAddress": {"value": null, "confidence": "low"},
  "originPort": {"value": null, "confidence": "low"},
  "destinationPort": {"value": null, "confidence": "low"},
  "cargoDescription": {"value": null, "confidence": "low"},
  "hsCodePrimary": {"value": null, "confidence": "low"},
  "grossWeight": {"value": null, "confidence": "low"},
  "netWeight": {"value": null, "confidence": "low"},
  "weightUnit": {"value": "KGS", "confidence": "high"},
  "numberOfPackages": {"value": null, "confidence": "low"},
  "incoterms": {"value": null, "confidence": "low"},
  "invoiceNumber": {"value": null, "confidence": "low"},
  "invoiceValue": {"value": null, "confidence": "low"},
  "currency": {"value": "USD", "confidence": "medium"},
  "awbOrBlNumber": {"value": null, "confidence": "low"},
  "overall_confidence": "low",
  "extraction_notes": ""
}`;

// ---------------------------------------------------------------------------
// Parse LLM response into ExtractionResult
// ---------------------------------------------------------------------------

const VALID_CONFIDENCES: Confidence[] = ["high", "medium", "low"];

function isValidConfidence(v: unknown): v is Confidence {
  return typeof v === "string" && VALID_CONFIDENCES.includes(v as Confidence);
}

/**
 * Map of camelCase (our canonical) → snake_case (LLM may return either).
 * We accept both forms from the LLM response.
 */
const FIELD_ALIASES: Record<string, ExtractionFieldKey> = {
  shipperName: "shipperName",
  shipper_name: "shipperName",
  consigneeName: "consigneeName",
  consignee_name: "consigneeName",
  shipperAddress: "shipperAddress",
  shipper_address: "shipperAddress",
  consigneeAddress: "consigneeAddress",
  consignee_address: "consigneeAddress",
  originPort: "originPort",
  origin_port: "originPort",
  destinationPort: "destinationPort",
  destination_port: "destinationPort",
  cargoDescription: "cargoDescription",
  cargo_description: "cargoDescription",
  hsCodePrimary: "hsCodePrimary",
  hs_code_primary: "hsCodePrimary",
  grossWeight: "grossWeight",
  gross_weight: "grossWeight",
  netWeight: "netWeight",
  net_weight: "netWeight",
  weightUnit: "weightUnit",
  weight_unit: "weightUnit",
  numberOfPackages: "numberOfPackages",
  number_of_packages: "numberOfPackages",
  incoterms: "incoterms",
  invoiceNumber: "invoiceNumber",
  invoice_number: "invoiceNumber",
  invoiceValue: "invoiceValue",
  invoice_value: "invoiceValue",
  currency: "currency",
  awbOrBlNumber: "awbOrBlNumber",
  awb_or_bl_number: "awbOrBlNumber",
};

export function parseExtractionResponse(raw: string): ExtractionResult {
  const defaults = defaultExtraction();

  try {
    // Extract JSON from the response (may be wrapped in markdown fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ...defaults,
        extraction_notes: "AI response did not contain valid JSON structure.",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: ExtractionResult = { ...defaults };

    // Map each field, accepting both camelCase and snake_case keys
    for (const [rawKey, canonicalKey] of Object.entries(FIELD_ALIASES)) {
      const fieldData = parsed[rawKey];
      if (fieldData && typeof fieldData === "object") {
        result[canonicalKey] = {
          value: fieldData.value ?? null,
          confidence: isValidConfidence(fieldData.confidence)
            ? fieldData.confidence
            : "low",
        };
      }
    }

    // Overall confidence — use LLM value if valid, else calculate
    if (isValidConfidence(parsed.overall_confidence)) {
      result.overall_confidence = parsed.overall_confidence;
    } else {
      const nonNullFields = EXTRACTION_FIELDS.filter(
        (f) => result[f].value !== null
      );
      const highCount = nonNullFields.filter(
        (f) => result[f].confidence === "high"
      ).length;
      const total = nonNullFields.length || 1;

      if (highCount / total > 0.6) {
        result.overall_confidence = "high";
      } else if (highCount / total > 0.3) {
        result.overall_confidence = "medium";
      } else {
        result.overall_confidence = "low";
      }
    }

    // Extraction notes
    if (typeof parsed.extraction_notes === "string") {
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
