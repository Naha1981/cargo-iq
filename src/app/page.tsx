'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  PackageSearch,
  BarChart3,
  Settings,
  Mail,
  MessageCircle,
  Upload,
  ChevronLeft,
  ChevronRight,
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Search,
  Menu,
  X,
  Shield,
  Play,
  DollarSign,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertCircle,
  Eye,
  Ban,
  Send,
  Terminal,
  Activity,
  RefreshCw,
  ChevronDown,
  Edit3,
  Check,
  ExternalLink,
  Package,
  Globe,
} from 'lucide-react';
import {
  mockShipments,
  mockOverviewStats,
  mockRlaStatuses,
  mockXmlCompactorStats,
  mockWebwrightExecutions,
  getMockShipmentDetail,
} from '@/lib/mock-data';
import type {
  ViewMode,
  ShipmentSummary,
  ShipmentDetail,
  Confidence,
  ShieldStatus,
  IngestSource,
  RlaStatus,
  WebwrightExecution,
} from '@/lib/types';

/* ══════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ══════════════════════════════════════════════════════════════════════ */

const COLORS = {
  navy: '#0B1F2A',
  navyLight: '#132D3E',
  navyBorder: '#1E3A4F',
  orange: '#FF7A1A',
  orangeHover: '#E56A10',
  orangeSubtle: '#FFF3E8',
  orangeBorder: '#FFB574',
  canvas: '#F1F4F8',
  surface: '#FFFFFF',
  surfaceSubtle: '#E8ECF1',
  textPrimaryDark: '#E2E8F0',
  textSecondaryDark: '#94A3B8',
  textPrimaryLight: '#0D1B2A',
  textSecondaryLight: '#3D5166',
  textTertiary: '#64748B',
  borderLight: '#C8D0DA',
  borderSubtle: '#DDE3EA',
  success: '#10B981',
  successBg: '#ECFDF5',
  successDark: '#15632A',
  warning: '#FF7A1A',
  warningBg: '#FFF7ED',
  warningDark: '#7A4F00',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  errorDark: '#9B1C1C',
  accent: '#B8860B',
  accentBg: '#FDF3DC',
} as const;

/* ══════════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════════ */

