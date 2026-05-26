"use client";

import { useState, useMemo } from "react";
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
  User,
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
  TrendingDown,
  DollarSign,
  Zap,
  AlertCircle,
  Menu,
  ArrowRight,
  Wifi,
  WifiOff,
  Play,
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

/* ══════════════════════════════════════════════
   Mock Data
   ══════════════════════════════════════════════ */

const shipments: ShipmentSummary[] = [
  { id: "1", reference: "CIQ-2026-00047", shipperName: "Shanghai Global Trading Co.", consigneeName: "ABC Logistics SA", originPort: "CNSHA", destinationPort: "ZADUR", shipmentType: "fcl_import", awbOrBlNumber: "MAEU123456789", overallConfidence: "high", shieldStatus: "pass", status: "cw_draft_created", documentCount: 3, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "2", reference: "CIQ-2026-00046", shipperName: "Dubai Freight Services LLC", consigneeName: "Santova Logistics", originPort: "AEDXB", destinationPort: "ZACPT", shipmentType: "air_import", awbOrBlNumber: "074-12345678", overallConfidence: "high", shieldStatus: "pass", status: "approved", documentCount: 2, createdAt: new Date(Date.now() - 3.5 * 3600000).toISOString() },
  { id: "3", reference: "CIQ-2026-00045", shipperName: "Kuehne + Nagel Shenzhen", consigneeName: "Megafreight Services", originPort: "CNSZX", destinationPort: "ZADUR", shipmentType: "lcl_import", awbOrBlNumber: "COSCO987654321", overallConfidence: "medium", shieldStatus: "hold", status: "review_required", documentCount: 2, createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: "4", reference: "CIQ-2026-00044", shipperName: "India Exports Mumbai", consigneeName: "NATCO Logistics", originPort: "INBOM", destinationPort: "ZADUR", shipmentType: "fcl_import", awbOrBlNumber: "MSCIM987654321", overallConfidence: "low", shieldStatus: "fail", status: "review_required", documentCount: 1, createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: "5", reference: "CIQ-2026-00043", shipperName: "UK Manufacturing Ltd", consigneeName: "CFR Freight SA", originPort: "GBFXT", destinationPort: "ZACPT", shipmentType: "air_import", awbOrBlNumber: "057-98765432", overallConfidence: "high", shieldStatus: "pass", status: "pending", documentCount: 3, createdAt: new Date(Date.now() - 8 * 3600000).toISOString() },
  { id: "6", reference: "CIQ-2026-00042", shipperName: "German Automotive GmbH", consigneeName: "Rohlig-Grindrod", originPort: "DEHAM", destinationPort: "ZADUR", shipmentType: "fcl_import", awbOrBlNumber: "HLCU456789123", overallConfidence: "medium", shieldStatus: "hold", status: "review_required", documentCount: 2, createdAt: new Date(Date.now() - 10 * 3600000).toISOString() },
  { id: "7", reference: "CIQ-2026-00041", shipperName: "Brazil Coffee Exporters", consigneeName: "Africa Global Logistics SA", originPort: "BRSSZ", destinationPort: "ZADUR", shipmentType: "fcl_import", awbOrBlNumber: "CSAV789123456", overallConfidence: "high", shieldStatus: "pass", status: "cw_draft_created", documentCount: 4, createdAt: new Date(Date.now() - 12 * 3600000).toISOString() },
  { id: "8", reference: "CIQ-2026-00040", shipperName: "Japan Electronics Corp", consigneeName: "DSV SA", originPort: "JPYOK", destinationPort: "ZACPT", shipmentType: "air_import", awbOrBlNumber: "618-12345675", overallConfidence: "high", shieldStatus: "pass", status: "approved", documentCount: 2, createdAt: new Date(Date.now() - 14 * 3600000).toISOString() },
  { id: "9", reference: "CIQ-2026-00039", shipperName: "Mozambique Commodities", consigneeName: "Transglobal Cargo", originPort: "MZMPM", destinationPort: "ZADUR", shipmentType: "fcl_import", awbOrBlNumber: "MSCM987123456", overallConfidence: "medium", shieldStatus: "hold", status: "pending", documentCount: 1, createdAt: new Date(Date.now() - 18 * 3600000).toISOString() },
  { id: "10", reference: "CIQ-2026-00038", shipperName: "Australia Mining Supplies", consigneeName: "Spectrum Freight SA", originPort: "AUBNE", destinationPort: "ZADUR", shipmentType: "fcl_import", awbOrBlNumber: "ANL456789123", overallConfidence: "low", shieldStatus: "fail", status: "error", documentCount: 2, createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
];

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

function formatZAR(n: number) {
  return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ShieldBadge({ status }: { status: ShieldStatus }) {
  const map: Record<ShieldStatus, { bg: string; text: string; label: string }> = {
    pass: { bg: "bg-emerald-50", text: "text-emerald-700", label: "PASS" },
    hold: { bg: "bg-amber-50", text: "text-amber-700", label: "HOLD" },
    fail: { bg: "bg-red-50", text: "text-red-700", label: "FAIL" },
    pending: { bg: "bg-slate-100", text: "text-slate-500", label: "PENDING" },
  };
  const s = map[status];
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
    in_cargowise: { bg: "bg-sky-50", text: "text-sky-700", label: "In CW" },
    cw_draft_created: { bg: "bg-violet-50", text: "text-violet-700", label: "CW Draft" },
    error: { bg: "bg-red-50", text: "text-red-700", label: "Error" },
  };
  const s = map[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const map: Record<Confidence, { text: string; dot: string }> = {
    high: { text: "text-emerald-600", dot: "bg-emerald-500" },
    medium: { text: "text-amber-600", dot: "bg-amber-500" },
    low: { text: "text-red-600", dot: "bg-red-500" },
  };
  const s = map[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
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
      style={{
        width: collapsed ? 56 : 240,
        backgroundColor: "#1A2332",
        borderColor: "#243040",
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b" style={{ borderColor: "#243040" }}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/cargoiq-logo.jpg"
            alt="CargoIQ"
            className="flex-shrink-0 rounded"
            style={{ width: 28, height: 28, objectFit: "cover" }}
          />
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#243040 transparent" }}>
        {sections.map((sec) => (
          <div key={sec.label} className="mb-3">
            {!collapsed && (
              <div className="px-5 mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>
                {sec.label}
              </div>
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

      {/* Collapse toggle — desktop only */}
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
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed top-0 left-0 bottom-0 z-40">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={onMobileClose}
          />
          {/* Sidebar panel */}
          <div className="relative z-10 h-full" style={{ width: 240 }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════
   Top Nav
   ══════════════════════════════════════════════ */

function TopNav({ view, collapsed, onToggleMobileSidebar, onQuickUpload }: {
  view: ViewMode; collapsed: boolean; onToggleMobileSidebar: () => void; onQuickUpload: () => void;
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
      style={{
        left: 0,
        backgroundColor: "#FFFFFF",
        borderColor: "#C8D0DA",
      }}
    >
      {/* Mobile hamburger */}
      <button
        className="md:hidden p-1.5 rounded hover:bg-[#E8ECF1] transition-colors"
        style={{ color: "#6B7E92" }}
        onClick={onToggleMobileSidebar}
      >
        <Menu size={20} />
      </button>
      <h2 className="text-[15px] font-semibold truncate" style={{ color: "#0D1B2A" }}>{viewLabels[view]}</h2>
      <div className="flex-1" />
      <div className="relative hidden sm:block">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#9AAAB8" }} />
        <input
          placeholder="Search shipments..."
          className="pl-8 pr-3 py-1.5 text-[13px] rounded border outline-none transition-colors focus:border-[#B8860B] focus:ring-2 focus:ring-[#FDF3DC]"
          style={{ width: 220, borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#F1F4F8" }}
        />
      </div>
      {/* Quick Upload button */}
      <button
        onClick={onQuickUpload}
        className="p-1.5 rounded hover:bg-[#E8ECF1] transition-colors"
        style={{ color: "#6B7E92" }}
        title="Quick Upload"
      >
        <Upload size={18} />
      </button>
      <button className="relative p-1.5 rounded hover:bg-[#E8ECF1] transition-colors" style={{ color: "#6B7E92" }}>
        <Bell size={18} />
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
      </button>
      <div className="hidden sm:flex items-center gap-2 pl-2 border-l" style={{ borderColor: "#C8D0DA" }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: "#B8860B", color: "#FFF" }}>
          JM
        </div>
        <span className="text-[13px] font-medium" style={{ color: "#0D1B2A" }}>J. Mokoena</span>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════
   Dashboard View
   ══════════════════════════════════════════════ */

function DashboardView({ setView }: { setView: (v: ViewMode) => void }) {
  const kpis = [
    { label: "Processed Today", value: "847", change: "+12%", up: true, icon: FileText, color: "#1A4971", bg: "#EBF3FB" },
    { label: "Automation Rate", value: "82%", change: "+3.2%", up: true, icon: Zap, color: "#15632A", bg: "#EBF5EE" },
    { label: "Avg Processing", value: "3m 34s", change: "-18%", up: true, icon: Clock, color: "#7A4F00", bg: "#FEF6E7" },
    { label: "Shield Exceptions", value: "112", change: "+5", up: false, icon: AlertTriangle, color: "#9B1C1C", bg: "#FEF2F2" },
  ];

  const shieldSummary = [
    { label: "Pass", count: 612, color: "bg-emerald-500", pct: 72 },
    { label: "Hold", count: 89, color: "bg-amber-500", pct: 10 },
    { label: "Fail", count: 23, color: "bg-red-500", pct: 3 },
    { label: "Pending", count: 123, color: "bg-slate-400", pct: 15 },
  ];

  const pipelineSteps = [
    { label: "Email", count: 142, status: "active" as const, icon: "📧" },
    { label: "Classify", count: 98, status: "active" as const, icon: "🏷️" },
    { label: "Extract", count: 87, status: "active" as const, icon: "📄" },
    { label: "Shield", count: 72, status: "complete" as const, icon: "🛡️" },
    { label: "Review", count: 15, status: "pending" as const, icon: "👁️" },
    { label: "CW", count: 8, status: "pending" as const, icon: "🔗" },
  ];

  return (
    <div className="p-6 max-w-[1440px]">
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
                  <span className="text-[11px] font-semibold" style={{ color: step.status === "active" ? "#1A4971" : step.status === "complete" ? "#15632A" : "#6B7E92" }}>
                    {step.label}
                  </span>
                  <span className="text-[16px] font-bold" style={{ color: "#0D1B2A" }}>{step.count}</span>
                  <span
                    className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                    style={{
                      color: step.status === "active" ? "#1A4971" : step.status === "complete" ? "#15632A" : "#6B7E92",
                      backgroundColor: step.status === "active" ? "#D6E8F7" : step.status === "complete" ? "#C6E4CE" : "#E8ECF1",
                    }}
                  >
                    {step.status}
                  </span>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight size={16} className="flex-shrink-0" style={{ color: "#9AAAB8" }} />
                )}
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
                {shipments.slice(0, 6).map((s) => (
                  <tr key={s.id} className="border-b hover:bg-[#F1F4F8] transition-colors cursor-pointer" style={{ borderColor: "#DDE3EA" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#0D1B2A" }}>
                      <span className="font-mono text-[12px]">{s.reference}</span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#3D5166" }}>
                      {s.originPort} → {s.destinationPort}
                    </td>
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
          <div className="px-4 pb-4">
            <div className="rounded-md p-3 text-[12px]" style={{ backgroundColor: "#FEF6E7", borderColor: "#E8B84B", color: "#7A4F00", border: "1px solid #E8B84B" }}>
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <AlertTriangle size={13} />
                89 shipments on HOLD
              </div>
              <div style={{ color: "#7A4F00", opacity: 0.8 }}>Requires manual review before CargoWise submission</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Shipment Queue View
   ══════════════════════════════════════════════ */

function ShipmentQueueView({ onSelectShipment }: { onSelectShipment: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shieldFilter, setShieldFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (shieldFilter !== "all" && s.shieldStatus !== shieldFilter) return false;
      if (search && !s.reference.toLowerCase().includes(search.toLowerCase()) && !s.shipperName.toLowerCase().includes(search.toLowerCase()) && !s.consigneeName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [statusFilter, shieldFilter, search]);

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#9AAAB8" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, shipper, consignee..."
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-md border outline-none transition-colors focus:border-[#B8860B] focus:ring-2 focus:ring-[#FDF3DC]"
            style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-[13px] rounded-md border outline-none"
          style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="review_required">Review Required</option>
          <option value="approved">Approved</option>
          <option value="cw_draft_created">CW Draft</option>
          <option value="error">Error</option>
        </select>
        <select
          value={shieldFilter}
          onChange={(e) => setShieldFilter(e.target.value)}
          className="px-3 py-2 text-[13px] rounded-md border outline-none"
          style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
        >
          <option value="all">All Shield</option>
          <option value="pass">Pass</option>
          <option value="hold">Hold</option>
          <option value="fail">Fail</option>
          <option value="pending">Pending</option>
        </select>
        <div className="ml-auto text-[12px]" style={{ color: "#6B7E92" }}>
          {filtered.length} shipment{filtered.length !== 1 ? "s" : ""}
        </div>
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
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectShipment(s.id)}
                  className="border-b hover:bg-[#F1F4F8] transition-colors cursor-pointer"
                  style={{ borderColor: "#DDE3EA" }}
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] font-medium" style={{ color: "#B8860B" }}>{s.reference}</td>
                  <td className="px-4 py-2.5" style={{ color: "#0D1B2A" }}>{s.shipperName}</td>
                  <td className="px-4 py-2.5" style={{ color: "#3D5166" }}>{s.originPort} → {s.destinationPort}</td>
                  <td className="px-4 py-2.5 capitalize" style={{ color: "#3D5166" }}>{s.shipmentType.replace("_", " ")}</td>
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
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Shipment Detail View
   ══════════════════════════════════════════════ */

function ShipmentDetailView({ shipmentId, setView }: { shipmentId: string | null; setView: (v: ViewMode) => void }) {
  const s = shipments.find((x) => x.id === shipmentId) || shipments[0];

  const shieldModules = [
    { name: "Invoice / PL Cross-Reference", result: s.shieldStatus === "fail" ? "fail" as ShieldStatus : "pass" as ShieldStatus, detail: s.shieldStatus === "fail" ? "Weight mismatch: Invoice 12,500 kg vs PL 13,280 kg" : "All values reconciled" },
    { name: "HS Code Validation (8-digit)", result: s.shieldStatus === "hold" ? "hold" as ShieldStatus : "pass" as ShieldStatus, detail: s.shieldStatus === "hold" ? "No HS code provided for line item 2" : "5 valid codes verified" },
    { name: "SACU / Non-SACU VAT Engine", result: "pass" as ShieldStatus, detail: formatZAR(22031.25) + " VAT calculated" },
  ];

  const lineItems = [
    { hsCode: "8471300000", desc: "Laptop Computers", qty: 500, unit: "PCS", value: 425000 },
    { hsCode: "8517620000", desc: "Network Routers", qty: 200, unit: "PCS", value: 64000 },
    { hsCode: "8504403000", desc: "Power Supply Units", qty: 1000, unit: "PCS", value: 45000 },
    { hsCode: "8544429000", desc: "Cable Assemblies", qty: 5000, unit: "M", value: 16000 },
    { hsCode: "8473300000", desc: "Computer Parts", qty: 300, unit: "KG", value: 36000 },
  ];

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView("shipments")} className="text-[13px] font-medium hover:underline" style={{ color: "#B8860B" }}>
          ← Back to Queue
        </button>
        <span style={{ color: "#C8D0DA" }}>|</span>
        <span className="font-mono text-[15px] font-semibold" style={{ color: "#0D1B2A" }}>{s.reference}</span>
        <ShieldBadge status={s.shieldStatus} />
        <StatusBadge status={s.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Shipment Info + Line Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Shipment Info */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>SHIPMENT DETAILS</span>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-[13px]">
              {[
                { label: "Shipper", value: s.shipperName },
                { label: "Consignee", value: s.consigneeName },
                { label: "Route", value: `${s.originPort} → ${s.destinationPort}` },
                { label: "BL/AWB", value: s.awbOrBlNumber },
                { label: "Type", value: s.shipmentType.replace("_", " ") },
                { label: "Incoterms", value: "CIF" },
                { label: "Vessel/Flight", value: "MSC ISABELLA" },
                { label: "ETA", value: "2026-06-15" },
                { label: "Invoice Value", value: "$586,000.00" },
                { label: "Gross Weight", value: "4,540 KGS" },
                { label: "Packages", value: "45" },
                { label: "Confidence", value: s.overallConfidence },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "#6B7E92" }}>{item.label}</div>
                  <div className="font-medium" style={{ color: "#0D1B2A" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>LINE ITEMS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ backgroundColor: "#F1F4F8" }}>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>HS Code</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Description</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Qty</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Unit</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Value (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "#DDE3EA" }}>
                      <td className="px-4 py-2 font-mono text-[12px]" style={{ color: "#1A4971" }}>{li.hsCode}</td>
                      <td className="px-4 py-2" style={{ color: "#0D1B2A" }}>{li.desc}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#3D5166" }}>{li.qty.toLocaleString()}</td>
                      <td className="px-4 py-2" style={{ color: "#3D5166" }}>{li.unit}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium" style={{ color: "#0D1B2A" }}>${li.value.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#F1F4F8" }}>
                    <td colSpan={4} className="px-4 py-2 text-right font-semibold" style={{ color: "#3D5166" }}>Total</td>
                    <td className="px-4 py-2 text-right font-mono font-bold" style={{ color: "#0D1B2A" }}>$586,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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
                <div key={m.name} className="rounded-md border p-3" style={{ borderColor: "#DDE3EA" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: "#0D1B2A" }}>{m.name}</span>
                    <ShieldBadge status={m.result} />
                  </div>
                  <p className="text-[12px]" style={{ color: "#6B7E92" }}>{m.detail}</p>
                </div>
              ))}
              {s.shieldStatus === "fail" && (
                <div className="rounded-md p-3 text-[12px] font-medium" style={{ backgroundColor: "#FEF2F2", border: "1px solid #F5A5A5", color: "#9B1C1C" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ban size={13} />
                    CargoWise submission BLOCKED
                  </div>
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
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: s.shieldStatus === "fail" ? "#9AAAB8" : "#B8860B" }}
                disabled={s.shieldStatus === "fail"}
              >
                <ExternalLink size={14} />
                Create CW Draft
              </button>
              <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium border transition-colors hover:bg-[#F1F4F8]" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>
                <Eye size={14} />
                Review Documents
              </button>
              <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium border transition-colors hover:bg-[#F1F4F8]" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>
                <RefreshCw size={14} />
                Re-run Shield
              </button>
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>DOCUMENTS</span>
            </div>
            <div className="p-4 space-y-2">
              {["Commercial_Invoice_SINV-2026-04287.pdf", "Packing_List_PL-2026-04287.pdf", "Bill_of_Lading_MAEU123456789.pdf"].map((doc) => (
                <div key={doc} className="flex items-center gap-2 p-2 rounded-md hover:bg-[#F1F4F8] transition-colors cursor-pointer">
                  <FileText size={14} style={{ color: "#9B1C1C" }} />
                  <span className="text-[12px] truncate" style={{ color: "#0D1B2A" }}>{doc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Compliance View
   ══════════════════════════════════════════════ */

function ComplianceView() {
  const recentEvents = [
    { ref: "CIQ-2026-00044", module: "Invoice/PL", result: "fail" as ShieldStatus, detail: "Weight mismatch: 12,500 vs 13,280 kg", time: "6h ago", risk: true },
    { ref: "CIQ-2026-00045", module: "HS Code", result: "hold" as ShieldStatus, detail: "Missing HS code on line item 2", time: "5h ago", risk: false },
    { ref: "CIQ-2026-00047", module: "VAT Engine", result: "pass" as ShieldStatus, detail: formatZAR(22031.25) + " VAT calculated correctly", time: "2h ago", risk: false },
    { ref: "CIQ-2026-00038", module: "Invoice/PL", result: "fail" as ShieldStatus, detail: "Value mismatch: Invoice $42K vs PL $48K", time: "24h ago", risk: true },
    { ref: "CIQ-2026-00041", module: "HS Code", result: "pass" as ShieldStatus, detail: "4 valid HS codes verified", time: "12h ago", risk: false },
    { ref: "CIQ-2026-00039", module: "VAT Engine", result: "hold" as ShieldStatus, detail: "SACU origin unclear — manual check needed", time: "18h ago", risk: false },
  ];

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Upload Zone */}
      <div className="rounded-lg border-2 border-dashed p-8 mb-6 flex flex-col items-center justify-center cursor-pointer hover:bg-[#F8FAFB] transition-colors" style={{ borderColor: "#C8D0DA", backgroundColor: "#FFFFFF" }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "#EBF3FB" }}>
          <Upload size={24} style={{ color: "#1A4971" }} />
        </div>
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: "#0D1B2A" }}>Upload Documents for Compliance Check</h3>
        <p className="text-[13px] mb-3" style={{ color: "#6B7E92" }}>Drop invoices, packing lists, or bills of lading — PDF, Excel, or images</p>
        <span className="px-4 py-2 rounded-md text-[13px] font-semibold text-white" style={{ backgroundColor: "#B8860B" }}>
          Browse Files
        </span>
      </div>

      {/* Recent Events */}
      <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>RECENT COMPLIANCE EVENTS</span>
        </div>
        <div className="divide-y" style={{ borderColor: "#DDE3EA" }}>
          {recentEvents.map((evt, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-[#F1F4F8] transition-colors">
              <div className="flex-shrink-0">
                {evt.result === "pass" ? <CheckCircle2 size={18} className="text-emerald-600" /> : evt.result === "hold" ? <AlertCircle size={18} className="text-amber-600" /> : <XCircle size={18} className="text-red-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[12px] font-medium" style={{ color: "#B8860B" }}>{evt.ref}</span>
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "#E8ECF1", color: "#3D5166" }}>{evt.module}</span>
                  {evt.risk && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF2F2" }}>
                      <AlertTriangle size={10} /> PENALTY RISK
                    </span>
                  )}
                </div>
                <p className="text-[12px] truncate" style={{ color: "#6B7E92" }}>{evt.detail}</p>
              </div>
              <ShieldBadge status={evt.result} />
              <span className="text-[11px] flex-shrink-0" style={{ color: "#9AAAB8" }}>{evt.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   WiseLayer View
   ══════════════════════════════════════════════ */

function WiseLayerView() {
  const [rlaLastChecked, setRlaLastChecked] = useState<string>("2026-03-04 09:42 SAST");
  const [rlaChecking, setRlaChecking] = useState(false);

  const kpis = [
    { label: "Total WiseTech Fees", value: formatZAR(428500), change: "+8%", up: true, icon: DollarSign, color: "#9B1C1C", bg: "#FEF2F2" },
    { label: "Savings This Month", value: formatZAR(127400), change: "+22%", up: true, icon: TrendingDown, color: "#15632A", bg: "#EBF5EE" },
    { label: "RLA Monitored", value: "5", change: "1 at risk", up: false, icon: AlertTriangle, color: "#7A4F00", bg: "#FEF6E7" },
    { label: "Active Alerts", value: "3", change: "", up: false, icon: Bell, color: "#1A4971", bg: "#EBF3FB" },
  ];

  const rlaData = [
    { code: "50123456789", name: "ABC Logistics SA", status: "active" },
    { code: "50987654321", name: "XYZ Imports (Pty) Ltd", status: "active" },
    { code: "50456789012", name: "DEF Trading CC", status: "suspended" },
    { code: "50321654987", name: "GHI Exports International", status: "active" },
    { code: "50789456123", name: "JKL Freight Solutions", status: "inactive" },
  ];

  // Simple bar chart representation
  const chartData = Array.from({ length: 14 }, (_, i) => ({
    label: `Day ${i + 1}`,
    fees: 80 + Math.floor(Math.random() * 60),
    saved: 40 + Math.floor(Math.random() * 40),
  }));
  const maxVal = Math.max(...chartData.map((d) => d.fees));

  // Transaction Compaction data
  const compactionData = [
    { date: "2026-03-04", origTx: 847, compactedTx: 312, saved: 535, estSaving: 2675.00 },
    { date: "2026-03-03", origTx: 912, compactedTx: 298, saved: 614, estSaving: 3070.00 },
    { date: "2026-03-02", origTx: 756, compactedTx: 287, saved: 469, estSaving: 2345.00 },
    { date: "2026-03-01", origTx: 823, compactedTx: 341, saved: 482, estSaving: 2410.00 },
    { date: "2026-02-28", origTx: 689, compactedTx: 256, saved: 433, estSaving: 2165.00 },
    { date: "2026-02-27", origTx: 934, compactedTx: 312, saved: 622, estSaving: 3110.00 },
    { date: "2026-02-26", origTx: 781, compactedTx: 298, saved: 483, estSaving: 2415.00 },
  ];

  const handleRunCheck = () => {
    setRlaChecking(true);
    setTimeout(() => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setRlaLastChecked(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} SAST`);
      setRlaChecking(false);
    }, 1500);
  };

  return (
    <div className="p-6 max-w-[1440px]">
      {/* Cost Alert Banner */}
      <div className="rounded-md p-3 mb-4 flex items-center gap-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #F5A5A5" }}>
        <AlertTriangle size={18} style={{ color: "#9B1C1C" }} />
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#9B1C1C" }}>Projected monthly spend exceeds budget</div>
          <div className="text-[12px]" style={{ color: "#9B1C1C", opacity: 0.85 }}>Current projection: R 513,400 vs. budget of R 450,000 — consider enabling transaction compaction to reduce WiseTech API fees.</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                <kpi.icon size={18} style={{ color: kpi.color }} />
              </div>
              {kpi.change && (
                <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${kpi.up ? "text-emerald-600" : "text-red-600"}`}>
                  {kpi.change}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>{kpi.value}</div>
            <div className="text-[11px] font-medium uppercase tracking-wider mt-0.5" style={{ color: "#6B7E92" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transaction Chart */}
        <div className="lg:col-span-2 rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>WISETECH FEE ANALYSIS (14 DAYS)</span>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-1.5 h-48">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col gap-0.5" style={{ height: 180 }}>
                    <div className="flex-1" />
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(d.saved / maxVal) * 100}%`,
                        backgroundColor: "#15632A",
                        minHeight: 2,
                        marginTop: "auto",
                      }}
                    />
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${((d.fees - d.saved) / maxVal) * 100}%`,
                        backgroundColor: "#C8D0DA",
                        minHeight: 2,
                      }}
                    />
                  </div>
                  <span className="text-[9px]" style={{ color: "#9AAAB8" }}>{i + 1}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: "#6B7E92" }}>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: "#15632A" }} /> Savings</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: "#C8D0DA" }} /> WiseTech Fees</span>
            </div>
          </div>
        </div>

        {/* RLA Monitor */}
        <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#DDE3EA" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>RLA STATUS MONITOR</span>
            <button
              onClick={handleRunCheck}
              disabled={rlaChecking}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors hover:bg-[#F1F4F8] disabled:opacity-50"
              style={{ border: "1px solid #C8D0DA", color: "#3D5166" }}
            >
              <RefreshCw size={12} className={rlaChecking ? "animate-spin" : ""} />
              {rlaChecking ? "Checking..." : "Run Check Now"}
            </button>
          </div>
          <div className="px-4 py-2 flex items-center gap-1.5 text-[11px]" style={{ color: "#6B7E92", backgroundColor: "#F8FAFB" }}>
            <Clock size={12} />
            Last checked: {rlaLastChecked}
          </div>
          <div className="divide-y" style={{ borderColor: "#DDE3EA" }}>
            {rlaData.map((r) => (
              <div key={r.code} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === "active" ? "bg-emerald-500" : r.status === "suspended" ? "bg-red-500" : "bg-slate-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: "#0D1B2A" }}>{r.name}</div>
                  <div className="text-[11px] font-mono" style={{ color: "#6B7E92" }}>{r.code}</div>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.status === "active" ? "bg-emerald-50 text-emerald-700" : r.status === "suspended" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Compaction Table */}
      <div className="mt-4 rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>TRANSACTION COMPACTION</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "#F1F4F8" }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Date</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Original TX Count</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Compacted TX Count</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Saved</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Est. Saving (USD)</th>
              </tr>
            </thead>
            <tbody>
              {compactionData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-[#F1F4F8] transition-colors" style={{ borderColor: "#DDE3EA" }}>
                  <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "#0D1B2A" }}>{row.date}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#3D5166" }}>{row.origTx.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#15632A" }}>{row.compactedTx.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium" style={{ color: "#15632A" }}>-{row.saved.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "#15632A" }}>${row.estSaving.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: "#F1F4F8" }}>
                <td className="px-4 py-2.5 font-semibold" style={{ color: "#3D5166" }}>Total (7 days)</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "#3D5166" }}>{compactionData.reduce((s, r) => s + r.origTx, 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "#15632A" }}>{compactionData.reduce((s, r) => s + r.compactedTx, 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "#15632A" }}>-{compactionData.reduce((s, r) => s + r.saved, 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ color: "#15632A" }}>${compactionData.reduce((s, r) => s + r.estSaving, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   CargoWise View
   ══════════════════════════════════════════════ */

function CargoWiseView({ setView }: { setView: (v: ViewMode) => void }) {
  const [connected, setConnected] = useState(false);

  const cwExecutions = [
    { ref: "CW-EXEC-001247", type: "Shipment Draft", status: "success" as const, duration: "2.3s", timestamp: "2026-03-04 09:38:12" },
    { ref: "CW-EXEC-001246", type: "eAdaptor XML", status: "success" as const, duration: "4.1s", timestamp: "2026-03-04 09:15:44" },
    { ref: "CW-EXEC-001245", type: "Shipment Draft", status: "failed" as const, duration: "1.8s", timestamp: "2026-03-04 08:52:01" },
    { ref: "CW-EXEC-001244", type: "Invoice Sync", status: "success" as const, duration: "3.6s", timestamp: "2026-03-04 08:30:19" },
    { ref: "CW-EXEC-001243", type: "eAdaptor XML", status: "success" as const, duration: "5.2s", timestamp: "2026-03-04 07:45:33" },
  ];

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[30px] font-semibold" style={{ color: "#0D1B2A" }}>CargoWise Integration Status</h1>
          <p className="text-[14px] mt-1" style={{ color: "#6B7E92" }}>Monitor CargoWise connectivity and execution history.</p>
        </div>
        {/* Demo toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium" style={{ color: "#6B7E92" }}>Demo mode:</span>
          <button
            onClick={() => setConnected(!connected)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ backgroundColor: connected ? "#15632A" : "#C8D0DA" }}
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              style={{ transform: connected ? "translateX(24px)" : "translateX(2px)" }}
            />
          </button>
          <span className="text-[12px] font-semibold" style={{ color: connected ? "#15632A" : "#6B7E92" }}>
            {connected ? "Connected" : "Not Connected"}
          </span>
        </div>
      </div>

      {connected ? (
        <div className="space-y-4">
          {/* Connection Status Card */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>CONNECTION STATUS</span>
            </div>
            <div className="p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex-1">
                <div className="text-[14px] font-medium" style={{ color: "#0D1B2A" }}>
                  Connected to <span className="font-mono" style={{ color: "#1A4971" }}>cw-prod.safreight.co.za</span>
                </div>
                <div className="text-[12px]" style={{ color: "#6B7E92" }}>
                  Last successful sync: 2026-03-04 09:38:12 SAST
                </div>
              </div>
              <Wifi size={18} className="text-emerald-600" />
            </div>
          </div>

          {/* Recent CW Executions */}
          <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
              <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>RECENT CW EXECUTIONS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ backgroundColor: "#F1F4F8" }}>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Ref</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Type</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Status</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Duration</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7E92" }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {cwExecutions.map((exec) => (
                    <tr key={exec.ref} className="border-b hover:bg-[#F1F4F8] transition-colors" style={{ borderColor: "#DDE3EA" }}>
                      <td className="px-4 py-2.5 font-mono text-[12px] font-medium" style={{ color: "#B8860B" }}>{exec.ref}</td>
                      <td className="px-4 py-2.5" style={{ color: "#0D1B2A" }}>{exec.type}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${exec.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${exec.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                          {exec.status === "success" ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#3D5166" }}>{exec.duration}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "#6B7E92" }}>{exec.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center p-16 rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
          <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EBF3FB" }}>
            <Database size={32} style={{ color: "#1A4971" }} />
          </div>
          <h2 className="text-[18px] font-semibold mt-4" style={{ color: "#0D1B2A" }}>CargoWise Not Connected</h2>
          <p className="text-[14px] mt-1 text-center max-w-[400px]" style={{ color: "#6B7E92" }}>
            Configure your CargoWise server credentials in Settings to enable draft creation and eAdaptor XML integration.
          </p>
          <button
            onClick={() => setView("settings")}
            className="mt-5 px-4 py-2 rounded text-[14px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#B8860B" }}
          >
            Go to Settings
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Settings View
   ══════════════════════════════════════════════ */

function SettingsView() {
  return (
    <div className="p-6 max-w-[900px]">
      {/* Confidence Thresholds */}
      <div className="rounded-lg border mb-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>AI CONFIDENCE THRESHOLDS</span>
        </div>
        <div className="p-4 space-y-4">
          {[
            { label: "Auto-approve threshold", desc: "Shipments above this confidence level are automatically approved", value: "85%" },
            { label: "Review threshold", desc: "Shipments below this level require manual review", value: "60%" },
            { label: "Block threshold", desc: "Shipments below this level are blocked from CargoWise", value: "40%" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium" style={{ color: "#0D1B2A" }}>{item.label}</div>
                <div className="text-[12px]" style={{ color: "#6B7E92" }}>{item.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={item.value}
                  className="w-20 px-2 py-1 text-[13px] text-right rounded border outline-none focus:border-[#B8860B]"
                  style={{ borderColor: "#C8D0DA", color: "#0D1B2A" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CargoWise Connection */}
      <div className="rounded-lg border mb-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>CARGOWISE CONNECTION</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "Server URL", value: "", placeholder: "https://your-cargowise-server.com" },
            { label: "Username", value: "", placeholder: "cw_username" },
            { label: "Password", value: "", placeholder: "••••••••" },
            { label: "Organization Code", value: "", placeholder: "ORG001" },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "#3D5166" }}>{field.label}</label>
              <input
                type={field.label === "Password" ? "password" : "text"}
                defaultValue={field.value}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-[13px] rounded-md border outline-none focus:border-[#B8860B] focus:ring-2 focus:ring-[#FDF3DC]"
                style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
              />
            </div>
          ))}
          <button className="px-4 py-2 rounded-md text-[13px] font-semibold text-white transition-colors hover:opacity-90" style={{ backgroundColor: "#B8860B" }}>
            Test Connection
          </button>
        </div>
      </div>

      {/* Email Ingestion */}
      <div className="rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "#C8D0DA" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#DDE3EA" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#3D5166" }}>EMAIL INGESTION</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "IMAP Server", placeholder: "imap.gmail.com" },
            { label: "Email Address", placeholder: "freight@yourcompany.co.za" },
            { label: "Password / App Key", placeholder: "••••••••" },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "#3D5166" }}>{field.label}</label>
              <input
                type={field.label.includes("Password") ? "password" : "text"}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-[13px] rounded-md border outline-none focus:border-[#B8860B] focus:ring-2 focus:ring-[#FDF3DC]"
                style={{ borderColor: "#C8D0DA", color: "#0D1B2A", backgroundColor: "#FFFFFF" }}
              />
            </div>
          ))}
          <button className="px-4 py-2 rounded-md text-[13px] font-medium border transition-colors hover:bg-[#F1F4F8]" style={{ borderColor: "#C8D0DA", color: "#3D5166" }}>
            + Add Email Connection
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Footer
   ══════════════════════════════════════════════ */

function Footer() {
  return (
    <footer
      className="flex items-center justify-center flex-shrink-0"
      style={{
        backgroundColor: "#1A2332",
        borderTop: "1px solid #243040",
        height: 32,
      }}
    >
      <span className="text-[11px]" style={{ color: "#6B7E92" }}>
        CARGOiQ (Pty) Ltd | Johannesburg, South Africa | POPIA Compliant | All data stored in South Africa
      </span>
    </footer>
  );
}

/* ══════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════ */

export default function Home() {
  const [view, setView] = useState<ViewMode>("dashboard");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSelectShipment = (id: string) => {
    setSelectedShipmentId(id);
    setView("shipment-detail");
  };

  const handleSetView = (v: ViewMode) => {
    setView(v);
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: "#F1F4F8" }}>
      <Sidebar
        view={view}
        setView={handleSetView}
        collapsed={sidebarCollapsed}
        toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <TopNav
        view={view}
        collapsed={sidebarCollapsed}
        onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
        onQuickUpload={() => setView("compliance")}
      />
      <main
        className="flex-1 overflow-y-auto transition-all duration-200"
        style={{
          marginLeft: sidebarCollapsed ? 56 : 240,
          paddingTop: 56,
        }}
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1">
            {view === "dashboard" && <DashboardView setView={handleSetView} />}
            {view === "shipments" && <ShipmentQueueView onSelectShipment={handleSelectShipment} />}
            {view === "shipment-detail" && <ShipmentDetailView shipmentId={selectedShipmentId} setView={handleSetView} />}
            {view === "compliance" && <ComplianceView />}
            {view === "wiselayer" && <WiseLayerView />}
            {view === "cargowise" && <CargoWiseView setView={handleSetView} />}
            {view === "settings" && <SettingsView />}
          </div>
          <Footer />
        </div>
      </main>
    </div>
  );
}
