// CargoIQ — CargoWise eAdaptor UniversalShipment XML Generator
// Generates WiseTech eAdaptor v1.1 XML for CargoWise integration
// All shipments are created in "Draft" status — NEVER submitted directly

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShipmentData {
  reference: string | null;
  shipperName: string | null;
  shipperAddress: string | null;
  consigneeName: string | null;
  consigneeAddress: string | null;
  notifyParty: string | null;
  originPort: string | null;
  destinationPort: string | null;
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
  awbOrBlNumber: string | null;
  vesselOrFlight: string | null;
  eta: Date | string | null;
  etd: Date | string | null;
  shipmentType: string | null;
  lineItems?: CwLineItem[];
}

export interface CwLineItem {
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
}

export interface OrgData {
  id: string;
  name: string;
  cwServerUrl?: string | null;
  cwEnterpriseId?: string | null;
  cwServerId?: string | null;
}

// ---------------------------------------------------------------------------
// XML Escape Utility
// ---------------------------------------------------------------------------

/**
 * Escape special characters for XML content.
 * Handles: &, <, >, ", '
 */
export function xmlEscape(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Helper: format date for XML
// ---------------------------------------------------------------------------

function xmlDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function xmlDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString(); // Full ISO 8601
}

// ---------------------------------------------------------------------------
// Helper: map shipment type to CargoWise mode
// ---------------------------------------------------------------------------

function mapShipmentMode(shipmentType: string | null): string {
  if (!shipmentType) return "SEA";
  const lower = shipmentType.toLowerCase();
  if (lower.includes("air")) return "AIR";
  if (lower.includes("fcl")) return "SEA";
  if (lower.includes("lcl")) return "SEA";
  if (lower.includes("customs")) return "SEA";
  return "SEA";
}

// ---------------------------------------------------------------------------
// Generate UniversalShipment XML
// ---------------------------------------------------------------------------

/**
 * Generate a WiseTech eAdaptor v1.1 UniversalShipment XML payload.
 *
 * The shipment is ALWAYS created in "Draft" status.
 * It must be reviewed and manually submitted in CargoWise.
 *
 * @param shipment - Shipment data matching the Shipment model fields
 * @param org - Organization data for enterprise/server context
 * @returns Well-formed XML string
 */
