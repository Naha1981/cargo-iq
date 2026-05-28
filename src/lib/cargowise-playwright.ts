// CargoIQ — CargoWise Playwright Browser Automation Simulation
// Simulates the 8-step CargoWise entry process with realistic timing
//
// ⚠️  IMPORTANT: This is a SIMULATION module. It does NOT run actual Playwright.
// It simulates the steps and timing of a real Playwright automation to provide
// realistic UI feedback and step logs. In production, this would be replaced
// with actual browser automation.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { ShipmentData, OrgData } from "./cargowise-xml";

export interface SimulationStep {
  step: number;
  name: string;
  status: "success" | "warning" | "error";
  message: string;
  durationMs: number;
}

export interface SimulationResult {
  /** Whether the overall simulation succeeded */
  success: boolean;
  /** Detailed step-by-step log */
  stepsLog: SimulationStep[];
  /** URL of the simulated screenshot (placeholder) */
  screenshotUrl: string | null;
  /** URL of the draft shipment in CargoWise (simulated) */
  draftUrl: string | null;
  /** Total simulation duration in milliseconds */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helper: promise-based delay
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// ---------------------------------------------------------------------------
// simulateCargowiseEntry
// ---------------------------------------------------------------------------

/**
 * Simulate the 8-step CargoWise browser automation process.
 *
 * Steps:
 * 1. Validate credentials — check CW connection config
 * 2. Launch browser — start Chromium instance
 * 3. Navigate — go to CargoWise server URL
 * 4. Login — authenticate with CW credentials
 * 5. Create shipment — navigate to shipment creation form
 * 6. Fill form — populate all extracted fields
 * 7. Save draft — save the shipment in Draft status
 * 8. Screenshot — capture confirmation screen
 *
 * @param shipment - Shipment data to simulate entering
 * @param org - Organization data with CW config
 * @returns Simulation result with step logs and timing
 */
export async function simulateCargowiseEntry(
  shipment: ShipmentData,
  org: OrgData
): Promise<SimulationResult> {
  const startTime = Date.now();
  const stepsLog: SimulationStep[] = [];

  // Step 1: Validate credentials
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(200, 400);
    await delay(stepDuration);

    const hasCreds = !!(org.cwServerUrl && org.cwEnterpriseId);
    const step: SimulationStep = {
      step: 1,
      name: "Validate credentials",
      status: hasCreds ? "success" : "warning",
      message: hasCreds
        ? `Credentials validated for ${org.cwServerUrl}`
        : "No CW credentials configured — using demo mode",
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 2: Launch browser
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(300, 500);
    await delay(stepDuration);

    const step: SimulationStep = {
      step: 2,
      name: "Launch browser",
      status: "success",
      message: "Chromium browser instance started",
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 3: Navigate to CW server
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(300, 500);
    await delay(stepDuration);

    const serverUrl = org.cwServerUrl || "https://cargowise.wisetechglobal.com";
    const step: SimulationStep = {
      step: 3,
      name: "Navigate to CargoWise",
      status: "success",
      message: `Navigated to ${serverUrl}`,
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 4: Login
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(400, 600);
    await delay(stepDuration);

    const step: SimulationStep = {
      step: 4,
      name: "Login",
      status: "success",
      message: `Authenticated as enterprise ${org.cwEnterpriseId || "demo"}`,
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 5: Create shipment
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(300, 500);
    await delay(stepDuration);

    const step: SimulationStep = {
      step: 5,
      name: "Create shipment",
      status: "success",
      message: `New shipment form opened for ${shipment.reference || "CIQ-NEW"}`,
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 6: Fill form
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(400, 600);
    await delay(stepDuration);

    const fieldCount = [
      shipment.shipperName,
      shipment.consigneeName,
      shipment.originPort,
      shipment.destinationPort,
      shipment.cargoDescription,
      shipment.grossWeight,
      shipment.awbOrBlNumber,
    ].filter(Boolean).length;

    const step: SimulationStep = {
      step: 6,
      name: "Fill form",
      status: fieldCount >= 4 ? "success" : "warning",
      message: `Populated ${fieldCount} fields from extracted data`,
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 7: Save draft
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(300, 500);
    await delay(stepDuration);

    const draftRef = shipment.reference || `CIQ-${Date.now()}`;
    const step: SimulationStep = {
      step: 7,
      name: "Save draft",
      status: "success",
      message: `Shipment saved as Draft: ${draftRef}`,
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  // Step 8: Screenshot
  {
    const stepStart = Date.now();
    const stepDuration = randomDelay(200, 400);
    await delay(stepDuration);

    const step: SimulationStep = {
      step: 8,
      name: "Screenshot",
      status: "success",
      message: "Confirmation screenshot captured",
      durationMs: Date.now() - stepStart,
    };
    stepsLog.push(step);
  }

  const totalDuration = Date.now() - startTime;
  const hasErrors = stepsLog.some((s) => s.status === "error");
  const draftRef = shipment.reference || `CIQ-${Date.now()}`;
  const serverUrl = org.cwServerUrl || "https://cargowise.wisetechglobal.com";

  return {
    success: !hasErrors,
    stepsLog,
    screenshotUrl: hasErrors
      ? null
      : `${serverUrl}/screenshots/${draftRef}.png`,
    draftUrl: hasErrors
      ? null
      : `${serverUrl}/shipment/${draftRef}/draft`,
    durationMs: totalDuration,
  };
}
