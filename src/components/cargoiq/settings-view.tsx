'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  Database,
  Mail,
  Lock,
  CheckCircle2,
  Plus,
} from 'lucide-react';

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

// ── Card component ────────────────────────────────────────────────────
function SettingsCard({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
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
          gap: 10,
          padding: '14px 20px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          backgroundColor: C.canvas,
        }}
      >
        <Icon size={16} style={{ color: C.accent }} />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.textPrimary,
          }}
        >
          {title}
        </span>
        {badge && <div style={{ marginLeft: 'auto' }}>{badge}</div>}
      </div>

      {/* Body */}
      <div style={{ padding: 20 }}>
        {children}
      </div>
    </div>
  );
}

// ── Pending badge ─────────────────────────────────────────────────────
function PendingBadge({ label }: { label: string }) {
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
        backgroundColor: C.warningBg,
        color: C.warning,
        border: `1px solid ${C.warningBorder}`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: C.warning,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

// ── Styled input ──────────────────────────────────────────────────────
function StyledInput({
  label,
  helperText,
  type = 'text',
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  helperText?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          color: C.textSecondary,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 36,
          width: '100%',
          padding: '0 12px',
          borderRadius: 6,
          border: `1px solid ${C.border}`,
          backgroundColor: '#FFFFFF',
          fontSize: 13,
          color: C.textPrimary,
          outline: 'none',
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            : undefined,
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = C.accent;
          e.currentTarget.style.boxShadow = `0 0 0 3px rgba(184, 134, 11, 0.15)`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {helperText && (
        <div
          style={{
            fontSize: 12,
            color: C.textTertiary,
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
}

// ── Primary button ────────────────────────────────────────────────────
function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        whiteSpace: 'nowrap' as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = C.accentHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = C.accent;
      }}
    >
      {children}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function SettingsView() {
  const [autoApprove, setAutoApprove] = useState('0.90');
  const [reviewRequired, setReviewRequired] = useState('0.75');
  const [serverUrl, setServerUrl] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [serverId, setServerId] = useState('');
  const [cwUsername, setCwUsername] = useState('');
  const [cwPassword, setCwPassword] = useState('');

  const handleSaveThresholds = useCallback(() => {
    // Placeholder
  }, []);

  const handleConnectCargowise = useCallback(() => {
    // Placeholder
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
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
          Settings
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Card 1: Confidence Thresholds ────────────────────────── */}
        <SettingsCard title="Confidence Thresholds" icon={Shield}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <StyledInput
              label="Auto-approve threshold"
              helperText="Shipments with confidence at or above this value will be automatically approved and sent to CargoWise. Range: 0–1."
              value={autoApprove}
              onChange={setAutoApprove}
              placeholder="0.90"
            />
            <StyledInput
              label="Review-required threshold"
              helperText="Shipments below the auto-approve threshold but at or above this value will be flagged for manual review. Range: 0–1."
              value={reviewRequired}
              onChange={setReviewRequired}
              placeholder="0.75"
            />
            <div>
              <PrimaryButton onClick={handleSaveThresholds}>
                Save Thresholds
              </PrimaryButton>
            </div>
          </div>
        </SettingsCard>

        {/* ── Card 2: CargoWise Integration ────────────────────────── */}
        <SettingsCard
          title="CargoWise Integration"
          icon={Database}
          badge={<PendingBadge label="Not connected" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <StyledInput
                label="Server URL"
                value={serverUrl}
                onChange={setServerUrl}
                placeholder="https://cargowise.yourcompany.com"
              />
              <StyledInput
                label="Enterprise ID"
                value={enterpriseId}
                onChange={setEnterpriseId}
                placeholder="Enter enterprise ID"
                mono
              />
              <StyledInput
                label="Server ID"
                value={serverId}
                onChange={setServerId}
                placeholder="Enter server ID"
                mono
              />
              <StyledInput
                label="Username"
                value={cwUsername}
                onChange={setCwUsername}
                placeholder="CargoWise username"
              />
            </div>
            <div style={{ maxWidth: 320 }}>
              <StyledInput
                label="Password"
                type="password"
                helperText="Stored encrypted with AES-256-GCM. Never visible in plaintext."
                value={cwPassword}
                onChange={setCwPassword}
                placeholder="••••••••"
              />
            </div>
            <div>
              <PrimaryButton onClick={handleConnectCargowise}>
                <Lock size={14} strokeWidth={2} />
                Connect CargoWise
              </PrimaryButton>
            </div>
          </div>
        </SettingsCard>

        {/* ── Card 3: Email Connections ─────────────────────────────── */}
        <SettingsCard title="Email Connections" icon={Mail}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Connected email row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 4,
                border: `1px solid ${C.successBorder}`,
                backgroundColor: C.successBg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail size={16} style={{ color: C.success, flexShrink: 0 }} />
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: C.textPrimary,
                    }}
                  >
                    ops@abclogistics.co.za
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textTertiary,
                      marginTop: 1,
                    }}
                  >
                    via IMAP
                  </div>
                </div>
              </div>
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
                  backgroundColor: C.successBg,
                  color: C.success,
                  border: `1px solid ${C.successBorder}`,
                }}
              >
                <CheckCircle2 size={10} style={{ flexShrink: 0 }} />
                Active
              </span>
            </div>

            {/* Add email button */}
            <div style={{ marginTop: 4 }}>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.accent,
                  backgroundColor: 'transparent',
                  border: `1px solid ${C.border}`,
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEF6E7';
                  e.currentTarget.style.borderColor = C.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <Plus size={14} strokeWidth={2} />
                Add Email Connection
              </button>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* ── Responsive overrides ────────────────────────────────────── */}
      <style jsx global>{`
        @media (max-width: 640px) {
          .ciq-settings-cw-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
