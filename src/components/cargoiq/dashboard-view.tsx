'use client';

import { useMemo } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Upload,
  ArrowRight,
} from 'lucide-react';
import { useCargoIQStore } from '@/lib/store';
import { mockOverviewStats, mockShipments } from '@/lib/mock-data';
import type { ShieldStatus, ShipmentStatus, ShipmentSummary } from '@/lib/types';

// ── Color tokens ──────────────────────────────────────────────────────
const C = {
  canvas: '#F1F4F8',
  surface: '#FFFFFF',
  subtle: '#E8ECF1',
  textPrimary: '#0D1B2A',
  textSecondary: '#3D5166',
  textTertiary: '#6B7E92',
  border: '#C8D0DA',
  accent: '#B8860B',
  accentHover: '#9A700A',
  success: '#15632A',
  successBg: '#EBF5EE',
  successBorder: '#8EC9A0',
  warning: '#7A4F00',
  warningBg: '#FEF6E7',
  warningBorder: '#E8B84B',
  error: '#9B1C1C',
  errorBg: '#FEF2F2',
  errorBorder: '#F5A5A5',
  info: '#1A4971',
  infoBg: '#EBF3FB',
  infoBorder: '#93C5E4',
  pendingBg: '#E8ECF1',
  pendingText: '#3D5166',
  pendingBorder: '#C8D0DA',
  tableHeaderBg: '#E8ECF1',
  tableRowHover: '#E8ECF1',
} as const;

// ── Badge config ──────────────────────────────────────────────────────
interface BadgeStyle {
  bg: string;
  color: string;
  border: string;
  dotColor: string;
  label: string;
}

const SHIELD_BADGE_MAP: Record<ShieldStatus, BadgeStyle> = {
  pass: {
    bg: C.successBg,
    color: C.success,
    border: C.successBorder,
    dotColor: C.success,
    label: 'PASS',
  },
  hold: {
    bg: C.warningBg,
    color: C.warning,
    border: C.warningBorder,
    dotColor: C.warning,
    label: 'HOLD',
  },
  fail: {
    bg: C.errorBg,
    color: C.error,
    border: C.errorBorder,
    dotColor: C.error,
    label: 'FAIL',
  },
  pending: {
    bg: C.pendingBg,
    color: C.pendingText,
    border: C.pendingBorder,
    dotColor: C.textTertiary,
    label: 'PENDING',
  },
};

