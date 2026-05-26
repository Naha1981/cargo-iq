'use client';

import { useMemo } from 'react';
import {
  PackageCheck,
  TrendingDown,
  DollarSign,
  Activity,
} from 'lucide-react';
import { mockTransactionData, mockRlaStatuses } from '@/lib/mock-data';

// ── Color tokens ──────────────────────────────────────────────────────
const C = {
  canvas: '#F1F4F8',
  surface: '#FFFFFF',
  subtle: '#E8ECF1',
  textPrimary: '#0D1B2A',
  textSecondary: '#3D5166',
  textTertiary: '#6B7E92',
  textDisabled: '#9AAAB8',
  border: '#C8D0DA',
  borderSubtle: '#DDE3EA',
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
} as const;

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
  sublabel,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  sublabel?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: 20,
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
            fontSize: 32,
            fontWeight: 600,
            lineHeight: 1.1,
            color: C.textPrimary,
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

// ── RLA Status Badge ──────────────────────────────────────────────────
function RlaBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; border: string; label: string }> = {
    active: { bg: C.successBg, color: C.success, border: C.successBorder, label: 'Active' },
    suspended: { bg: C.errorBg, color: C.error, border: C.errorBorder, label: 'Suspended' },
    inactive: { bg: C.subtle, color: C.textDisabled, border: C.border, label: 'Inactive' },
  };
  const c = config[status] ?? config.inactive;

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
        letterSpacing: '0.03em',
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: c.color,
          flexShrink: 0,
        }}
      />
      {c.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function WiseLayerView() {
  const transactionData = mockTransactionData;
  const rlaStatuses = mockRlaStatuses;

  const maxTotal = useMemo(() => {
    return Math.max(...transactionData.map((d) => d.total));
  }, [transactionData]);

  return (
    <div style={{ padding: 24, maxWidth: 1440, margin: '0 auto' }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: C.textPrimary,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          WiseTech Cost Intelligence
        </h1>
        <p
          style={{
            fontSize: 14,
            color: C.textTertiary,
            marginTop: 6,
          }}
        >
          Value Pack transaction monitoring and optimisation
        </p>
      </div>

      {/* ── KPI Row ────────────────────────────────────────────────── */}
      <div
        className="ciq-wiselayer-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          icon={PackageCheck}
          iconColor={C.info}
          iconBg={C.infoBg}
          value="2,847"
          label="Projected Transactions (MTD)"
        />
        <KpiCard
          icon={TrendingDown}
          iconColor={C.success}
          iconBg={C.successBg}
          value="64%"
          label="Compacted"
          sublabel="1,822 transactions saved"
        />
        <KpiCard
          icon={DollarSign}
          iconColor={C.accent}
          iconBg="#FEF6E7"
          value="R48,320"
          label="Estimated Monthly Saving"
        />
        <KpiCard
          icon={DollarSign}
          iconColor={C.accent}
          iconBg="#FEF6E7"
          value="R284,100"
          label="YTD Saving (Value Pack)"
        />
      </div>

      {/* ── Bottom Row: Chart + RLA Monitor ─────────────────────────── */}
      <div
        className="ciq-wiselayer-bottom-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ── Transaction Breakdown Chart ───────────────────────────── */}
        <div
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
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
              Transaction Breakdown (30 days)
            </span>
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: C.info,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 500 }}>Original</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: C.success,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 500 }}>Saved</span>
              </div>
            </div>
          </div>

          {/* Chart body */}
          <div style={{ padding: '16px 16px 12px' }}>
            {/* Y-axis labels + bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: 180,
                  paddingRight: 8,
                  flexShrink: 0,
                }}
              >
                {[maxTotal, Math.round(maxTotal * 0.75), Math.round(maxTotal * 0.5), Math.round(maxTotal * 0.25), 0].map(
                  (v) => (
                    <span
                      key={v}
                      style={{
                        fontSize: 10,
                        color: C.textTertiary,
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right',
                        minWidth: 28,
                        lineHeight: 1,
                      }}
                    >
                      {v}
                    </span>
                  )
                )}
              </div>

              {/* Bars container */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 2,
                  height: 180,
                  borderBottom: `1px solid ${C.borderSubtle}`,
                  borderLeft: `1px solid ${C.borderSubtle}`,
                  paddingLeft: 4,
                  paddingBottom: 0,
                  overflowX: 'auto',
                }}
                className="ciq-scrollbar"
              >
                {transactionData.map((day) => {
                  const totalHeight = (day.total / maxTotal) * 168;
                  const savedHeight = (day.saved / day.total) * totalHeight;
                  const originalHeight = totalHeight - savedHeight;

                  return (
                    <div
                      key={day.date}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: 16,
                        flex: '1 0 16px',
                      }}
                      title={`${day.date}: ${day.total} total, ${day.saved} saved`}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: '100%',
                          maxWidth: 20,
                        }}
                      >
                        {/* Original (blue) */}
                        <div
                          style={{
                            width: '100%',
                            height: originalHeight,
                            backgroundColor: C.info,
                            borderRadius: '2px 2px 0 0',
                            minWidth: 4,
                          }}
                        />
                        {/* Saved (green) */}
                        <div
                          style={{
                            width: '100%',
                            height: savedHeight,
                            backgroundColor: C.success,
                            borderRadius: originalHeight === 0 ? '2px 2px 0 0' : '0 0 2px 2px',
                            minWidth: 4,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis labels */}
            <div
              style={{
                display: 'flex',
                marginTop: 6,
                paddingLeft: 36,
                gap: 2,
                overflow: 'hidden',
              }}
            >
              {transactionData.filter((_, i) => i % 5 === 0 || i === transactionData.length - 1).map((day) => (
                <span
                  key={day.date}
                  style={{
                    fontSize: 10,
                    color: C.textTertiary,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 16,
                    textAlign: 'center',
                    flex: transactionData.length > 6 ? '1 0 16px' : undefined,
                  }}
                >
                  {day.date.slice(5)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── RLA Status Monitor ────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <Activity size={16} style={{ color: C.accent }} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.textPrimary,
              }}
            >
              RLA Status Monitor
            </span>
          </div>

          {/* Body */}
          <div style={{ padding: 16 }}>
            <div
              style={{
                fontSize: 12,
                color: C.textTertiary,
                marginBottom: 16,
              }}
            >
              Last checked: today 06:00
            </div>

            {/* Importer rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rlaStatuses.map((rla) => (
                <div
                  key={rla.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 4,
                    border: `1px solid ${C.borderSubtle}`,
                    backgroundColor: C.surface,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: C.textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rla.importerName ?? 'Unknown'}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: C.textTertiary,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {rla.importerCode}
                    </span>
                  </div>
                  <RlaBadge status={rla.rlaStatus} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Responsive overrides ────────────────────────────────────── */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .ciq-wiselayer-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .ciq-wiselayer-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .ciq-wiselayer-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
