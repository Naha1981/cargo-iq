// GET /api/wiselayer - WiseLayer cost optimization data
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    const org = await db.organisation.findFirst({
      where: orgId ? { id: orgId } : undefined,
    });

    if (!org) {
      return NextResponse.json({ error: "not_found", message: "Organisation not found" }, { status: 404 });
    }

    // Get WiseTech transactions
    const transactions = await db.wisetechTransaction.findMany({
      where: { orgId: org.id },
      orderBy: { date: "desc" },
      take: 30,
    });

    // Calculate totals
    const totalOriginal = transactions.reduce((sum, t) => sum + t.originalCount, 0);
    const totalCompacted = transactions.reduce((sum, t) => sum + t.compactedCount, 0);
    const totalSavings = transactions.reduce((sum, t) => sum + (t.estimatedSavingUsd || 0), 0);
    const compactRate = totalOriginal > 0 ? (totalOriginal - totalCompacted) / totalOriginal : 0;

    // Daily trend
    const trend = transactions.map(t => ({
      date: t.date.toISOString().split("T")[0],
      original: t.originalCount,
      compacted: t.compactedCount,
      savings: t.estimatedSavingUsd || 0,
    }));

    // Value Pack cost estimate (R14.20 per CW transaction)
    const cwExecutions = await db.cwExecution.count({ where: { orgId: org.id, status: "success" } });
    const cwCostZar = cwExecutions * 14.20;

    return NextResponse.json({
      summary: {
        totalOriginalTransactions: totalOriginal,
        totalCompactedTransactions: totalCompacted,
        totalSavingsUsd: totalSavings,
        compactRate: Math.round(compactRate * 100) / 100,
        valuePackTransactions: cwExecutions,
        valuePackCostZar: cwCostZar,
        netSavingZar: Math.round(totalSavings * 18.5 - cwCostZar), // Convert USD savings to ZAR minus CW cost
      },
      trend,
      transactions,
    });
  } catch (error) {
    console.error("Error getting WiseLayer data:", error);
    return NextResponse.json({ error: "internal_error", message: "Failed to get WiseLayer data" }, { status: 500 });
  }
}
