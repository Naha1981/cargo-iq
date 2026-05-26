"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useCargoIQStore } from "@/lib/store";
import { mockShipments } from "@/lib/mock-data";
import type { ShipmentSummary, Confidence, ShieldStatus, ShipmentStatus } from "@/lib/types";

// ── Color tokens ──────────────────────────────────────────────────────────
const C = {
  canvas: "#F1F4F8",
  surface: "#FFFFFF",
  subtle: "#E8ECF1",
  textPrimary: "#0D1B2A",
  textSecondary: "#3D5166",
  textTertiary: "#6B7E92",
  border: "#C8D0DA",
  borderSubtle: "#DDE3EA",
  accent: "#B8860B",
  headerBg: "#E8ECF1",
  rowHover: "#E8ECF1",
} as const;

// ── Badge style maps ──────────────────────────────────────────────────────
const SHIELD_BADGE: Record<ShieldStatus, { bg: string; color: string; border: string; dot: string; label: string }> = {
  pass:    { bg: "#EBF5EE", color: "#15632A", border: "#8EC9A0", dot: "#15632A", label: "PASS" },
  hold:    { bg: "#FEF6E7", color: "#7A4F00", border: "#E8B84B", dot: "#E8B84B", label: "HOLD" },
  fail:    { bg: "#FEF2F2", color: "#9B1C1C", border: "#F5A5A5", dot: "#9B1C1C", label: "FAIL" },
  pending: { bg: "#E8ECF1", color: "#3D5166", border: "#C8D0DA", dot: "#6B7E92", label: "PENDING" },
};

const CONFIDENCE_BADGE: Record<Confidence, { bg: string; color: string; border: string; dot: string; label: string }> = {
  high:   { bg: "#EBF5EE", color: "#15632A", border: "#8EC9A0", dot: "#15632A", label: "HIGH" },
  medium: { bg: "#FEF6E7", color: "#7A4F00", border: "#E8B84B", dot: "#E8B84B", label: "MEDIUM" },
  low:    { bg: "#FEF2F2", color: "#9B1C1C", border: "#F5A5A5", dot: "#9B1C1C", label: "LOW" },
};

const STATUS_BADGE: Record<ShipmentStatus, { bg: string; color: string; border: string; label: string }> = {
  pending:         { bg: "#E8ECF1", color: "#3D5166", border: "#C8D0DA", label: "PENDING" },
  review_required: { bg: "#FEF6E7", color: "#7A4F00", border: "#E8B84B", label: "REVIEW" },
  approved:        { bg: "#EBF5EE", color: "#15632A", border: "#8EC9A0", label: "APPROVED" },
  rejected:        { bg: "#FEF2F2", color: "#9B1C1C", border: "#F5A5A5", label: "REJECTED" },
  in_cargowise:    { bg: "#EBF3FB", color: "#1A4971", border: "#93C5E4", label: "IN CW" },
  cw_draft_created:{ bg: "#FDF3DC", color: "#B8860B", border: "#D4A843", label: "CW DRAFT" },
  error:           { bg: "#FEF2F2", color: "#9B1C1C", border: "#F5A5A5", label: "ERROR" },
};

// ── Status dropdown options ───────────────────────────────────────────────
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "review_required", label: "Review required" },
  { value: "approved", label: "Approved" },
  { value: "cw_draft_created", label: "CW Draft" },
  { value: "error", label: "Error" },
];

const SHIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All shield statuses" },
  { value: "pass", label: "Pass" },
  { value: "hold", label: "Hold" },
  { value: "fail", label: "Fail" },
];

// ── Relative time ─────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Inline badge component ────────────────────────────────────────────────
interface BadgeProps {
  bg: string;
  color: string;
  border: string;
  label: string;
  dot?: string;
}

