'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useCargoIQStore } from '@/lib/store';
import { getMockShipmentDetail } from '@/lib/mock-data';
import type { ShipmentDetail, ShieldStatus, Confidence, ShieldModule } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ── Color tokens ──────────────────────────────────────────────────────
const C = {
  canvas: '#F1F4F8',
  surface: '#FFFFFF',
  subtle: '#E8ECF1',
  textPrimary: '#0D1B2A',
  textSecondary: '#3D5166',
  textTertiary: '#6B7E92',
  border: '#C8D0DA',
  borderSubtle: '#DDE3EA',
  accent: '#B8860B',
  success: '#15632A',
  successBg: '#EBF5EE',
  successBorder: '#8EC9A0',
  warning: '#7A4F00',
  warningBg: '#FEF6E7',
  warningBorder: '#E8B84B',
  error: '#9B1C1C',
  errorBg: '#FEF2F2',
  errorBorder: '#F5A5A5',
  disabled: '#9CA3AF',
} as const;

// ── Badge component ───────────────────────────────────────────────────
function StatusBadge({ status }: { status: ShieldStatus | 'pending' }) {
  const config: Record<string, { bg: string; color: string; border: string; label: string }> = {
    pass: { bg: C.successBg, color: C.success, border: C.successBorder, label: 'PASS' },
    hold: { bg: C.warningBg, color: C.warning, border: C.warningBorder, label: 'HOLD' },
    fail: { bg: C.errorBg, color: C.error, border: C.errorBorder, label: 'FAIL' },
    pending: { bg: C.subtle, color: C.textTertiary, border: C.borderSubtle, label: 'PENDING' },
  };
  const c = config[status] ?? config.pending;

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
        letterSpacing: '0.04em',
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {c.label}
    </span>
  );
}

function SmallBadge({
  label,
  variant,
}: {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'neutral';
}) {
  const map = {
    success: { bg: C.successBg, color: C.success, border: C.successBorder },
    warning: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
    error: { bg: C.errorBg, color: C.error, border: C.errorBorder },
    neutral: { bg: C.subtle, color: C.textTertiary, border: C.borderSubtle },
  };
  const c = map[variant];

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
        letterSpacing: '0.04em',
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </span>
  );
}

// ── Document type labels ──────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  bl: 'Bill of Lading',
  awb: 'Air Waybill',
  coo: 'Certificate of Origin',
  insurance: 'Insurance Certificate',
  customs_declaration: 'Customs Declaration',
};

// ── Module display names ──────────────────────────────────────────────
const MODULE_NAMES: Record<string, string> = {
  invoice_pl: 'Invoice/PL Cross-Reference',
  hs_code: 'HS Code Validator',
  vat_engine: 'VAT Engine',
};

// ── Shipment type labels ──────────────────────────────────────────────
const SHIPMENT_TYPE_LABELS: Record<string, string> = {
  fcl_import: 'FCL IMPORT',
  lcl_import: 'LCL IMPORT',
  air_import: 'AIR IMPORT',
  fcl_export: 'FCL EXPORT',
  lcl_export: 'LCL EXPORT',
  air_export: 'AIR EXPORT',
};

// ── Confidence underline style helper ─────────────────────────────────
function confidenceStyle(confidence: Confidence | null | undefined): React.CSSProperties {
  if (confidence === 'medium') {
    return { borderBottom: `2px solid ${C.warning}` };
  }
  if (confidence === 'low') {
    return { borderBottom: `2px solid ${C.error}` };
  }
  return {};
}

// ── Extracted field ───────────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  confidence?: Confidence | null;
  fullWidth?: boolean;
}

