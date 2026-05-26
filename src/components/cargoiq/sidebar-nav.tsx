"use client";

import {
  LayoutDashboard,
  Package,
  Inbox,
  ShieldCheck,
  LineChart,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCargoIQStore } from "@/lib/store";
import type { ViewMode } from "@/lib/types";

// ── Color tokens ──────────────────────────────────────────────────────
const colors = {
  bg: "#1A2332",
  active: "#243447",
  hover: "#1F2D3D",
  text: "#C8D3DF",
  muted: "#6B7E92",
  border: "#243040",
  accent: "#B8860B",
} as const;

// ── Navigation structure ──────────────────────────────────────────────
interface NavItem {
  label: string;
  icon: LucideIcon;
  view: ViewMode;
  badge?: string;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    heading: "Operations",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
      { label: "Shipment Queue", icon: Package, view: "shipments", badge: "34" },
      { label: "Inbox", icon: Inbox, view: "dashboard" },
    ],
  },
  {
    heading: "Compliance",
    items: [
      { label: "Compliance Shield", icon: ShieldCheck, view: "compliance" },
    ],
  },
  {
    heading: "WiseLayer",
    items: [
      { label: "Cost Intelligence", icon: LineChart, view: "wiselayer" },
      { label: "CargoWise Status", icon: Database, view: "cargowise" },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "Settings", icon: Settings, view: "settings" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────
export function SidebarNav() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar } =
    useCargoIQStore();

  const collapsed = sidebarCollapsed;
  const width = collapsed ? 56 : 220;

  return (
    <nav
      className="flex flex-col h-screen shrink-0 select-none overflow-hidden transition-[width] duration-200 ease-in-out"
      style={{
        width,
        backgroundColor: colors.bg,
        borderRight: `1px solid ${colors.border}`,
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-3 h-14 shrink-0"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        {/* CIQ badge */}
        <div
          className="flex items-center justify-center shrink-0 rounded-md font-bold text-white text-xs tracking-wider"
          style={{
            width: 32,
            height: 32,
            background: `linear-gradient(135deg, ${colors.accent}, #D4A017)`,
          }}
        >
          CIQ
        </div>

        {/* CargoIQ text — hidden when collapsed */}
        <span
          className="font-semibold text-sm whitespace-nowrap transition-opacity duration-200"
          style={{
            color: colors.text,
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : "auto",
            overflow: "hidden",
          }}
        >
          CargoIQ
        </span>
      </div>

      {/* ── Nav sections ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {sections.map((section) => (
          <div key={section.heading} className="mb-1">
            {/* Section heading — hidden when collapsed */}
            {!collapsed && (
              <div
                className="px-4 pt-3 pb-1.5 font-semibold tracking-widest uppercase"
                style={{
                  color: colors.muted,
                  fontSize: 10,
                }}
              >
                {section.heading}
              </div>
            )}

            {/* Collapsed separator dot */}
            {collapsed && (
              <div className="flex justify-center py-2">
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: colors.muted }}
                />
              </div>
            )}

            {/* Items */}
            {section.items.map((item) => {
              const isActive = currentView === item.view;
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  onClick={() => setView(item.view)}
                  className={`
                    relative flex items-center w-full
                    transition-colors duration-150 cursor-pointer
                    ${collapsed ? "justify-center px-0" : "gap-3 px-4"}
                  `}
                  style={{
                    height: 36,
                    backgroundColor: isActive ? colors.active : "transparent",
                    borderLeft: isActive
                      ? `2px solid ${colors.accent}`
                      : "2px solid transparent",
                    color: isActive ? "#FFFFFF" : colors.text,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = colors.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className="shrink-0"
                    size={18}
                    strokeWidth={isActive ? 2 : 1.5}
                  />

                  {/* Label — hidden when collapsed */}
                  {!collapsed && (
                    <span
                      className="truncate whitespace-nowrap"
                      style={{ fontSize: 13 }}
                    >
                      {item.label}
                    </span>
                  )}

                  {/* Badge count */}
                  {item.badge && (
                    <span
                      className={`
                        flex items-center justify-center
                        rounded-full font-semibold leading-none
                        ${collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto"}
                      `}
                      style={{
                        backgroundColor: "#DC2626",
                        color: "#FFFFFF",
                        fontSize: collapsed ? 9 : 10,
                        minWidth: collapsed ? 14 : 18,
                        height: collapsed ? 14 : 18,
                        padding: collapsed ? "0 2px" : "0 5px",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Footer: System status + collapse toggle ───────────────── */}
      <div
        className="shrink-0 px-3 py-3 flex flex-col gap-2"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        {/* System status */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
          <span
            className="shrink-0 rounded-full animate-pulse"
            style={{
              width: 6,
              height: 6,
              backgroundColor: "#22C55E",
            }}
          />
          {!collapsed && (
            <span
              className="truncate"
              style={{ color: colors.muted, fontSize: 11 }}
            >
              All systems operational
            </span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={`
            flex items-center justify-center rounded transition-colors duration-150 cursor-pointer
            ${collapsed ? "w-full" : "w-full"}
          `}
          style={{
            height: 28,
            color: colors.muted,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.hover;
            e.currentTarget.style.color = colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = colors.muted;
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={1.5} />
          ) : (
            <ChevronLeft size={14} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* ── Custom scrollbar styles ────────────────────────────────── */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${colors.border};
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${colors.muted};
        }
      `}</style>
    </nav>
  );
}

export default SidebarNav;
