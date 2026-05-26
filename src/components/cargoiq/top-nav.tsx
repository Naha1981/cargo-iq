'use client';

import { useCallback, useMemo, useState } from 'react';
import { Menu, Search, Bell, LogOut } from 'lucide-react';
import { useCargoIQStore } from '@/lib/store';
import type { ViewMode } from '@/lib/types';

// ── View name mapping ────────────────────────────────────────────────
const VIEW_LABELS: Record<ViewMode, string> = {
  dashboard: 'Operations Dashboard',
  shipments: 'Shipment Queue',
  'shipment-detail': 'Shipment Detail',
  compliance: 'Compliance Shield',
  wiselayer: 'Cost Intelligence',
  cargowise: 'CargoWise Status',
  settings: 'Settings',
};

// ── Color tokens ─────────────────────────────────────────────────────
const COLORS = {
  bg: '#FFFFFF',
  border: '#C8D0DA',
  textPrimary: '#0D1B2A',
  textSecondary: '#3D5166',
  textTertiary: '#6B7E92',
  accent: '#B8860B',
  errorRed: '#9B1C1C',
  navySquare: '#0D1B2A',
} as const;

// ── Types ────────────────────────────────────────────────────────────
interface TopNavProps {
  /** Optional callback when sign-out is triggered */
  onSignOut?: () => void;
}

// ── Component ────────────────────────────────────────────────────────
export function TopNav({ onSignOut }: TopNavProps) {
  const { currentView, toggleSidebar, searchQuery, setSearchQuery } =
    useCargoIQStore();

  const [searchFocused, setSearchFocused] = useState(false);

  const viewLabel = useMemo(() => VIEW_LABELS[currentView], [currentView]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery],
  );

  const handleSignOut = useCallback(() => {
    onSignOut?.();
  }, [onSignOut]);

  return (
    <header
      className="flex items-center shrink-0 select-none"
      style={{
        height: 56,
        backgroundColor: COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* ── Left section: toggle + breadcrumb ── */}
      <div className="flex items-center gap-2 pl-4">
        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[#F1F3F6] active:bg-[#E4E8ED]"
          style={{ width: 32, height: 32 }}
          aria-label="Toggle sidebar"
        >
          <Menu size={16} style={{ color: COLORS.textSecondary }} />
        </button>

        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 ml-1"
          style={{ fontSize: 14, color: COLORS.textTertiary }}
        >
          <span>CargoIQ</span>
          <span aria-hidden="true">/</span>
          <span
            className="font-medium"
            style={{ color: COLORS.textPrimary }}
          >
            {viewLabel}
          </span>
        </nav>
      </div>

      {/* ── Center: global search ── */}
      <div className="flex-1 flex justify-center px-4">
        <div
          className="relative flex items-center w-full"
          style={{ maxWidth: 448 }}
        >
          <Search
            size={15}
            className="absolute left-3 pointer-events-none"
            style={{ color: COLORS.textTertiary }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search shipments, references, consignees…"
            className="w-full outline-none transition-colors duration-150"
            style={{
              height: 34,
              paddingLeft: 34,
              paddingRight: 12,
              borderRadius: 6,
              border: `1px solid ${searchFocused ? COLORS.accent : COLORS.border}`,
              boxShadow: searchFocused
                ? `0 0 0 2px rgba(184, 134, 11, 0.15)`
                : 'none',
              fontSize: 13,
              color: COLORS.textPrimary,
              backgroundColor: '#F8F9FB',
            }}
            aria-label="Global search"
          />
        </div>
      </div>

      {/* ── Right section: bell + user + sign-out ── */}
      <div className="flex items-center gap-3 pr-4">
        {/* Notification bell */}
        <button
          type="button"
          className="relative flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[#F1F3F6] active:bg-[#E4E8ED]"
          style={{ width: 34, height: 34 }}
          aria-label="Notifications — 3 unread"
        >
          <Bell size={17} style={{ color: COLORS.textSecondary }} />
          {/* Count badge */}
          <span
            className="absolute flex items-center justify-center font-semibold leading-none"
            style={{
              top: 4,
              right: 3,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              backgroundColor: COLORS.errorRed,
              color: '#FFFFFF',
              fontSize: 10,
            }}
          >
            3
          </span>
        </button>

        {/* Divider */}
        <div
          className="hidden sm:block"
          style={{
            width: 1,
            height: 28,
            backgroundColor: COLORS.border,
          }}
        />

        {/* User info */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Avatar with initials */}
          <div
            className="flex items-center justify-center rounded font-semibold"
            style={{
              width: 32,
              height: 32,
              backgroundColor: COLORS.navySquare,
              color: '#FFFFFF',
              fontSize: 12,
              letterSpacing: '0.02em',
            }}
            aria-hidden="true"
          >
            JM
          </div>

          {/* Name + role */}
          <div className="flex flex-col leading-tight">
            <span
              className="font-medium"
              style={{ fontSize: 13, color: COLORS.textPrimary }}
            >
              Johan Meyer
            </span>
            <span
              style={{ fontSize: 11, color: COLORS.textTertiary }}
            >
              Operations Manager
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="hidden sm:block"
          style={{
            width: 1,
            height: 28,
            backgroundColor: COLORS.border,
          }}
        />

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[#F1F3F6] active:bg-[#E4E8ED]"
          style={{ width: 32, height: 32 }}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={15} style={{ color: COLORS.textTertiary }} />
        </button>
      </div>
    </header>
  );
}

export default TopNav;