function formatZAR(n: number): string {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatZARShort(n: number): string {
  return 'R' + n.toLocaleString('en-ZA');
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}m ${sec}s`;
}

function confidenceColor(pct: number): string {
  if (pct >= 85) return COLORS.success;
  if (pct >= 65) return '#F59E0B';
  return COLORS.error;
}

function confidenceBgColor(pct: number): string {
  if (pct >= 85) return '#D1FAE5';
  if (pct >= 65) return '#FEF3C7';
  return '#FEE2E2';
}

function confidenceLabel(pct: number): string {
  if (pct >= 85) return 'High';
  if (pct >= 65) return 'Medium';
  return 'Low';
}

function getSourceIcon(source: IngestSource) {
  switch (source) {
    case 'email': return { icon: Mail, label: 'Email' };
    case 'whatsapp': return { icon: MessageCircle, label: 'WhatsApp' };
    case 'upload': return { icon: Upload, label: 'Upload' };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   SIDEBAR
   ══════════════════════════════════════════════════════════════════════ */

function Sidebar({
  view,
  setView,
  collapsed,
  toggleCollapse,
  mobileOpen,
  onMobileClose,
}: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  collapsed: boolean;
  toggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const navItems: { key: ViewMode; icon: typeof LayoutDashboard; label: string }[] = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: 'cargoflow', icon: PackageSearch, label: 'CargoFlow AI' },
    { key: 'wiselayer', icon: BarChart3, label: 'WiseLayer' },
    { key: 'settings', icon: Settings, label: 'Settings' },
  ];

  const sidebarContent = (
    <aside
      className="flex flex-col h-full"
      style={{
        width: collapsed ? 56 : 240,
        backgroundColor: COLORS.navy,
        borderRight: `1px solid ${COLORS.navyBorder}`,
        transition: 'width 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-14 px-4 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.navyBorder}` }}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/cargoiq-logo.jpg"
            alt="CargoIQ Logo"
            className="shrink-0 rounded"
            style={{ width: 28, height: 28, objectFit: 'cover' }}
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight truncate">
                <span style={{ color: COLORS.textPrimaryDark }}>CARGO</span>
                <span style={{ color: COLORS.orange }}>iQ</span>
              </span>
              <span
                className="text-[10px] leading-none"
                style={{ color: COLORS.textSecondaryDark }}
              >
                Compliance Platform
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto py-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${COLORS.navyBorder} transparent` }}
      >
        {!collapsed && (
          <div
            className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: COLORS.textSecondaryDark }}
          >
            Navigation
          </div>
        )}
        {navItems.map((item) => {
          const active = view === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key);
                onMobileClose();
              }}
              className="flex items-center gap-2.5 w-full transition-colors"
              style={{
                padding: collapsed ? '8px 0' : '8px 16px',
                margin: collapsed ? '2px 8px' : '2px 8px',
                borderRadius: 6,
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: collapsed ? 40 : 'calc(100% - 16px)',
                color: active ? COLORS.textPrimaryDark : COLORS.textSecondaryDark,
                backgroundColor: active ? COLORS.navyLight : 'transparent',
                borderLeft: active ? `3px solid ${COLORS.orange}` : '3px solid transparent',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="hidden md:flex items-center justify-center h-10 shrink-0 transition-colors"
        style={{
          borderTop: `1px solid ${COLORS.navyBorder}`,
          color: COLORS.textSecondaryDark,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.navyLight)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed top-0 left-0 bottom-0 z-40">
        {sidebarContent}
      </div>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={onMobileClose}
          />
          <div className="relative z-10 h-full" style={{ width: 240 }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TOP NAV
   ══════════════════════════════════════════════════════════════════════ */

function TopNav({
  view,
  collapsed,
  onToggleMobileSidebar,
}: {
  view: ViewMode;
  collapsed: boolean;
  onToggleMobileSidebar: () => void;
}) {
  const labels: Record<ViewMode, string> = {
    dashboard: 'Dashboard',
    cargoflow: 'CargoFlow AI — Review & Release',
    wiselayer: 'WiseLayer — Cost & Compliance Guard',
    settings: 'Settings',
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center h-14 px-5 gap-3"
      style={{
        left: 0,
        backgroundColor: COLORS.surface,
        borderBottom: `1px solid ${COLORS.borderLight}`,
        transition: 'left 200ms',
      }}
    >
      <button
        className="md:hidden p-1.5 rounded transition-colors"
        style={{ color: COLORS.textTertiary }}
        onClick={onToggleMobileSidebar}
      >
        <Menu size={20} />
      </button>
      <h2 className="text-[15px] font-semibold truncate" style={{ color: COLORS.textPrimaryLight }}>
        {labels[view]}
      </h2>
      <div className="flex-1" />
      <button
        className="p-1.5 rounded transition-colors"
        style={{ color: COLORS.textTertiary }}
        title="Upload Document"
      >
        <Upload size={18} />
      </button>
      <button className="relative p-1.5 rounded transition-colors" style={{ color: COLORS.textTertiary }}>
        <Bell size={18} />
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
          style={{ backgroundColor: COLORS.accent }}
        >
          3
        </span>
      </button>
      <div
        className="hidden sm:flex items-center gap-2 pl-2"
        style={{ borderLeft: `1px solid ${COLORS.borderLight}` }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ backgroundColor: COLORS.accent, color: '#FFF' }}
        >
          JM
        </div>
        <span className="text-[13px] font-medium" style={{ color: COLORS.textPrimaryLight }}>
          J. Mokoena
        </span>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD VIEW
   ══════════════════════════════════════════════════════════════════════ */

function DashboardView() {
  const stats = mockOverviewStats;
  const recentShipments = mockShipments.slice(0, 8);

  const kpis = [
    {
      label: 'Queue Size',
      value: stats.queueSize,
      change: '+12%',
      up: true,
      icon: Package,
      color: COLORS.navyLight,
      bg: '#EBF3FB',
    },
    {
      label: 'Automation Rate',
      value: `${Math.round(stats.automationRate * 100)}%`,
      change: '+3.2%',
      up: true,
      icon: Zap,
      color: COLORS.successDark,
      bg: COLORS.successBg,
    },
    {
      label: 'Avg Processing',
      value: formatSeconds(stats.avgTimeSeconds),
      change: '-18%',
      up: true,
      icon: Clock,
      color: COLORS.warningDark,
      bg: COLORS.warningBg,
    },
    {
      label: 'Shield Exceptions',
      value: stats.exceptions,
      change: '+5',
      up: false,
      icon: AlertTriangle,
      color: COLORS.errorDark,
      bg: COLORS.errorBg,
    },
  ];

  const ss = stats.shieldSummary;
  const shieldTotal = ss.pass + ss.hold + ss.fail + ss.pending;
  const shieldItems = [
    { label: 'Pass', count: ss.pass, color: COLORS.success, pct: shieldTotal > 0 ? Math.round((ss.pass / shieldTotal) * 100) : 0 },
    { label: 'Hold', count: ss.hold, color: '#F59E0B', pct: shieldTotal > 0 ? Math.round((ss.hold / shieldTotal) * 100) : 0 },
    { label: 'Fail', count: ss.fail, color: COLORS.error, pct: shieldTotal > 0 ? Math.round((ss.fail / shieldTotal) * 100) : 0 },
    { label: 'Pending', count: ss.pending, color: '#94A3B8', pct: shieldTotal > 0 ? Math.round((ss.pending / shieldTotal) * 100) : 0 },
  ];

  return (
    <div className="p-6 max-w-[1440px]">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-lg border p-5"
              style={{ backgroundColor: COLORS.surface, borderColor: COLORS.borderLight }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: kpi.bg }}
                >
                  <Icon size={20} style={{ color: kpi.color }} />
                </div>
                <span
                  className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
                    kpi.up ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {kpi.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {kpi.change}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: COLORS.textPrimaryLight }}>
                {kpi.value}
              </div>
              <div
                className="text-[11px] font-medium uppercase tracking-wider mt-1"
                style={{ color: COLORS.textTertiary }}
              >
                {kpi.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Shipments Table */}
        <div className="lg:col-span-2 rounded-lg border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.borderLight }}>
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: COLORS.borderSubtle }}
          >
            <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textSecondaryLight }}>
              Recent Shipments
            </span>
            <span className="text-[12px] font-medium" style={{ color: COLORS.accent }}>View all →</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ backgroundColor: COLORS.canvas }}>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>Reference</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>Shipper</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>Route</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>Confidence</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentShipments.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b transition-colors cursor-pointer"
                    style={{ borderColor: COLORS.borderSubtle }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.canvas)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="px-4 py-2.5 font-mono text-[12px] font-medium" style={{ color: COLORS.orange }}>
                      {s.reference}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px] truncate" style={{ color: COLORS.textPrimaryLight }}>
                      {s.shipperName || '—'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.textSecondaryLight }}>
                      {s.originPort || '—'} → {s.destinationPort || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: confidenceColor(s.confidencePercent) }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidenceColor(s.confidencePercent) }} />
                        {s.confidencePercent}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: s.status === 'review_required' ? COLORS.warningBg : s.status === 'approved' || s.status === 'cw_draft_created' ? COLORS.successBg : s.status === 'rejected' || s.status === 'error' ? COLORS.errorBg : COLORS.surfaceSubtle,
                          color: s.status === 'review_required' ? COLORS.warningDark : s.status === 'approved' || s.status === 'cw_draft_created' ? COLORS.successDark : s.status === 'rejected' || s.status === 'error' ? COLORS.errorDark : COLORS.textTertiary,
                        }}
                      >
                        {s.status === 'review_required' ? 'Review' : s.status === 'cw_draft_created' ? 'CW Draft' : s.status === 'in_cargowise' ? 'In CW' : s.status.charAt(0).toUpperCase() + s.status.slice(1).replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance Shield Summary */}
        <div className="rounded-lg border" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.borderLight }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: COLORS.borderSubtle }}>
            <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textSecondaryLight }}>
              Compliance Shield
            </span>
          </div>
          <div className="p-4 space-y-4">
            {shieldItems.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-medium" style={{ color: COLORS.textSecondaryLight }}>
                    {item.label}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: COLORS.textPrimaryLight }}>
                    {item.count}{' '}
                    <span className="text-[11px] font-normal" style={{ color: COLORS.textTertiary }}>
                      ({item.pct}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: COLORS.surfaceSubtle }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          {ss.hold > 0 && (
            <div className="px-4 pb-4">
              <div
                className="rounded-md p-3 text-[12px]"
                style={{
                  backgroundColor: COLORS.warningBg,
                  border: `1px solid ${COLORS.orangeBorder}`,
                  color: COLORS.warningDark,
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <AlertTriangle size={13} />
                  {ss.hold} shipments on HOLD
                </div>
                <div style={{ opacity: 0.85 }}>Requires manual review before CargoWise submission</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CARGOFLOW AI VIEW — Split-Screen Review & Release Workspace
   ══════════════════════════════════════════════════════════════════════ */

function ConfidenceBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: COLORS.surfaceSubtle }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${percent}%`, backgroundColor: confidenceColor(percent) }}
        />
      </div>
      <span
        className="text-[11px] font-semibold tabular-nums"
        style={{ color: confidenceColor(percent) }}
      >
        {percent}%
      </span>
    </div>
  );
}

