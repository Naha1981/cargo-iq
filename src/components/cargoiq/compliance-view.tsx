'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { getMockShipmentDetail } from '@/lib/mock-data';
import type { ShieldModule, ShieldStatus } from '@/lib/types';

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

// ── Module display names ──────────────────────────────────────────────
const MODULE_NAMES: Record<string, string> = {
  invoice_pl: 'Invoice / Packing List Cross-Reference',
  hs_code: 'HS Code Validator',
  vat_engine: 'VAT Engine',
};

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

// ── Status badge ──────────────────────────────────────────────────────
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
        gap: 5,
        height: 22,
        padding: '0 10px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: c.color,
          flexShrink: 0,
        }}
      />
      {c.label}
    </span>
  );
}

// ── Module result row ─────────────────────────────────────────────────
function ModuleRow({ module }: { module: ShieldModule }) {
  const isFail = module.result === 'fail';
  const isHold = module.result === 'hold';
  const borderColor = isFail ? C.error : isHold ? C.warning : C.success;
  const bgColor = isFail ? C.errorBg : isHold ? C.warningBg : 'transparent';

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        backgroundColor: bgColor,
        borderRadius: '0 4px 4px 0',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flexShrink: 0 }}>
          <ModuleIcon result={module.result} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span
              style={{
                fontSize: 14,
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
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

// ── Main Component ────────────────────────────────────────────────────
export default function ComplianceView() {
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'complete'>('idle');

  const handleUpload = useCallback(() => {
    setUploadState('uploading');
    setTimeout(() => {
      setUploadState('complete');
    }, 1800);
  }, []);

  const shieldResults = useMemo(() => {
    if (uploadState !== 'complete') return null;
    const detail = getMockShipmentDetail('1');
    return detail.shieldResults;
  }, [uploadState]);

  const passCount = useMemo(() => {
    if (!shieldResults) return 0;
    return shieldResults.modules.filter((m) => m.result === 'pass').length;
  }, [shieldResults]);

  const holdCount = useMemo(() => {
    if (!shieldResults) return 0;
    return shieldResults.modules.filter((m) => m.result === 'hold').length;
  }, [shieldResults]);

  const failCount = useMemo(() => {
    if (!shieldResults) return 0;
    return shieldResults.modules.filter((m) => m.result === 'fail').length;
  }, [shieldResults]);

  const overallColor = useMemo(() => {
    if (!shieldResults) return C.textTertiary;
    if (shieldResults.overall === 'pass') return C.success;
    if (shieldResults.overall === 'hold') return C.warning;
    return C.error;
  }, [shieldResults]);

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
          Pre-Submission Compliance Audit
        </h1>
        <p
          style={{
            fontSize: 14,
            color: C.textTertiary,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          Upload a commercial invoice and packing list to run a full SARS compliance check before submission.
        </p>
      </div>

      {/* ── Upload Zone ────────────────────────────────────────────── */}
      {uploadState === 'idle' && (
        <div
          onClick={handleUpload}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleUpload();
            }
          }}
          style={{
            backgroundColor: C.surface,
            border: `2px dashed ${C.border}`,
            borderRadius: 8,
            padding: '64px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: 'pointer',
            transition: 'border-color 150ms ease, background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.accent;
            e.currentTarget.style.backgroundColor = '#FDF9F0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.backgroundColor = C.surface;
          }}
          aria-label="Upload files for compliance check"
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              backgroundColor: C.subtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <Upload size={24} strokeWidth={1.5} style={{ color: C.accent }} />
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.textPrimary,
            }}
          >
            Drop files here or click to upload
          </span>
          <span
            style={{
              fontSize: 13,
              color: C.textTertiary,
            }}
          >
            Commercial invoice + packing list (PDF, JPG, PNG, DOCX)
          </span>
        </div>
      )}

      {/* ── Uploading state ────────────────────────────────────────── */}
      {uploadState === 'uploading' && (
        <div
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '64px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <Loader2
            size={32}
            strokeWidth={2}
            style={{ color: C.accent, animation: 'spin 1s linear infinite' }}
          />
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.textPrimary,
            }}
          >
            Running compliance audit…
          </span>
          <span
            style={{
              fontSize: 13,
              color: C.textTertiary,
            }}
          >
            Analysing documents against SARS requirements
          </span>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────── */}
      {uploadState === 'complete' && shieldResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Shield Panel */}
          <div
            style={{
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 20px',
                borderBottom: `1px solid ${C.borderSubtle}`,
                backgroundColor: C.canvas,
              }}
            >
              <ShieldCheck size={18} style={{ color: overallColor }} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.textPrimary,
                }}
              >
                Compliance Shield Results
              </span>
              <div style={{ marginLeft: 'auto' }}>
                <StatusBadge status={shieldResults.overall} />
              </div>
            </div>

            {/* Body: Module rows */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shieldResults.modules.map((mod) => (
                <ModuleRow key={mod.module} module={mod} />
              ))}
            </div>
          </div>

          {/* Summary text */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 20px',
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} style={{ color: C.textTertiary }} />
              <span
                style={{
                  fontSize: 14,
                  color: C.textSecondary,
                  fontWeight: 500,
                }}
              >
                {passCount} check{passCount !== 1 ? 's' : ''} passed
                {holdCount > 0 && `, ${holdCount} require${holdCount === 1 ? 's' : ''} review`}
                {failCount > 0 && `, ${failCount} failed`}
              </span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button
                type="button"
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
                <Download size={15} strokeWidth={2} />
                Download Audit Report
              </button>
            </div>
          </div>

          {/* Re-upload link */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setUploadState('idle')}
              style={{
                background: 'none',
                border: 'none',
                color: C.accent,
                fontSize: 13,
                fontWeight: 600,
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
              Upload different documents
            </button>
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
