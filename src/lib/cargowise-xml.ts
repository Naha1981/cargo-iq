// CargoIQ — CargoWise eAdaptor XML Generator
// Generates WiseTech eAdaptor UniversalShipment XML for creating customs entries in CargoWise.
// The shipment is ALWAYS created in "Draft" status — NEVER submitted directly.

/**
 * Shipment data structure for XML generation.
 * Maps to the Shipment model fields from the CargoIQ database.
 */
export interface ShipmentData {
  id: string;
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
  eta: string | null;
  etd: string | null;
  shipmentType: string | null;
  lineItems: CwLineItem[];
}

export interface CwLineItem {
  lineNumber: number;
  hsCode: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  totalWeight: number | null;
  totalValue: number | null;
  currency: string | null;
}

export interface OrgData {
  id: string;
  name: string;
  cwEnterpriseId: string | null;
  cwServerId: string | null;
}

/**
 * Escapes special XML characters in a string.
 */
function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a date string to ISO 8601 format for XML.
 */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString();
  } catch {
    return "";
  }
}

/**
 * Maps CargoIQ shipment type to CargoWise shipment mode code.
 */
function getShipmentMode(shipmentType: string | null): string {
  if (!shipmentType) return "SEA";
  if (shipmentType.startsWith("air")) return "AIR";
  if (shipmentType.startsWith("fcl") || shipmentType.startsWith("lcl")) return "SEA";
  if (shipmentType === "customs_only") return "CUSTOMS";
  return "SEA";
}

/**
 * Maps CargoIQ shipment type to CargoWise direction code.
 */
function getDirection(shipmentType: string | null): string {
  if (!shipmentType) return "IN";
  if (shipmentType.includes("import")) return "IN";
  if (shipmentType.includes("export")) return "OUT";
  return "IN";
}

/**
 * Generates the eAdaptor UniversalShipment XML for creating a draft customs entry in CargoWise.
 *
 * Follows the WiseTech eAdaptor UniversalShipment schema v1.1.
 * The shipment is created in "Draft" status only — NEVER submitted directly.
 */
