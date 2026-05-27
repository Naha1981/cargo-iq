// GET /api/wiselayer - WiseLayer data for the authenticated org
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Date range filter
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const where: Record<string, unknown> = { orgId };

    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);
      where.date = dateFilter;
    }

    const [transactions, total] = await Promise.all([
      db.wisetechTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
      }),
      db.wisetechTransaction.count({ where }),
    ]);

    // Calculate summary stats
    const totalOriginal = transactions.reduce((sum, t) => sum + t.originalCount, 0);
    const totalCompacted = transactions.reduce((sum, t) => sum + t.compactedCount, 0);
    const totalSaved = totalOriginal - totalCompacted;
    const totalEstimatedSavingUsd = transactions.reduce(
      (sum, t) => sum + (t.estimatedSavingUsd || 0),
      0
    );

    const hasMore = offset + limit < total;

    return NextResponse.json({
      items: transactions.map((t) => ({
        id: t.id,
        orgId: t.orgId,
        date: t.date.toISOString(),
        originalCount: t.originalCount,
        compactedCount: t.compactedCount,
        saved: t.originalCount - t.compactedCount,
        estimatedSavingUsd: t.estimatedSavingUsd,
        createdAt: t.createdAt.toISOString(),
      })),
      summary: {
        totalTransactions: total,
        totalOriginal,
        totalCompacted,
        totalSaved,
        totalEstimatedSavingUsd: Math.round(totalEstimatedSavingUsd * 100) / 100,
        compactionRatio: totalOriginal > 0
          ? Math.round((totalSaved / totalOriginal) * 100 * 100) / 100
          : 0,
      },
      pagination: {
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error getting WiseLayer data:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get WiseLayer data" },
      { status: 500 }
    );
  }
}
