// POST /api/shipments/[id]/shield — Re-run compliance shield for a shipment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runComplianceShield, ComplianceModule } from "@/lib/compliance-engine";

function portToCountryCode(port: string | null): string {
  if (!port) return "";
  return port.substring(0, 2).toUpperCase();
}

function estimateZarValue(valueUsd: number | null, currency: string | null): number {
  if (!valueUsd) return 0;
  const rate = currency === "GBP" ? 23.5 : currency === "EUR" ? 20.0 : 18.5;
  return Math.round(valueUsd * rate * 100) / 100;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch shipment with line items
    const shipment = await db.shipment.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "not_found", message: "Shipment not found" },
        { status: 404 }
      );
    }

    // Build line items for compliance check
    const lineItems =
      shipment.lineItems.length > 0
        ? shipment.lineItems.map((li) => ({ hs_code: li.hsCode || "" }))
        : shipment.hsCodePrimary
          ? [{ hs_code: shipment.hsCodePrimary }]
          : [];

    const customsValueZar = estimateZarValue(shipment.invoiceValue, shipment.currency);
    const estimatedDutiesZar = Math.round(customsValueZar * 0.15 * 100) / 100;
    const declaredVatZar = Math.round(customsValueZar * 0.15 * 100) / 100;

    // Run compliance shield
    const shieldResult = runComplianceShield({
      invoice_data: {
        gross_weight: shipment.grossWeight || 0,
        net_weight: shipment.netWeight || 0,
        total_value: shipment.invoiceValue || 0,
        package_count: shipment.numberOfPackages || 0,
      },
      packing_list_data: {
        gross_weight: shipment.grossWeight || 0,
        net_weight: shipment.netWeight || 0,
        package_count: shipment.numberOfPackages || 0,
      },
      line_items: lineItems,
      origin_country_code: portToCountryCode(shipment.originPort),
      customs_value_zar: customsValueZar,
      duties_zar: estimatedDutiesZar,
      declared_vat_zar: declaredVatZar,
    });

    // Store previous shield status for audit
    const previousShieldStatus = shipment.shieldStatus;

    // Determine new shipment status based on shield result
    let newStatus = shipment.status;
    if (shipment.status === "pending" || shipment.status === "review_required") {
      newStatus = shieldResult.overall === "pass" ? "pending" : "review_required";
    }

    // Update shipment with new shield results
    await db.shipment.update({
      where: { id },
      data: {
        shieldStatus: shieldResult.overall,
        shieldResults: JSON.stringify(shieldResult),
        status: newStatus,
      },
    });

    // Create new ComplianceEvent records
    for (const mod of shieldResult.modules) {
      await db.complianceEvent.create({
        data: {
          orgId: shipment.orgId,
          shipmentId: id,
          module: mod.module,
          result: mod.result,
          detail: JSON.stringify(mod.detail),
          penaltyRisk: mod.penalty_risk,
        },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        orgId: shipment.orgId,
        entityType: "shipment",
        entityId: id,
        action: "shield_checked",
        actorType: "system",
        beforeState: JSON.stringify({ shieldStatus: previousShieldStatus }),
        afterState: JSON.stringify({
          shieldStatus: shieldResult.overall,
          status: newStatus,
        }),
        metadata: JSON.stringify({
          overall: shieldResult.overall,
          modules: shieldResult.modules.map((m: ComplianceModule) => ({
            module: m.module,
            result: m.result,
          })),
          re_run: true,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      shieldStatus: shieldResult.overall,
      shipmentStatus: newStatus,
      modules: shieldResult.modules.map((m: ComplianceModule) => ({
        module: m.module,
        result: m.result,
        penaltyRisk: m.penalty_risk,
      })),
      penaltyRiskDetected: shieldResult.penalty_risk_detected,
      blockCargowise: shieldResult.block_cargowise,
    });
  } catch (error) {
    console.error("Error re-running compliance shield:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : "Failed to re-run compliance shield",
      },
      { status: 500 }
    );
  }
}