function Badge({ bg, color, border, label, dot }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.02em",
        borderRadius: 3,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color,
        lineHeight: "20px",
        whiteSpace: "nowrap" as const,
      }}
    >
      {dot && (
        <span
          style={{
            display: "block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: dot,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

// ── Component ─────────────────────────────────────────────────────────────
export default function ShipmentQueueView() {
  const { statusFilter, shieldFilter, searchQuery, setStatusFilter, setShieldFilter, setSearchQuery, selectShipment, setShipments } = useCargoIQStore();

  // Initialize store shipments
  useEffect(() => {
    setShipments(mockShipments);
  }, [setShipments]);

  const [page, setPage] = useState(1);

  // ── Client-side filtering ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = mockShipments;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.reference && s.reference.toLowerCase().includes(q)) ||
          (s.shipperName && s.shipperName.toLowerCase().includes(q)) ||
          (s.consigneeName && s.consigneeName.toLowerCase().includes(q))
      );
    }

    if (statusFilter) {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (shieldFilter) {
      result = result.filter((s) => s.shieldStatus === shieldFilter);
    }

    return result;
  }, [searchQuery, statusFilter, shieldFilter]);

  // ── Derived safe page (clamps to totalPages when filters reduce results) ──
  // Page resets are handled in each filter change handler.

  // ── Pagination ──────────────────────────────────────────────────────────
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageData = filtered.slice(start, end);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setPage(1);
    },
    [setSearchQuery],
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatusFilter(e.target.value);
      setPage(1);
    },
    [setStatusFilter],
  );

  const handleShieldChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setShieldFilter(e.target.value);
      setPage(1);
    },
    [setShieldFilter],
  );

  const handleRowClick = useCallback(
    (id: string) => selectShipment(id),
    [selectShipment],
  );

  const handlePrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  // ── Empty state ─────────────────────────────────────────────────────────
  const isEmpty = filtered.length === 0;

  return (
    <div className="flex flex-col gap-4" style={{ color: C.textPrimary }}>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 30, fontWeight: 600, color: C.textPrimary, margin: 0, lineHeight: 1.25 }}>
          Shipment Queue
        </h2>
        <p style={{ fontSize: 14, color: C.textTertiary, margin: 0, marginTop: 4 }}>
          {total} total shipments
        </p>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: "12px 16px",
          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
        }}
      >
        {/* Search */}
        <div className="relative flex-1" style={{ minWidth: 240 }}>
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: C.textTertiary }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by reference, shipper, consignee..."
            className="w-full outline-none"
            style={{
              height: 34,
              paddingLeft: 34,
              paddingRight: 12,
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              fontSize: 13,
              color: C.textPrimary,
              backgroundColor: C.canvas,
            }}
            aria-label="Search shipments"
          />
        </div>

        {/* Status dropdown */}
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          style={{
            height: 34,
            paddingLeft: 10,
            paddingRight: 28,
            borderRadius: 4,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            color: statusFilter ? C.textPrimary : C.textTertiary,
            backgroundColor: C.surface,
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7E92' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
          }}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Shield dropdown */}
        <select
          value={shieldFilter}
          onChange={handleShieldChange}
          style={{
            height: 34,
            paddingLeft: 10,
            paddingRight: 28,
            borderRadius: 4,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            color: shieldFilter ? C.textPrimary : C.textTertiary,
            backgroundColor: C.surface,
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7E92' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
          }}
          aria-label="Filter by shield status"
        >
          {SHIELD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {isEmpty ? (
          /* ── Empty state ─────────────────────────────────────────────────── */
          <div
            className="flex flex-col items-center justify-center"
            style={{ padding: "64px 24px" }}
          >
            <Package size={48} style={{ color: C.textTertiary, marginBottom: 16 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, margin: 0 }}>
              No shipments in queue
            </p>
            <p style={{ fontSize: 13, color: C.textTertiary, margin: 0, marginTop: 4, textAlign: "center" }}>
              All shipments have been processed or the inbox is empty.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                lineHeight: 1.5,
                minWidth: 960,
              }}
            >
              {/* ── Table header ──────────────────────────────────────────────── */}
              <thead>
                <tr
                  style={{
                    backgroundColor: C.headerBg,
                  }}
                >
                  {["☐", "REFERENCE", "SHIPPER", "CONSIGNEE", "ROUTE", "DOCS", "CONFIDENCE", "SHIELD", "STATUS", "RECEIVED"].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: "0 12px",
                          height: 36,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          color: C.textTertiary,
                          textAlign: col === "☐" || col === "DOCS" ? "center" : "left",
                          borderBottom: `1px solid ${C.borderSubtle}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              {/* ── Table body ───────────────────────────────────────────────── */}
              <tbody>
                {pageData.map((row: ShipmentSummary) => {
                  const shieldStyle = row.shieldStatus
                    ? SHIELD_BADGE[row.shieldStatus]
                    : SHIELD_BADGE.pending;
                  const confStyle = row.overallConfidence
                    ? CONFIDENCE_BADGE[row.overallConfidence]
                    : CONFIDENCE_BADGE.low;
                  const statusStyle = STATUS_BADGE[row.status];

                  return (
                    <tr
                      key={row.id}
                      onClick={() => handleRowClick(row.id)}
                      className="ciq-queue-row"
                      style={{
                        height: 44,
                        cursor: "pointer",
                        borderBottom: `1px solid ${C.borderSubtle}`,
                        transition: "background-color 100ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = C.rowHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open shipment ${row.reference}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowClick(row.id);
                        }
                      }}
                    >
                      {/* Checkbox (decorative) */}
                      <td
                        style={{
                          padding: "0 12px",
                          textAlign: "center",
                          borderBottom: "none",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            border: `1px solid ${C.border}`,
                            backgroundColor: C.surface,
                          }}
                        />
                      </td>

                      {/* Reference */}
                      <td
                        style={{
                          padding: "0 12px",
                          borderBottom: "none",
                          fontFamily: "var(--font-geist-mono), monospace",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          color: C.accent,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.reference}
                      </td>

                      {/* Shipper */}
                      <td
                        style={{
                          padding: "0 12px",
                          borderBottom: "none",
                          color: C.textPrimary,
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.shipperName}
                      </td>

                      {/* Consignee */}
                      <td
                        style={{
                          padding: "0 12px",
                          borderBottom: "none",
                          color: C.textPrimary,
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.consigneeName}
                      </td>

                      {/* Route */}
                      <td
                        style={{
                          padding: "0 12px",
                          borderBottom: "none",
                          fontFamily: "var(--font-geist-mono), monospace",
                          fontVariantNumeric: "tabular-nums",
                          color: C.textSecondary,
                          whiteSpace: "nowrap",
                          fontSize: 12,
                        }}
                      >
                        {row.originPort}
                        <span style={{ margin: "0 4px", color: C.textTertiary }}>→</span>
                        {row.destinationPort}
                      </td>

                      {/* Docs */}
                      <td
                        style={{
                          padding: "0 12px",
                          borderBottom: "none",
                          textAlign: "center",
                          color: C.textSecondary,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <FileText size={13} style={{ color: C.textTertiary }} />
                          {row.documentCount}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td style={{ padding: "0 12px", borderBottom: "none" }}>
                        <Badge
                          bg={confStyle.bg}
                          color={confStyle.color}
                          border={confStyle.border}
                          dot={confStyle.dot}
                          label={confStyle.label}
                        />
                      </td>

                      {/* Shield */}
                      <td style={{ padding: "0 12px", borderBottom: "none" }}>
                        <Badge
                          bg={shieldStyle.bg}
                          color={shieldStyle.color}
                          border={shieldStyle.border}
                          dot={shieldStyle.dot}
                          label={shieldStyle.label}
                        />
                      </td>

                      {/* Status */}
                      <td style={{ padding: "0 12px", borderBottom: "none" }}>
                        <Badge
                          bg={statusStyle.bg}
                          color={statusStyle.color}
                          border={statusStyle.border}
                          label={statusStyle.label}
                        />
                      </td>

                      {/* Received */}
                      <td
                        style={{
                          padding: "0 12px",
                          borderBottom: "none",
                          color: C.textTertiary,
                          whiteSpace: "nowrap",
                          fontSize: 12,
                        }}
                      >
                        {relativeTime(row.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination footer ────────────────────────────────────────────── */}
        {!isEmpty && (
          <div
            className="flex items-center justify-between"
            style={{
              padding: "10px 16px",
              borderTop: `1px solid ${C.borderSubtle}`,
              backgroundColor: C.surface,
            }}
          >
            <span style={{ fontSize: 13, color: C.textTertiary }}>
              Showing {total === 0 ? 0 : start + 1}–{end} of {total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1"
                style={{
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  backgroundColor: C.surface,
                  fontSize: 13,
                  color: safePage <= 1 ? C.textTertiary : C.textSecondary,
                  cursor: safePage <= 1 ? "not-allowed" : "pointer",
                  opacity: safePage <= 1 ? 0.5 : 1,
                  transition: "background-color 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (safePage > 1) e.currentTarget.style.backgroundColor = C.subtle;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = C.surface;
                }}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1"
                style={{
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  backgroundColor: C.surface,
                  fontSize: 13,
                  color: safePage >= totalPages ? C.textTertiary : C.textSecondary,
                  cursor: safePage >= totalPages ? "not-allowed" : "pointer",
                  opacity: safePage >= totalPages ? 0.5 : 1,
                  transition: "background-color 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (safePage < totalPages) e.currentTarget.style.backgroundColor = C.subtle;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = C.surface;
                }}
                aria-label="Next page"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
