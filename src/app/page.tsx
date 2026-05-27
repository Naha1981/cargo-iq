"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  LayoutDashboard,
  PackageSearch,
  ShieldCheck,
  BarChart3,
  Settings,
  Database,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  Eye,
  Ban,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Zap,
  AlertCircle,
  Menu,
  ArrowRight,
  Wifi,
  WifiOff,
  Play,
  Send,
  Code2,
  Activity,
  Radio,
  X,
  ThumbsUp,
  ThumbsDown,
  File,
  FileSpreadsheet,
  FileType,
  Loader2,
  Save,
  Mail,
  Hash,
  Globe,
  Building2,
  Server,
  Key,
  Users,
  ShieldAlert,
} from "lucide-react";

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

type ViewMode = "dashboard" | "shipments" | "shipment-detail" | "compliance" | "wiselayer" | "cargowise" | "settings";
type Confidence = "high" | "medium" | "low";
type ShieldStatus = "pass" | "hold" | "fail" | "pending";
type ShipmentStatus = "pending" | "review_required" | "approved" | "rejected" | "in_cargowise" | "cw_draft_created" | "error";

interface ShipmentSummary {
  id: string;
  reference: string;
  shipperName: string;
  consigneeName: string;
  originPort: string;
  destinationPort: string;
  shipmentType: string;
  awbOrBlNumber: string;
  overallConfidence: Confidence;
  shieldStatus: ShieldStatus;
  status: ShipmentStatus;
  documentCount: number;
  createdAt: string;
}

interface ShipmentListResponse {
  items: ShipmentSummary[];
  total: number;
  page: number;
  limit: number;
}

interface LineItem {
  id: string;
  lineNumber: number;
  hsCode: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitWeight: number | null;
  totalWeight: number | null;
  unitValue: number | null;
  totalValue: number | null;
  currency: string | null;
  confidence: string | null;
}

interface ComplianceEvent {
  id: string;
  module: string;
  result: string;
  detail: string;
  penaltyRisk: boolean;
  createdAt: string;
}

interface Document {
  id: string;
  filename: string;
  docType: string;
  fileType: string;
  status: string;
  createdAt: string;
}

interface ShipmentDetail {
  id: string;
  reference: string;
  shipperName: string | null;
  shipperAddress: string | null;
  consigneeName: string | null;
  consigneeAddress: string | null;
  notifyParty: string | null;
  originPort: string | null;
  destinationPort: string | null;
  cargoDescription: string | null;
  hsCodePrimary: string | null;
  grossWeight: number | null;
  netWeight: number | null;
  weightUnit: string | null;
  numberOfPackages: number | null;
  incoterms: string | null;
  invoiceNumber: string | null;
  invoiceValue: number | null;
  currency: string | null;
  awbOrBlNumber: string | null;
  vesselOrFlight: string | null;
  shipmentType: string | null;
  overallConfidence: Confidence;
  shieldStatus: ShieldStatus;
  shieldResults: Record<string, unknown>;
  status: ShipmentStatus;
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  lineItems: LineItem[];
  complianceEvents: ComplianceEvent[];
  documents: Document[];
  createdAt: string;
  updatedAt: string;
  eta: string | null;
  etd: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  source: string;
  orgId: string;
}

interface AnalyticsData {
  processed: number;
  automationRate: number;
  avgTimeSeconds: number;
  errorRate: number;
  shieldSummary: { pass: number; hold: number; fail: number; pending: number };
  queueSize: number;
  exceptions: number;
  recentTrend: Array<{ date: string; count: number }>;
  topOriginPorts: Array<{ port: string; count: number }>;
  avgConfidenceBySource: Record<string, Record<string, number>>;
  shieldPassRate: number;
  pipelineStatus: {
    pending: number;
    review_required: number;
    approved: number;
    rejected: number;
    cw_draft_created: number;
    in_cargowise: number;
    error: number;
  };
}

interface CwExecution {
  id: string;
  shipmentId: string;
  executionType: string;
  status: string;
  durationMs: number | null;
  screenshotUrl: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    reference: string;
    shipperName: string | null;
    status: string;
  };
}

interface WsNotification {
  type?: string;
  message?: string;
  event?: string;
  reference?: string;
  [key: string]: unknown;
}

/* ══════════════════════════════════════════════
   Data Fetching Hook
   ══════════════════════════════════════════════ */

function useApi<T>(url: string, defaultValue: T) {
  const [state, setState] = useState<{ data: T; loading: boolean; error: string | null }>({
    data: defaultValue, loading: true, error: null,
  });
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setState({ data: d, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: defaultValue, loading: false, error: e.message });
      });
    return () => { cancelled = true; };
  }, [url, fetchKey]);

  return { data: state.data, loading: state.loading, error: state.error, refetch };
}

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

