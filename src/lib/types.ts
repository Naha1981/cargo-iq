// CargoIQ Type Definitions

export type Confidence = "high" | "medium" | "low";
export type ShieldStatus = "pass" | "hold" | "fail" | "pending";
export type ShipmentStatus =
  | "pending"
  | "review_required"
  | "approved"
  | "rejected"
  | "in_cargowise"
  | "cw_draft_created"
  | "error";

export type ViewMode =
  | "dashboard"
  | "shipments"
  | "shipment-detail"
  | "compliance"
  | "wiselayer"
  | "cargowise"
  | "settings";

export interface ShipmentSummary {
  id: string;
  reference: string | null;
  shipperName: string | null;
  consigneeName: string | null;
  originPort: string | null;
  destinationPort: string | null;
  shipmentType: string | null;
  awbOrBlNumber: string | null;
  overallConfidence: Confidence | null;
  shieldStatus: ShieldStatus | null;
  status: ShipmentStatus;
  documentCount: number;
  createdAt: string;
}

export interface ShipmentDetail extends ShipmentSummary {
  shipperAddress: string | null;
  consigneeAddress: string | null;
  notifyParty: string | null;
  cargoDescription: string | null;
  hsCodePrimary: string | null;
  grossWeight: number | null;
  netWeight: number | null;
  weightUnit: string;
  numberOfPackages: number | null;
  incoterms: string | null;
  invoiceNumber: string | null;
  invoiceValue: number | null;
  currency: string;
  vesselOrFlight: string | null;
  eta: string | null;
  etd: string | null;
  shieldResults: ShieldReport | null;
  lineItems: CargoLineItem[];
  documents: ShipmentDocument[];
  complianceEvents: ComplianceEvent[];
}

export interface ShieldReport {
  overall: ShieldStatus;
  penaltyRiskDetected: boolean;
  blockCargowise: boolean;
  modules: ShieldModule[];
}

export interface ShieldModule {
  module: string;
  result: ShieldStatus;
  detail: Record<string, unknown>;
  penaltyRisk: boolean;
  resolution: string | null;
}

export interface CargoLineItem {
  id: string;
  lineNumber: number;
  hsCode: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitWeight: number | null;
  totalWeight: number | null;
  unitValue: number | null;
  totalValue: number | null;
  currency: string | null;
  confidence: Confidence | null;
}

export interface ShipmentDocument {
  id: string;
  filename: string | null;
  fileType: string | null;
  docType: string | null;
  pageCount: number | null;
  status: string;
  createdAt: string;
}

export interface ComplianceEvent {
  id: string;
  module: string;
  result: ShieldStatus;
  detail: Record<string, unknown>;
  penaltyRisk: boolean;
  autoResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface OverviewStats {
  processed: number;
  automationRate: number;
  avgTimeSeconds: number;
  errorRate: number;
  shieldSummary: Record<string, number>;
  queueSize: number;
  exceptions: number;
}

export interface RlaStatus {
  id: string;
  importerCode: string;
  importerName: string | null;
  rlaStatus: string;
  lastCheckedAt: string | null;
  suspendedSince: string | null;
  alertSent: boolean;
}
