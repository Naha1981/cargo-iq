// POST /api/seed - Seed the database with comprehensive demo data
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // ─── Create default organisation ─────────────────────────────────────────
    const org = await db.organisation.upsert({
      where: { slug: "demo" },
      update: {},
      create: {
        name: "ABC Logistics SA",
        slug: "demo",
        plan: "growth",
        cwServerUrl: "https://cargowise.abclogistics.co.za",
        cwEnterpriseId: "ABC-SA",
        cwServerId: "CW-PROD-01",
        confidenceAutoApprove: 0.90,
        confidenceReviewRequired: 0.75,
      },
    });

    // ─── Create demo users ───────────────────────────────────────────────────
    const users = [
      { email: "johan@abclogistics.co.za", fullName: "Johan Mokoena", role: "admin" },
      { email: "thandi@abclogistics.co.za", fullName: "Thandi Ndlovu", role: "operations_manager" },
      { email: "pieter@abclogistics.co.za", fullName: "Pieter van der Merwe", role: "operator" },
      { email: "nomsa@abclogistics.co.za", fullName: "Nomsa Dlamini", role: "operator" },
      { email: "reader@abclogistics.co.za", fullName: "Sipho Reader", role: "viewer" },
    ];

    for (const u of users) {
      await db.user.upsert({
        where: { orgId_email: { orgId: org.id, email: u.email } },
        update: {},
        create: { orgId: org.id, ...u },
      });
    }

    // ─── Create email connection ─────────────────────────────────────────────
    await db.emailConnection.upsert({
      where: { id: "conn-demo-gmail" },
      update: {},
      create: {
        id: "conn-demo-gmail",
        orgId: org.id,
        type: "gmail",
        emailAddress: "inbox@abclogistics.co.za",
        status: "active",
      },
    });

    // ─── Create RLA statuses ─────────────────────────────────────────────────
    const rlaStatuses = [
      { importerCode: "ZA12345678901", importerName: "ABC Logistics SA", rlaStatus: "active" },
      { importerCode: "ZA98765432101", importerName: "Santova Logistics", rlaStatus: "active" },
      { importerCode: "ZA55544433301", importerName: "Megafreight Services", rlaStatus: "suspended", suspendedSince: new Date("2026-05-20") },
      { importerCode: "ZA11122233301", importerName: "NATCO Logistics", rlaStatus: "active" },
      { importerCode: "ZA77788899901", importerName: "CFR Freight SA", rlaStatus: "inactive" },
    ];

    for (const rla of rlaStatuses) {
      await db.rlaStatus.upsert({
        where: { orgId_importerCode: { orgId: org.id, importerCode: rla.importerCode } },
        update: {},
        create: { orgId: org.id, ...rla, lastCheckedAt: new Date() },
      });
    }

    // ─── Create demo shipments with full data ───────────────────────────────
    const shipmentsData = [
      {
        reference: "CIQ-2026-00047", shipperName: "Shanghai Global Trading Co.", shipperAddress: "889 Pudong Avenue, Shanghai 200120, China",
        consigneeName: "ABC Logistics SA", consigneeAddress: "12 Sandton Drive, Sandton, Johannesburg 2196, South Africa",
        originPort: "CNSHA", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "MAEU123456789", overallConfidence: "high", shieldStatus: "pass",
        status: "cw_draft_created", cargoDescription: "Electronic equipment - CIF Durban",
        hsCodePrimary: "8471300000", grossWeight: 4540, weightUnit: "KGS", netWeight: 4200,
        numberOfPackages: 45, incoterms: "CIF", invoiceNumber: "SINV-2026-04287",
        invoiceValue: 586000, currency: "USD", vesselOrFlight: "MSC ISABELLA",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "8471300000", description: "Laptop Computers", quantity: 500, unit: "PCS", unitWeight: 2.4, totalWeight: 1200, unitValue: 850, totalValue: 425000, currency: "USD", confidence: "high" },
          { lineNumber: 2, hsCode: "8517620000", description: "Network Routers", quantity: 200, unit: "PCS", unitWeight: 3.2, totalWeight: 640, unitValue: 320, totalValue: 64000, currency: "USD", confidence: "high" },
          { lineNumber: 3, hsCode: "8504403000", description: "Power Supply Units", quantity: 1000, unit: "PCS", unitWeight: 1.2, totalWeight: 1200, unitValue: 45, totalValue: 45000, currency: "USD", confidence: "high" },
          { lineNumber: 4, hsCode: "8544429000", description: "Cable Assemblies", quantity: 5000, unit: "M", unitWeight: 0.2, totalWeight: 1000, unitValue: 3.2, totalValue: 16000, currency: "USD", confidence: "medium" },
          { lineNumber: 5, hsCode: "8473300000", description: "Computer Parts & Accessories", quantity: 300, unit: "KG", unitWeight: 0.5, totalWeight: 500, unitValue: 120, totalValue: 36000, currency: "USD", confidence: "high" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "Invoice and packing list values are consistent" }, penaltyRisk: false },
          { module: "hs_code", result: "pass", detail: { message: "All 5 HS codes valid (8 numeric digits)" }, penaltyRisk: false },
          { module: "vat_engine", result: "pass", detail: { message: "VAT calculation verified: declared R4 256 535 vs calculated R4 256 400 (variance R135)", isSacuOrigin: false }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00046", shipperName: "Dubai Freight Services LLC", shipperAddress: "Jebel Ali Free Zone, Dubai, UAE",
        consigneeName: "Santova Logistics", consigneeAddress: "Point Waterfront, Durban 4001, South Africa",
        originPort: "AEDXB", destinationPort: "ZACPT", shipmentType: "air_import",
        awbOrBlNumber: "074-12345678", overallConfidence: "high", shieldStatus: "pass",
        status: "approved", cargoDescription: "Textile products - FOB Dubai",
        hsCodePrimary: "6203420000", grossWeight: 2800, weightUnit: "KGS", netWeight: 2650,
        numberOfPackages: 120, incoterms: "FOB", invoiceNumber: "DF-2026-0891",
        invoiceValue: 234500, currency: "USD", vesselOrFlight: "EK782",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "6203420000", description: "Men's Cotton Trousers", quantity: 5000, unit: "PCS", unitWeight: 0.35, totalWeight: 1750, unitValue: 28, totalValue: 140000, currency: "USD", confidence: "high" },
          { lineNumber: 2, hsCode: "6204420000", description: "Women's Cotton Dresses", quantity: 3000, unit: "PCS", unitWeight: 0.25, totalWeight: 750, unitValue: 31.5, totalValue: 94500, currency: "USD", confidence: "high" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "All values reconciled" }, penaltyRisk: false },
          { module: "hs_code", result: "pass", detail: { message: "2 valid codes verified" }, penaltyRisk: false },
          { module: "vat_engine", result: "pass", detail: { message: "VAT verified", isSacuOrigin: false }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00045", shipperName: "Kuehne + Nagel Shenzhen", shipperAddress: "18 Huaqiang Road, Shenzhen, Guangdong, China",
        consigneeName: "Megafreight Services", consigneeAddress: "The Woodlands Office Park, Woodmead, Sandton 2191",
        originPort: "CNSZX", destinationPort: "ZADUR", shipmentType: "lcl_import",
        awbOrBlNumber: "COSCO987654321", overallConfidence: "medium", shieldStatus: "hold",
        status: "review_required", cargoDescription: "Machinery parts - CFR Durban",
        hsCodePrimary: "8483400000", grossWeight: 12500, weightUnit: "KGS", netWeight: 11800,
        numberOfPackages: 8, incoterms: "CFR", invoiceNumber: "KN-SZX-2026-443",
        invoiceValue: 890000, currency: "USD",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "8483400000", description: "Gearboxes for machinery", quantity: 4, unit: "PCS", unitWeight: 1850, totalWeight: 7400, unitValue: 125000, totalValue: 500000, currency: "USD", confidence: "high" },
          { lineNumber: 2, hsCode: "8483600000", description: "Clutch assemblies", quantity: 8, unit: "PCS", unitWeight: 450, totalWeight: 3600, unitValue: 35000, totalValue: 280000, currency: "USD", confidence: "high" },
          { lineNumber: 3, hsCode: "8483", description: "Transmission shafts (INCOMPLETE CODE)", quantity: 10, unit: "PCS", unitWeight: 150, totalWeight: 1500, unitValue: 11000, totalValue: 110000, currency: "USD", confidence: "low" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "Weights and counts reconciled" }, penaltyRisk: false },
          { module: "hs_code", result: "hold", detail: { message: "1 of 3 HS codes invalid — line 3 has only 4 digits (requires 8 for SARS)", invalidCodes: [{ line: 3, code: "8483", reason: "Only 4 digits" }] }, penaltyRisk: true },
          { module: "vat_engine", result: "pass", detail: { message: "VAT calculation verified" }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00044", shipperName: "India Exports Mumbai", shipperAddress: "52 Nehru Port, Navi Mumbai 400703, India",
        consigneeName: "NATCO Logistics", consigneeAddress: "3 Ripeed Road, Mobeni, Durban 4060",
        originPort: "INBOM", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "MSCIM987654321", overallConfidence: "low", shieldStatus: "fail",
        status: "review_required", cargoDescription: "Chemical products - CIF Durban",
        hsCodePrimary: "1234567", grossWeight: 18500, weightUnit: "KGS", netWeight: 17000,
        numberOfPackages: 16, incoterms: "CIF", invoiceNumber: "IE-2026-7765",
        invoiceValue: 445000, currency: "USD",
        source: "whatsapp", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "1234567", description: "Industrial Solvent Mixture", quantity: 8, unit: "DRM", unitWeight: 1200, totalWeight: 9600, unitValue: 28000, totalValue: 224000, currency: "USD", confidence: "low" },
          { lineNumber: 2, hsCode: "2909", description: "Chemical Ether (INCOMPLETE)", quantity: 4, unit: "DRM", unitWeight: 2200, totalWeight: 8800, unitValue: 55000, totalValue: 220000, currency: "USD", confidence: "low" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "fail", detail: { message: "Package count mismatch: Invoice says 16, Packing List says 18", mismatches: [{ field: "package_count", invoice: 16, packing_list: 18 }] }, penaltyRisk: true },
          { module: "hs_code", result: "fail", detail: { message: "All 2 HS codes invalid — require 8 digits for SARS", invalidCodes: [{ line: 1, code: "1234567", reason: "Only 7 digits" }, { line: 2, code: "2909", reason: "Only 4 digits" }] }, penaltyRisk: true },
          { module: "vat_engine", result: "fail", detail: { message: "Declared VAT R42 500 differs from calculated R70 505 by R28 005 — exceeds R50 threshold", variance: 28005 }, penaltyRisk: true },
        ],
      },
      {
        reference: "CIQ-2026-00043", shipperName: "UK Manufacturing Ltd", shipperAddress: "15 Industrial Park, Felixstowe, Suffolk IP11 4RS, UK",
        consigneeName: "CFR Freight SA", consigneeAddress: "1st Floor, The MARC, 2 River Road, Cape Town 8001",
        originPort: "GBFXT", destinationPort: "ZACPT", shipmentType: "air_import",
        awbOrBlNumber: "057-98765432", overallConfidence: "high", shieldStatus: "pass",
        status: "pending", cargoDescription: "Pharmaceutical intermediates - DDP Cape Town",
        hsCodePrimary: "2934990000", grossWeight: 850, weightUnit: "KGS", netWeight: 780,
        numberOfPackages: 24, incoterms: "DDP", invoiceNumber: "UKM-2026-0921",
        invoiceValue: 1250000, currency: "GBP", vesselOrFlight: "BA57",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "2934990000", description: "Pharmaceutical Intermediates Grade A", quantity: 100, unit: "KG", unitWeight: 4.5, totalWeight: 450, unitValue: 8500, totalValue: 850000, currency: "GBP", confidence: "high" },
          { lineNumber: 2, hsCode: "2934999090", description: "Chemical Compounds (Pharma Grade)", quantity: 50, unit: "KG", unitWeight: 8, totalWeight: 400, unitValue: 8000, totalValue: 400000, currency: "GBP", confidence: "high" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "All values reconciled" }, penaltyRisk: false },
          { module: "hs_code", result: "pass", detail: { message: "2 valid 8-digit codes verified" }, penaltyRisk: false },
          { module: "vat_engine", result: "pass", detail: { message: "VAT verified (non-SACU: 10% markup applied)", isSacuOrigin: false }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00042", shipperName: "German Automotive GmbH", shipperAddress: "Hamburg Freeport, Am Sandtorkai 48, 20457 Hamburg, Germany",
        consigneeName: "Rohlig-Grindrod", consigneeAddress: "Grindrod House, 7 Cruywagen Street, Durban 4001",
        originPort: "DEHAM", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "HLCU456789123", overallConfidence: "medium", shieldStatus: "hold",
        status: "review_required", cargoDescription: "Automotive components - FOB Hamburg",
        hsCodePrimary: "8708990000", grossWeight: 8200, weightUnit: "KGS", netWeight: 7800,
        numberOfPackages: 32, incoterms: "FOB", invoiceNumber: "GA-2026-4478",
        invoiceValue: 675000, currency: "EUR",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "8708990000", description: "Vehicle Brake Components", quantity: 200, unit: "PCS", unitWeight: 12, totalWeight: 2400, unitValue: 850, totalValue: 170000, currency: "EUR", confidence: "high" },
          { lineNumber: 2, hsCode: "8708290000", description: "Suspension Parts", quantity: 150, unit: "PCS", unitWeight: 18, totalWeight: 2700, unitValue: 1200, totalValue: 180000, currency: "EUR", confidence: "high" },
          { lineNumber: 3, hsCode: "87081000", description: "Bumper assemblies (INCOMPLETE)", quantity: 50, unit: "PCS", unitWeight: 52, totalWeight: 2600, unitValue: 6500, totalValue: 325000, currency: "EUR", confidence: "low" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "Weights reconciled within tolerance" }, penaltyRisk: false },
          { module: "hs_code", result: "hold", detail: { message: "1 of 3 HS codes has only 8 digits but line 3 code '87081000' needs verification — appears truncated", invalidCodes: [{ line: 3, code: "87081000", reason: "Suspiciously short, may be truncated" }] }, penaltyRisk: true },
          { module: "vat_engine", result: "pass", detail: { message: "VAT calculation verified" }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00041", shipperName: "Brazil Coffee Exporters", shipperAddress: "Rua do Comércio 456, Santos, São Paulo, Brazil",
        consigneeName: "Africa Global Logistics SA", consigneeAddress: "3rd Floor, Maritime House, Durban 4001",
        originPort: "BRSSZ", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "CSAV789123456", overallConfidence: "high", shieldStatus: "pass",
        status: "cw_draft_created", cargoDescription: "Green coffee beans - FOB Santos",
        hsCodePrimary: "0901110000", grossWeight: 19500, weightUnit: "KGS", netWeight: 19200,
        numberOfPackages: 780, incoterms: "FOB", invoiceNumber: "BCE-2026-0847",
        invoiceValue: 312000, currency: "USD", vesselOrFlight: "CSAV VOLCANO",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "0901110000", description: "Green Coffee Beans (Arabica)", quantity: 780, unit: "BAG", unitWeight: 25, totalWeight: 19500, unitValue: 400, totalValue: 312000, currency: "USD", confidence: "high" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "All values reconciled" }, penaltyRisk: false },
          { module: "hs_code", result: "pass", detail: { message: "1 valid 8-digit code" }, penaltyRisk: false },
          { module: "vat_engine", result: "pass", detail: { message: "SACU origin: no 10% markup. VAT verified." }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00040", shipperName: "Japan Electronics Corp", shipperAddress: "1-1 Yokohama Port, Naka-ku, Yokohama 231-0002, Japan",
        consigneeName: "DSV SA", consigneeAddress: "DSV House, 8 Solcart Road, Cape Town 7405",
        originPort: "JPYOK", destinationPort: "ZACPT", shipmentType: "air_import",
        awbOrBlNumber: "618-12345675", overallConfidence: "high", shieldStatus: "pass",
        status: "approved", cargoDescription: "Precision instruments - CIF Cape Town",
        hsCodePrimary: "9031800000", grossWeight: 340, weightUnit: "KGS", netWeight: 310,
        numberOfPackages: 12, incoterms: "CIF", invoiceNumber: "JEC-2026-1205",
        invoiceValue: 1850000, currency: "JPY", vesselOrFlight: "SA282",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "9031800000", description: "Precision Measurement Instruments", quantity: 6, unit: "PCS", unitWeight: 25, totalWeight: 150, unitValue: 150000, totalValue: 900000, currency: "JPY", confidence: "high" },
          { lineNumber: 2, hsCode: "9031490000", description: "Optical Instruments", quantity: 4, unit: "PCS", unitWeight: 40, totalWeight: 160, unitValue: 237500, totalValue: 950000, currency: "JPY", confidence: "high" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "All values reconciled" }, penaltyRisk: false },
          { module: "hs_code", result: "pass", detail: { message: "2 valid codes verified" }, penaltyRisk: false },
          { module: "vat_engine", result: "pass", detail: { message: "Non-SACU 10% markup applied. VAT verified." }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00039", shipperName: "Mozambique Commodities", shipperAddress: "Av. 25 de Setembro 1234, Maputo, Mozambique",
        consigneeName: "Transglobal Cargo", consigneeAddress: "40 Benares Road, Malvern, Durban 4093",
        originPort: "MZMPM", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "MSCM987123456", overallConfidence: "medium", shieldStatus: "hold",
        status: "pending", cargoDescription: "Agricultural products - DAP Durban",
        hsCodePrimary: "1201000000", grossWeight: 22000, weightUnit: "KGS", netWeight: 21500,
        numberOfPackages: 440, incoterms: "DAP", invoiceNumber: "MC-2026-0315",
        invoiceValue: 178000, currency: "USD",
        source: "email", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "1201000000", description: "Soya Beans (Grade A)", quantity: 440, unit: "BAG", unitWeight: 50, totalWeight: 22000, unitValue: 404.5, totalValue: 178000, currency: "USD", confidence: "medium" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "pass", detail: { message: "Values reconciled" }, penaltyRisk: false },
          { module: "hs_code", result: "pass", detail: { message: "1 valid code" }, penaltyRisk: false },
          { module: "vat_engine", result: "hold", detail: { message: "SACU origin (MZ is SACU member) — verify RLA status before submission. No 10% markup applied.", isSacuOrigin: true }, penaltyRisk: false },
        ],
      },
      {
        reference: "CIQ-2026-00038", shipperName: "Australia Mining Supplies", shipperAddress: "45 Port Kembla Road, Wollongong NSW 2500, Australia",
        consigneeName: "Spectrum Freight SA", consigneeAddress: "18 Kyalami Boulevard, Kyalami, Midrand 1684",
        originPort: "AUBNE", destinationPort: "ZADUR", shipmentType: "fcl_import",
        awbOrBlNumber: "ANL456789123", overallConfidence: "low", shieldStatus: "fail",
        status: "error", cargoDescription: "Mining equipment - FOB Brisbane",
        hsCodePrimary: "8430490000", grossWeight: 28500, weightUnit: "KGS", netWeight: 27000,
        numberOfPackages: 4, incoterms: "FOB", invoiceNumber: "AMS-2026-0892",
        invoiceValue: 2350000, currency: "AUD",
        source: "manual_upload", orgId: org.id,
        lineItems: [
          { lineNumber: 1, hsCode: "8430490000", description: "Coal Mining Excavator Parts", quantity: 2, unit: "PCS", unitWeight: 9500, totalWeight: 19000, unitValue: 850000, totalValue: 1700000, currency: "AUD", confidence: "low" },
          { lineNumber: 2, hsCode: "8431", description: "Boring machinery (INCOMPLETE)", quantity: 1, unit: "PCS", unitWeight: 7000, totalWeight: 7000, unitValue: 650000, totalValue: 650000, currency: "AUD", confidence: "low" },
        ],
        complianceResults: [
          { module: "invoice_pl", result: "fail", detail: { message: "Weight mismatch: Invoice 28 500 kg vs PL 27 200 kg (difference exceeds 1 kg tolerance)" }, penaltyRisk: true },
          { module: "hs_code", result: "fail", detail: { message: "1 of 2 HS codes invalid — '8431' has only 4 digits", invalidCodes: [{ line: 2, code: "8431", reason: "Only 4 digits" }] }, penaltyRisk: true },
          { module: "vat_engine", result: "fail", detail: { message: "Declared VAT R195 000 differs from calculated R4 194 750 by R3 999 750 — massive discrepancy", variance: 3999750 }, penaltyRisk: true },
        ],
      },
    ];

    // ─── Create shipments with line items and compliance events ──────────────
    let created = 0;
    for (const data of shipmentsData) {
      const { lineItems, complianceResults, ...shipmentFields } = data;

      const shipment = await db.shipment.upsert({
        where: { orgId_reference: { orgId: org.id, reference: data.reference } },
        update: shipmentFields,
        create: shipmentFields,
      });

      // Create line items
      if (lineItems && lineItems.length > 0) {
        // Delete existing line items first
        await db.cargoLineItem.deleteMany({ where: { shipmentId: shipment.id } });

        for (const li of lineItems) {
          await db.cargoLineItem.create({
            data: { shipmentId: shipment.id, ...li },
          });
        }
      }

      // Create compliance events
      if (complianceResults && complianceResults.length > 0) {
        // Delete existing events first
        await db.complianceEvent.deleteMany({ where: { shipmentId: shipment.id } });

        for (const ce of complianceResults) {
          await db.complianceEvent.create({
            data: {
              orgId: org.id,
              shipmentId: shipment.id,
              module: ce.module,
              result: ce.result,
              detail: JSON.stringify(ce.detail),
              penaltyRisk: ce.penaltyRisk,
              autoResolved: false,
            },
          });
        }
      }

      // Create audit logs for shipments with CW status
      if (data.status === "cw_draft_created") {
        await db.auditLog.create({
          data: {
            orgId: org.id, entityType: "shipment", entityId: shipment.id,
            action: "approved", actorType: "user", actorId: "johan@abclogistics.co.za",
            metadata: JSON.stringify({ note: "Auto-seed: approved and pushed to CW" }),
          },
        });
        await db.cwExecution.create({
          data: {
            orgId: org.id, shipmentId: shipment.id, executionType: "eadaptor_xml",
            status: "success", durationMs: 2800,
            cwResponse: "Draft created successfully in CargoWise",
            startedAt: new Date(Date.now() - 3600000),
            completedAt: new Date(Date.now() - 3597200),
          },
        });
      }

      created++;
    }

    // ─── Create WiseTech transactions ────────────────────────────────────────
    const wtDates = ["2026-05-21", "2026-05-22", "2026-05-23", "2026-05-24", "2026-05-25", "2026-05-26", "2026-05-27"];
    for (const d of wtDates) {
      const original = Math.floor(Math.random() * 50) + 30;
      const compacted = Math.floor(original * (0.3 + Math.random() * 0.4));
      await db.wisetechTransaction.upsert({
        where: { orgId_date: { orgId: org.id, date: new Date(d) } },
        update: {},
        create: {
          orgId: org.id,
          date: new Date(d),
          originalCount: original,
          compactedCount: compacted,
          estimatedSavingUsd: Math.round((original - compacted) * 12.5),
        },
      });
    }

    return NextResponse.json({
      success: true,
      organisation: org.name,
      shipmentsCreated: created,
      usersCreated: users.length,
      rlaStatusesCreated: rlaStatuses.length,
      wiseTechDays: wtDates.length,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to seed database" },
      { status: 500 }
    );
  }
}