export function generateShipmentXml(shipment: ShipmentData, org: OrgData): string {
  const senderRef = shipment.reference || `CIQ-${shipment.id}`;
  const consignmentNum = shipment.awbOrBlNumber || senderRef;
  const mode = getShipmentMode(shipment.shipmentType);
  const direction = getDirection(shipment.shipmentType);
  const now = new Date().toISOString();

  // Build line items XML
  const lineItemsXml = shipment.lineItems
    .map((li) => {
      const liXml = [];
      liXml.push(`      <LineItem>`);
      liXml.push(`        <LineNumber>${li.lineNumber}</LineNumber>`);
      if (li.hsCode) {
        liXml.push(`        <CommodityCode>${escapeXml(li.hsCode)}</CommodityCode>`);
      }
      if (li.description) {
        liXml.push(`        <Description>${escapeXml(li.description)}</Description>`);
      }
      if (li.quantity !== null) {
        liXml.push(`        <Quantity>${li.quantity}</Quantity>`);
      }
      if (li.unit) {
        liXml.push(`        <UnitOfMeasure>${escapeXml(li.unit)}</UnitOfMeasure>`);
      }
      if (li.totalWeight !== null) {
        liXml.push(`        <Weight>${li.totalWeight}</Weight>`);
        liXml.push(`        <WeightUnit>${escapeXml(shipment.weightUnit)}</WeightUnit>`);
      }
      if (li.totalValue !== null) {
        liXml.push(`        <Value>${li.totalValue}</Value>`);
        liXml.push(`        <ValueCurrency>${escapeXml(li.currency || shipment.currency)}</ValueCurrency>`);
      }
      liXml.push(`      </LineItem>`);
      return liXml.join("\n");
    })
    .join("\n");

  // Build organization party XML helper
  const orgPartyXml = (
    role: string,
    name: string | null,
    address: string | null
  ): string => {
    if (!name) return "";
    const lines = [];
    lines.push(`      <Organization>`);
    lines.push(`        <Role>${role}</Role>`);
    lines.push(`        <Name>${escapeXml(name)}</Name>`);
    if (address) {
      lines.push(`        <Address>`);
      lines.push(`          <FullAddress>${escapeXml(address)}</FullAddress>`);
      lines.push(`        </Address>`);
    }
    lines.push(`      </Organization>`);
    return lines.join("\n");
  };

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<UniversalShipment xmlns="http://www.wise-tech.com/Universe/1.1" version="1.1">`,
    `  <Shipment>`,
    `    <DataContext>`,
    `      <DataTargetCollection>`,
    `        <DataTarget>`,
    `          <Type>Shipment</Type>`,
    `          <Key>${escapeXml(senderRef)}</Key>`,
    `        </DataTarget>`,
    `      </DataTargetCollection>`,
    org.cwEnterpriseId
      ? `      <Enterprise>${escapeXml(org.cwEnterpriseId)}</Enterprise>`
      : "",
    org.cwServerId
      ? `      <Server>${escapeXml(org.cwServerId)}</Server>`
      : "",
    `    </DataContext>`,
    ``,
    `    <!-- Shipment Header -->`,
    `    <ShipmentHeader>`,
    `      <SenderRef>${escapeXml(senderRef)}</SenderRef>`,
    `      <ConsignmentNum>${escapeXml(consignmentNum)}</ConsignmentNum>`,
    `      <ShipmentMode>${mode}</ShipmentMode>`,
    `      <Direction>${direction}</Direction>`,
    `      <!-- DRAFT STATUS ONLY — Never submit directly -->`,
    `      <Status>Draft</Status>`,
    `      <CreatedDate>${now}</CreatedDate>`,
    `    </ShipmentHeader>`,
    ``,
    `    <!-- Organization Parties -->`,
    `    <OrganizationCollection>`,
    orgPartyXml("Shipper", shipment.shipperName, shipment.shipperAddress),
    orgPartyXml("Consignee", shipment.consigneeName, shipment.consigneeAddress),
    orgPartyXml("NotifyParty", shipment.notifyParty, null),
    `    </OrganizationCollection>`,
    ``,
    `    <!-- Routing -->`,
    `    <Routing>`,
    shipment.originPort
      ? `      <OriginPort>${escapeXml(shipment.originPort)}</OriginPort>`
      : "",
    shipment.destinationPort
      ? `      <DestinationPort>${escapeXml(shipment.destinationPort)}</DestinationPort>`
      : "",
    shipment.vesselOrFlight
      ? `      <VesselOrFlight>${escapeXml(shipment.vesselOrFlight)}</VesselOrFlight>`
      : "",
    shipment.etd
      ? `      <ETD>${formatDate(shipment.etd)}</ETD>`
      : "",
    shipment.eta
      ? `      <ETA>${formatDate(shipment.eta)}</ETA>`
      : "",
    `    </Routing>`,
    ``,
    `    <!-- Cargo Details -->`,
    `    <Cargo>`,
    shipment.cargoDescription
      ? `      <Description>${escapeXml(shipment.cargoDescription)}</Description>`
      : "",
    shipment.hsCodePrimary
      ? `      <PrimaryHSCode>${escapeXml(shipment.hsCodePrimary)}</PrimaryHSCode>`
      : "",
    shipment.grossWeight !== null
      ? `      <GrossWeight>${shipment.grossWeight}</GrossWeight>`
      : "",
    shipment.netWeight !== null
      ? `      <NetWeight>${shipment.netWeight}</NetWeight>`
      : "",
    `      <WeightUnit>${escapeXml(shipment.weightUnit)}</WeightUnit>`,
    shipment.numberOfPackages !== null
      ? `      <PackageCount>${shipment.numberOfPackages}</PackageCount>`
      : "",
    `    </Cargo>`,
    ``,
    `    <!-- Commercial Details -->`,
    `    <Commercial>`,
    shipment.invoiceNumber
      ? `      <InvoiceNumber>${escapeXml(shipment.invoiceNumber)}</InvoiceNumber>`
      : "",
    shipment.invoiceValue !== null
      ? `      <InvoiceValue>${shipment.invoiceValue}</InvoiceValue>`
      : "",
    `      <Currency>${escapeXml(shipment.currency)}</Currency>`,
    shipment.incoterms
      ? `      <Incoterms>${escapeXml(shipment.incoterms)}</Incoterms>`
      : "",
    `    </Commercial>`,
    ``,
    `    <!-- Customs Details -->`,
    `    <Customs>`,
    shipment.invoiceValue !== null
      ? `      <DeclaredValue>${shipment.invoiceValue}</DeclaredValue>`
      : "",
    `      <DeclaredCurrency>${escapeXml(shipment.currency)}</DeclaredCurrency>`,
    `      <VATCalculation>Auto</VATCalculation>`,
    `    </Customs>`,
    ``,
    `    <!-- Line Items -->`,
    shipment.lineItems.length > 0
      ? `    <LineItemCollection>\n${lineItemsXml}\n    </LineItemCollection>`
      : "",
    ``,
    `  </Shipment>`,
    `</UniversalShipment>`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return xml;
}
