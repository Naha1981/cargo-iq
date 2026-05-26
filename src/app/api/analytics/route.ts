// GET /api/analytics - Overview statistics
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const org = await db.organisation.findFirst();
    if (!org) {
      return NextResponse.json({
        processed: 0, automationRate: 0, avgTimeSeconds: 0,
        errorRate: 0, shieldSummary: { pass: 0, hold: 0, fail: 0, pending: 0 },
        queueSize: 0, exceptions: 0,
      });
    }

    const [total, pending, reviewRequired, approved, cwDraft, errors, passCount, holdCount, failCount] =
      await Promise.all([
        db.shipment.count({ where: { orgId: org.id } }),
        db.shipment.count({ where: { orgId: org.id, status: "pending" } }),
        db.shipment.count({ where: { orgId: org.id, status: "review_required" } }),
        db.shipment.count({ where: { orgId: org.id, status: "approved" } }),
        db.shipment.count({ where: { orgId: org.id, status: "cw_draft_created" } }),
        db.shipment.count({ where: { orgId: org.id, status: "error" } }),
        db.shipment.count({ where: { orgId: org.id, shieldStatus: "pass" } }),
        db.shipment.count({ where: { orgId: org.id, shieldStatus: "hold" } }),
        db.shipment.count({ where: { orgId: org.id, shieldStatus: "fail" } }),
      ]);

    const processed = approved + cwDraft;
    const pendingShield = total - passCount - holdCount - failCount;
    const automationRate = total > 0 ? cwDraft / Math.max(total, 1) : 0;

    return NextResponse.json({
      processed,
      automationRate: Math.round(automationRate * 100) / 100,
      avgTimeSeconds: 214,
      errorRate: total > 0 ? errors / total : 0,
      shieldSummary: { pass: passCount, hold: holdCount, fail: failCount, pending: pendingShield },
      queueSize: pending + reviewRequired,
      exceptions: holdCount + failCount,
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get analytics" },
      { status: 500 }
    );
  }
}