function ExtractedField({ label, value, mono, confidence, fullWidth }: FieldProps) {
  const isMissing = !value;
  const lowConf = confidence === 'low';

  return (
    <div className={fullWidth ? 'col-span-2 sm:col-span-3' : ''}>
      <div
        style={{
          fontSize: 12,
          color: C.textTertiary,
          marginBottom: 2,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        className="flex items-center gap-1.5"
        style={{
          fontSize: 13,
          color: isMissing ? C.disabled : C.textPrimary,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : undefined,
          ...(!isMissing ? confidenceStyle(confidence) : {}),
        }}
      >
        {lowConf && !isMissing && (
          <AlertCircle size={13} style={{ color: C.error, flexShrink: 0 }} />
        )}
        {isMissing ? 'Not extracted' : value}
      </div>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────
function DetailCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.textPrimary,
          }}
        >
          {title}
        </span>
        {action}
      </div>
      {/* Body */}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

// ── Module icon helper ────────────────────────────────────────────────
function ModuleIcon({ result }: { result: ShieldStatus }) {
  switch (result) {
    case 'pass':
      return <CheckCircle2 size={18} style={{ color: C.success }} />;
    case 'hold':
      return <AlertTriangle size={18} style={{ color: C.warning }} />;
    case 'fail':
      return <XCircle size={18} style={{ color: C.error }} />;
    default:
      return <Shield size={18} style={{ color: C.textTertiary }} />;
  }
}

// ── Shield module row ─────────────────────────────────────────────────
function ModuleRow({ module }: { module: ShieldModule }) {
  const isFail = module.result === 'fail';
  const isHold = module.result === 'hold';
  const isPass = module.result === 'pass';

  const borderColor = isFail ? C.error : isHold ? C.warning : C.success;
  const bgColor = isFail ? C.errorBg : isHold ? C.warningBg : C.successBg;

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        backgroundColor: isFail ? bgColor : isHold ? bgColor : 'transparent',
        borderRadius: '0 4px 4px 0',
        padding: '10px 12px',
        marginBottom: 8,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <ModuleIcon result={module.result} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.textPrimary,
              }}
            >
              {MODULE_NAMES[module.module] ?? module.module}
            </span>
            <StatusBadge status={module.result} />
          </div>
          {module.resolution && (
            <div
              style={{
                fontSize: 12,
                color: C.textSecondary,
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {module.resolution}
            </div>
          )}
          {module.penaltyRisk && (
            <div
              className="flex items-center gap-1"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.error,
                marginTop: 6,
              }}
            >
              <AlertTriangle size={12} />
              Penalty risk detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Overall status text ───────────────────────────────────────────────
function OverallStatusBanner({ overall }: { overall: ShieldStatus }) {
  if (overall === 'pass') {
    return (
      <div
        className="flex items-center gap-2"
        style={{
          padding: '10px 12px',
          borderRadius: 4,
          backgroundColor: C.successBg,
          border: `1px solid ${C.successBorder}`,
          marginBottom: 12,
        }}
      >
        <ShieldCheck size={18} style={{ color: C.success }} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.success,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Compliant
        </span>
      </div>
    );
  }
  if (overall === 'hold') {
    return (
      <div
        className="flex items-center gap-2"
        style={{
          padding: '10px 12px',
          borderRadius: 4,
          backgroundColor: C.warningBg,
          border: `1px solid ${C.warningBorder}`,
          marginBottom: 12,
        }}
      >
        <AlertTriangle size={18} style={{ color: C.warning }} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.warning,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Review Required
        </span>
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-2"
      style={{
        padding: '10px 12px',
        borderRadius: 4,
        backgroundColor: C.errorBg,
        border: `1px solid ${C.errorBorder}`,
        marginBottom: 12,
      }}
    >
      <XCircle size={18} style={{ color: C.error }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.error,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Penalty Risk Detected
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function ShipmentDetailView() {
  const { selectedShipmentId, setView } = useCargoIQStore();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const detail: ShipmentDetail | null = useMemo(() => {
    if (!selectedShipmentId) return null;
    return getMockShipmentDetail(selectedShipmentId);
  }, [selectedShipmentId]);

  const hasFail = useMemo(() => {
    if (!detail?.shieldResults) return false;
    return detail.shieldResults.modules.some((m) => m.result === 'fail');
  }, [detail]);

  const hasHold = useMemo(() => {
    if (!detail?.shieldResults) return false;
    return detail.shieldResults.modules.some((m) => m.result === 'hold');
  }, [detail]);

  const handleBack = useCallback(() => {
    setView('shipments');
  }, [setView]);

  const handleApprove = useCallback(() => {
    if (hasFail) return;
    if (hasHold) {
      setConfirmDialogOpen(true);
      return;
    }
    // Direct approval for all-pass
  }, [hasFail, hasHold]);

  const handleReject = useCallback(() => {
    setRejectDialogOpen(true);
  }, []);

  // ── Empty state ───────────────────────────────────────────────────
  if (!detail) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: C.canvas, color: C.textTertiary, fontSize: 14 }}
      >
        Select a shipment to view details.
      </div>
    );
  }

  const shieldOverall = detail.shieldResults?.overall ?? 'pending';
  const typeLabel = SHIPMENT_TYPE_LABELS[detail.shipmentType ?? ''] ?? detail.shipmentType?.toUpperCase() ?? 'UNKNOWN';
  const routeLabel = [detail.originPort, detail.destinationPort].filter(Boolean).join(' → ');

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: C.canvas }}
    >
      {/* ═══════════════════════════════════════════════════════════════
          PAGE HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <header
        className="shrink-0"
        style={{
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: '12px 20px',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: back + title */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[#F1F3F6] active:bg-[#E4E8ED] mt-0.5 cursor-pointer"
              style={{ width: 28, height: 28 }}
              aria-label="Back to shipments"
            >
              <ArrowLeft size={16} style={{ color: C.textSecondary }} />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.textPrimary,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {detail.reference ?? 'No Reference'}
                </span>
                <StatusBadge status={detail.shieldStatus ?? 'pending'} />
              </div>
              <div
                className="flex items-center gap-1.5 mt-1"
                style={{ fontSize: 12, color: C.textTertiary, fontWeight: 500, letterSpacing: '0.06em' }}
              >
                <span>{typeLabel}</span>
                {routeLabel && (
                  <>
                    <span style={{ color: C.border }}>·</span>
                    <span>{routeLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              className="cursor-pointer"
              style={{
                borderColor: C.error,
                color: C.error,
                fontSize: 12,
                fontWeight: 600,
                height: 32,
              }}
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={hasFail}
              className="cursor-pointer"
              style={{
                backgroundColor: hasFail ? C.subtle : C.accent,
                color: hasFail ? C.disabled : '#FFFFFF',
                fontSize: 12,
                fontWeight: 600,
                height: 32,
                border: 'none',
              }}
            >
              Approve &amp; Send to CargoWise →
            </Button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          TWO-COLUMN LAYOUT
      ═══════════════════════════════════════════════════════════════ */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: 16 }}
      >
        <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
          {/* ─── LEFT COLUMN (60%) ─────────────────────────────────── */}
          <div className="flex flex-col gap-4" style={{ width: '60%', minWidth: 0 }}>

            {/* Card 1: Extracted Shipment Data */}
            <DetailCard title="Extracted Shipment Data">
              <div
                className="grid gap-x-6 gap-y-3"
                style={{
                  gridTemplateColumns: 'repeat(3, 1fr)',
                }}
              >
                <ExtractedField label="Shipper" value={detail.shipperName} />
                <ExtractedField label="Shipper Address" value={detail.shipperAddress} />
                <ExtractedField label="Consignee" value={detail.consigneeName} />
                <ExtractedField label="Consignee Address" value={detail.consigneeAddress} />
                <ExtractedField label="Origin Port" value={detail.originPort} />
                <ExtractedField label="Destination Port" value={detail.destinationPort} />
                <ExtractedField
                  label="AWB/BL Number"
                  value={detail.awbOrBlNumber}
                  mono
                />
                <ExtractedField
                  label="Cargo Description"
                  value={detail.cargoDescription}
                  fullWidth
                />
                <ExtractedField
                  label="HS Code"
                  value={detail.hsCodePrimary}
                  mono
                />
                <ExtractedField
                  label="Gross Weight"
                  value={detail.grossWeight != null ? `${detail.grossWeight.toLocaleString()} ${detail.weightUnit}` : null}
                />
                <ExtractedField
                  label="Packages"
                  value={detail.numberOfPackages != null ? String(detail.numberOfPackages) : null}
                />
                <ExtractedField
                  label="Invoice Number"
                  value={detail.invoiceNumber}
                  mono
                />
                <ExtractedField
                  label="Invoice Value"
                  value={detail.invoiceValue != null ? `${detail.currency} ${detail.invoiceValue.toLocaleString()}` : null}
                />
                <ExtractedField
                  label="ETA"
                  value={detail.eta}
                />
              </div>
            </DetailCard>

            {/* Card 2: Cargo Line Items */}
            <DetailCard title="Cargo Line Items">
              <div style={{ margin: -16 }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: `1px solid ${C.borderSubtle}`,
                        backgroundColor: C.canvas,
                      }}
                    >
                      {['#', 'HS Code', 'Description', 'Qty', 'Unit Value', 'Total Value'].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: '8px 12px',
                              textAlign: h === '#' || h === 'Qty' ? 'center' : 'left',
                              fontWeight: 600,
                              color: C.textTertiary,
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lineItems.map((item) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: `1px solid ${C.borderSubtle}`,
                        }}
                      >
                        <td
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            color: C.textSecondary,
                          }}
                        >
                          {item.lineNumber}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: 12,
                            color: C.textPrimary,
                            ...confidenceStyle(item.confidence),
                          }}
                        >
                          <span className="flex items-center gap-1">
                            {item.confidence === 'low' && (
                              <AlertCircle size={11} style={{ color: C.error, flexShrink: 0 }} />
                            )}
                            {item.hsCode ?? '—'}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            color: C.textPrimary,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.description ?? '—'}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            color: C.textPrimary,
                          }}
                        >
                          {item.quantity != null ? `${item.quantity.toLocaleString()} ${item.unit ?? ''}` : '—'}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: 12,
                            color: C.textPrimary,
                            textAlign: 'right',
                          }}
                        >
                          {item.unitValue != null ? `${item.currency ?? 'USD'} ${item.unitValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: 12,
                            color: C.textPrimary,
                            textAlign: 'right',
                            fontWeight: 600,
                          }}
                        >
                          {item.totalValue != null ? `${item.currency ?? 'USD'} ${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailCard>

            {/* Card 3: Documents */}
            <DetailCard title={`Documents (${detail.documents.length})`}>
              <div className="flex flex-col gap-2">
                {detail.documents.map((doc) => {
                  const docLabel = DOC_TYPE_LABELS[doc.docType ?? ''] ?? doc.docType ?? 'Unknown';
                  const statusVariant =
                    doc.status === 'processed'
                      ? 'success' as const
                      : doc.status === 'pending'
                        ? 'warning' as const
                        : 'neutral' as const;

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: `1px solid ${C.borderSubtle}`,
                        backgroundColor: C.surface,
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText
                          size={16}
                          className="shrink-0"
                          style={{ color: C.textTertiary }}
                        />
                        <div className="min-w-0">
                          <div
                            style={{
                              fontSize: 13,
                              color: C.textPrimary,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {doc.filename ?? 'Unnamed file'}
                          </div>
                          <div
                            className="flex items-center gap-1.5"
                            style={{
                              fontSize: 11,
                              color: C.textTertiary,
                              marginTop: 1,
                            }}
                          >
                            <span>{docLabel}</span>
                            {doc.pageCount != null && (
                              <>
                                <span>·</span>
                                <span>{doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <SmallBadge
                        label={doc.status}
                        variant={statusVariant}
                      />
                    </div>
                  );
                })}
              </div>
            </DetailCard>
          </div>

          {/* ─── RIGHT COLUMN (40%) ────────────────────────────────── */}
          <div className="flex flex-col gap-4" style={{ width: '40%', minWidth: 0 }}>
            {/* Compliance Shield Panel */}
            <div
              style={{
                backgroundColor: C.surface,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                overflow: 'hidden',
              }}
            >
              {/* Header bar */}
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.borderSubtle}`,
                  backgroundColor: C.canvas,
                }}
              >
                <Shield
                  size={16}
                  style={{
                    color:
                      shieldOverall === 'pass'
                        ? C.success
                        : shieldOverall === 'hold'
                          ? C.warning
                          : C.error,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.textPrimary,
                  }}
                >
                  Compliance Shield
                </span>
                <div className="ml-auto">
                  <StatusBadge status={shieldOverall} />
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: 16 }}>
                {/* Overall status banner */}
                <OverallStatusBanner overall={shieldOverall} />

                {/* Module rows */}
                <div className="flex flex-col gap-0">
                  {detail.shieldResults?.modules.map((mod) => (
                    <ModuleRow key={mod.module} module={mod} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          HOLD CONFIRMATION DIALOG
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Approval with HOLD Flags</DialogTitle>
            <DialogDescription>
              This shipment has compliance modules with HOLD status. Are you sure you want to approve and send to CargoWise? Review the flagged items before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 4,
              backgroundColor: C.warningBg,
              border: `1px solid ${C.warningBorder}`,
              fontSize: 13,
              color: C.warning,
            }}
          >
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertTriangle size={14} />
              Hold flags detected
            </div>
            <ul style={{ paddingLeft: 22, margin: 0, lineHeight: 1.6 }}>
              {detail.shieldResults?.modules
                .filter((m) => m.result === 'hold')
                .map((m) => (
                  <li key={m.module}>
                    {MODULE_NAMES[m.module] ?? m.module}
                    {m.resolution ? `: ${m.resolution}` : ''}
                  </li>
                ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmDialogOpen(false)}
              className="cursor-pointer"
              style={{
                backgroundColor: C.accent,
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              Confirm &amp; Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          REJECT CONFIRMATION DIALOG
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Shipment</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject shipment {detail.reference}? This action will prevent it from being sent to CargoWise and mark it as rejected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              className="cursor-pointer"
              style={{
                backgroundColor: C.error,
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              Reject Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
