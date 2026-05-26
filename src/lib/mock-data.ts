// CargoIQ — Mock data for demo purposes
import type { ShipmentSummary, ShipmentDetail, OverviewStats, ShieldModule, CargoLineItem, RlaStatus } from "./types";

export const mockOverviewStats: OverviewStats = {
  processed: 847,
  automationRate: 0.82,
  avgTimeSeconds: 214,
  errorRate: 0.018,
  shieldSummary: { pass: 612, hold: 89, fail: 23, pending: 123 },
  queueSize: 34,
  exceptions: 112,
};

const coreShipments: ShipmentSummary[] = [
  {
    id: "1",
    reference: "CIQ-2026-00047",
    shipperName: "Shanghai Global Trading Co.",
    consigneeName: "ABC Logistics SA",
    originPort: "CNSHA",
    destinationPort: "ZADUR",
    shipmentType: "fcl_import",
    awbOrBlNumber: "MAEU123456789",
    overallConfidence: "high",
    shieldStatus: "pass",
    status: "cw_draft_created",
    documentCount: 3,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "2",
    reference: "CIQ-2026-00046",
    shipperName: "Dubai Freight Services LLC",
    consigneeName: "Santova Logistics",
    originPort: "AEDXB",
    destinationPort: "ZACPT",
    shipmentType: "air_import",
    awbOrBlNumber: "074-12345678",
    overallConfidence: "high",
    shieldStatus: "pass",
    status: "approved",
    documentCount: 2,
    createdAt: new Date(Date.now() - 3.5 * 3600000).toISOString(),
  },
  {
    id: "3",
    reference: "CIQ-2026-00045",
    shipperName: "Kuehne + Nagel Shenzhen",
    consigneeName: "Megafreight Services",
    originPort: "CNSZX",
    destinationPort: "ZADUR",
    shipmentType: "lcl_import",
    awbOrBlNumber: "COSCO987654321",
    overallConfidence: "medium",
    shieldStatus: "hold",
    status: "review_required",
    documentCount: 2,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "4",
    reference: "CIQ-2026-00044",
    shipperName: "India Exports Mumbai",
    consigneeName: "NATCO Logistics",
    originPort: "INBOM",
    destinationPort: "ZADUR",
    shipmentType: "fcl_import",
    awbOrBlNumber: "MSCIM987654321",
    overallConfidence: "low",
    shieldStatus: "fail",
    status: "review_required",
    documentCount: 1,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: "5",
    reference: "CIQ-2026-00043",
    shipperName: "UK Manufacturing Ltd",
    consigneeName: "CFR Freight SA",
    originPort: "GBFXT",
    destinationPort: "ZACPT",
    shipmentType: "air_import",
    awbOrBlNumber: "057-98765432",
    overallConfidence: "high",
    shieldStatus: "pass",
    status: "pending",
    documentCount: 3,
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "6",
    reference: "CIQ-2026-00042",
    shipperName: "German Automotive GmbH",
    consigneeName: "Rohlig-Grindrod",
    originPort: "DEHAM",
    destinationPort: "ZADUR",
    shipmentType: "fcl_import",
    awbOrBlNumber: "HLCU456789123",
    overallConfidence: "medium",
    shieldStatus: "hold",
    status: "review_required",
    documentCount: 2,
    createdAt: new Date(Date.now() - 10 * 3600000).toISOString(),
  },
  {
    id: "7",
    reference: "CIQ-2026-00041",
    shipperName: "Brazil Coffee Exporters",
    consigneeName: "Africa Global Logistics SA",
    originPort: "BRSSZ",
    destinationPort: "ZADUR",
    shipmentType: "fcl_import",
    awbOrBlNumber: "CSAV789123456",
    overallConfidence: "high",
    shieldStatus: "pass",
    status: "cw_draft_created",
    documentCount: 4,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: "8",
    reference: "CIQ-2026-00040",
    shipperName: "Japan Electronics Corp",
    consigneeName: "DSV SA",
    originPort: "JPYOK",
    destinationPort: "ZACPT",
    shipmentType: "air_import",
    awbOrBlNumber: "618-12345675",
    overallConfidence: "high",
    shieldStatus: "pass",
    status: "approved",
    documentCount: 2,
    createdAt: new Date(Date.now() - 14 * 3600000).toISOString(),
  },
  {
    id: "9",
    reference: "CIQ-2026-00039",
    shipperName: "Mozambique Commodities",
    consigneeName: "Transglobal Cargo",
    originPort: "MZMPM",
    destinationPort: "ZADUR",
    shipmentType: "fcl_import",
    awbOrBlNumber: "MSCM987123456",
    overallConfidence: "medium",
    shieldStatus: "hold",
    status: "pending",
    documentCount: 1,
    createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
  {
    id: "10",
    reference: "CIQ-2026-00038",
    shipperName: "Australia Mining Supplies",
    consigneeName: "Spectrum Freight SA",
    originPort: "AUBNE",
    destinationPort: "ZADUR",
    shipmentType: "fcl_import",
    awbOrBlNumber: "ANL456789123",
    overallConfidence: "low",
    shieldStatus: "fail",
    status: "error",
    documentCount: 2,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];

// ── Extended shipments to reach 34 total ──────────────────────────────────
const extendedShipmentDefs: Array<{
  shipper: string; consignee: string; origin: string; dest: string;
  type: string; bl: string; confidence: "high" | "medium" | "low";
  shield: "pass" | "hold" | "fail" | "pending";
  status: ShipmentSummary["status"]; docs: number; hoursAgo: number;
}> = [
  { shipper: "Singapore Tech Pte Ltd", consignee: "Bidvest Freight", origin: "SGSIN", dest: "ZADUR", type: "air_import", bl: "618-23456789", confidence: "high", shield: "pass", status: "pending", docs: 2, hoursAgo: 26 },
  { shipper: "Vietnam Garments JSC", consignee: "Grindrod Intermodal", origin: "VNSGN", dest: "ZACPT", type: "fcl_import", bl: "ONE234567890", confidence: "medium", shield: "hold", status: "review_required", docs: 3, hoursAgo: 28 },
  { shipper: "Chile Wine Exports SA", consignee: "Maersk SA", origin: "CLSCL", dest: "ZADUR", type: "fcl_import", bl: "MAEU234567890", confidence: "high", shield: "pass", status: "approved", docs: 2, hoursAgo: 30 },
  { shipper: "Thailand Rubber Co.", consignee: "Safcor Panalpina", origin: "THBKK", dest: "ZADUR", type: "lcl_import", bl: "CULP345678901", confidence: "medium", shield: "pending", status: "pending", docs: 1, hoursAgo: 32 },
  { shipper: "Turkey Textile Exports", consignee: "Imperial Logistics", origin: "TRIST", dest: "ZACPT", type: "fcl_import", bl: "YML456789012", confidence: "high", shield: "pass", status: "cw_draft_created", docs: 3, hoursAgo: 34 },
  { shipper: "Nigeria Oil Services Ltd", consignee: "ABC Logistics SA", origin: "NGLOS", dest: "ZADUR", type: "fcl_import", bl: "MSCN567890123", confidence: "low", shield: "fail", status: "error", docs: 1, hoursAgo: 36 },
  { shipper: "South Korea Electronics", consignee: "Santova Logistics", origin: "KRPUS", dest: "ZADUR", type: "air_import", bl: "074-34567890", confidence: "high", shield: "pass", status: "approved", docs: 2, hoursAgo: 38 },
  { shipper: "Italy Fashion Exports SpA", consignee: "CFR Freight SA", origin: "ITGOA", dest: "ZACPT", type: "fcl_import", bl: "MSCU678901234", confidence: "medium", shield: "hold", status: "review_required", docs: 3, hoursAgo: 40 },
  { shipper: "Argentina Agri Products", consignee: "DSV SA", origin: "ARBUE", dest: "ZADUR", type: "fcl_import", bl: "HLCU789012345", confidence: "high", shield: "pass", status: "in_cargowise", docs: 4, hoursAgo: 42 },
  { shipper: "Indonesia Mining Corp", consignee: "Rohlig-Grindrod", origin: "IDJKT", dest: "ZADUR", type: "fcl_import", bl: "COSCO890123456", confidence: "low", shield: "fail", status: "review_required", docs: 1, hoursAgo: 44 },
  { shipper: "Mexico Manufacturing SA", consignee: "Megafreight Services", origin: "MXMZL", dest: "ZACPT", type: "lcl_import", bl: "MAEU901234567", confidence: "medium", shield: "hold", status: "pending", docs: 2, hoursAgo: 46 },
  { shipper: "Egypt Chemicals Ltd", consignee: "Transglobal Cargo", origin: "EGCAI", dest: "ZADUR", type: "fcl_import", bl: "ONE012345678", confidence: "high", shield: "pass", status: "approved", docs: 3, hoursAgo: 48 },
  { shipper: "Poland Machinery Sp.", consignee: "Spectrum Freight SA", origin: "PLGDN", dest: "ZADUR", type: "fcl_import", bl: "YML123456789", confidence: "medium", shield: "pending", status: "pending", docs: 2, hoursAgo: 50 },
  { shipper: "Kenya Tea Exporters", consignee: "Africa Global Logistics SA", origin: "KEMBA", dest: "ZADUR", type: "air_import", bl: "057-45678901", confidence: "high", shield: "pass", status: "cw_draft_created", docs: 3, hoursAgo: 52 },
  { shipper: "Colombia Coffee SA", consignee: "NATCO Logistics", origin: "COCTG", dest: "ZACPT", type: "fcl_import", bl: "CSAV234567890", confidence: "medium", shield: "hold", status: "review_required", docs: 2, hoursAgo: 54 },
  { shipper: "Philippines Electronics", consignee: "Bidvest Freight", origin: "PHMNL", dest: "ZADUR", type: "air_import", bl: "618-56789012", confidence: "low", shield: "fail", status: "error", docs: 1, hoursAgo: 56 },
  { shipper: "Sweden Steel AB", consignee: "Safcor Panalpina", origin: "SEGOA", dest: "ZADUR", type: "fcl_import", bl: "HLCU345678901", confidence: "high", shield: "pass", status: "approved", docs: 2, hoursAgo: 58 },
  { shipper: "Malaysia Palm Oil Bhd", consignee: "Imperial Logistics", origin: "MYPKG", dest: "ZACPT", type: "fcl_import", bl: "MSCM456789012", confidence: "medium", shield: "hold", status: "pending", docs: 3, hoursAgo: 60 },
  { shipper: "France Luxury Goods SA", consignee: "Maersk SA", origin: "FRMRS", dest: "ZADUR", type: "air_import", bl: "074-67890123", confidence: "high", shield: "pass", status: "in_cargowise", docs: 4, hoursAgo: 62 },
  { shipper: "China Steel Corp", consignee: "Grindrod Intermodal", origin: "CNTXG", dest: "ZADUR", type: "fcl_import", bl: "COSCO567890123", confidence: "high", shield: "pass", status: "approved", docs: 2, hoursAgo: 64 },
  { shipper: "Peru Mining Exports", consignee: "ABC Logistics SA", origin: "PECLL", dest: "ZACPT", type: "fcl_import", bl: "MAEU678901234", confidence: "low", shield: "fail", status: "review_required", docs: 1, hoursAgo: 66 },
  { shipper: "Norway Seafood AS", consignee: "Santova Logistics", origin: "NOOSL", dest: "ZADUR", type: "air_import", bl: "057-78901234", confidence: "high", shield: "pass", status: "cw_draft_created", docs: 3, hoursAgo: 68 },
  { shipper: "Ghana Cocoa Board", consignee: "CFR Freight SA", origin: "GHACC", dest: "ZADUR", type: "fcl_import", bl: "CULP789012345", confidence: "medium", shield: "pending", status: "pending", docs: 2, hoursAgo: 70 },
  { shipper: "Taiwan Semiconductor Co.", consignee: "DSV SA", origin: "TWKHH", dest: "ZACPT", type: "air_import", bl: "618-89012345", confidence: "high", shield: "pass", status: "approved", docs: 3, hoursAgo: 72 },
];

const extendedShipments: ShipmentSummary[] = extendedShipmentDefs.map((d, i) => ({
  id: String(11 + i),
  reference: `CIQ-2026-${String(37 - i).padStart(5, "0")}`,
  shipperName: d.shipper,
  consigneeName: d.consignee,
  originPort: d.origin,
  destinationPort: d.dest,
  shipmentType: d.type,
  awbOrBlNumber: d.bl,
  overallConfidence: d.confidence,
  shieldStatus: d.shield,
  status: d.status,
  documentCount: d.docs,
  createdAt: new Date(Date.now() - d.hoursAgo * 3600000).toISOString(),
}));

export const mockShipments: ShipmentSummary[] = [...coreShipments, ...extendedShipments];

const mockShieldModules: ShieldModule[] = [
  {
    module: "invoice_pl",
    result: "pass",
    detail: { checked: true, hasInvoice: true, hasPackingList: true },
    penaltyRisk: false,
    resolution: null,
  },
  {
    module: "hs_code",
    result: "pass",
    detail: { checked: true, validCodes: 5 },
    penaltyRisk: false,
    resolution: null,
  },
  {
    module: "vat_engine",
    result: "pass",
    detail: {
      origin: "CN",
      isSacu: false,
      customsValue: 125000,
      duties: 8750,
      markupApplied: true,
      calculatedVat: 22031.25,
    },
    penaltyRisk: false,
    resolution: null,
  },
];

const mockShieldModulesHold: ShieldModule[] = [
  {
    module: "invoice_pl",
    result: "pass",
    detail: { checked: true },
    penaltyRisk: false,
    resolution: null,
  },
  {
    module: "hs_code",
    result: "hold",
    detail: { message: "No HS code provided" },
    penaltyRisk: false,
    resolution: "Add HS code before customs submission.",
  },
  {
    module: "vat_engine",
    result: "pass",
    detail: { calculatedVat: 18450 },
    penaltyRisk: false,
    resolution: null,
  },
];

const mockShieldModulesFail: ShieldModule[] = [
  {
    module: "invoice_pl",
    result: "fail",
    detail: {
      mismatches: [
        {
          field: "gross_weight",
          shipmentValue: 12500,
          lineItemsTotal: 13280,
          variance: 780,
        },
      ],
    },
    penaltyRisk: true,
    resolution: "Reconcile invoice and packing list values before submission.",
  },
  {
    module: "hs_code",
    result: "fail",
    detail: {
      invalidCodes: [
        { code: "1234567", cleaned: "1234567", context: "line_item_2", reason: "Must be exactly 8 digits" },
      ],
    },
    penaltyRisk: true,
    resolution: "SARS requires 8-digit HS codes. Correct invalid codes before submission.",
  },
  {
    module: "vat_engine",
    result: "pass",
    detail: { calculatedVat: 19800 },
    penaltyRisk: false,
    resolution: null,
  },
];

const mockLineItems: CargoLineItem[] = [
  { id: "l1", lineNumber: 1, hsCode: "8471300000", description: "Laptop Computers", quantity: 500, unit: "PCS", unitWeight: 2.4, totalWeight: 1200, unitValue: 850, totalValue: 425000, currency: "USD", confidence: "high" },
  { id: "l2", lineNumber: 2, hsCode: "8517620000", description: "Network Routers", quantity: 200, unit: "PCS", unitWeight: 3.2, totalWeight: 640, unitValue: 320, totalValue: 64000, currency: "USD", confidence: "high" },
  { id: "l3", lineNumber: 3, hsCode: "8504403000", description: "Power Supply Units", quantity: 1000, unit: "PCS", unitWeight: 1.8, totalWeight: 1800, unitValue: 45, totalValue: 45000, currency: "USD", confidence: "medium" },
  { id: "l4", lineNumber: 4, hsCode: "8544429000", description: "Cable Assemblies", quantity: 5000, unit: "M", unitWeight: 0.15, totalWeight: 750, unitValue: 3.2, totalValue: 16000, currency: "USD", confidence: "high" },
  { id: "l5", lineNumber: 5, hsCode: "8473300000", description: "Computer Parts & Accessories", quantity: 300, unit: "KG", unitWeight: 0.5, totalWeight: 150, unitValue: 120, totalValue: 36000, currency: "USD", confidence: "medium" },
];

export function getMockShipmentDetail(id: string): ShipmentDetail {
  const shipment = mockShipments.find(s => s.id === id) || mockShipments[0];
  const shieldMap: Record<string, ShieldModule[]> = {
    pass: mockShieldModules,
    hold: mockShieldModulesHold,
    fail: mockShieldModulesFail,
    pending: mockShieldModules,
  };
  const shieldStatus = shipment.shieldStatus || "pending";
  const modules = shieldMap[shieldStatus] || mockShieldModules;
  const overall = shieldStatus as "pass" | "hold" | "fail";

  return {
    ...shipment,
    shipperAddress: "Room 2801, International Trade Centre, Shanghai 200001, China",
    consigneeAddress: "15 Quarry Road, Springfield, Durban 4001, South Africa",
    notifyParty: "ABC Logistics SA — Customs Division",
    cargoDescription: "Electronic equipment including laptop computers, network routers, power supply units and cable assemblies. CIF Durban.",
    hsCodePrimary: "8471300000",
    grossWeight: 4540,
    netWeight: 4200,
    weightUnit: "KGS",
    numberOfPackages: 45,
    incoterms: "CIF",
    invoiceNumber: "SINV-2026-04287",
    invoiceValue: 586000,
    currency: "USD",
    vesselOrFlight: "MSC ISABELLA",
    eta: "2026-06-15",
    etd: "2026-05-28",
    shieldResults: {
      overall,
      penaltyRiskDetected: overall === "fail",
      blockCargowise: overall === "fail",
      modules,
    },
    lineItems: mockLineItems,
    documents: [
      { id: "d1", filename: "Commercial_Invoice_SINV-2026-04287.pdf", fileType: "pdf", docType: "commercial_invoice", pageCount: 3, status: "processed", createdAt: shipment.createdAt },
      { id: "d2", filename: "Packing_List_PL-2026-04287.pdf", fileType: "pdf", docType: "packing_list", pageCount: 2, status: "processed", createdAt: shipment.createdAt },
      { id: "d3", filename: "Bill_of_Lading_MAEU123456789.pdf", fileType: "pdf", docType: "bl", pageCount: 1, status: "processed", createdAt: shipment.createdAt },
    ],
    complianceEvents: modules.map((m, i) => ({
      id: `ce${i}`,
      module: m.module,
      result: m.result,
      detail: m.detail,
      penaltyRisk: m.penaltyRisk,
      autoResolved: false,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: shipment.createdAt,
    })),
  };
}

export const mockRlaStatuses: RlaStatus[] = [
  { id: "r1", importerCode: "50123456789", importerName: "ABC Logistics SA", rlaStatus: "active", lastCheckedAt: new Date().toISOString(), suspendedSince: null, alertSent: false },
  { id: "r2", importerCode: "50987654321", importerName: "XYZ Imports (Pty) Ltd", rlaStatus: "active", lastCheckedAt: new Date().toISOString(), suspendedSince: null, alertSent: false },
  { id: "r3", importerCode: "50456789012", importerName: "DEF Trading CC", rlaStatus: "suspended", lastCheckedAt: new Date().toISOString(), suspendedSince: new Date(Date.now() - 3 * 86400000).toISOString(), alertSent: true },
  { id: "r4", importerCode: "50321654987", importerName: "GHI Exports International", rlaStatus: "active", lastCheckedAt: new Date().toISOString(), suspendedSince: null, alertSent: false },
  { id: "r5", importerCode: "50789456123", importerName: "JKL Freight Solutions", rlaStatus: "inactive", lastCheckedAt: new Date(Date.now() - 7 * 86400000).toISOString(), suspendedSince: null, alertSent: false },
];

export const mockTransactionData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.now() - (29 - i) * 86400000);
  const total = 80 + Math.floor(Math.random() * 60);
  const saved = Math.floor(total * (0.5 + Math.random() * 0.25));
  return { date: date.toISOString().split("T")[0], total, saved };
});