function QuarantineQueue({
  shipments,
  selectedId,
  onSelect,
}: {
  shipments: ShipmentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{ width: 280, backgroundColor: COLORS.surface, borderRight: `1px solid ${COLORS.borderLight}` }}
    >
      <div
        className="px-4 py-3 border-b shrink-0 flex items-center justify-between"
        style={{ borderColor: COLORS.borderSubtle }}
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>
          Quarantine Queue
        </span>
        <span
          className="text-[11px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: COLORS.orangeSubtle, color: COLORS.orange }}
        >
          {shipments.length}
        </span>
      </div>
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${COLORS.borderLight} transparent` }}
      >
        {shipments.map((s) => {
          const isActive = selectedId === s.id;
          const src = getSourceIcon(s.source);
          const SrcIcon = src.icon;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full text-left px-4 py-3 border-b transition-colors"
              style={{
                borderColor: COLORS.borderSubtle,
                backgroundColor: isActive ? COLORS.orangeSubtle : 'transparent',
                borderLeft: isActive ? `3px solid ${COLORS.orange}` : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = COLORS.canvas;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[12px] font-semibold" style={{ color: COLORS.orange }}>
                  {s.reference}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <SrcIcon size={12} style={{ color: COLORS.textTertiary }} />
                <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>
                  {src.label}
                </span>
                <span className="text-[11px] ml-auto" style={{ color: COLORS.textTertiary }}>
                  {relativeTime(s.createdAt)}
                </span>
              </div>
              <ConfidenceBar percent={s.confidencePercent} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DocumentViewer({ shipment }: { shipment: ShipmentDetail | null }) {
  const [activeTab, setActiveTab] = useState<'invoice' | 'packing' | 'bl'>('invoice');

  if (!shipment) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: COLORS.navy }}
      >
        <div className="text-center">
          <FileText size={40} style={{ color: COLORS.textSecondaryDark }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: COLORS.textSecondaryDark }}>
            Select a shipment to view documents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: COLORS.navy }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.navyBorder}` }}
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textSecondaryDark }}>
          Document Viewer
        </span>
        <div className="flex gap-1">
          {(['invoice', 'packing', 'bl'] as const).map((tab) => {
            const labels = { invoice: 'Invoice', packing: 'Packing List', bl: 'BL/AWB' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === tab ? COLORS.orange : 'transparent',
                  color: activeTab === tab ? '#FFF' : COLORS.textSecondaryDark,
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mock Document Area */}
      <div className="flex-1 p-4 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
        <div
          className="mx-auto rounded-lg p-6 max-w-lg"
          style={{ backgroundColor: '#0F2433', border: `1px solid ${COLORS.navyBorder}` }}
        >
          {/* SAD 500 Form Representation */}
          <div className="text-center mb-6">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: COLORS.orange }}>
              South African Revenue Service
            </div>
            <div className="text-[16px] font-bold" style={{ color: COLORS.textPrimaryDark }}>
              SAD 500 — Customs Declaration
            </div>
            <div className="text-[11px] mt-1" style={{ color: COLORS.textSecondaryDark }}>
              Reference: {shipment.reference}
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            {[
              { label: 'Decl Type', value: 'IM' },
              { label: 'Office', value: shipment.destinationPort || 'ZADUR' },
              { label: 'Declarant', value: shipment.consigneeName || '—' },
              { label: 'Importer', value: shipment.consigneeName || '—' },
              { label: 'Export Country', value: shipment.originPort?.substring(0, 2) || 'CN' },
              { label: 'Transport', value: shipment.vesselOrFlight || '—' },
              { label: 'Gross Mass', value: shipment.grossWeight ? `${shipment.grossWeight} ${shipment.weightUnit}` : '—' },
              { label: 'Packages', value: shipment.numberOfPackages ? String(shipment.numberOfPackages) : '—' },
              { label: 'HS Code', value: shipment.hsCodePrimary || '—' },
              { label: 'Currency', value: shipment.currency || 'USD' },
              { label: 'Customs Value', value: shipment.invoiceValue ? `$${shipment.invoiceValue.toLocaleString()}` : '—' },
              { label: 'Incoterms', value: shipment.incoterms || '—' },
            ].map((field) => (
              <div
                key={field.label}
                className="p-2 rounded"
                style={{ backgroundColor: '#0A1A26', border: `1px solid ${COLORS.navyBorder}` }}
              >
                <div style={{ color: COLORS.textSecondaryDark }} className="mb-0.5 text-[9px] uppercase tracking-wider">
                  {field.label}
                </div>
                <div style={{ color: COLORS.textPrimaryDark }} className="font-mono font-medium">
                  {field.value}
                </div>
              </div>
            ))}
          </div>

          {/* Line Items Preview */}
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: COLORS.textSecondaryDark }}>
              Cargo Line Items
            </div>
            {shipment.lineItems.slice(0, 3).map((li) => (
              <div
                key={li.id}
                className="flex items-center justify-between py-1.5 border-b text-[11px]"
                style={{ borderColor: COLORS.navyBorder }}
              >
                <span style={{ color: COLORS.textPrimaryDark }} className="font-mono">
                  {li.hsCode || '—'}
                </span>
                <span style={{ color: COLORS.textSecondaryDark }} className="truncate mx-2 flex-1">
                  {li.description}
                </span>
                <span style={{ color: COLORS.orange }} className="font-mono">
                  {li.totalValue ? `$${li.totalValue.toLocaleString()}` : '—'}
                </span>
              </div>
            ))}
            {shipment.lineItems.length > 3 && (
              <div className="text-[10px] mt-1" style={{ color: COLORS.textSecondaryDark }}>
                +{shipment.lineItems.length - 3} more items
              </div>
            )}
          </div>

          {/* Watermark */}
          <div className="mt-6 text-center">
            <span
              className="text-[9px] uppercase tracking-widest"
              style={{ color: COLORS.navyBorder }}
            >
              AI-EXTRACTED DRAFT — FOR REVIEW ONLY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIEditableFormField({
  label,
  value,
  fieldKey,
  confidence,
  isEditing,
  onEditStart,
  onEditSave,
  onEditCancel,
  editValue,
  onEditValueChange,
  mono = false,
}: {
  label: string;
  value: string | number | null;
  fieldKey: string;
  confidence: Confidence;
  isEditing: boolean;
  onEditStart: (field: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  editValue: string;
  onEditValueChange: (v: string) => void;
  mono?: boolean;
}) {
  const borderColor =
    confidence === 'high'
      ? COLORS.success
      : confidence === 'medium'
        ? '#F59E0B'
        : COLORS.orange;

  const showWarning = confidence === 'low';
  const displayValue = value != null ? String(value) : '—';

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>
          {label}
        </label>
        {confidence === 'medium' && (
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
        )}
        {showWarning && <AlertCircle size={12} style={{ color: COLORS.orange }} />}
      </div>
      {isEditing ? (
        <div className="flex gap-1.5">
          <input
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave();
              if (e.key === 'Escape') onEditCancel();
            }}
            autoFocus
            className="flex-1 px-2 py-1.5 text-[13px] rounded border outline-none"
            style={{
              borderColor: COLORS.orange,
              backgroundColor: COLORS.orangeSubtle,
              color: COLORS.textPrimaryLight,
              fontFamily: mono ? 'var(--font-geist-mono), monospace' : 'inherit',
            }}
          />
          <button
            onClick={onEditSave}
            className="p-1.5 rounded"
            style={{ backgroundColor: COLORS.success, color: '#FFF' }}
          >
            <Check size={14} />
          </button>
          <button
            onClick={onEditCancel}
            className="p-1.5 rounded"
            style={{ backgroundColor: COLORS.surfaceSubtle, color: COLORS.textTertiary }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="px-2.5 py-1.5 text-[13px] rounded cursor-pointer transition-colors"
          style={{
            borderBottom: `2px solid ${borderColor}`,
            backgroundColor: showWarning ? COLORS.orangeSubtle : 'transparent',
            color: COLORS.textPrimaryLight,
            fontFamily: mono ? 'var(--font-geist-mono), monospace' : 'inherit',
          }}
          onClick={() => onEditStart(fieldKey)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = showWarning ? COLORS.orangeSubtle : COLORS.canvas;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = showWarning ? COLORS.orangeSubtle : 'transparent';
          }}
        >
          {displayValue}
        </div>
      )}
    </div>
  );
}

