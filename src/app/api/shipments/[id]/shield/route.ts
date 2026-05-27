// POST /api/shipments/[id]/shield - Re-run compliance shield for a shipment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";
import {
  runComplianceShield,
  type ComplianceShieldInput,
} from "@/lib/compliance-engine";
import { portToCountryCode, estimateZarValue } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getOrgIdFromRequest(request);

    // Fetch shipment with orgId verification
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

    if (shipment.orgId !== orgId) {
      return NextResponse.json(
        { error: "forbidden", message: "Shipment does not belong to your organisation" },
        { status: 403 }
      );
    }

    // Build compliance shield input from shipment data
    const originCountry = portToCountryCode(shipment.originPort);
    const customsValueZar =
      estimateZarValue(shipment.invoiceValue, shipment.currency) ?? 0;
    const dutiesZar = Math.round(customsValueZar * 0.05 * 100) / 100; // ~5% duty estimate
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
      line_items: shipment.lineItems.map((li) => ({
        hs_code: li.hsCode || "",
        description: li.description || undefined,
      })),
      origin_country_code: originCountry,
      customs_value_zar: customsValueZar,
      duties_zar: dutiesZar,
      declared_vat_zar: declaredVatZar,
    };

    // Run all 3 compliance modules
    const shieldResult = runComplianceShield(shieldInput);

    // Update shipment with shield results
    await db.shipment.update({
      where: { id },
      data: {
        shieldStatus: shieldResult.overall,
        shieldResults: JSON.stringify(shieldResult),
      },
    });

    // Create ComplianceEvent records for each module result
    for (const mod of shieldResult.modules) {
      await db.complianceEvent.create({
        data: {
          orgId,
          shipmentId: id,
          module: mod.module,
          result: mod.result,
          detail: JSON.stringify(mod.detail),
          penaltyRisk: mod.penalty_risk,
        },
      });
    }

    // Write AuditLog entry
    await db.auditLog.create({
      data: {
        orgId,
        entityType: "shipment",
        entityId: id,
        action: "shield_checked",
        actorType: "ai_system",
        metadata: JSON.stringify({
          overall: shieldResult.overall,
          modules: shieldResult.modules.map((m) => ({
            module: m.module,
            result: m.result,
          })),
          penalty_risk_detected: shieldResult.penalty_risk_detected,
          block_cargowise: shieldResult.block_cargowise,
        }),
      },
    });

    // Fetch updated shipment with compliance events
    const updatedShipment = await db.shipment.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
        complianceEvents: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({
      ...updatedShipment,
      extractedFields: JSON.parse(updatedShipment?.extractedFields || "{}"),
      confidenceScores: JSON.parse(updatedShipment?.confidenceScores || "{}"),
      shieldResults: JSON.parse(updatedShipment?.shieldResults || "{}"),
    });
  } catch (error) {
    console.error("Error running compliance shield:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to run compliance shield" },
      { status: 500 }
    );
  }
}
