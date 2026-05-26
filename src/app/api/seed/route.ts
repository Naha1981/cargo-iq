// POST /api/seed - Seed the database with demo data
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Create default organisation
    const org = await db.organisation.upsert({
      where: { slug: "demo" },
      update: {},
      create: { name: "ABC Logistics SA", slug: "demo", plan: "growth" },
    });

    // Create some demo shipments
    const shipments = [
      {
        reference: "CIQ-2026-00047", shipperName: "Shanghai Global Trading Co.", consigneeName: "ABC Logistics SA",
        originPort: "CNSHA", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "MAEU123456789", overallConfidence: "high", shieldStatus: "pass",
        status: "cw_draft_created", cargoDescription: "Electronic equipment - CIF Durban",
        hsCodePrimary: "8471300000", grossWeight: 4540, weightUnit: "KGS", netWeight: 4200,
        numberOfPackages: 45, incoterms: "CIF", invoiceNumber: "SINV-2026-04287",
        invoiceValue: 586000, currency: "USD", vesselOrFlight: "MSC ISABELLA",
        source: "email", orgId: org.id,
      },
      {
        reference: "CIQ-2026-00046", shipperName: "Dubai Freight Services LLC", consigneeName: "Santova Logistics",
        originPort: "AEDXB", destinationPort: "ZACPT", shipmentType: "air_import",
        awbOrBlNumber: "074-12345678", overallConfidence: "high", shieldStatus: "pass",
        status: "approved", cargoDescription: "Textile products - FOB Dubai",
        hsCodePrimary: "6203420000", grossWeight: 2800, weightUnit: "KGS",
        numberOfPackages: 120, incoterms: "FOB", invoiceNumber: "DF-2026-0891",
        invoiceValue: 234500, currency: "USD", vesselOrFlight: "EK782",
        source: "email", orgId: org.id,
      },
      {
        reference: "CIQ-2026-00045", shipperName: "Kuehne + Nagel Shenzhen", consigneeName: "Megafreight Services",
        originPort: "CNSZX", destinationPort: "ZADUR", shipmentType: "lcl_import",
        awbOrBlNumber: "COSCO987654321", overallConfidence: "medium", shieldStatus: "hold",
        status: "review_required", cargoDescription: "Machinery parts - CFR Durban",
        hsCodePrimary: "8483400000", grossWeight: 12500, weightUnit: "KGS",
        numberOfPackages: 8, incoterms: "CFR", invoiceNumber: "KN-SZX-2026-443",
        invoiceValue: 890000, currency: "USD",
        source: "email", orgId: org.id,
      },
      {
        reference: "CIQ-2026-00044", shipperName: "India Exports Mumbai", consigneeName: "NATCO Logistics",
        originPort: "INBOM", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "MSCIM987654321", overallConfidence: "low", shieldStatus: "fail",
        status: "review_required", cargoDescription: "Chemical products - CIF Durban",
        hsCodePrimary: "1234567", grossWeight: 18500, weightUnit: "KGS",
        numberOfPackages: 16, incoterms: "CIF", invoiceNumber: "IE-2026-7765",
        invoiceValue: 445000, currency: "USD",
        source: "whatsapp", orgId: org.id,
      },
      {
        reference: "CIQ-2026-00043", shipperName: "UK Manufacturing Ltd", consigneeName: "CFR Freight SA",
        originPort: "GBFXT", destinationPort: "ZACPT", shipmentType: "air_import",
        awbOrBlNumber: "057-98765432", overallConfidence: "high", shieldStatus: "pass",
        status: "pending", cargoDescription: "Pharmaceutical intermediates - DDP Cape Town",
        hsCodePrimary: "2934990000", grossWeight: 850, weightUnit: "KGS",
        numberOfPackages: 24, incoterms: "DDP", invoiceNumber: "UKM-2026-0921",
        invoiceValue: 1250000, currency: "GBP",
        source: "email", orgId: org.id,
      },
    ];

    for (const data of shipments) {
      await db.shipment.upsert({
        where: { orgId_reference: { orgId: org.id, reference: data.reference } },
        update: data,
        create: data,
      });
    }

    return NextResponse.json({
      success: true,
      organisation: org.name,
      shipmentsCreated: shipments.length,
    });
  } catch (error) {
    console.error("Error seeding database:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to seed database" },
      { status: 500 }
    );
  }
}