function AIDraftForm({
  shipment,
}: {
  shipment: ShipmentDetail | null;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [formValues, setFormValues] = useState<Record<string, string | number | null>>(() => {
    if (!shipment) return {};
    return {
      shipperName: shipment.shipperName,
      consigneeName: shipment.consigneeName,
      shipperAddress: shipment.shipperAddress,
      consigneeAddress: shipment.consigneeAddress,
      grossWeight: shipment.grossWeight,
      invoiceValue: shipment.invoiceValue,
      currency: shipment.currency,
      hsCodePrimary: shipment.hsCodePrimary,
      incoterms: shipment.incoterms,
      numberOfPackages: shipment.numberOfPackages,
      vesselOrFlight: shipment.vesselOrFlight,
      eta: shipment.eta,
      etd: shipment.etd,
    };
  });

  const handleEditStart = useCallback((field: string) => {
    if (shipment) {
      const currentVal = formValues[field];
      setEditValue(currentVal != null ? String(currentVal) : '');
      setEditingField(field);
    }
  }, [shipment, formValues]);

  const handleEditSave = useCallback(() => {
    if (editingField) {
      setFormValues((prev) => ({ ...prev, [editingField]: editValue }));
    }
    setEditingField(null);
  }, [editingField, editValue]);

  const handleEditCancel = useCallback(() => {
    setEditingField(null);
  }, []);

  if (!shipment) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: COLORS.surface }}>
        <div className="text-center">
          <Edit3 size={40} style={{ color: COLORS.textTertiary }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: COLORS.textTertiary }}>
            Select a shipment to edit AI draft
          </p>
        </div>
      </div>
    );
  }

  const fc = shipment.fieldConfidence;

  const fields = [
    { label: 'Shipper', key: 'shipperName', confidence: fc.shipperName || 'high', mono: false },
    { label: 'Consignee', key: 'consigneeName', confidence: fc.consigneeName || 'high', mono: false },
    { label: 'Shipper Address', key: 'shipperAddress', confidence: 'high' as Confidence, mono: false },
    { label: 'Consignee Address', key: 'consigneeAddress', confidence: 'high' as Confidence, mono: false },
    { label: 'Gross Weight', key: 'grossWeight', confidence: fc.grossWeight || 'high', mono: true },
    { label: 'Customs Value', key: 'invoiceValue', confidence: fc.invoiceValue || 'high', mono: true },
    { label: 'Currency', key: 'currency', confidence: 'high' as Confidence, mono: true },
    { label: 'HS Code', key: 'hsCodePrimary', confidence: fc.hsCodePrimary || 'high', mono: true },
    { label: 'Incoterms', key: 'incoterms', confidence: 'high' as Confidence, mono: true },
    { label: 'Packages', key: 'numberOfPackages', confidence: 'high' as Confidence, mono: true },
    { label: 'Vessel/Flight', key: 'vesselOrFlight', confidence: 'high' as Confidence, mono: false },
    { label: 'ETA', key: 'eta', confidence: 'high' as Confidence, mono: true },
    { label: 'ETD', key: 'etd', confidence: 'high' as Confidence, mono: true },
  ];

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: COLORS.surface }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textTertiary }}>
          AI Draft — Editable Form
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: COLORS.textTertiary }}>
          <Edit3 size={12} />
          Click any field to edit
        </span>
      </div>

      {/* Form Content */}
      <div
        className="flex-1 p-4 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${COLORS.borderLight} transparent` }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {fields.map((f) => (
            <AIEditableFormField
              key={f.key}
              label={f.label}
              value={formValues[f.key]}
              fieldKey={f.key}
              confidence={f.confidence}
              isEditing={editingField === f.key}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
              editValue={editValue}
              onEditValueChange={setEditValue}
              mono={f.mono}
            />
          ))}
        </div>

        {/* Line Items */}
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: COLORS.textTertiary }}>
            Cargo Line Items
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: COLORS.borderLight }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: COLORS.canvas }}>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: COLORS.textTertiary }}>#</th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: COLORS.textTertiary }}>HS Code</th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: COLORS.textTertiary }}>Description</th>
                  <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: COLORS.textTertiary }}>Qty</th>
                  <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: COLORS.textTertiary }}>Value</th>
                  <th className="text-center px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: COLORS.textTertiary }}>Conf</th>
                </tr>
              </thead>
              <tbody>
                {shipment.lineItems.map((li) => (
                  <tr key={li.id} className="border-t" style={{ borderColor: COLORS.borderSubtle }}>
                    <td className="px-3 py-1.5 font-mono" style={{ color: COLORS.textTertiary }}>{li.lineNumber}</td>
                    <td className="px-3 py-1.5 font-mono" style={{ color: COLORS.textPrimaryLight }}>{li.hsCode || '—'}</td>
                    <td className="px-3 py-1.5 truncate max-w-[160px]" style={{ color: COLORS.textSecondaryLight }}>{li.description}</td>
                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: COLORS.textPrimaryLight }}>{li.quantity}</td>
                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: COLORS.orange }}>
                      {li.totalValue ? `$${li.totalValue.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: confidenceColor(li.confidence === 'high' ? 90 : li.confidence === 'medium' ? 75 : 55) }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SARSPenaltyShieldBanner({ shipment }: { shipment: ShipmentDetail | null }) {
  if (!shipment || !shipment.shieldResults) return null;

  const warnings: string[] = [];
  shipment.shieldResults.modules.forEach((m) => {
    if (m.result === 'hold' || m.result === 'fail') {
      if (m.module === 'invoice_pl') warnings.push('Invoice & PL Mismatch');
      if (m.module === 'hs_code') warnings.push('HS Code Missing/Invalid');
      if (m.module === 'vat_engine') warnings.push('VAT Calculation Required');
    }
  });

  if (warnings.length === 0 && shipment.shieldResults.overall === 'pass') {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ backgroundColor: '#ECFDF5', borderTop: `1px solid ${COLORS.success}` }}
      >
        <CheckCircle2 size={16} style={{ color: COLORS.success }} />
        <span className="text-[12px] font-semibold" style={{ color: COLORS.successDark }}>
          SARS Penalty Shield — All checks passed
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 shrink-0 overflow-x-auto"
      style={{ backgroundColor: COLORS.orange, scrollbarWidth: 'thin' }}
    >
      <Shield size={16} style={{ color: '#FFF' }} />
      <span className="text-[12px] font-bold text-white whitespace-nowrap">SARS Penalty Shield:</span>
      {warnings.map((w, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFF' }}
        >
          <AlertTriangle size={11} />
          {w}
        </span>
      ))}
      {shipment.shieldResults.penaltyRiskDetected && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap"
          style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: '#FFF' }}
        >
          <XCircle size={11} />
          Penalty Risk Detected
        </span>
      )}
    </div>
  );
}

function CargoFlowView() {
  const quarantinedShipments = useMemo(
    () => mockShipments.filter((s) => s.status === 'review_required' || s.status === 'pending'),
    []
  );

  const [selectedId, setSelectedId] = useState<string | null>(() =>
    quarantinedShipments.length > 0 ? quarantinedShipments[0].id : null
  );
  const [detail, setDetail] = useState<ShipmentDetail | null>(() =>
    quarantinedShipments.length > 0 ? getMockShipmentDetail(quarantinedShipments[0].id) : null
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDetail(getMockShipmentDetail(id));
  }, []);

  return (
    <div className="flex h-full">
      {/* Quarantine Queue */}
      <QuarantineQueue
        shipments={quarantinedShipments}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Active Ingestion Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{
            backgroundColor: COLORS.surface,
            borderBottom: `1px solid ${COLORS.borderLight}`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: COLORS.textPrimaryLight }}>
              Active Ingestion Queue
            </span>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: COLORS.orangeSubtle, color: COLORS.orange }}
            >
              {quarantinedShipments.length} items
            </span>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors"
            style={{ backgroundColor: COLORS.orange, color: '#FFF' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
          >
            <Upload size={14} />
            Upload Document
          </button>
        </div>

        {/* Split-Screen Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Document Viewer */}
          <div className="flex-1 flex min-w-0">
            <DocumentViewer shipment={detail} />
          </div>

          {/* Right: AI Draft Form */}
          <div
            className="flex-1 flex min-w-0"
            style={{ borderLeft: `1px solid ${COLORS.borderLight}` }}
          >
            <AIDraftForm shipment={detail} key={detail?.id ?? 'none'} />
          </div>
        </div>

        {/* SARS Penalty Shield Banner */}
        <SARSPenaltyShieldBanner shipment={detail} />

        {/* Action Buttons */}
        <div
          className="flex items-center justify-end gap-3 px-4 py-3 shrink-0"
          style={{
            backgroundColor: COLORS.surface,
            borderTop: `1px solid ${COLORS.borderLight}`,
          }}
        >
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold border transition-colors"
            style={{ borderColor: COLORS.error, color: COLORS.error, backgroundColor: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.errorBg)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Ban size={15} />
            Reject File
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: COLORS.orange, color: '#FFF' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
          >
            <ExternalLink size={15} />
            Release to CargoWise
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WISELAYER VIEW — Cost Guard & Agent Control
   ══════════════════════════════════════════════════════════════════════ */

function XMLPayloadCompactor() {
  const stats = mockXmlCompactorStats;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.borderLight }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: COLORS.navy, borderBottom: `1px solid ${COLORS.navyBorder}` }}
      >
        <TrendingDown size={16} style={{ color: COLORS.orange }} />
        <span className="text-[13px] font-semibold" style={{ color: COLORS.textPrimaryDark }}>
          XML Payload Compactor
        </span>
      </div>

      {/* KPI Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div
            className="rounded-lg p-4 text-center"
            style={{ backgroundColor: COLORS.canvas, border: `1px solid ${COLORS.borderSubtle}` }}
          >
            <div className="text-2xl font-bold font-mono" style={{ color: COLORS.textPrimaryLight }}>
              {stats.projectedTxCount.toLocaleString()}
            </div>
            <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: COLORS.textTertiary }}>
              Projected Tx Count
            </div>
          </div>
          <div
            className="rounded-lg p-4 text-center"
            style={{ backgroundColor: COLORS.canvas, border: `1px solid ${COLORS.borderSubtle}` }}
          >
            <div className="text-2xl font-bold font-mono" style={{ color: COLORS.success }}>
              {stats.compactedSavingsPercent}%
            </div>
            <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: COLORS.textTertiary }}>
              Compacted Savings
            </div>
          </div>
        </div>

        {/* Monthly Savings */}
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: COLORS.orangeSubtle, border: `1px solid ${COLORS.orangeBorder}` }}
        >
          <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: COLORS.warningDark }}>
            Calculated Monthly Savings
          </div>
          <div className="text-3xl font-bold" style={{ color: COLORS.orange }}>
            {formatZAR(stats.monthlySavingsZAR)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>
              YTD Savings:
            </span>
            <span className="text-[14px] font-bold" style={{ color: COLORS.accent }}>
              {formatZARShort(stats.ytdSavingsZAR)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RLASentinel() {
  const statuses = mockRlaStatuses;

  const statusIcon = (status: RlaStatus['rlaStatus']) => {
    switch (status) {
      case 'active':
        return <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.success }} />;
      case 'suspended':
        return <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.error }} />;
      case 'inactive':
        return <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#94A3B8' }} />;
    }
  };

  const statusLabel = (status: RlaStatus['rlaStatus']) => {
    const map: Record<RlaStatus['rlaStatus'], { bg: string; color: string; label: string }> = {
      active: { bg: COLORS.successBg, color: COLORS.successDark, label: 'ACTIVE' },
      suspended: { bg: COLORS.errorBg, color: COLORS.errorDark, label: 'SUSPENDED' },
      inactive: { bg: COLORS.surfaceSubtle, color: COLORS.textTertiary, label: 'INACTIVE' },
    };
    const s = map[status];
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
        style={{ backgroundColor: s.bg, color: s.color }}
      >
        {statusIcon(status)}
        {s.label}
      </span>
    );
  };

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.borderLight }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: COLORS.navy, borderBottom: `1px solid ${COLORS.navyBorder}` }}
      >
        <div className="flex items-center gap-2">
          <Shield size={16} style={{ color: COLORS.orange }} />
          <span className="text-[13px] font-semibold" style={{ color: COLORS.textPrimaryDark }}>
            RLA Status Sentinel
          </span>
        </div>
        <span className="text-[11px]" style={{ color: COLORS.textSecondaryDark }}>
          {statuses.filter((s) => s.rlaStatus === 'active').length} Active Accounts
        </span>
      </div>

      {/* Importer List */}
      <div
        className="max-h-64 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${COLORS.borderLight} transparent` }}
      >
        {statuses.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-2.5 border-b transition-colors"
            style={{ borderColor: COLORS.borderSubtle }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.canvas)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div className="flex items-center gap-2.5">
              {statusIcon(r.rlaStatus)}
              <div>
                <div className="text-[13px] font-medium" style={{ color: COLORS.textPrimaryLight }}>
                  {r.importerName}
                </div>
                <div className="text-[10px] font-mono" style={{ color: COLORS.textTertiary }}>
                  {r.importerCode}
                </div>
              </div>
            </div>
            {statusLabel(r.rlaStatus)}
          </div>
        ))}
      </div>

      {/* Audit Button */}
      <div className="px-4 py-3">
        <button
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-semibold border transition-colors"
          style={{ borderColor: COLORS.orange, color: COLORS.orange, backgroundColor: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeSubtle)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <RefreshCw size={14} />
          Run eFiling Audit Now
        </button>
      </div>
    </div>
  );
}

