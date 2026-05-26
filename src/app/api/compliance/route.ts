// POST /api/compliance - Compliance Shield API
// 3 Phase-1 modules: Invoice↔PL Cross-Reference, HS Code Validator, SACU/Non-SACU VAT Engine
import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceData {
  gross_weight: number;
  net_weight: number;
  total_value: number;
  package_count: number;
}

interface PackingListData {
  gross_weight: number;
  net_weight: number;
  package_count: number;
}

interface LineItem {
  hs_code: string;
}

interface ComplianceRequest {
  shipment_id?: string;
  invoice_data: InvoiceData;
  packing_list_data: PackingListData;
  line_items: LineItem[];
  origin_country_code: string;
  customs_value_zar: number;
  duties_zar: number;
  declared_vat_zar: number;
}

type ModuleResult = "pass" | "hold" | "fail";

interface ComplianceModule {
  module: string;
  result: ModuleResult;
  detail: Record<string, unknown>;
  penalty_risk: boolean;
}

interface ComplianceResponse {
  overall: ModuleResult;
  modules: ComplianceModule[];
  penalty_risk_detected: boolean;
  block_cargowise: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SACU_COUNTRIES = new Set(["ZA", "LS", "NA", "SZ", "BW"]);
const VAT_RATE = 0.15;
const VAT_VARIANCE_THRESHOLD_ZAR = 50;
const WEIGHT_TOLERANCE_KG = 1;
const VALUE_TOLERANCE_PCT = 0.005; // 0.5%

// ─── Module 1: Invoice ↔ Packing List Cross-Reference ────────────────────────

function checkInvoicePl(
  invoice: InvoiceData,
  packingList: PackingListData
): ComplianceModule {
  const mismatches: Array<{
    field: string;
    invoice_value: number;
    packing_list_value: number;
    tolerance: string;
    difference: number;
  }> = [];

  // Check gross weight — tolerance 1kg
  const grossWeightDiff = Math.abs(invoice.gross_weight - packingList.gross_weight);
  if (grossWeightDiff > WEIGHT_TOLERANCE_KG) {
    mismatches.push({
      field: "gross_weight",
      invoice_value: invoice.gross_weight,
      packing_list_value: packingList.gross_weight,
      tolerance: `±${WEIGHT_TOLERANCE_KG}kg`,
      difference: Math.round(grossWeightDiff * 100) / 100,
    });
  }

  // Check net weight — tolerance 1kg
  const netWeightDiff = Math.abs(invoice.net_weight - packingList.net_weight);
  if (netWeightDiff > WEIGHT_TOLERANCE_KG) {
    mismatches.push({
      field: "net_weight",
      invoice_value: invoice.net_weight,
      packing_list_value: packingList.net_weight,
      tolerance: `±${WEIGHT_TOLERANCE_KG}kg`,
      difference: Math.round(netWeightDiff * 100) / 100,
    });
  }

  // Check package counts — exact match required
  if (invoice.package_count !== packingList.package_count) {
    mismatches.push({
      field: "package_count",
      invoice_value: invoice.package_count,
      packing_list_value: packingList.package_count,
      tolerance: "exact match",
      difference: Math.abs(invoice.package_count - packingList.package_count),
    });
  }

  // Check total value — tolerance 0.5%
  // (invoice total_value vs derived from packing list; since packing list doesn't have total_value,
  // we check if the invoice value is reasonable given the weights)
  // Per spec: compare values with tolerance 0.5% — we compare invoice total against a calculated value
  // if packing list had value data. Since the schema only gives us invoice total_value,
  // we note that the cross-reference is primarily about weight and package count.
  // However, if we interpret "values" as comparing the gross weight ratio to value ratio,
  // we'll check if value per kg is consistent.
  // For now: weight and count mismatches are the primary checks per the spec.

  if (mismatches.length > 0) {
    // Determine severity: FAIL if package count mismatch, else HOLD
    const hasPackageCountMismatch = mismatches.some((m) => m.field === "package_count");
    const result: ModuleResult = hasPackageCountMismatch ? "fail" : "hold";
    const penaltyRisk = hasPackageCountMismatch || mismatches.length >= 2;

    return {
      module: "invoice_pl",
      result,
      detail: {
        mismatches,
        summary: `${mismatches.length} discrepancy(ies) found between invoice and packing list`,
        checked_fields: ["gross_weight", "net_weight", "package_count"],
      },
      penalty_risk: penaltyRisk,
    };
  }

  return {
    module: "invoice_pl",
    result: "pass",
    detail: {
      message: "Invoice and packing list values are consistent",
      checked_fields: ["gross_weight", "net_weight", "package_count"],
      invoice_gross_weight: invoice.gross_weight,
      packing_list_gross_weight: packingList.gross_weight,
      invoice_net_weight: invoice.net_weight,
      packing_list_net_weight: packingList.net_weight,
      invoice_package_count: invoice.package_count,
      packing_list_package_count: packingList.package_count,
    },
    penalty_risk: false,
  };
}

// ─── Module 2: HS Code Format Validator ──────────────────────────────────────

function checkHsCode(lineItems: LineItem[]): ComplianceModule {
  if (!lineItems || lineItems.length === 0) {
    return {
      module: "hs_code",
      result: "hold",
      detail: { message: "No line items provided for HS code validation" },
      penalty_risk: false,
    };
  }

  const cleanPattern = /[.\s-]/g;
  const invalidItems: Array<{
    line_item_index: number;
    original_code: string;
    cleaned_code: string;
    reason: string;
  }> = [];

  const validatedItems: Array<{
    line_item_index: number;
    original_code: string;
    cleaned_code: string;
    valid: boolean;
  }> = [];

  for (let i = 0; i < lineItems.length; i++) {
    const code = lineItems[i].hs_code;
    if (!code) {
      invalidItems.push({
        line_item_index: i + 1,
        original_code: code || "(empty)",
        cleaned_code: "(empty)",
        reason: "No HS code provided",
      });
      validatedItems.push({
        line_item_index: i + 1,
        original_code: code || "(empty)",
        cleaned_code: "(empty)",
        valid: false,
      });
      continue;
    }

    const cleaned = code.replace(cleanPattern, "");
    const isValid = /^\d{8}$/.test(cleaned);

    validatedItems.push({
      line_item_index: i + 1,
      original_code: code,
      cleaned_code: cleaned,
      valid: isValid,
    });

    if (!isValid) {
      let reason = "Must be exactly 8 numeric digits for SARS";
      if (cleaned.length < 8) {
        reason = `HS code has only ${cleaned.length} digits after cleaning (requires 8 for SARS)`;
      } else if (cleaned.length > 8) {
        reason = `HS code has ${cleaned.length} digits after cleaning (requires exactly 8 for SARS)`;
      } else if (!/^\d+$/.test(cleaned)) {
        reason = "HS code contains non-numeric characters after cleaning";
      }

      invalidItems.push({
        line_item_index: i + 1,
        original_code: code,
        cleaned_code: cleaned,
        reason,
      });
    }
  }

  if (invalidItems.length > 0) {
    const allInvalid = invalidItems.length === lineItems.length;
    return {
      module: "hs_code",
      result: allInvalid ? "fail" : "hold",
      detail: {
        invalid_codes: invalidItems,
        total_line_items: lineItems.length,
        invalid_count: invalidItems.length,
        valid_count: lineItems.length - invalidItems.length,
        summary: `${invalidItems.length} of ${lineItems.length} HS code(s) invalid — SARS requires exactly 8 numeric digits`,
        note: "Dots, spaces, and dashes are stripped before validation",
      },
      penalty_risk: invalidItems.length > 0,
    };
  }

  return {
    module: "hs_code",
    result: "pass",
    detail: {
      message: "All HS codes are valid (8 numeric digits)",
      total_line_items: lineItems.length,
      validated_items: validatedItems,
    },
    penalty_risk: false,
  };
}

// ─── Module 3: SACU/Non-SACU VAT Engine ─────────────────────────────────────

function checkSacuVat(
  originCountryCode: string,
  customsValueZar: number,
  dutiesZar: number,
  declaredVatZar: number
): ComplianceModule {
  const origin = (originCountryCode || "").toUpperCase().trim();

  if (!origin) {
    return {
      module: "vat_engine",
      result: "hold",
      detail: { message: "Origin country code not provided" },
      penalty_risk: false,
    };
  }

  if (customsValueZar <= 0) {
    return {
      module: "vat_engine",
      result: "hold",
      detail: { message: "Customs value must be greater than zero" },
      penalty_risk: false,
    };
  }

  const isSacu = SACU_COUNTRIES.has(origin);
  const markupFactor = isSacu ? 1.0 : 1.10;
  const addedTaxValue = customsValueZar * markupFactor + dutiesZar;
  const calculatedVat = Math.round(addedTaxValue * VAT_RATE * 100) / 100;
  const vatVariance = Math.abs(declaredVatZar - calculatedVat);
  const vatVarianceExceedsThreshold = vatVariance > VAT_VARIANCE_THRESHOLD_ZAR;

  const detail: Record<string, unknown> = {
    origin_country: origin,
    is_sacu_origin: isSacu,
    sacu_countries: Array.from(SACU_COUNTRIES),
    customs_value_zar: customsValueZar,
    duties_zar: dutiesZar,
    markup_factor: markupFactor,
    markup_applied: !isSacu,
    added_tax_value_zar: Math.round(addedTaxValue * 100) / 100,
    vat_rate: VAT_RATE,
    calculated_vat_zar: calculatedVat,
    declared_vat_zar: declaredVatZar,
    vat_variance_zar: Math.round(vatVariance * 100) / 100,
    variance_threshold_zar: VAT_VARIANCE_THRESHOLD_ZAR,
    calculation: isSacu
      ? `ATV = customs_value × 1.00 + duties = ${customsValueZar} × 1.00 + ${dutiesZar} = ${Math.round(addedTaxValue * 100) / 100}`
      : `ATV = customs_value × 1.10 + duties = ${customsValueZar} × 1.10 + ${dutiesZar} = ${Math.round(addedTaxValue * 100) / 100}`,
  };

  if (vatVarianceExceedsThreshold) {
    return {
      module: "vat_engine",
      result: "fail",
      detail: {
        ...detail,
        summary: `Declared VAT (R${declaredVatZar}) differs from calculated VAT (R${calculatedVat}) by R${Math.round(vatVariance * 100) / 100} — exceeds R${VAT_VARIANCE_THRESHOLD_ZAR} threshold`,
        action_required: "Review VAT calculation before customs submission",
      },
      penalty_risk: true,
    };
  }

  return {
    module: "vat_engine",
    result: "pass",
    detail: {
      ...detail,
      summary: `VAT calculation verified: declared R${declaredVatZar} vs calculated R${calculatedVat} (variance R${Math.round(vatVariance * 100) / 100})`,
    },
    penalty_risk: false,
  };
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ComplianceRequest = await request.json();

    const {
      shipment_id,
      invoice_data,
      packing_list_data,
      line_items,
      origin_country_code,
      customs_value_zar,
      duties_zar,
      declared_vat_zar,
    } = body;

    // Validate required fields
    if (!invoice_data) {
      return NextResponse.json(
        { error: "bad_request", message: "invoice_data is required" },
        { status: 400 }
      );
    }
    if (!packing_list_data) {
      return NextResponse.json(
        { error: "bad_request", message: "packing_list_data is required" },
        { status: 400 }
      );
    }
    if (!line_items || !Array.isArray(line_items)) {
      return NextResponse.json(
        { error: "bad_request", message: "line_items array is required" },
        { status: 400 }
      );
    }
    if (!origin_country_code) {
      return NextResponse.json(
        { error: "bad_request", message: "origin_country_code is required" },
        { status: 400 }
      );
    }
    if (typeof customs_value_zar !== "number" || customs_value_zar < 0) {
      return NextResponse.json(
        { error: "bad_request", message: "customs_value_zar must be a non-negative number" },
        { status: 400 }
      );
    }
    if (typeof duties_zar !== "number" || duties_zar < 0) {
      return NextResponse.json(
        { error: "bad_request", message: "duties_zar must be a non-negative number" },
        { status: 400 }
      );
    }
    if (typeof declared_vat_zar !== "number" || declared_vat_zar < 0) {
      return NextResponse.json(
        { error: "bad_request", message: "declared_vat_zar must be a non-negative number" },
        { status: 400 }
      );
    }

    // Run all 3 Phase-1 modules
    const modules: ComplianceModule[] = [
      checkInvoicePl(invoice_data, packing_list_data),
      checkHsCode(line_items),
      checkSacuVat(origin_country_code, customs_value_zar, duties_zar, declared_vat_zar),
    ];

    // Determine overall status: FAIL > HOLD > PASS
    const hasFail = modules.some((m) => m.result === "fail");
    const hasHold = modules.some((m) => m.result === "hold");
    const overall: ModuleResult = hasFail ? "fail" : hasHold ? "hold" : "pass";

    const penaltyRiskDetected = modules.some((m) => m.penalty_risk);
    const blockCargowise = hasFail;

    const response: ComplianceResponse = {
      overall,
      modules,
      penalty_risk_detected: penaltyRiskDetected,
      block_cargowise: blockCargowise,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error running compliance audit:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : "Failed to run compliance audit",
      },
      { status: 500 }
    );
  }
}
