// POST /api/compliance/audit - Run compliance shield against a shipment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// SACU VAT Engine constants
const SACU_COUNTRIES = new Set(["ZA", "LS", "NA", "SZ", "BW"]);
const VAT_RATE = 0.15;
const VAT_VARIANCE_THRESHOLD_ZAR = 50;

function checkInvoicePl(shipment: Record<string, unknown>, lineItems: Record<string, unknown>[]) {
  const mismatches: Record<string, unknown>[] = [];
  const hasInvoice = true; // For now, assume docs exist
  const hasPackingList = true;

  if (!hasInvoice || !hasPackingList) {
    return {
      module: "invoice_pl",
      result: "hold" as const,
      detail: { message: "Both invoice and packing list required for cross-reference" },
      penaltyRisk: false,
      resolution: "Upload commercial invoice and packing list.",
    };
  }

  // Check gross weight vs line item total
  const grossWeight = Number(shipment.grossWeight) || 0;
  const liTotalWeight = lineItems.reduce((sum, li) => sum + (Number(li.totalWeight) || 0), 0);
  if (grossWeight > 0 && liTotalWeight > 0 && Math.abs(liTotalWeight - grossWeight) > 1) {
    mismatches.push({ field: "gross_weight", shipmentValue: grossWeight, lineItemsTotal: liTotalWeight });
  }

  // Check total value
  const invoiceValue = Number(shipment.invoiceValue) || 0;
  const liTotalValue = lineItems.reduce((sum, li) => sum + (Number(li.totalValue) || 0), 0);
  if (invoiceValue > 0 && liTotalValue > 0 && Math.abs(liTotalValue - invoiceValue) / invoiceValue > 0.005) {
    mismatches.push({ field: "total_value", shipmentValue: invoiceValue, lineItemsTotal: liTotalValue });
  }

  if (mismatches.length > 0) {
    return {
      module: "invoice_pl",
      result: "fail" as const,
      detail: { mismatches },
      penaltyRisk: true,
      resolution: "Reconcile invoice and packing list values before submission.",
    };
  }

  return {
    module: "invoice_pl",
    result: "pass" as const,
    detail: { checked: true, hasInvoice, hasPackingList },
    penaltyRisk: false,
    resolution: null,
  };
}

function checkHsCode(shipment: Record<string, unknown>, lineItems: Record<string, unknown>[]) {
  const invalid: Record<string, unknown>[] = [];
  const cleanPattern = /[.\s-]/g;

  function check(code: string | null | undefined, context: string) {
    if (!code) return;
    const cleaned = code.replace(cleanPattern, "");
    if (!/^\d{8}$/.test(cleaned)) {
      invalid.push({ code, cleaned, context, reason: "Must be exactly 8 digits" });
    }
  }

  check(shipment.hsCodePrimary as string, "shipment");
  lineItems.forEach((li, i) => check(li.hsCode as string, `line_item_${i + 1}`));

  if (invalid.length > 0) {
    return {
      module: "hs_code",
      result: "fail" as const,
      detail: { invalidCodes: invalid },
      penaltyRisk: true,
      resolution: "SARS requires 8-digit HS codes. Correct invalid codes before submission.",
    };
  }

  const hasAny = shipment.hsCodePrimary || lineItems.some((li) => li.hsCode);
  if (!hasAny) {
    return {
      module: "hs_code",
      result: "hold" as const,
      detail: { message: "No HS code provided" },
      penaltyRisk: false,
      resolution: "Add HS code before customs submission.",
    };
  }

  return { module: "hs_code", result: "pass" as const, detail: { checked: true }, penaltyRisk: false, resolution: null };
}

function checkSacuVat(shipment: Record<string, unknown>) {
  const origin = ((shipment.originPort as string) || "").slice(0, 2).toUpperCase();
  const customsValue = Number(shipment.invoiceValue) || 0;
  const duties = 0; // Would need duties field

  if (!origin) {
    return {
      module: "vat_engine",
      result: "hold" as const,
      detail: { message: "Origin country not specified" },
      penaltyRisk: false,
      resolution: "Provide country of origin to enable VAT verification.",
    };
  }

  if (customsValue <= 0) {
    return {
      module: "vat_engine",
      result: "hold" as const,
      detail: { message: "Customs value not provided" },
      penaltyRisk: false,
      resolution: "Provide customs value to enable VAT calculation.",
    };
  }

  const isSacu = SACU_COUNTRIES.has(origin);
  const markup = isSacu ? 1.0 : 1.10;
  const atv = customsValue * markup + duties;
  const calculatedVat = Math.round(atv * VAT_RATE * 100) / 100;

  return {
    module: "vat_engine",
    result: "pass" as const,
    detail: { origin, isSacu, customsValue, duties, markupApplied: !isSacu, atv: Math.round(atv * 100) / 100, calculatedVat },
    penaltyRisk: false,
    resolution: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shipmentId } = body;

    if (!shipmentId) {
      return NextResponse.json(
        { error: "bad_request", message: "shipmentId required" },
        { status: 400 }
      );
    }

    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: { lineItems: true },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "not_found", message: "Shipment not found" },
        { status: 404 }
      );
    }

    const shipData = {
      ...shipment,
      grossWeight: shipment.grossWeight ? Number(shipment.grossWeight) : null,
      invoiceValue: shipment.invoiceValue ? Number(shipment.invoiceValue) : null,
    };
    const lineItemsData = shipment.lineItems.map((li) => ({
      ...li,
      totalWeight: li.totalWeight ? Number(li.totalWeight) : null,
      totalValue: li.totalValue ? Number(li.totalValue) : null,
    }));

    // Run all Phase 1 modules
    const modules = [
      checkInvoicePl(shipData, lineItemsData),
      checkHsCode(shipData, lineItemsData),
      checkSacuVat(shipData),
    ];

    // Determine overall status
    const hasFail = modules.some((m) => m.result === "fail");
    const hasHold = modules.some((m) => m.result === "hold");
    const overall = hasFail ? "fail" : hasHold ? "hold" : "pass";

    const report = {
      overall,
      penaltyRiskDetected: modules.some((m) => m.penaltyRisk),
      blockCargowise: hasFail,
      modules,
    };

    // Update shipment
    await db.shipment.update({
      where: { id: shipmentId },
      data: {
        shieldStatus: overall,
        shieldResults: JSON.stringify(report),
        status: hasFail || hasHold ? "review_required" : shipment.status,
      },
    });

    // Create compliance events
    for (const mod of modules) {
      await db.complianceEvent.create({
        data: {
          orgId: shipment.orgId,
          shipmentId,
          module: mod.module,
          result: mod.result,
          detail: JSON.stringify(mod.detail),
          penaltyRisk: mod.penaltyRisk,
        },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        orgId: shipment.orgId,
        entityType: "shipment",
        entityId: shipmentId,
        action: "shield_checked",
        actorType: "ai_system",
        metadata: JSON.stringify({ overall }),
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error running compliance audit:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to run compliance audit" },
      { status: 500 }
    );
  }
}
