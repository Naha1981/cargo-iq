// CargoIQ — Compliance Shield Engine
// 3 Phase-1 modules: Invoice↔PL Cross-Reference, HS Code Validator, SACU/Non-SACU VAT Engine
// Extracted from /api/compliance for reuse across the platform

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleResult = "pass" | "hold" | "fail";

export interface InvoiceData {
  gross_weight: number;
  net_weight: number;
  total_value?: number;
  package_count: number;
}

export interface PackingListData {
  gross_weight: number;
  net_weight: number;
  package_count: number;
}

export interface LineItem {
  hs_code: string;
  description?: string;
}

export interface ComplianceModule {
  module: string;
  result: ModuleResult;
  detail: Record<string, unknown>;
  penalty_risk: boolean;
}

export interface ComplianceShieldInput {
  invoice_data: InvoiceData;
  packing_list_data: PackingListData;
  line_items: LineItem[];
  origin_country_code: string;
  customs_value_zar: number;
  duties_zar: number;
  declared_vat_zar: number;
}

export interface ComplianceShieldResult {
  overall: ModuleResult;
  modules: ComplianceModule[];
  penalty_risk_detected: boolean;
  block_cargowise: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SACU_COUNTRIES = new Set(["ZA", "LS", "NA", "SZ", "BW"]);
const VAT_RATE = 0.15;
const VAT_VARIANCE_THRESHOLD_ZAR = 50;
const WEIGHT_TOLERANCE_KG = 1;

// ---------------------------------------------------------------------------
// Module 1: Invoice ↔ Packing List Cross-Reference
// ---------------------------------------------------------------------------

/**
 * Compare invoice and packing list data for consistency.
 *
 * Checks:
 * - gross_weight: ±1kg tolerance
 * - net_weight: ±1kg tolerance
 * - package_count: exact match required
 *
 * Returns HOLD for weight mismatches, FAIL for package count mismatches.
 */
export function checkInvoicePl(
  invoiceData: InvoiceData,
  packingListData: PackingListData
): ComplianceModule {
  const mismatches: Array<{
    field: string;
    invoice_value: number;
    packing_list_value: number;
    tolerance: string;
    difference: number;
  }> = [];

  // Gross weight — ±1kg tolerance
  const grossWeightDiff = Math.abs(
    invoiceData.gross_weight - packingListData.gross_weight
  );
  if (grossWeightDiff > WEIGHT_TOLERANCE_KG) {
    mismatches.push({
      field: "gross_weight",
      invoice_value: invoiceData.gross_weight,
      packing_list_value: packingListData.gross_weight,
      tolerance: `±${WEIGHT_TOLERANCE_KG}kg`,
      difference: Math.round(grossWeightDiff * 100) / 100,
    });
  }

  // Net weight — ±1kg tolerance
  const netWeightDiff = Math.abs(
    invoiceData.net_weight - packingListData.net_weight
  );
  if (netWeightDiff > WEIGHT_TOLERANCE_KG) {
    mismatches.push({
      field: "net_weight",
      invoice_value: invoiceData.net_weight,
      packing_list_value: packingListData.net_weight,
      tolerance: `±${WEIGHT_TOLERANCE_KG}kg`,
      difference: Math.round(netWeightDiff * 100) / 100,
    });
  }

  // Package count — exact match required
  if (invoiceData.package_count !== packingListData.package_count) {
    mismatches.push({
      field: "package_count",
      invoice_value: invoiceData.package_count,
      packing_list_value: packingListData.package_count,
      tolerance: "exact match",
      difference: Math.abs(invoiceData.package_count - packingListData.package_count),
    });
  }

  if (mismatches.length > 0) {
    const hasPackageCountMismatch = mismatches.some(
      (m) => m.field === "package_count"
    );
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
      invoice_gross_weight: invoiceData.gross_weight,
      packing_list_gross_weight: packingListData.gross_weight,
      invoice_net_weight: invoiceData.net_weight,
      packing_list_net_weight: packingListData.net_weight,
      invoice_package_count: invoiceData.package_count,
      packing_list_package_count: packingListData.package_count,
    },
    penalty_risk: false,
  };
}

// ---------------------------------------------------------------------------
// Module 2: HS Code Format Validator
// ---------------------------------------------------------------------------

/**
 * Validate HS codes are exactly 8 numeric digits per SARS requirement.
 *
 * Strips dots, spaces, and dashes before validation.
 * Returns per-line-item results with detailed reasons for invalid codes.
 */
export function checkHsCode(lineItems: LineItem[]): ComplianceModule {
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

// ---------------------------------------------------------------------------
// Module 3: SACU / Non-SACU VAT Engine
// ---------------------------------------------------------------------------

/**
 * Calculate VAT based on SACU origin status and compare against declared VAT.
 *
 * SACU countries (ZA, LS, NA, SZ, BW): markup factor = 1.00
 * Non-SACU countries: markup factor = 1.10
 *
 * ATV (Added Tax Value) = customs_value × markup + duties
 * VAT = ATV × 0.15
 *
 * Flags if declared VAT differs from calculated by >R50.
 */
export function checkSacuVat(
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

// ---------------------------------------------------------------------------
// runComplianceShield — Aggregated wrapper
// ---------------------------------------------------------------------------

/**
 * Run all 3 compliance modules and return an aggregated result.
 *
 * Overall status: FAIL > HOLD > PASS
 * block_cargowise: true if any module returns FAIL
 * penalty_risk_detected: true if any module has penalty_risk = true
 */
export function runComplianceShield(
  data: ComplianceShieldInput
): ComplianceShieldResult {
  const modules: ComplianceModule[] = [
    checkInvoicePl(data.invoice_data, data.packing_list_data),
    checkHsCode(data.line_items),
    checkSacuVat(
      data.origin_country_code,
      data.customs_value_zar,
      data.duties_zar,
      data.declared_vat_zar
    ),
  ];

  const hasFail = modules.some((m) => m.result === "fail");
  const hasHold = modules.some((m) => m.result === "hold");
  const overall: ModuleResult = hasFail ? "fail" : hasHold ? "hold" : "pass";

  const penalty_risk_detected = modules.some((m) => m.penalty_risk);
  const block_cargowise = hasFail;

  return {
    overall,
    modules,
    penalty_risk_detected,
    block_cargowise,
  };
}
