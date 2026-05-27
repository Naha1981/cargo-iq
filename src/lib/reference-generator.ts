// CargoIQ — Reference Generator
// Generates CIQ-YYYY-NNNNN references for shipments
// Uses DB query to find the next sequential number for the year

import type { PrismaClient } from "@prisma/client";

/**
 * Generate the next CIQ reference number for the current year.
 *
 * Format: CIQ-2026-00001, CIQ-2026-00002, etc.
 *
 * Queries the Shipment table for the highest existing reference matching
 * CIQ-{year}-* and increments the sequential number.
 *
 * @param db - PrismaClient instance
 * @param year - Optional year override (defaults to current year)
 * @returns The next reference string, e.g. "CIQ-2026-00001"
 */
export async function generateNextReference(
  db: PrismaClient,
  year?: number
): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `CIQ-${y}-`;

  // Find the highest reference for this year
  const lastShipment = await db.shipment.findFirst({
    where: {
      reference: {
        startsWith: prefix,
      },
    },
    orderBy: {
      reference: "desc",
    },
    select: {
      reference: true,
    },
  });

  let nextSeq = 1;

  if (lastShipment?.reference) {
    // Extract the numeric suffix
    const suffix = lastShipment.reference.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  // Format as CIQ-YYYY-NNNNN (5-digit zero-padded)
  const reference = `${prefix}${String(nextSeq).padStart(5, "0")}`;
  return reference;
}
