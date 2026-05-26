"use client";

import { SidebarNav } from "@/components/cargoiq/sidebar-nav";
import { TopNav } from "@/components/cargoiq/top-nav";
import { useCargoIQStore } from "@/lib/store";
import ShipmentQueueView from "@/components/cargoiq/shipment-queue-view";
import DashboardView from "@/components/cargoiq/dashboard-view";
import ShipmentDetailView from "@/components/cargoiq/shipment-detail-view";
import ComplianceView from "@/components/cargoiq/compliance-view";
import WiseLayerView from "@/components/cargoiq/wiselayer-view";
import SettingsView from "@/components/cargoiq/settings-view";
import { Database } from "lucide-react";

export default function Home() {
  const currentView = useCargoIQStore((s) => s.currentView);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F1F4F8" }}>
      {/* Sidebar — fixed width, full height */}
      <SidebarNav />

      {/* Main area — fills remaining space */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top navigation */}
        <TopNav />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          {currentView === "dashboard" && <DashboardView />}
          {currentView === "shipments" && <ShipmentQueueView />}
          {currentView === "shipment-detail" && <ShipmentDetailView />}
          {currentView === "compliance" && <ComplianceView />}
          {currentView === "wiselayer" && <WiseLayerView />}
          {currentView === "cargowise" && <CargoWiseView />}
          {currentView === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

function CargoWiseView() {
  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <h1 style={{ fontSize: 30, fontWeight: 600, color: "#0D1B2A" }}>
        CargoWise Integration Status
      </h1>
      <p style={{ fontSize: 14, color: "#6B7E92", marginTop: 4 }}>
        Monitor CargoWise connectivity and execution history.
      </p>

      <div
        className="mt-8 flex flex-col items-center justify-center"
        style={{
          padding: "64px 24px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #C8D0DA",
          borderRadius: 6,
        }}
      >
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 64, height: 64, backgroundColor: "#EBF3FB" }}
        >
          <Database size={32} style={{ color: "#1A4971" }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0D1B2A", marginTop: 16 }}>
          CargoWise Not Connected
        </h2>
        <p style={{ fontSize: 14, color: "#6B7E92", marginTop: 4, maxWidth: 400, textAlign: "center" }}>
          Configure your CargoWise server credentials in Settings to enable draft creation and eAdaptor XML integration.
        </p>
        <button
          onClick={() => useCargoIQStore.getState().setView("settings")}
          style={{
            marginTop: 20,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: "#B8860B",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Go to Settings
        </button>
      </div>
    </div>
  );
}