const STATUS_BADGE_MAP: Record<ShipmentStatus, BadgeStyle> = {
  pending: {
    bg: C.pendingBg,
    color: C.pendingText,
    border: C.pendingBorder,
    dotColor: C.textTertiary,
    label: 'PENDING',
  },
  review_required: {
    bg: C.warningBg,
    color: C.warning,
    border: C.warningBorder,
    dotColor: C.warning,
    label: 'REVIEW',
  },
  approved: {
    bg: C.successBg,
    color: C.success,
    border: C.successBorder,
    dotColor: C.success,
    label: 'APPROVED',
  },
  rejected: {
    bg: C.errorBg,
    color: C.error,
    border: C.errorBorder,
    dotColor: C.error,
    label: 'REJECTED',
  },
  in_cargowise: {
    bg: C.infoBg,
    color: C.info,
    border: C.infoBorder,
    dotColor: C.info,
    label: 'IN CW',
  },
  cw_draft_created: {
    bg: C.infoBg,
    color: C.info,
    border: C.infoBorder,
    dotColor: C.info,
    label: 'CW DRAFT',
  },
  error: {
    bg: C.errorBg,
    color: C.error,
    border: C.errorBorder,
    dotColor: C.error,
    label: 'ERROR',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────
function formatDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────

/** Shield status badge with dot prefix */
function ShieldBadge({ status }: { status: ShieldStatus | null }) {
  const config = SHIELD_BADGE_MAP[status ?? 'pending'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 20,
        padding: '0 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.02em',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        lineHeight: '20px',
        whiteSpace: 'nowrap' as const,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: config.dotColor,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

/** Status badge without dot prefix */
function StatusBadge({ status }: { status: ShipmentStatus }) {
  const config = STATUS_BADGE_MAP[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.02em',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        lineHeight: '20px',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {config.label}
    </span>
  );
}

/** KPI metric card */
function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
  sublabel,
  highlight,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: C.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={16} strokeWidth={1.75} style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.1,
            color: highlight ? C.error : C.textPrimary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        {sublabel && (
          <div
            style={{
              fontSize: 12,
              color: C.textTertiary,
              marginTop: 4,
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compliance Shield Summary card */
function ComplianceShieldSummary({
  shieldSummary,
}: {
  shieldSummary: Record<string, number>;
}) {
  const items = useMemo(() => {
    const total =
      (shieldSummary.pass ?? 0) +
      (shieldSummary.hold ?? 0) +
      (shieldSummary.fail ?? 0) +
      (shieldSummary.pending ?? 0);
    return [
      {
        key: 'pass',
        label: 'Pass',
        count: shieldSummary.pass ?? 0,
        color: C.success,
        bg: C.successBg,
      },
      {
        key: 'hold',
        label: 'Hold',
        count: shieldSummary.hold ?? 0,
        color: C.warning,
        bg: C.warningBg,
      },
      {
        key: 'fail',
        label: 'Fail',
        count: shieldSummary.fail ?? 0,
        color: C.error,
        bg: C.errorBg,
      },
      {
        key: 'pending',
        label: 'Pending',
        count: shieldSummary.pending ?? 0,
        color: C.textTertiary,
        bg: C.pendingBg,
      },
    ].map((item) => ({
      ...item,
      pct: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }, [shieldSummary]);

  return (
    <div
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: C.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 20,
        }}
      >
        Compliance Shield
      </div>

      {/* Horizontal bar */}
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: C.subtle,
          marginBottom: 16,
        }}
      >
        {items.map((item) => (
          <div
            key={item.key}
            style={{
              width: `${item.pct}%`,
              backgroundColor: item.color,
              minWidth: item.count > 0 ? 2 : 0,
              transition: 'width 300ms ease',
            }}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>

      {/* Breakdown list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: C.textSecondary,
                  fontWeight: 500,
                }}
              >
                {item.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.count}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: C.textTertiary,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {item.pct.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shipments table row */
function ShipmentRow({
  shipment,
  onSelect,
}: {
  shipment: ShipmentSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(shipment.id)}
      style={{
        height: 44,
        cursor: 'pointer',
        backgroundColor: C.surface,
        transition: 'background-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = C.tableRowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = C.surface;
      }}
      role="button"
      tabIndex={0}
      aria-label={`View shipment ${shipment.reference}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(shipment.id);
        }
      }}
    >
      {/* Reference */}
      <td
        style={{
          padding: '0 12px',
          fontSize: 13,
          fontWeight: 600,
          color: C.textPrimary,
          borderBottom: `1px solid ${C.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {shipment.reference ?? '—'}
      </td>

      {/* Shipper */}
      <td
        style={{
          padding: '0 12px',
          fontSize: 13,
          color: C.textSecondary,
          borderBottom: `1px solid ${C.border}`,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 200,
        }}
      >
        {shipment.shipperName ?? '—'}
      </td>

      {/* Route */}
      <td
        style={{
          padding: '0 12px',
          fontSize: 13,
          borderBottom: `1px solid ${C.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: C.textPrimary, fontWeight: 500 }}>
          {shipment.originPort ?? '???'}
        </span>
        <span style={{ color: C.textTertiary, margin: '0 6px' }}>→</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: C.textPrimary, fontWeight: 500 }}>
          {shipment.destinationPort ?? '???'}
        </span>
      </td>

      {/* Shield */}
      <td
        style={{
          padding: '0 12px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <ShieldBadge status={shipment.shieldStatus} />
      </td>

      {/* Status */}
      <td
        style={{
          padding: '0 12px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <StatusBadge status={shipment.status} />
      </td>

      {/* Received */}
      <td
        style={{
          padding: '0 12px',
          fontSize: 13,
          color: C.textTertiary,
          borderBottom: `1px solid ${C.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {getRelativeTime(shipment.createdAt)}
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function DashboardView() {
  const { selectShipment, setView } = useCargoIQStore();
  const stats = mockOverviewStats;
  const shipments = mockShipments;

  const today = formatDate();

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1440,
        margin: '0 auto',
        minHeight: '100%',
      }}
    >
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: C.textPrimary,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Operations Dashboard
          </h1>
          <p
            style={{
              fontSize: 14,
              color: C.textTertiary,
              marginTop: 4,
              margin: 0,
              paddingTop: 4,
            }}
          >
            {today}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            /* Upload document handler placeholder */
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 36,
            padding: '0 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: C.accent,
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = C.accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = C.accent;
          }}
        >
          <Upload size={15} strokeWidth={2} />
          Upload Document
        </button>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      <div
        className="ciq-dashboard-grid-kpi"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          icon={Package}
          iconColor={C.info}
          iconBg={C.infoBg}
          value={stats.queueSize}
          label="Shipments in Queue"
        />
        <KpiCard
          icon={CheckCircle2}
          iconColor={C.success}
          iconBg={C.successBg}
          value={`${Math.round(stats.automationRate * 100)}%`}
          label="Automation Rate"
          sublabel={`${stats.processed} processed`}
        />
        <KpiCard
          icon={AlertTriangle}
          iconColor={C.warning}
          iconBg={C.warningBg}
          value={stats.exceptions}
          label="Exceptions"
          highlight={stats.exceptions > 0}
        />
        <KpiCard
          icon={ShieldCheck}
          iconColor={C.error}
          iconBg={C.errorBg}
          value={stats.shieldSummary.fail ?? 0}
          label="Compliance Flags"
          sublabel={`${stats.shieldSummary.hold ?? 0} on hold`}
        />
      </div>

      {/* ── Second Row: Table + Shield Summary ───────────────────────── */}
      <div
        className="ciq-dashboard-grid-row2"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ── Recent Shipments Table ─────────────────────────────────── */}
        <div
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {/* Table header bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.textPrimary,
              }}
            >
              Recent Shipments
            </span>
            <button
              type="button"
              onClick={() => setView('shipments')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: C.accent,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.75';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              View all
              <ArrowRight size={12} strokeWidth={2} />
            </button>
          </div>

          {/* Table */}
          {shipments.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                gap: 12,
              }}
            >
              <Package size={32} strokeWidth={1.25} style={{ color: C.textTertiary }} />
              <span style={{ fontSize: 14, color: C.textTertiary }}>
                No shipments in queue
              </span>
            </div>
          ) : (
            <div
              style={{
                maxHeight: 480,
                overflowY: 'auto',
              }}
              className="ciq-scrollbar"
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: C.tableHeaderBg,
                    }}
                  >
                    {['Reference', 'Shipper', 'Route', 'Shield', 'Status', 'Received'].map(
                      (col) => (
                        <th
                          key={col}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontWeight: 600,
                            fontSize: 11,
                            color: C.textTertiary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            borderBottom: `2px solid ${C.border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <ShipmentRow
                      key={shipment.id}
                      shipment={shipment}
                      onSelect={selectShipment}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Compliance Shield Summary ──────────────────────────────── */}
        <ComplianceShieldSummary shieldSummary={stats.shieldSummary} />
      </div>

      {/* ── Responsive overrides via media query ──────────────────────── */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .ciq-dashboard-grid-kpi {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .ciq-dashboard-grid-row2 {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .ciq-dashboard-grid-kpi {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
