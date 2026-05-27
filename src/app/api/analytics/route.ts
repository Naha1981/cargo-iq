// GET /api/analytics - Overview statistics with enhanced pipeline metrics
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const org = await db.organisation.findFirst();
    if (!org) {
      return NextResponse.json({
        processed: 0,
        automationRate: 0,
        avgTimeSeconds: 0,
        errorRate: 0,
        shieldSummary: { pass: 0, hold: 0, fail: 0, pending: 0 },
        queueSize: 0,
        exceptions: 0,
        recentTrend: [],
        topOriginPorts: [],
        avgConfidenceBySource: {},
        shieldPassRate: 0,
        pipelineStatus: { pending: 0, review_required: 0, approved: 0, rejected: 0, cw_draft_created: 0, in_cargowise: 0, error: 0 },
      });
    }

    // Core counts
    const [
      total,
      pending,
      reviewRequired,
      approved,
      cwDraft,
      errors,
      passCount,
      holdCount,
      failCount,
      rejectedCount,
      inCwCount,
    ] = await Promise.all([
      db.shipment.count({ where: { orgId: org.id } }),
      db.shipment.count({ where: { orgId: org.id, status: "pending" } }),
      db.shipment.count({ where: { orgId: org.id, status: "review_required" } }),
      db.shipment.count({ where: { orgId: org.id, status: "approved" } }),
      db.shipment.count({ where: { orgId: org.id, status: "cw_draft_created" } }),
      db.shipment.count({ where: { orgId: org.id, status: "error" } }),
      db.shipment.count({ where: { orgId: org.id, shieldStatus: "pass" } }),
      db.shipment.count({ where: { orgId: org.id, shieldStatus: "hold" } }),
      db.shipment.count({ where: { orgId: org.id, shieldStatus: "fail" } }),
      db.shipment.count({ where: { orgId: org.id, status: "rejected" } }),
      db.shipment.count({ where: { orgId: org.id, status: "in_cargowise" } }),
    ]);

    const processed = approved + cwDraft;
    const pendingShield = total - passCount - holdCount - failCount;
    const automationRate = total > 0 ? cwDraft / Math.max(total, 1) : 0;

    // ── Recent shipment trend (last 7 days) ─────────────────────────────────
    const recentTrend: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      const count = await db.shipment.count({
        where: {
          orgId: org.id,
          createdAt: { gte: new Date(dateStr), lt: new Date(nextDateStr) },
        },
      });

      recentTrend.push({ date: dateStr, count });
    }

    // ── Top origin ports ────────────────────────────────────────────────────
    const allShipments = await db.shipment.findMany({
      where: { orgId: org.id, originPort: { not: null } },
      select: { originPort: true },
    });

    const portCounts: Record<string, number> = {};
    for (const s of allShipments) {
      if (s.originPort) {
        portCounts[s.originPort] = (portCounts[s.originPort] || 0) + 1;
      }
    }
    const topOriginPorts = Object.entries(portCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([port, count]) => ({ port, count }));

    // ── Average confidence by source type ───────────────────────────────────
    const sourceTypes = ["email", "whatsapp", "manual_upload"] as const;
    const avgConfidenceBySource: Record<string, Record<string, number>> = {};

    for (const source of sourceTypes) {
      const sourceShipments = await db.shipment.findMany({
        where: { orgId: org.id, source },
        select: { overallConfidence: true },
      });

      const counts = { high: 0, medium: 0, low: 0, total: sourceShipments.length };
      for (const s of sourceShipments) {
        if (s.overallConfidence === "high") counts.high++;
        else if (s.overallConfidence === "medium") counts.medium++;
        else counts.low++;
      }

      if (counts.total > 0) {
        avgConfidenceBySource[source] = {
          highPct: Math.round((counts.high / counts.total) * 100),
          mediumPct: Math.round((counts.medium / counts.total) * 100),
          lowPct: Math.round((counts.low / counts.total) * 100),
          total: counts.total,
        };
      }
    }

    // ── Shield pass rate ────────────────────────────────────────────────────
    const shieldTotal = passCount + holdCount + failCount;
    const shieldPassRate = shieldTotal > 0 ? Math.round((passCount / shieldTotal) * 100) / 100 : 0;

    // ── Pipeline status (how many at each stage) ───────────────────────────
    const pipelineStatus = {
      pending,
      review_required: reviewRequired,
      approved,
      rejected: rejectedCount,
      cw_draft_created: cwDraft,
      in_cargowise: inCwCount,
      error: errors,
    };

    return NextResponse.json({
      processed,
      automationRate: Math.round(automationRate * 100) / 100,
      avgTimeSeconds: 214,
      errorRate: total > 0 ? errors / total : 0,
      shieldSummary: { pass: passCount, hold: holdCount, fail: failCount, pending: pendingShield },
      queueSize: pending + reviewRequired,
      exceptions: holdCount + failCount,
      // Enhanced metrics
      recentTrend,
      topOriginPorts,
      avgConfidenceBySource,
      shieldPassRate,
      pipelineStatus,
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get analytics" },
      { status: 500 }
    );
  }
}
