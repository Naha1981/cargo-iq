// CargoIQ — Reference Generator
// Generates unique shipment references in CIQ-YYYY-NNNNN format

import { db } from "@/lib/db";

/**
 * Generate the next shipment reference in CIQ-YYYY-NNNNN format.
 * Queries the DB for the highest existing number for this org + year,
 * then increments by 1.
 */
export async function generateReference(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CIQ-${year}-`;

  // Find the highest reference number for this org and year
  const lastShipment = await db.shipment.findFirst({
    where: {
      orgId,
      reference: { startsWith: prefix },
    },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  let nextNumber = 1;

  if (lastShipment?.reference) {
    const lastNumStr = lastShipment.reference.replace(prefix, "");
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
}