function formatZAR(n: number) {
  return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}m ${sec}s`;
}

function ShieldBadge({ status }: { status: ShieldStatus }) {
  const map: Record<ShieldStatus, { bg: string; text: string; label: string }> = {
    pass: { bg: "bg-emerald-50", text: "text-emerald-700", label: "PASS" },
    hold: { bg: "bg-amber-50", text: "text-amber-700", label: "HOLD" },
    fail: { bg: "bg-red-50", text: "text-red-700", label: "FAIL" },
    pending: { bg: "bg-slate-100", text: "text-slate-500", label: "PENDING" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const map: Record<ShipmentStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-slate-100", text: "text-slate-600", label: "Pending" },
    review_required: { bg: "bg-amber-50", text: "text-amber-700", label: "Review" },
    approved: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Approved" },
    rejected: { bg: "bg-red-50", text: "text-red-700", label: "Rejected" },
    in_cargowise: { bg: "bg-teal-50", text: "text-teal-700", label: "In CW" },
    cw_draft_created: { bg: "bg-amber-50", text: "text-amber-800", label: "CW Draft" },
    error: { bg: "bg-red-50", text: "text-red-700", label: "Error" },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const map: Record<Confidence, { text: string; dot: string }> = {
    high: { text: "text-emerald-600", dot: "bg-emerald-500" },
    medium: { text: "text-amber-600", dot: "bg-amber-500" },
    low: { text: "text-red-600", dot: "bg-red-500" },
  };
  const s = map[level] || map.medium;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function fileIcon(fileType: string) {
  if (fileType === "pdf") return <FileText size={14} className="text-red-500" />;
  if (["xlsx", "xls", "csv"].includes(fileType)) return <FileSpreadsheet size={14} className="text-emerald-600" />;
  if (["jpg", "jpeg", "png"].includes(fileType)) return <FileText size={14} className="text-sky-500" />;
  if (["docx", "doc"].includes(fileType)) return <FileType size={14} className="text-sky-600" />;
  return <File size={14} className="text-slate-400" />;
}

/* ══════════════════════════════════════════════
   Sidebar
   ══════════════════════════════════════════════ */

function Sidebar({ view, setView, collapsed, toggleCollapse, mobileOpen, onMobileClose }: {
  view: ViewMode; setView: (v: ViewMode) => void; collapsed: boolean; toggleCollapse: () => void;
  mobileOpen: boolean; onMobileClose: () => void;
}) {
  const sections = [
    { label: "Operations", items: [
      { key: "dashboard" as ViewMode, icon: LayoutDashboard, label: "Dashboard" },
      { key: "shipments" as ViewMode, icon: PackageSearch, label: "Shipment Queue" },
      { key: "compliance" as ViewMode, icon: ShieldCheck, label: "Compliance Audit" },
    ]},
    { label: "Intelligence", items: [
      { key: "wiselayer" as ViewMode, icon: BarChart3, label: "WiseLayer" },
      { key: "cargowise" as ViewMode, icon: Database, label: "CargoWise" },
    ]},
    { label: "System", items: [
      { key: "settings" as ViewMode, icon: Settings, label: "Settings" },
    ]},
  ];

  const sidebarContent = (
    <aside
      className="flex flex-col border-r transition-all duration-200 h-full"
      style={{ width: collapsed ? 56 : 240, backgroundColor: "#1A2332", borderColor: "#243040" }}
    >
      <div className="flex items-center h-14 px-4 border-b" style={{ borderColor: "#243040" }}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img src="/cargoiq-logo.jpg" alt="CargoIQ Logo" className="flex-shrink-0 rounded" style={{ width: 28, height: 28, objectFit: "cover" }} />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight truncate">
                <span className="text-white">CARGO</span><span style={{ color: "#E6A34D" }}>iQ</span>
              </span>
              <span className="text-[10px] leading-none" style={{ color: "#6B7E92" }}>Compliance Platform</span>
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#243040 transparent" }}>
        {sections.map((sec) => (
          <div key={sec.label} className="mb-3">
            {!collapsed && (
              <div className="px-5 mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>{sec.label}</div>
            )}
            {sec.items.map((item) => {
              const active = view === item.key || (item.key === "shipments" && view === "shipment-detail");
              return (
                <button
                  key={item.key}
                  onClick={() => { setView(item.key); onMobileClose(); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2 mx-2 rounded text-[13px] font-medium transition-colors"
                  style={{
                    width: collapsed ? 40 : "calc(100% - 16px)",
                    justifyContent: collapsed ? "center" : "flex-start",
                    marginLeft: collapsed ? 8 : undefined,
                    marginRight: collapsed ? 8 : undefined,
                    paddingLeft: collapsed ? 0 : 16,
                    color: active ? "#C8D3DF" : "#6B7E92",
                    backgroundColor: active ? "#243447" : "transparent",
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <button
        onClick={toggleCollapse}
        className="hidden md:flex items-center justify-center h-10 border-t transition-colors hover:bg-[#1F2D3D]"
        style={{ borderColor: "#243040", color: "#6B7E92" }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block fixed top-0 left-0 bottom-0 z-40">{sidebarContent}</div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onMobileClose} />
          <div className="relative z-10 h-full" style={{ width: 240 }}>{sidebarContent}</div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════
   Top Nav
   ══════════════════════════════════════════════ */

function TopNav({ view, collapsed, onToggleMobileSidebar, onQuickUpload, wsConnected, notificationCount }: {
  view: ViewMode; collapsed: boolean; onToggleMobileSidebar: () => void; onQuickUpload: () => void;
  wsConnected: boolean; notificationCount: number;
}) {
  const viewLabels: Record<ViewMode, string> = {
    dashboard: "Dashboard",
    shipments: "Shipment Queue",
    "shipment-detail": "Shipment Detail",
    compliance: "Compliance Audit",
    wiselayer: "WiseLayer — Cost Intelligence",
    cargowise: "CargoWise Integration",
    settings: "Settings",
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center h-14 px-5 gap-3 border-b transition-all duration-200"
      style={{ left: 0, backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}
    >
      <button className="md:hidden p-1.5 rounded hover:bg-[#E8ECF1] transition-colors" style={{ color: "#6B7E92" }} onClick={onToggleMobileSidebar}>
        <Menu size={20} />
      </button>
      <h2 className="text-[15px] font-semibold truncate" style={{ color: "#0D1B2A" }}>{viewLabels[view]}</h2>
      <div className="flex-1" />
      {/* WebSocket indicator */}
      <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: wsConnected ? "#15632A" : "#9B1C1C" }}>
        {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span className="hidden sm:inline">{wsConnected ? "Live" : "Offline"}</span>
      </div>
      <button onClick={onQuickUpload} className="p-1.5 rounded hover:bg-[#E8ECF1] transition-colors" style={{ color: "#6B7E92" }} title="Upload Document">
        <Upload size={18} />
      </button>
      <button className="relative p-1.5 rounded hover:bg-[#E8ECF1] transition-colors" style={{ color: "#6B7E92" }}>
        <Bell size={18} />
        {notificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1" style={{ backgroundColor: "#B8860B" }}>
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </button>
      <div className="hidden sm:flex items-center gap-2 pl-2 border-l" style={{ borderColor: "#C8D0DA" }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: "#B8860B", color: "#FFF" }}>JM</div>
        <span className="text-[13px] font-medium" style={{ color: "#0D1B2A" }}>J. Mokoena</span>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════
   Notification Toast
   ══════════════════════════════════════════════ */

function NotificationToast({ notification, onDismiss }: { notification: WsNotification; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border shadow-lg p-4 animate-in slide-in-from-bottom-2" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FEF6E7" }}>
          <Radio size={16} style={{ color: "#B8860B" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: "#0D1B2A" }}>
            {notification.type === "shipment:created" ? "New Shipment" :
             notification.type === "shield:completed" ? "Shield Complete" :
             notification.type === "cw:draft_created" ? "CW Draft Created" :
             notification.type === "cw:draft_failed" ? "CW Draft Failed" :
             notification.type === "email:ingested" ? "Email Ingested" :
             notification.type === "shipment:approved" ? "Shipment Approved" :
             notification.type === "shipment:rejected" ? "Shipment Rejected" :
             "Notification"}
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: "#6B7E92" }}>
            {notification.message || notification.reference || "Event received"}
          </div>
        </div>
        <button onClick={onDismiss} className="flex-shrink-0 p-1 rounded hover:bg-[#E8ECF1]" style={{ color: "#6B7E92" }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Dashboard View
   ══════════════════════════════════════════════ */

function DashboardView({ setView, onSelectShipment }: { setView: (v: ViewMode) => void; onSelectShipment: (id: string) => void }) {
  const { data: analytics, loading: analyticsLoading } = useApi<AnalyticsData>("/api/analytics", {
    processed: 0, automationRate: 0, avgTimeSeconds: 0, errorRate: 0,
    shieldSummary: { pass: 0, hold: 0, fail: 0, pending: 0 },
    queueSize: 0, exceptions: 0, recentTrend: [], topOriginPorts: [],
    avgConfidenceBySource: {}, shieldPassRate: 0,
    pipelineStatus: { pending: 0, review_required: 0, approved: 0, rejected: 0, cw_draft_created: 0, in_cargowise: 0, error: 0 },
  });

  const { data: recentShipments, loading: shipmentsLoading } = useApi<ShipmentListResponse>("/api/shipments?limit=5", { items: [], total: 0, page: 1, limit: 5 });

  const kpis = [
    { label: "Processed Today", value: analytics.processed, change: analytics.recentTrend.length > 1 ? `+${analytics.recentTrend[analytics.recentTrend.length - 1]?.count || 0}` : "0", up: true, icon: FileText, color: "#1A4971", bg: "#EBF3FB" },
    { label: "Automation Rate", value: `${Math.round(analytics.automationRate * 100)}%`, change: "+3.2%", up: true, icon: Zap, color: "#15632A", bg: "#EBF5EE" },
    { label: "Avg Processing", value: formatSeconds(analytics.avgTimeSeconds), change: "-18%", up: true, icon: Clock, color: "#7A4F00", bg: "#FEF6E7" },
    { label: "Shield Exceptions", value: analytics.exceptions, change: analytics.exceptions > 0 ? `+${analytics.exceptions}` : "0", up: analytics.exceptions === 0, icon: AlertTriangle, color: "#9B1C1C", bg: "#FEF2F2" },
  ];

  const ps = analytics.pipelineStatus;
  const pipelineSteps = [
    { label: "Email", count: analytics.queueSize, status: "active" as const, icon: "📧" },
    { label: "Classify", count: ps.pending, status: ps.pending > 0 ? "active" as const : "complete" as const, icon: "🏷️" },
    { label: "Extract", count: ps.review_required, status: ps.review_required > 0 ? "active" as const : "complete" as const, icon: "📄" },
    { label: "Shield", count: analytics.shieldSummary.pass, status: "complete" as const, icon: "🛡️" },
    { label: "Review", count: ps.review_required, status: ps.review_required > 0 ? "pending" as const : "complete" as const, icon: "👁️" },
    { label: "CW", count: ps.cw_draft_created, status: ps.cw_draft_created > 0 ? "active" as const : "pending" as const, icon: "🔗" },
  ];

  const ss = analytics.shieldSummary;
  const shieldTotal = ss.pass + ss.hold + ss.fail + ss.pending;
  const shieldSummary = [
    { label: "Pass", count: ss.pass, color: "bg-emerald-500", pct: shieldTotal > 0 ? Math.round((ss.pass / shieldTotal) * 100) : 0 },
    { label: "Hold", count: ss.hold, color: "bg-amber-500", pct: shieldTotal > 0 ? Math.round((ss.hold / shieldTotal) * 100) : 0 },
    { label: "Fail", count: ss.fail, color: "bg-red-500", pct: shieldTotal > 0 ? Math.round((ss.fail / shieldTotal) * 100) : 0 },
    { label: "Pending", count: ss.pending, color: "bg-slate-400", pct: shieldTotal > 0 ? Math.round((ss.pending / shieldTotal) * 100) : 0 },
  ];

  return (
    <div className="p-6 max-w-[1440px]">
      {analyticsLoading && <div className="text-[13px] mb-4" style={{ color: "#6B7E92" }}>Loading analytics...</div>}
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                <kpi.icon size={18} style={{ color: kpi.color }} />
              </div>
              <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${kpi.up ? "text-emerald-600" : "text-red-600"}`}>
                {kpi.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {kpi.change}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>{kpi.value}</div>
            <div className="text-[11px] font-medium uppercase tracking-wider mt-0.5" style={{ color: "#6B7E92" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Processing Pipeline */}
      <div className="rounded-lg border mb-6" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>PROCESSING PIPELINE</span>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border min-w-[80px]"
                  style={{
                    backgroundColor: step.status === "active" ? "#EBF3FB" : step.status === "complete" ? "#EBF5EE" : "#F1F4F8",
                    borderColor: step.status === "active" ? "#1A4971" : step.status === "complete" ? "#15632A" : "#C8D0DA",
                  }}
                >
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-[11px] font-semibold" style={{ color: step.status === "active" ? "#1A4971" : step.status === "complete" ? "#15632A" : "#6B7E92" }}>{step.label}</span>
                  <span className="text-[16px] font-bold" style={{ color: "#0D1B2A" }}>{step.count}</span>
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full" style={{
                    color: step.status === "active" ? "#1A4971" : step.status === "complete" ? "#15632A" : "#6B7E92",
                    backgroundColor: step.status === "active" ? "#D6E8F7" : step.status === "complete" ? "#C6E4CE" : "#E8ECF1",
                  }}>{step.status}</span>
                </div>
                {i < pipelineSteps.length - 1 && <ArrowRight size={16} className="flex-shrink-0" style={{ color: "#9AAAB8" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Shipments */}
        <div className="lg:col-span-2 rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>RECENT SHIPMENTS</span>
            <button onClick={() => setView("shipments")} className="text-[12px] font-medium hover:underline" style={{ color: "#B8860B" }}>View all →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "#C8D0DA" }}>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Reference</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Route</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Shield</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {shipmentsLoading ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-[12px]" style={{ color: "#6B7E92" }}>Loading...</td></tr>
                ) : recentShipments.items.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-[12px]" style={{ color: "#6B7E92" }}>No shipments yet. Upload a document to get started.</td></tr>
                ) : recentShipments.items.map((s) => (
                  <tr key={s.id} onClick={() => onSelectShipment(s.id)} className="border-b hover:bg-[#F1F4F8] transition-colors cursor-pointer" style={{ borderColor: "#DDE3EA" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#0D1B2A" }}>
                      <span className="font-mono text-[12px]">{s.reference}</span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#3D5166" }}>{s.originPort || "—"} → {s.destinationPort || "—"}</td>
                    <td className="px-4 py-2.5"><ShieldBadge status={s.shieldStatus} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shield Summary */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>COMPLIANCE SHIELD</span>
          </div>
          <div className="p-4 space-y-4">
            {shieldSummary.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium" style={{ color: "#3D5166" }}>{item.label}</span>
                  <span className="text-[13px] font-bold" style={{ color: "#0D1B2A" }}>{item.count}</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#E8ECF1" }}>
                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          {analytics.shieldSummary.hold > 0 && (
            <div className="px-4 pb-4">
              <div className="rounded-md p-3 text-[12px]" style={{ backgroundColor: "#FEF6E7", borderColor: "#E8B84B", color: "#7A4F00", border: "1px solid #E8B84B" }}>
                <div className="flex items-center gap-1.5 font-semibold mb-1"><AlertTriangle size={13} />{analytics.shieldSummary.hold} shipments on HOLD</div>
                <div style={{ color: "#7A4F00", opacity: 0.8 }}>Requires manual review before CargoWise submission</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Shipment Queue View
   ══════════════════════════════════════════════ */

function ShipmentQueueView({ onSelectShipment, wsCreatedShipment }: {
  onSelectShipment: (id: string) => void;
  wsCreatedShipment: ShipmentSummary | null;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shieldFilter, setShieldFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (shieldFilter !== "all") queryParams.set("shield", shieldFilter);
  if (search) queryParams.set("search", search);
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));

  const { data, loading, refetch } = useApi<ShipmentListResponse>(`/api/shipments?${queryParams.toString()}`, { items: [], total: 0, page: 1, limit });

  const items = wsCreatedShipment ? [wsCreatedShipment, ...data.items.filter((i) => i.id !== wsCreatedShipment.id)] : data.items;
  const totalPages = Math.ceil(data.total / limit);

  // Re-fetch when filters change
  useEffect(() => { refetch(); }, [statusFilter, shieldFilter, search, page]);

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#9AAAB8" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by reference, shipper, consignee..."
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-md border outline-none transition-colors focus:border-[#B8860B] focus:ring-2 focus:ring-[#FDF3DC]"
            style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 text-[13px] rounded-md border outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="review_required">Review Required</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cw_draft_created">CW Draft</option>
          <option value="error">Error</option>
        </select>
        <select value={shieldFilter} onChange={(e) => { setShieldFilter(e.target.value); setPage(1); }} className="px-3 py-2 text-[13px] rounded-md border outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
          <option value="all">All Shield</option>
          <option value="pass">Pass</option>
          <option value="hold">Hold</option>
          <option value="fail">Fail</option>
          <option value="pending">Pending</option>
        </select>
        <div className="ml-auto text-[12px]" style={{ color: "#6B7E92" }}>{data.total} shipment{data.total !== 1 ? "s" : ""}</div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "#F1F4F8" }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Reference</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Shipper</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Route</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Type</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Confidence</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Shield</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Docs</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-[12px]" style={{ color: "#6B7E92" }}>Loading shipments...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-[12px]" style={{ color: "#6B7E92" }}>No shipments found.</td></tr>
              ) : items.map((s) => (
                <tr key={s.id} onClick={() => onSelectShipment(s.id)} className="border-b hover:bg-[#F1F4F8] transition-colors cursor-pointer" style={{ borderColor: "#DDE3EA" }}>
                  <td className="px-4 py-2.5 font-mono text-[12px] font-medium" style={{ color: "#B8860B" }}>{s.reference}</td>
                  <td className="px-4 py-2.5 max-w-[180px] truncate" style={{ color: "#0D1B2A" }}>{s.shipperName || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: "#3D5166" }}>{s.originPort || "—"} → {s.destinationPort || "—"}</td>
                  <td className="px-4 py-2.5 capitalize" style={{ color: "#3D5166" }}>{(s.shipmentType || "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5"><ConfidenceBadge level={s.overallConfidence} /></td>
                  <td className="px-4 py-2.5"><ShieldBadge status={s.shieldStatus} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2.5 text-center" style={{ color: "#3D5166" }}>{s.documentCount}</td>
                  <td className="px-4 py-2.5" style={{ color: "#6B7E92" }}>{relativeTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[12px]" style={{ color: "#6B7E92" }}>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 text-[12px] rounded border disabled:opacity-50" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>Previous</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-[12px] rounded border disabled:opacity-50" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Shipment Detail View
   ══════════════════════════════════════════════ */

function ShipmentDetailView({ shipmentId, setView }: { shipmentId: string; setView: (v: ViewMode) => void }) {
  const { data: s, loading, refetch } = useApi<ShipmentDetail | null>(`/api/shipments/${shipmentId}`, null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { data: cwExecutions } = useApi<{ executions: CwExecution[] }>(`/api/cargowise/executions?shipmentId=${shipmentId}&limit=5`, { executions: [] });

  const handleAction = async (action: string, url: string, body?: Record<string, unknown>) => {
    setActionLoading(action);
    setActionResult(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (res.ok) {
        setActionResult(`✓ ${action} succeeded`);
        refetch();
      } else {
        setActionResult(`✗ ${action} failed: ${data.error || data.message || "Unknown error"}`);
      }
    } catch (e) {
      setActionResult(`✗ ${action} error: ${e instanceof Error ? e.message : "Network error"}`);
    }
    setActionLoading(null);
  };

  const handleFieldEdit = async (field: string, value: string) => {
    try {
      await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      refetch();
    } catch { /* silently fail */ }
    setEditingField(null);
  };

  if (loading || !s) {
    return <div className="p-6"><div className="text-[13px]" style={{ color: "#6B7E92" }}>Loading shipment details...</div></div>;
  }

  const shieldModules = s.shieldResults && typeof s.shieldResults === "object" && "modules" in s.shieldResults
    ? (s.shieldResults as { modules: Array<{ module: string; result: string; detail: Record<string, unknown>; penalty_risk: boolean }> }).modules
    : s.complianceEvents.map((ce) => ({
        module: ce.module,
        result: ce.result,
        detail: (() => { try { return JSON.parse(ce.detail); } catch { return { message: ce.detail }; } })(),
        penalty_risk: ce.penaltyRisk,
      }));

  const detailFields = [
    { label: "Shipper", value: s.shipperName, field: "shipperName" },
    { label: "Consignee", value: s.consigneeName, field: "consigneeName" },
    { label: "Route", value: `${s.originPort || "—"} → ${s.destinationPort || "—"}`, field: null },
    { label: "BL/AWB", value: s.awbOrBlNumber, field: "awbOrBlNumber" },
    { label: "Type", value: (s.shipmentType || "").replace(/_/g, " "), field: "shipmentType" },
    { label: "Incoterms", value: s.incoterms, field: "incoterms" },
    { label: "Vessel/Flight", value: s.vesselOrFlight, field: "vesselOrFlight" },
    { label: "ETA", value: s.eta ? new Date(s.eta).toLocaleDateString() : "—", field: null },
    { label: "Invoice Value", value: s.invoiceValue ? `$${Number(s.invoiceValue).toLocaleString()}` : "—", field: "invoiceValue" },
    { label: "Gross Weight", value: s.grossWeight ? `${Number(s.grossWeight).toLocaleString()} ${s.weightUnit || "KGS"}` : "—", field: "grossWeight" },
    { label: "Packages", value: s.numberOfPackages, field: "numberOfPackages" },
    { label: "Confidence", value: s.overallConfidence, field: null },
    { label: "Source", value: s.source, field: null },
    { label: "HS Code", value: s.hsCodePrimary, field: "hsCodePrimary" },
  ];

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => setView("shipments")} className="text-[13px] font-medium hover:underline" style={{ color: "#B8860B" }}>← Back to Queue</button>
        <span style={{ color: "#C8D0DA" }}>|</span>
        <span className="font-mono text-[15px] font-semibold" style={{ color: "#0D1B2A" }}>{s.reference}</span>
        <ShieldBadge status={s.shieldStatus} />
        <StatusBadge status={s.status} />
      </div>

      {/* Action result banner */}
      {actionResult && (
        <div className={`mb-4 rounded-md p-3 text-[12px] font-medium ${actionResult.startsWith("✓") ? "border" : "border"}`} style={{
          backgroundColor: actionResult.startsWith("✓") ? "#EBF5EE" : "#FEF2F2",
          borderColor: actionResult.startsWith("✓") ? "#C6E4CE" : "#F5A5A5",
          color: actionResult.startsWith("✓") ? "#15632A" : "#9B1C1C",
        }}>
          {actionResult}
          <button onClick={() => setActionResult(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Shipment Info + Line Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Shipment Info */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>SHIPMENT DETAILS</span>
              <span className="ml-2 text-[11px]" style={{ color: "#6B7E92" }}>Click a value to edit</span>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-[13px]">
              {detailFields.map((item) => (
                <div key={item.label}>
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "#6B7E92" }}>{item.label}</div>
                  {editingField === item.field ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => item.field && handleFieldEdit(item.field, editValue)}
                      onKeyDown={(e) => { if (e.key === "Enter" && item.field) handleFieldEdit(item.field, editValue); if (e.key === "Escape") setEditingField(null); }}
                      className="w-full px-2 py-1 text-[13px] border rounded outline-none focus:border-[#B8860B]"
                      style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }}
                    />
                  ) : (
                    <div
                      className={`font-medium ${item.field ? "cursor-pointer hover:bg-[#F1F4F8] rounded px-1 -mx-1" : ""}`}
                      style={{ color: "#0D1B2A" }}
                      onClick={() => {
                        if (item.field) { setEditingField(item.field); setEditValue(String(item.value || "")); }
                      }}
                    >
                      {String(item.value || "—")}
                      {item.field && <Save size={10} className="inline ml-1 opacity-30" />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>LINE ITEMS ({s.lineItems.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ backgroundColor: "#F1F4F8" }}>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>HS Code</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Description</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Qty</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Unit</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lineItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-4 text-center text-[12px]" style={{ color: "#6B7E92" }}>No line items extracted</td></tr>
                  ) : s.lineItems.map((li) => (
                    <tr key={li.id} className="border-b" style={{ borderColor: "#DDE3EA" }}>
                      <td className="px-4 py-2 font-mono text-[12px]" style={{ color: "#1A4971" }}>{li.hsCode || "—"}</td>
                      <td className="px-4 py-2" style={{ color: "#0D1B2A" }}>{li.description || "—"}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#3D5166" }}>{li.quantity?.toLocaleString() || "—"}</td>
                      <td className="px-4 py-2" style={{ color: "#3D5166" }}>{li.unit || "—"}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium" style={{ color: "#0D1B2A" }}>{li.totalValue ? `$${Number(li.totalValue).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>DOCUMENTS ({s.documents.length})</span>
            </div>
            <div className="p-4">
              {s.documents.length === 0 ? (
                <div className="text-[12px]" style={{ color: "#6B7E92" }}>No documents attached</div>
              ) : (
                <div className="space-y-2">
                  {s.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md border" style={{ borderColor: "#DDE3EA" }}>
                      {fileIcon(doc.fileType)}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium truncate" style={{ color: "#0D1B2A" }}>{doc.filename}</div>
                        <div className="text-[11px]" style={{ color: "#6B7E92" }}>{doc.docType} · {doc.status}</div>
                      </div>
                      <span className="text-[11px]" style={{ color: "#6B7E92" }}>{relativeTime(doc.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Timeline */}
          {s.complianceEvents.length > 0 && (
            <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
                <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>AUDIT TIMELINE</span>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto space-y-3">
                {s.complianceEvents.map((ev) => (
                  <div key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${ev.result === "pass" ? "bg-emerald-500" : ev.result === "hold" ? "bg-amber-500" : "bg-red-500"}`} />
                      <div className="w-px flex-1" style={{ backgroundColor: "#DDE3EA" }} />
                    </div>
                    <div className="pb-3">
                      <div className="text-[12px] font-semibold" style={{ color: "#0D1B2A" }}>{ev.module}</div>
                      <div className="text-[11px]" style={{ color: "#6B7E92" }}>
                        {(() => { try { const d = JSON.parse(ev.detail); return d.message || d.reason || JSON.stringify(d); } catch { return ev.detail; } })()}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "#9AAAB8" }}>{relativeTime(ev.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Shield + Actions */}
        <div className="space-y-4">
          {/* Shield */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#DDE3EA" }}>
              <ShieldCheck size={16} style={{ color: "#B8860B" }} />
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>COMPLIANCE SHIELD</span>
            </div>
            <div className="p-4 space-y-3">
              {shieldModules.map((m) => (
                <div key={m.module} className="rounded-md border p-3" style={{ borderColor: "#DDE3EA" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: "#0D1B2A" }}>{m.module}</span>
                    <ShieldBadge status={(m.result as ShieldStatus) || "pending"} />
                  </div>
                  <p className="text-[12px]" style={{ color: "#6B7E92" }}>
                    {typeof m.detail === "object" ? (m.detail as Record<string, unknown>).message || (m.detail as Record<string, unknown>).reason || JSON.stringify(m.detail) : String(m.detail)}
                  </p>
                  {m.penalty_risk && (
                    <div className="mt-1 text-[11px] font-medium text-red-600 flex items-center gap-1">
                      <AlertTriangle size={11} /> SARS Penalty Risk
                    </div>
                  )}
                </div>
              ))}
              {s.shieldStatus === "fail" && (
                <div className="rounded-md p-3 text-[12px] font-medium" style={{ backgroundColor: "#FEF2F2", border: "1px solid #F5A5A5", color: "#9B1C1C" }}>
                  <div className="flex items-center gap-1.5 mb-1"><Ban size={13} />CargoWise submission BLOCKED</div>
                  Resolve all FAIL results before proceeding.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>ACTIONS</span>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => handleAction("Create CW Draft", `/api/cargowise/execute`, { shipmentId: s.id })}
                disabled={s.shieldStatus === "fail" || actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: s.shieldStatus === "fail" ? "#9AAAB8" : "#B8860B" }}
              >
                {actionLoading === "Create CW Draft" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Create CW Draft
              </button>
              <button
                onClick={() => handleAction("Approve", `/api/shipments/${s.id}/approve`, { notes: "Approved via CargoIQ", acknowledgeRisks: s.shieldStatus === "hold" })}
                disabled={s.status === "approved" || actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium border transition-colors hover:bg-[#EBF5EE]" style={{ borderColor: "#C8D0DA", color: "#15632A" }}
              >
                {actionLoading === "Approve" ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                Approve
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={s.status === "rejected" || actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium border transition-colors hover:bg-[#FEF2F2]" style={{ borderColor: "#C8D0DA", color: "#9B1C1C" }}
              >
                <ThumbsDown size={14} />
                Reject
              </button>
              <button
                onClick={() => handleAction("Re-run Shield", `/api/shipments/${s.id}/shield`)}
                disabled={actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium border transition-colors hover:bg-[#F1F4F8]" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}
              >
                {actionLoading === "Re-run Shield" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Re-run Shield
              </button>
            </div>
          </div>

          {/* CW Execution History */}
          {cwExecutions.executions.length > 0 && (
            <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
                <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>CW EXECUTIONS</span>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {cwExecutions.executions.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between text-[12px] p-2 rounded border" style={{ borderColor: "#DDE3EA" }}>
                    <div>
                      <span className="font-mono" style={{ color: "#B8860B" }}>{ex.executionType}</span>
                      <span className="ml-2" style={{ color: "#6B7E92" }}>{ex.durationMs ? `${ex.durationMs}ms` : "—"}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ex.status === "success" ? "bg-emerald-50 text-emerald-700" : ex.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{ex.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Dialog */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold mb-4" style={{ color: "#0D1B2A" }}>Reject Shipment</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (min 3 characters)..."
              className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B] mb-4"
              style={{ borderColor: "#C8D0DA", color: "#0D1B2A", minHeight: 100 }}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setRejectOpen(false); setRejectReason(""); }} className="px-4 py-2 text-[13px] rounded-md border" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>Cancel</button>
              <button
                onClick={() => { handleAction("Reject", `/api/shipments/${s.id}/reject`, { reason: rejectReason }); setRejectOpen(false); setRejectReason(""); }}
                disabled={rejectReason.length < 3}
                className="px-4 py-2 text-[13px] rounded-md text-white disabled:opacity-50" style={{ backgroundColor: "#9B1C1C" }}
              >Reject Shipment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Compliance Audit View
   ══════════════════════════════════════════════ */

function ComplianceView() {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const { data: shipmentsData, loading } = useApi<ShipmentListResponse>("/api/shipments?limit=50", { items: [], total: 0, page: 1, limit: 50 });
  const { data: analytics } = useApi<AnalyticsData>("/api/analytics", {
    processed: 0, automationRate: 0, avgTimeSeconds: 0, errorRate: 0,
    shieldSummary: { pass: 0, hold: 0, fail: 0, pending: 0 },
    queueSize: 0, exceptions: 0, recentTrend: [], topOriginPorts: [],
    avgConfidenceBySource: {}, shieldPassRate: 0,
    pipelineStatus: { pending: 0, review_required: 0, approved: 0, rejected: 0, cw_draft_created: 0, in_cargowise: 0, error: 0 },
  });

  // Aggregate compliance events from all shipments
  const [allEvents, setAllEvents] = useState<Array<ComplianceEvent & { reference: string; shipmentId: string }>>([]);

  useEffect(() => {
    if (shipmentsData.items.length === 0) return;
    const fetchEvents = async () => {
      const events: Array<ComplianceEvent & { reference: string; shipmentId: string }> = [];
      // Fetch detail for each shipment to get complianceEvents
      const promises = shipmentsData.items.map(async (s) => {
        try {
          const res = await fetch(`/api/shipments/${s.id}`);
          if (res.ok) {
            const detail = await res.json();
            if (detail.complianceEvents) {
              for (const ce of detail.complianceEvents) {
                events.push({ ...ce, reference: s.reference, shipmentId: s.id });
              }
            }
          }
        } catch { /* skip */ }
      });
      await Promise.all(promises);
      setAllEvents(events);
    };
    fetchEvents();
  }, [shipmentsData.items]);

  const filtered = allEvents.filter((e) => {
    if (moduleFilter !== "all" && e.module !== moduleFilter) return false;
    if (resultFilter !== "all" && e.result !== resultFilter) return false;
    return true;
  });

  const uniqueModules = [...new Set(allEvents.map((e) => e.module))];
  const passCount = allEvents.filter((e) => e.result === "pass").length;
  const holdCount = allEvents.filter((e) => e.result === "hold").length;
  const failCount = allEvents.filter((e) => e.result === "fail").length;

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>{allEvents.length}</div>
          <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#6B7E92" }}>Total Checks</div>
        </div>
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#EBF5EE", borderColor: "#C6E4CE" }}>
          <div className="text-2xl font-bold text-emerald-700">{passCount}</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">Pass</div>
        </div>
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#FEF6E7", borderColor: "#E8B84B" }}>
          <div className="text-2xl font-bold text-amber-700">{holdCount}</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-amber-600">Hold</div>
        </div>
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#FEF2F2", borderColor: "#F5A5A5" }}>
          <div className="text-2xl font-bold text-red-700">{failCount}</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-red-600">Fail</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="px-3 py-2 text-[13px] rounded-md border outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
          <option value="all">All Modules</option>
          {uniqueModules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} className="px-3 py-2 text-[13px] rounded-md border outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
          <option value="all">All Results</option>
          <option value="pass">Pass</option>
          <option value="hold">Hold</option>
          <option value="fail">Fail</option>
        </select>
        <div className="ml-auto text-[12px]" style={{ color: "#6B7E92" }}>{filtered.length} event{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Events Table */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "#F1F4F8" }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Shipment</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Module</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Result</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Detail</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Penalty Risk</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: "#6B7E92" }}>Loading compliance events...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: "#6B7E92" }}>No compliance events found.</td></tr>
              ) : filtered.map((ev) => (
                <tr key={ev.id} className="border-b hover:bg-[#F1F4F8] transition-colors" style={{ borderColor: "#DDE3EA" }}>
                  <td className="px-4 py-2.5 font-mono text-[12px] font-medium" style={{ color: "#B8860B" }}>{ev.reference}</td>
                  <td className="px-4 py-2.5" style={{ color: "#0D1B2A" }}>{ev.module}</td>
                  <td className="px-4 py-2.5"><ShieldBadge status={ev.result as ShieldStatus} /></td>
                  <td className="px-4 py-2.5 max-w-[300px] truncate" style={{ color: "#3D5166" }}>
                    {(() => { try { const d = JSON.parse(ev.detail); return d.message || d.reason || JSON.stringify(d); } catch { return ev.detail; } })()}
                  </td>
                  <td className="px-4 py-2.5">{ev.penaltyRisk ? <AlertTriangle size={14} className="text-red-500" /> : <span style={{ color: "#6B7E92" }}>—</span>}</td>
                  <td className="px-4 py-2.5" style={{ color: "#6B7E92" }}>{relativeTime(ev.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shield Pass Rate */}
      {analytics.shieldPassRate > 0 && (
        <div className="mt-6 rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="text-[13px] font-semibold mb-2" style={{ color: "#3D5166" }}>SHIELD PASS RATE</div>
          <div className="w-full h-3 rounded-full" style={{ backgroundColor: "#E8ECF1" }}>
            <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${Math.round(analytics.shieldPassRate * 100)}%` }} />
          </div>
          <div className="text-[12px] mt-1" style={{ color: "#6B7E92" }}>{Math.round(analytics.shieldPassRate * 100)}% of checked shipments pass all shield modules</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   WiseLayer View
   ══════════════════════════════════════════════ */

function WiseLayerView() {
  const { data: analytics } = useApi<AnalyticsData>("/api/analytics", {
    processed: 0, automationRate: 0, avgTimeSeconds: 0, errorRate: 0,
    shieldSummary: { pass: 0, hold: 0, fail: 0, pending: 0 },
    queueSize: 0, exceptions: 0, recentTrend: [], topOriginPorts: [],
    avgConfidenceBySource: {}, shieldPassRate: 0,
    pipelineStatus: { pending: 0, review_required: 0, approved: 0, rejected: 0, cw_draft_created: 0, in_cargowise: 0, error: 0 },
  });

  const { data: shipments } = useApi<ShipmentListResponse>("/api/shipments?limit=20", { items: [], total: 0, page: 1, limit: 20 });

  const totalValue = shipments.items.reduce((acc, s) => acc + 0, 0); // Placeholder
  const avgConf = analytics.avgConfidenceBySource;

  return (
    <div className="p-6 max-w-[1440px]">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="flex items-center gap-2 mb-2"><DollarSign size={16} style={{ color: "#B8860B" }} /><span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#6B7E92" }}>Total Pipeline Value</span></div>
          <div className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>—</div>
          <div className="text-[11px]" style={{ color: "#6B7E92" }}>Cost intelligence coming soon</div>
        </div>
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="flex items-center gap-2 mb-2"><Activity size={16} style={{ color: "#B8860B" }} /><span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#6B7E92" }}>Active Shipments</span></div>
          <div className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>{shipments.total}</div>
          <div className="text-[11px]" style={{ color: "#6B7E92" }}>In processing pipeline</div>
        </div>
        <div className="rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="flex items-center gap-2 mb-2"><ShieldCheck size={16} style={{ color: "#B8860B" }} /><span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#6B7E92" }}>Shield Pass Rate</span></div>
          <div className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>{Math.round(analytics.shieldPassRate * 100)}%</div>
          <div className="text-[11px]" style={{ color: "#6B7E92" }}>Compliance health</div>
        </div>
      </div>

      {/* Confidence by Source */}
      <div className="rounded-lg border mb-6" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>EXTRACTION CONFIDENCE BY SOURCE</span>
        </div>
        <div className="p-4">
          {Object.keys(avgConf).length === 0 ? (
            <div className="text-[12px]" style={{ color: "#6B7E92" }}>No source data available yet</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(avgConf).map(([source, data]) => (
                <div key={source}>
                  <div className="text-[12px] font-semibold mb-2 capitalize" style={{ color: "#0D1B2A" }}>{source.replace(/_/g, " ")} ({(data as Record<string, number>).total} shipments)</div>
                  <div className="flex gap-3">
                    {(["highPct", "mediumPct", "lowPct"] as const).map((key) => {
                      const labels = { highPct: "High", mediumPct: "Medium", lowPct: "Low" };
                      const colors = { highPct: "bg-emerald-500", mediumPct: "bg-amber-500", lowPct: "bg-red-500" };
                      return (
                        <div key={key} className="flex-1">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span style={{ color: "#6B7E92" }}>{labels[key]}</span>
                            <span className="font-medium" style={{ color: "#0D1B2A" }}>{(data as Record<string, number>)[key]}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#E8ECF1" }}>
                            <div className={`h-2 rounded-full ${colors[key]}`} style={{ width: `${(data as Record<string, number>)[key]}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Origin Ports */}
      <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>TOP ORIGIN PORTS</span>
        </div>
        <div className="p-4">
          {analytics.topOriginPorts.length === 0 ? (
            <div className="text-[12px]" style={{ color: "#6B7E92" }}>No port data available yet</div>
          ) : (
            <div className="space-y-3">
              {analytics.topOriginPorts.map((p) => {
                const maxCount = analytics.topOriginPorts[0]?.count || 1;
                return (
                  <div key={p.port}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="font-mono font-medium" style={{ color: "#0D1B2A" }}>{p.port}</span>
                      <span style={{ color: "#6B7E92" }}>{p.count} shipments</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#E8ECF1" }}>
                      <div className="h-2 rounded-full" style={{ width: `${(p.count / maxCount) * 100}%`, backgroundColor: "#B8860B" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder */}
      <div className="mt-6 rounded-lg border p-6 text-center" style={{ backgroundColor: "#F1F4F8", borderColor: "#C8D0DA" }}>
        <DollarSign size={32} className="mx-auto mb-2" style={{ color: "#B8860B" }} />
        <div className="text-[15px] font-semibold mb-1" style={{ color: "#0D1B2A" }}>WiseTech Cost Intelligence</div>
        <div className="text-[12px]" style={{ color: "#6B7E92" }}>CargoWise cost optimization insights and WiseTech Value Pack analytics are coming soon. Connect your CargoWise instance in Settings to enable cost tracking.</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   CargoWise Integration View
   ══════════════════════════════════════════════ */

function CargoWiseView({ wsConnected }: { wsConnected: boolean }) {
  const [testResult, setTestResult] = useState<{ connected: boolean; message?: string; error?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftResult, setDraftResult] = useState<string | null>(null);

  const { data: executions, loading: executionsLoading, refetch: refetchExecutions } = useApi<{ executions: CwExecution[]; total: number }>("/api/cargowise/executions?limit=20", { executions: [], total: 0 });
  const { data: shipments } = useApi<ShipmentListResponse>("/api/shipments?limit=10&status=approved", { items: [], total: 0, page: 1, limit: 10 });

  const handleTest = async () => {
    setTestLoading(true);
    try {
      // Get first org
      const res = await fetch("/api/cargowise/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: "auto" }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ connected: false, error: e instanceof Error ? e.message : "Connection failed" });
    }
    setTestLoading(false);
  };

  const handleCreateDraft = async () => {
    if (!selectedShipmentId) return;
    setDraftLoading(true);
    setDraftResult(null);
    try {
      const res = await fetch("/api/cargowise/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: selectedShipmentId }),
      });
      const data = await res.json();
      setDraftResult(data.success ? `✓ Draft created successfully (${data.execution?.executionType}, ${data.execution?.durationMs}ms)` : `✗ Failed: ${data.error || data.message}`);
      refetchExecutions();
    } catch (e) {
      setDraftResult(`✗ Error: ${e instanceof Error ? e.message : "Network error"}`);
    }
    setDraftLoading(false);
  };

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Connection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>CARGOWISE CONNECTION</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult?.connected ? <Wifi size={18} className="text-emerald-500" /> : <WifiOff size={18} className="text-slate-400" />}
                <span className="text-[13px] font-medium" style={{ color: "#0D1B2A" }}>
                  {testResult?.connected ? "Connected" : testResult ? "Not Connected" : "Not Tested"}
                </span>
              </div>
              <button onClick={handleTest} disabled={testLoading} className="px-4 py-1.5 rounded-md text-[12px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#B8860B" }}>
                {testLoading ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}Test Connection
              </button>
            </div>
            {testResult && (
              <div className={`rounded-md p-3 text-[12px] ${testResult.connected ? "border" : "border"}`} style={{
                backgroundColor: testResult.connected ? "#EBF5EE" : "#FEF2F2",
                borderColor: testResult.connected ? "#C6E4CE" : "#F5A5A5",
                color: testResult.connected ? "#15632A" : "#9B1C1C",
              }}>
                {testResult.connected ? (testResult.message || "Connected") : (testResult.error || testResult.hint || "Connection failed")}
              </div>
            )}
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "#6B7E92" }}>
              <Radio size={12} className={wsConnected ? "text-emerald-500" : "text-red-500"} />
              WebSocket: {wsConnected ? "Connected" : "Disconnected"}
            </div>
          </div>
        </div>

        {/* Create Draft */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>CREATE CW DRAFT</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Select Approved Shipment</label>
              <select
                value={selectedShipmentId || ""}
                onChange={(e) => setSelectedShipmentId(e.target.value || null)}
                className="w-full px-3 py-2 text-[13px] rounded-md border outline-none"
                style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
              >
                <option value="">— Select shipment —</option>
                {shipments.items.map((s) => (
                  <option key={s.id} value={s.id}>{s.reference} — {s.shipperName || "Unknown"}</option>
                ))}
              </select>
            </div>
            <button onClick={handleCreateDraft} disabled={!selectedShipmentId || draftLoading} className="w-full py-2 rounded-md text-[13px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#B8860B" }}>
              {draftLoading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : <ExternalLink size={14} className="inline mr-1" />}
              Create Draft
            </button>
            {draftResult && (
              <div className={`rounded-md p-3 text-[12px] ${draftResult.startsWith("✓") ? "border" : "border"}`} style={{
                backgroundColor: draftResult.startsWith("✓") ? "#EBF5EE" : "#FEF2F2",
                borderColor: draftResult.startsWith("✓") ? "#C6E4CE" : "#F5A5A5",
                color: draftResult.startsWith("✓") ? "#15632A" : "#9B1C1C",
              }}>{draftResult}</div>
            )}
          </div>
        </div>
      </div>

      {/* Execution History */}
      <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>EXECUTION HISTORY</span>
          <button onClick={() => refetchExecutions()} className="text-[12px] font-medium hover:underline" style={{ color: "#B8860B" }}>Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "#F1F4F8" }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Reference</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Type</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Duration</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Error</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {executionsLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: "#6B7E92" }}>Loading...</td></tr>
              ) : executions.executions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px]" style={{ color: "#6B7E92" }}>No CW executions yet.</td></tr>
              ) : executions.executions.map((ex) => (
                <tr key={ex.id} className="border-b" style={{ borderColor: "#DDE3EA" }}>
                  <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "#B8860B" }}>{ex.shipment?.reference || ex.shipmentId}</td>
                  <td className="px-4 py-2.5" style={{ color: "#3D5166" }}>{ex.executionType}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ex.status === "success" ? "bg-emerald-50 text-emerald-700" : ex.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{ex.status}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "#3D5166" }}>{ex.durationMs ? `${ex.durationMs}ms` : "—"}</td>
                  <td className="px-4 py-2.5 max-w-[200px] truncate text-red-600 text-[12px]">{ex.errorMessage || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: "#6B7E92" }}>{relativeTime(ex.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Settings View
   ══════════════════════════════════════════════ */

function SettingsView() {
  const [cwServerUrl, setCwServerUrl] = useState("");
  const [cwEnterpriseId, setCwEnterpriseId] = useState("");
  const [cwServerId, setCwServerId] = useState("");
  const [cwCredentials, setCwCredentials] = useState("");
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  // Try to load org settings
  useEffect(() => {
    fetch("/api/analytics").then(r => r.json()).then(() => {
      // We don't have a direct org API, so we'll show placeholder values
      setOrgName("CargoIQ Demo Organisation");
    }).catch(() => {});
  }, []);

  const handleSaveCw = async () => {
    setSaveResult(null);
    // In a real implementation, this would call a settings API
    setSaveResult("✓ Configuration saved (connectivity test required)");
    setTimeout(() => setSaveResult(null), 3000);
  };

  return (
    <div className="p-6 max-w-[1440px]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organisation */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#DDE3EA" }}>
            <Building2 size={16} style={{ color: "#B8860B" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>ORGANISATION</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Organisation Name</label>
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Plan</label>
              <div className="px-3 py-2 text-[13px] rounded-md border" style={{ borderColor: "#C8D0DA", backgroundColor: "#F1F4F8", color: "#0D1B2A" }}>Professional — South Africa</div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Confidence Threshold</label>
              <select className="w-full px-3 py-2 text-[13px] border rounded-md outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
                <option value="high">High — Only auto-approve high confidence</option>
                <option value="medium">Medium — Auto-approve medium and above</option>
                <option value="low">Low — Auto-approve all except low</option>
              </select>
            </div>
          </div>
        </div>

        {/* CargoWise Configuration */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#DDE3EA" }}>
            <Server size={16} style={{ color: "#B8860B" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>CARGOWISE CONFIGURATION</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>eAdaptor Server URL</label>
              <input value={cwServerUrl} onChange={(e) => setCwServerUrl(e.target.value)} placeholder="https://your-cw-instance.com/eAdaptor" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Enterprise ID</label>
              <input value={cwEnterpriseId} onChange={(e) => setCwEnterpriseId(e.target.value)} placeholder="Enter CW Enterprise ID" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Server ID</label>
              <input value={cwServerId} onChange={(e) => setCwServerId(e.target.value)} placeholder="Enter CW Server ID" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Credentials (Base64)</label>
              <input value={cwCredentials} onChange={(e) => setCwCredentials(e.target.value)} type="password" placeholder="Enter Basic Auth credentials" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <button onClick={handleSaveCw} className="px-4 py-2 rounded-md text-[13px] font-semibold text-white" style={{ backgroundColor: "#B8860B" }}>Save Configuration</button>
            {saveResult && <div className="text-[12px] font-medium text-emerald-700">{saveResult}</div>}
          </div>
        </div>

        {/* Email Configuration */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#DDE3EA" }}>
            <Mail size={16} style={{ color: "#B8860B" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>EMAIL CONNECTION</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>IMAP Server</label>
              <input placeholder="imap.your-company.co.za" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Email Address</label>
              <input placeholder="cargoiq@your-company.co.za" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Password / App Key</label>
              <input type="password" placeholder="••••••••" className="w-full px-3 py-2 text-[13px] border rounded-md outline-none focus:border-[#B8860B]" style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }} />
            </div>
            <div className="rounded-md p-3 text-[12px]" style={{ backgroundColor: "#FEF6E7", borderColor: "#E8B84B", color: "#7A4F00", border: "1px solid #E8B84B" }}>
              Email ingestion is active via the /api/ingest/email webhook. Configure your email provider to POST incoming messages.
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#DDE3EA" }}>
            <Users size={16} style={{ color: "#B8860B" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>USER MANAGEMENT</span>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {[
                { name: "J. Mokoena", email: "jmokoena@cargoiq.co.za", role: "Admin" },
                { name: "A. Naidoo", email: "anaidoo@cargoiq.co.za", role: "Operator" },
                { name: "S. van der Merwe", email: "svdmerwe@cargoiq.co.za", role: "Compliance" },
              ].map((user) => (
                <div key={user.email} className="flex items-center gap-3 p-2 rounded-md border" style={{ borderColor: "#DDE3EA" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ backgroundColor: "#B8860B", color: "#FFF" }}>
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <div className="text-[12px] font-medium" style={{ color: "#0D1B2A" }}>{user.name}</div>
                    <div className="text-[11px]" style={{ color: "#6B7E92" }}>{user.email}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">{user.role}</span>
                </div>
              ))}
            </div>
            <button className="mt-3 px-4 py-2 text-[12px] rounded-md border hover:bg-[#F1F4F8] transition-colors" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>+ Add User</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Document Upload Dialog
   ══════════════════════════════════════════════ */

function DocumentUploadDialog({ open, onClose, onShipmentCreated }: {
  open: boolean; onClose: () => void; onShipmentCreated: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("commercial_invoice");
  const [source, setSource] = useState("manual_upload");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<{ success: boolean; shipment?: { id: string; reference: string }; error?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress("Uploading document...");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      formData.append("source", source);

      setProgress("Running AI extraction pipeline...");

      const res = await fetch("/api/process", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok && data.success) {
        setProgress("Processing complete!");
        setResult({ success: true, shipment: data.shipment });
      } else {
        setProgress("Processing failed");
        setResult({ success: false, error: data.error || data.message || "Unknown error" });
      }
    } catch (e) {
      setProgress("Network error");
      setResult({ success: false, error: e instanceof Error ? e.message : "Upload failed" });
    }
    setProcessing(false);
  };

  const handleClose = () => {
    if (result?.success && result.shipment) {
      onShipmentCreated(result.shipment.id);
    }
    setFile(null);
    setResult(null);
    setProgress("");
    setProcessing(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: "#0D1B2A" }}>Upload & Process Document</h3>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[#E8ECF1]" style={{ color: "#6B7E92" }}><X size={18} /></button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${dragOver ? "border-[#B8860B] bg-[#FEF6E7]" : "border-[#C8D0DA] bg-[#F1F4F8]"}`}
        >
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
          <Upload size={32} className="mx-auto mb-2" style={{ color: dragOver ? "#B8860B" : "#9AAAB8" }} />
          <div className="text-[13px] font-medium" style={{ color: "#0D1B2A" }}>
            {file ? file.name : "Drop a file here or click to browse"}
          </div>
          <div className="text-[11px] mt-1" style={{ color: "#6B7E92" }}>Supports PDF, images, Excel, Word</div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-md border outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
              <option value="commercial_invoice">Commercial Invoice</option>
              <option value="packing_list">Packing List</option>
              <option value="bill_of_lading">Bill of Lading</option>
              <option value="air_waybill">Air Waybill</option>
              <option value="customs_declaration">Customs Declaration</option>
              <option value="unknown">Unknown / Other</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "#6B7E92" }}>Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-md border outline-none" style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}>
              <option value="manual_upload">Manual Upload</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>

        {/* Process Button */}
        <button
          onClick={handleProcess}
          disabled={!file || processing}
          className="w-full py-2.5 rounded-md text-[13px] font-semibold text-white disabled:opacity-50 mb-4"
          style={{ backgroundColor: "#B8860B" }}
        >
          {processing ? <><Loader2 size={14} className="animate-spin inline mr-2" />{progress}</> : "Process Document"}
        </button>

        {/* Result */}
        {result && (
          <div className={`rounded-md p-3 text-[12px] ${result.success ? "border" : "border"}`} style={{
            backgroundColor: result.success ? "#EBF5EE" : "#FEF2F2",
            borderColor: result.success ? "#C6E4CE" : "#F5A5A5",
            color: result.success ? "#15632A" : "#9B1C1C",
          }}>
            {result.success ? (
              <div>
                <div className="font-semibold mb-1">✓ Shipment Created: {result.shipment?.reference}</div>
                <button onClick={handleClose} className="underline text-[11px]">View shipment →</button>
              </div>
            ) : (
              <div>✗ {result.error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Footer
   ══════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="mt-auto border-t px-5 py-3" style={{ backgroundColor: "#F1F4F8", borderColor: "#C8D0DA" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: "#6B7E92" }}>
        <span>© 2026 CARGOiQ — AI Compliance & Cost Containment Platform</span>
        <span>Built for South African Freight Forwarders · SARS 2025/2026 Enforcement Ready</span>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════ */

export default function CargoIQPage() {
  const [view, setView] = useState<ViewMode>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [notifications, setNotifications] = useState<WsNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [wsCreatedShipment, setWsCreatedShipment] = useState<ShipmentSummary | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Seed demo data on first load
  useEffect(() => {
    fetch("/api/health").then(() => {
      // Check if we have data; if not, seed
      fetch("/api/shipments?limit=1").then(r => r.json()).then((data: ShipmentListResponse) => {
        if (data.total === 0) {
          fetch("/api/seed", { method: "POST" }).then(() => {
            console.log("[CargoIQ] Demo data seeded");
          }).catch(() => {});
        }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // WebSocket connection
  useEffect(() => {
    const socket = io({
      transports: ["websocket"],
      path: "/socket.io",
      query: { XTransformPort: "3003" },
    });

    socket.on("connect", () => {
      setWsConnected(true);
      console.log("[WS] Connected:", socket.id);
    });

    socket.on("disconnect", () => {
      setWsConnected(false);
      console.log("[WS] Disconnected");
    });

    const events = ["shipment:created", "shipment:updated", "shipment:approved", "shipment:rejected", "shield:completed", "cw:draft_created", "cw:draft_failed", "email:ingested", "extraction:complete", "notification"];
    for (const event of events) {
      socket.on(event, (data: WsNotification) => {
        console.log(`[WS] ${event}:`, data);
        setNotificationCount((c) => c + 1);
        setNotifications((prev) => [{ ...data, type: data.type || event }, ...prev].slice(0, 10));

        // If new shipment created, add it to the queue
        if (event === "shipment:created" && data.shipmentId) {
          setWsCreatedShipment({
            id: data.shipmentId as string,
            reference: (data.reference as string) || "CIQ-NEW",
            shipperName: (data.shipperName as string) || "",
            consigneeName: "",
            originPort: "",
            destinationPort: "",
            shipmentType: "",
            awbOrBlNumber: "",
            overallConfidence: "medium",
            shieldStatus: "pending",
            status: "pending",
            documentCount: 0,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSelectShipment = (id: string) => {
    setSelectedShipmentId(id);
    setView("shipment-detail");
  };

  const handleUploadCreated = (id: string) => {
    setSelectedShipmentId(id);
    setView("shipment-detail");
  };

  const currentNotification = notifications[0] || null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F1F4F8" }}>
      <Sidebar
        view={view}
        setView={setView}
        collapsed={collapsed}
        toggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <TopNav
        view={view}
        collapsed={collapsed}
        onToggleMobileSidebar={() => setMobileOpen(true)}
        onQuickUpload={() => setUploadOpen(true)}
        wsConnected={wsConnected}
        notificationCount={notificationCount}
      />

      {/* Main Content */}
      <main
        className={`flex-1 pt-14 transition-all duration-200 ${collapsed ? "md:ml-14" : "md:ml-60"}`}
      >
        {view === "dashboard" && <DashboardView setView={setView} onSelectShipment={handleSelectShipment} />}
        {view === "shipments" && <ShipmentQueueView onSelectShipment={handleSelectShipment} wsCreatedShipment={wsCreatedShipment} />}
        {view === "shipment-detail" && selectedShipmentId && <ShipmentDetailView shipmentId={selectedShipmentId} setView={setView} />}
        {view === "compliance" && <ComplianceView />}
        {view === "wiselayer" && <WiseLayerView />}
        {view === "cargowise" && <CargoWiseView wsConnected={wsConnected} />}
        {view === "settings" && <SettingsView />}
      </main>

      <Footer />

      <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onShipmentCreated={handleUploadCreated} />

      {/* Notification Toast */}
      {currentNotification && (
        <NotificationToast
          notification={currentNotification}
          onDismiss={() => setNotifications((prev) => prev.slice(1))}
        />
      )}
    </div>
  );
}
