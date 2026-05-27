// POST /api/compliance - Compliance Shield API
// 3 Phase-1 modules: Invoice↔PL Cross-Reference, HS Code Validator, SACU/Non-SACU VAT Engine
// Now imports shared logic from /src/lib/compliance-engine.ts
import { NextRequest, NextResponse } from "next/server";
import {
  runComplianceShield,
  type ComplianceCheckParams,
} from "@/lib/compliance-engine";

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ComplianceCheckParams = await request.json();

    const {
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

    // Run all 3 Phase-1 modules via shared engine
    const response = runComplianceShield(body);

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