export function generateShipmentXml(
  shipment: ShipmentData,
  org: OrgData
): string {
  const now = new Date().toISOString();
  const mode = mapShipmentMode(shipment.shipmentType);
  const isAir = mode === "AIR";

  // Build OrganizationParties section
  const shipperXml = shipment.shipperName
    ? `
    <OrganizationParty>
      <OrganizationCode>${xmlEscape(shipment.reference || "")}</OrganizationCode>
      <OrganizationName>${xmlEscape(shipment.shipperName)}</OrganizationName>
      <PartyType>Shipper</PartyType>
      <Address>
        <AddressLine1>${xmlEscape(shipment.shipperAddress || "")}</AddressLine1>
        <AddressType>StreetAddress</AddressType>
      </Address>
    </OrganizationParty>`
    : "";

  const consigneeXml = shipment.consigneeName
    ? `
    <OrganizationParty>
      <OrganizationName>${xmlEscape(shipment.consigneeName)}</OrganizationName>
      <PartyType>Consignee</PartyType>
      <Address>
        <AddressLine1>${xmlEscape(shipment.consigneeAddress || "")}</AddressLine1>
        <AddressType>StreetAddress</AddressType>
      </Address>
    </OrganizationParty>`
    : "";

  const notifyXml = shipment.notifyParty
    ? `
    <OrganizationParty>
      <OrganizationName>${xmlEscape(shipment.notifyParty)}</OrganizationName>
      <PartyType>NotifyParty</PartyType>
    </OrganizationParty>`
    : "";

  // Build LineItems section
  let lineItemsXml = "";
  if (shipment.lineItems && shipment.lineItems.length > 0) {
    lineItemsXml = shipment.lineItems
      .map(
        (li) => `    <LineItem>
      <LineNumber>${li.lineNumber}</LineNumber>
      ${li.hsCode ? `<HSCode>${xmlEscape(li.hsCode)}</HSCode>` : ""}
      ${li.description ? `<Description>${xmlEscape(li.description)}</Description>` : ""}
      ${li.quantity != null ? `<Quantity>${li.quantity}</Quantity>` : ""}
      ${li.unit ? `<UnitOfMeasure>${xmlEscape(li.unit)}</UnitOfMeasure>` : ""}
      ${li.totalWeight != null ? `<Weight>${li.totalWeight}</Weight>` : ""}
      ${li.totalValue != null ? `<Value>${li.totalValue}</Value>` : ""}
      ${li.currency ? `<Currency>${xmlEscape(li.currency)}</Currency>` : ""}
    </LineItem>`
      )
      .join("\n");
  }

  // Assemble the full XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UniversalShipment xmlns="http://www.wisetechglobal.com/eAdaptor/v1.1" version="1.1">
  <Header>
    <SourceSystem>CargoIQ</SourceSystem>
    <EnterpriseID>${xmlEscape(org.cwEnterpriseId || org.id)}</EnterpriseID>
    <ServerID>${xmlEscape(org.cwServerId || "")}</ServerID>
    <MessageID>${xmlEscape(`CIQ-${Date.now()}`)}</MessageID>
    <MessageDate>${xmlDateTime(now)}</MessageDate>
  </Header>
  <Shipment>
    <ShipmentHeader>
      <ShipmentReference>${xmlEscape(shipment.reference || "")}</ShipmentReference>
      <Mode>${mode}</Mode>
      <ShipmentStatus>Draft</ShipmentStatus>
      <Direction>Import</Direction>
      ${isAir ? `<AWBNumber>${xmlEscape(shipment.awbOrBlNumber || "")}</AWBNumber>` : `<BLNumber>${xmlEscape(shipment.awbOrBlNumber || "")}</BLNumber>`}
      ${shipment.vesselOrFlight ? `<VesselFlight>${xmlEscape(shipment.vesselOrFlight)}</VesselFlight>` : ""}
      ${shipment.incoterms ? `<Incoterms>${xmlEscape(shipment.incoterms)}</Incoterms>` : ""}
      <CreatedDate>${xmlDateTime(now)}</CreatedDate>
    </ShipmentHeader>
    <OrganizationParties>
      ${shipperXml}
      ${consigneeXml}
      ${notifyXml}
    </OrganizationParties>
    <Routing>
      ${shipment.originPort ? `<PortOfLoading>${xmlEscape(shipment.originPort)}</PortOfLoading>` : ""}
      ${shipment.destinationPort ? `<PortOfDischarge>${xmlEscape(shipment.destinationPort)}</PortOfDischarge>` : ""}
      ${shipment.etd ? `<ETD>${xmlDate(shipment.etd)}</ETD>` : ""}
      ${shipment.eta ? `<ETA>${xmlDate(shipment.eta)}</ETA>` : ""}
    </Routing>
    <Cargo>
      ${shipment.cargoDescription ? `<Description>${xmlEscape(shipment.cargoDescription)}</Description>` : ""}
      ${shipment.grossWeight != null ? `<GrossWeight Unit="${xmlEscape(shipment.weightUnit || "KGS")}">${shipment.grossWeight}</GrossWeight>` : ""}
      ${shipment.netWeight != null ? `<NetWeight Unit="${xmlEscape(shipment.weightUnit || "KGS")}">${shipment.netWeight}</NetWeight>` : ""}
      ${shipment.numberOfPackages != null ? `<PackageCount>${shipment.numberOfPackages}</PackageCount>` : ""}
    </Cargo>
    <Commercial>
      ${shipment.invoiceNumber ? `<InvoiceNumber>${xmlEscape(shipment.invoiceNumber)}</InvoiceNumber>` : ""}
      ${shipment.invoiceValue != null ? `<InvoiceValue Currency="${xmlEscape(shipment.currency || "USD")}">${shipment.invoiceValue}</InvoiceValue>` : ""}
    </Commercial>
    <Customs>
      ${shipment.hsCodePrimary ? `<HSCodePrimary>${xmlEscape(shipment.hsCodePrimary)}</HSCodePrimary>` : ""}
      <CountryOfOrigin>${xmlEscape((shipment.originPort || "").slice(0, 2) || "ZA")}</CountryOfOrigin>
    </Customs>
    ${lineItemsXml ? `<LineItems>\n${lineItemsXml}\n    </LineItems>` : ""}
  </Shipment>
</UniversalShipment>`;

  return xml;
}
