// CargoIQ — Zustand Store
import { create } from "zustand";
import type { ViewMode, ShipmentSummary, ShipmentDetail, OverviewStats, IngestSource } from "./types";

interface CargoIQState {
  // Navigation
  currentView: ViewMode;
  selectedShipmentId: string | null;
  sidebarCollapsed: boolean;

  // Data
  shipments: ShipmentSummary[];
  shipmentDetail: ShipmentDetail | null;
  overviewStats: OverviewStats | null;
  isLoading: boolean;

  // Filters
  statusFilter: string;
  shieldFilter: string;
  searchQuery: string;
  sourceFilter: IngestSource | "";

  // Actions
  setView: (view: ViewMode) => void;
  selectShipment: (id: string) => void;
  toggleSidebar: () => void;
  setShipments: (shipments: ShipmentSummary[]) => void;
  setShipmentDetail: (detail: ShipmentDetail | null) => void;
  setOverviewStats: (stats: OverviewStats | null) => void;
  setLoading: (loading: boolean) => void;
  setStatusFilter: (filter: string) => void;
  setShieldFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  setSourceFilter: (filter: IngestSource | "") => void;
}

export const useCargoIQStore = create<CargoIQState>((set) => ({
  currentView: "cargoflow",
  selectedShipmentId: null,
  sidebarCollapsed: false,

  shipments: [],
  shipmentDetail: null,
  overviewStats: null,
  isLoading: false,

  statusFilter: "",
  shieldFilter: "",
  searchQuery: "",
  sourceFilter: "",

  setView: (view) => set({ currentView: view }),
  selectShipment: (id) => set({ selectedShipmentId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setShipments: (shipments) => set({ shipments }),
  setShipmentDetail: (detail) => set({ shipmentDetail: detail }),
  setOverviewStats: (stats) => set({ overviewStats: stats }),
  setLoading: (loading) => set({ isLoading: loading }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setShieldFilter: (filter) => set({ shieldFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSourceFilter: (filter) => set({ sourceFilter: filter }),
}));