function WebwrightTerminal() {
  const [prompt, setPrompt] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const prevExecutions = mockWebwrightExecutions;

  const handleExecute = useCallback(() => {
    if (!prompt.trim() || isRunning) return;
    setIsRunning(true);
    setOutputLines([]);

    const lines = [
      '[system] Spawning isolated Webwright sandbox...',
      `[webwright] Launching Chromium headless...`,
      `[webwright] Navigating to ${targetUrl || 'https://transnet.portauthority.co.za'}...`,
      `[webwright] Entering credentials...`,
      `[webwright] Executing prompt: "${prompt}"`,
    ];

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < lines.length) {
        setOutputLines((prev) => [...prev, lines[idx]]);
        idx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setOutputLines((prev) => [
            ...prev,
            '[webwright] Status: SUCCESS',
            `[stdout] Task completed. Container MSCU${Math.floor(1000000 + Math.random() * 9000000)} is located in STACK_${String.fromCharCode(65 + Math.floor(Math.random() * 5))}, Row ${Math.floor(Math.random() * 10) + 1}.`,
          ]);
          setIsRunning(false);
        }, 600);
      }
    }, 500);
  }, [prompt, targetUrl, isRunning]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [outputLines]);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#333' }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #333' }}
      >
        <Terminal size={16} style={{ color: COLORS.orange }} />
        <span className="text-[13px] font-semibold" style={{ color: COLORS.orange }}>
          Webwright Autonomous Agent Terminal
        </span>
      </div>

      {/* Input Area */}
      <div className="p-4" style={{ backgroundColor: '#0D0D0D' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#666' }}>
              Prompt
            </label>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Log into Durban Port, check container MSCU1234567..."
              className="w-full px-3 py-2 text-[13px] rounded border outline-none"
              style={{
                backgroundColor: '#1A1A1A',
                borderColor: '#333',
                color: COLORS.orange,
                fontFamily: 'var(--font-geist-mono), monospace',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#666' }}>
              Target URL
            </label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://transnet.portauthority.co.za"
              className="w-full px-3 py-2 text-[13px] rounded border outline-none"
              style={{
                backgroundColor: '#1A1A1A',
                borderColor: '#333',
                color: COLORS.orange,
                fontFamily: 'var(--font-geist-mono), monospace',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            />
          </div>
        </div>
        <button
          onClick={handleExecute}
          disabled={isRunning || !prompt.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-semibold transition-colors"
          style={{
            backgroundColor: isRunning ? '#333' : COLORS.orange,
            color: isRunning ? '#666' : '#FFF',
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {isRunning ? <Loader2Animated size={14} /> : <Play size={14} />}
          {isRunning ? 'Executing...' : 'Execute Webwright Task'}
        </button>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="max-h-64 overflow-y-auto p-4"
        style={{
          backgroundColor: '#000',
          borderTop: '1px solid #333',
          scrollbarWidth: 'thin',
          scrollbarColor: '#333 transparent',
        }}
      >
        {/* Previous execution output */}
        {prevExecutions.map((exec) => (
          <div key={exec.id} className="mb-4">
            {exec.output.map((line, i) => (
              <div
                key={i}
                className="text-[12px] font-mono leading-relaxed"
                style={{ color: line.includes('[system]') ? '#666' : line.includes('SUCCESS') ? COLORS.success : COLORS.orange }}
              >
                {line}
              </div>
            ))}
          </div>
        ))}

        {/* Live execution output */}
        {outputLines.length > 0 && (
          <div className="mb-2">
            {outputLines.map((line, i) => (
              <div
                key={i}
                className="text-[12px] font-mono leading-relaxed"
                style={{ color: line.includes('[system]') ? '#666' : line.includes('SUCCESS') ? COLORS.success : COLORS.orange }}
              >
                {line}
              </div>
            ))}
            {isRunning && (
              <span className="inline-block w-2 h-4 animate-pulse" style={{ backgroundColor: COLORS.orange }} />
            )}
          </div>
        )}

        {!isRunning && outputLines.length === 0 && prevExecutions.length === 0 && (
          <div className="text-[12px] font-mono" style={{ color: '#444' }}>
            No executions yet. Enter a prompt and click Execute.
          </div>
        )}
      </div>
    </div>
  );
}

/* Simple animated loader component */
function Loader2Animated({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function WiseLayerView() {
  return (
    <div className="p-6 max-w-[1440px]">
      {/* Top Row: XML Compactor + RLA Sentinel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <XMLPayloadCompactor />
        <RLASentinel />
      </div>

      {/* Bottom Row: Webwright Terminal (full width) */}
      <WebwrightTerminal />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SETTINGS VIEW
   ══════════════════════════════════════════════════════════════════════ */

function SettingsView() {
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'agents' | 'notifications'>('general');

  const tabs = [
    { key: 'general' as const, label: 'General', icon: Settings },
    { key: 'api' as const, label: 'API Keys', icon: Globe },
    { key: 'agents' as const, label: 'Agent Config', icon: Activity },
    { key: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="p-6 max-w-[900px]">
      <h3 className="text-[18px] font-semibold mb-4" style={{ color: COLORS.textPrimaryLight }}>
        Settings
      </h3>

      {/* Tab Bar */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-lg"
        style={{ backgroundColor: COLORS.canvas }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors flex-1 justify-center"
              style={{
                backgroundColor: active ? COLORS.surface : 'transparent',
                color: active ? COLORS.textPrimaryLight : COLORS.textTertiary,
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.borderLight }}>
        {activeTab === 'general' && (
          <div className="space-y-5">
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: COLORS.textTertiary }}>
                Organisation Name
              </label>
              <input
                defaultValue="Calthol CC — Customs Division"
                className="w-full px-3 py-2 text-[13px] rounded-md border outline-none"
                style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimaryLight, backgroundColor: COLORS.canvas }}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: COLORS.textTertiary }}>
                SARS Declarant Code
              </label>
              <input
                defaultValue="50123456789"
                className="w-full px-3 py-2 text-[13px] font-mono rounded-md border outline-none"
                style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimaryLight, backgroundColor: COLORS.canvas }}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: COLORS.textTertiary }}>
                Default Port
              </label>
              <select
                defaultValue="ZADUR"
                className="w-full px-3 py-2 text-[13px] rounded-md border outline-none"
                style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimaryLight, backgroundColor: COLORS.canvas }}
              >
                <option value="ZADUR">ZADUR — Durban</option>
                <option value="ZACPT">ZACPT — Cape Town</option>
                <option value="ZAJNB">ZAJNB — Johannesburg</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium" style={{ color: COLORS.textPrimaryLight }}>
                  Auto-Release High Confidence
                </div>
                <div className="text-[11px]" style={{ color: COLORS.textTertiary }}>
                  Automatically release shipments with &gt;95% confidence
                </div>
              </div>
              <div
                className="w-10 h-5 rounded-full relative cursor-pointer"
                style={{ backgroundColor: COLORS.success }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                  style={{ left: 22 }}
                />
              </div>
            </div>
            <button
              className="px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
              style={{ backgroundColor: COLORS.orange, color: '#FFF' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
            >
              Save Changes
            </button>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-4">
            {[
              { name: 'CargoWise API Key', value: 'cw_prod_****7a3f', connected: true },
              { name: 'SARS eFiling Token', value: 'sars_ef_****2b1c', connected: true },
              { name: 'OpenAI API Key', value: 'sk-****d8e9', connected: true },
              { name: 'WhatsApp Business API', value: 'Not configured', connected: false },
            ].map((api) => (
              <div
                key={api.name}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: COLORS.borderSubtle, backgroundColor: COLORS.canvas }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: api.connected ? COLORS.success : COLORS.textTertiary }}
                  />
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: COLORS.textPrimaryLight }}>
                      {api.name}
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: COLORS.textTertiary }}>
                      {api.value}
                    </div>
                  </div>
                </div>
                <button
                  className="text-[12px] font-medium px-2.5 py-1 rounded border transition-colors"
                  style={{ borderColor: COLORS.borderLight, color: COLORS.textTertiary }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.orange)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
                >
                  {api.connected ? 'Update' : 'Configure'}
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-4">
            {[
              { name: 'Webwright Agent', desc: 'Autonomous web scraping & form filling', enabled: true },
              { name: 'XML Compactor', desc: 'Payload optimization for CargoWise', enabled: true },
              { name: 'RLA Sentinel', desc: 'SARS RLA status monitoring & alerts', enabled: true },
              { name: 'Email Ingestion', desc: 'Automated document extraction from email', enabled: true },
              { name: 'VAT Engine', desc: 'Auto-calculate VAT for customs declarations', enabled: false },
            ].map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: COLORS.borderSubtle, backgroundColor: COLORS.canvas }}
              >
                <div>
                  <div className="text-[13px] font-medium" style={{ color: COLORS.textPrimaryLight }}>
                    {agent.name}
                  </div>
                  <div className="text-[11px]" style={{ color: COLORS.textTertiary }}>
                    {agent.desc}
                  </div>
                </div>
                <div
                  className="w-10 h-5 rounded-full relative cursor-pointer"
                  style={{ backgroundColor: agent.enabled ? COLORS.success : COLORS.borderLight }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                    style={{ left: agent.enabled ? 22 : 2 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {[
              { name: 'Shipment Created', desc: 'New shipment ingested from email/WhatsApp', enabled: true },
              { name: 'Shield Alert', desc: 'Compliance shield hold or fail', enabled: true },
              { name: 'CW Draft Created', desc: 'CargoWise draft successfully created', enabled: true },
              { name: 'RLA Status Change', desc: 'Importer RLA suspended or reactivated', enabled: true },
              { name: 'Daily Summary', desc: 'Daily email digest of queue status', enabled: false },
            ].map((n) => (
              <div
                key={n.name}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: COLORS.borderSubtle, backgroundColor: COLORS.canvas }}
              >
                <div>
                  <div className="text-[13px] font-medium" style={{ color: COLORS.textPrimaryLight }}>
                    {n.name}
                  </div>
                  <div className="text-[11px]" style={{ color: COLORS.textTertiary }}>
                    {n.desc}
                  </div>
                </div>
                <div
                  className="w-10 h-5 rounded-full relative cursor-pointer"
                  style={{ backgroundColor: n.enabled ? COLORS.success : COLORS.borderLight }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                    style={{ left: n.enabled ? 22 : 2 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════════════ */

export default function CargoIQApp() {
  const [view, setView] = useState<ViewMode>('cargoflow');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const sidebarWidth = sidebarCollapsed ? 56 : 240;

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <DashboardView />;
      case 'cargoflow':
        return <CargoFlowView />;
      case 'wiselayer':
        return <WiseLayerView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <CargoFlowView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.canvas }}>
      <Sidebar
        view={view}
        setView={setView}
        collapsed={sidebarCollapsed}
        toggleCollapse={toggleSidebarCollapse}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <TopNav
        view={view}
        collapsed={sidebarCollapsed}
        onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
      />

      {/* Main Content Area */}
      <main
        className="flex-1 flex flex-col"
        style={{
          marginLeft: sidebarWidth,
          paddingTop: 56, // topnav height
          transition: 'margin-left 200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* CargoFlow uses full height, other views scroll normally */}
        {view === 'cargoflow' ? (
          <div className="flex-1 overflow-hidden">
            <CargoFlowView />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {renderView()}
          </div>
        )}
      </main>
    </div>
  );
}
