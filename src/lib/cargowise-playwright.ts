// CargoIQ — CargoWise Playwright Browser Automation Fallback
//
// SIMULATION ONLY — This module simulates Playwright browser automation
// for organisations that don't have eAdaptor configured.
//
// In production, this would use Playwright to:
//   1. Launch a headless browser
//   2. Navigate to CargoWise One web interface
//   3. Log in with the org's credentials
//   4. Navigate to the shipment creation page
//   5. Fill in the shipment form fields
//   6. Save as Draft (never submit)
//   7. Capture a screenshot for audit
//   8. Return the draft URL
//
// Since we can't actually run Playwright in this environment,
// we simulate the entire flow with realistic logging and timing.

import type { ShipmentData, OrgData } from "./cargowise-xml";

export interface PlaywrightResult {
  success: boolean;
  screenshotUrl?: string;
  draftUrl?: string;
  errorMessage?: string;
  stepsLog: string[];
  durationMs: number;
}

/**
 * Simulates creating a CargoWise draft via Playwright browser automation.
 *
 * This is a SIMULATION that:
 * 1. Logs the steps it would take
 * 2. Creates a mock screenshot URL
 * 3. Returns a simulated success response after 2-3 seconds
 * 4. Creates proper CwExecution records with executionType: "playwright"
 */
export async function createCwDraftViaPlaywright(
  shipment: ShipmentData,
  org: OrgData
): Promise<PlaywrightResult> {
  const startTime = Date.now();
  const stepsLog: string[] = [];

  const log = (step: string) => {
    const elapsed = Date.now() - startTime;
    stepsLog.push(`[${elapsed}ms] ${step}`);
    console.log(`[Playwright Simulation] ${step}`);
  };

  try {
    // Step 1: Validate org has CargoWise credentials
    log("Step 1/8: Validating CargoWise credentials for org: " + org.name);
    if (!org.cwEnterpriseId) {
      log("WARNING: No CW Enterprise ID configured — using simulation defaults");
    }
    await simulateDelay(300);

    // Step 2: Launch browser
    log("Step 2/8: Launching headless Chromium browser");
    await simulateDelay(400);

    // Step 3: Navigate to CargoWise One
    const cwUrl = "https://cargowise-one.wisetechglobal.com";
    log(`Step 3/8: Navigating to ${cwUrl}`);
    await simulateDelay(500);

    // Step 4: Log in
    log("Step 4/8: Logging in with org credentials (simulated)");
    log("  → Entering username...");
    await simulateDelay(200);
    log("  → Entering password...");
    await simulateDelay(200);
    log("  → Clicking Sign In...");
    await simulateDelay(300);
    log("  → Login successful");

    // Step 5: Navigate to shipment creation
    log("Step 5/8: Navigating to Customs → New Shipment Entry");
    await simulateDelay(400);

    // Step 6: Fill in shipment form
    log("Step 6/8: Filling in shipment form fields");
    const reference = shipment.reference || `CIQ-${shipment.id}`;
    log(`  → Sender Reference: ${reference}`);
    if (shipment.awbOrBlNumber) log(`  → Consignment Number: ${shipment.awbOrBlNumber}`);
    if (shipment.shipperName) log(`  → Shipper: ${shipment.shipperName}`);
    if (shipment.consigneeName) log(`  → Consignee: ${shipment.consigneeName}`);
    if (shipment.originPort) log(`  → Origin Port: ${shipment.originPort}`);
    if (shipment.destinationPort) log(`  → Destination Port: ${shipment.destinationPort}`);
    if (shipment.cargoDescription) log(`  → Cargo Description: ${shipment.cargoDescription.substring(0, 60)}...`);
    if (shipment.invoiceValue !== null) log(`  → Invoice Value: ${shipment.currency} ${shipment.invoiceValue.toLocaleString()}`);
    await simulateDelay(600);

    // Step 7: Save as Draft
    log("Step 7/8: Saving shipment as DRAFT (never submitting directly)");
    await simulateDelay(400);

    // Step 8: Capture screenshot
    log("Step 8/8: Capturing screenshot for audit trail");
    await simulateDelay(200);

    const screenshotId = `cw-screenshot-${Date.now()}`;
    const screenshotUrl = `/api/cargowise/screenshots/${screenshotId}.png`;
    const draftUrl = `${cwUrl}/Customs/Shipment/Draft/${reference}`;

    log(`✓ Draft created successfully: ${reference}`);
    log(`✓ Screenshot captured: ${screenshotUrl}`);
    log(`✓ Draft URL: ${draftUrl}`);

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      screenshotUrl,
      draftUrl,
      stepsLog,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Playwright simulation error";

    log(`✗ Failed: ${errorMessage}`);

    return {
      success: false,
      errorMessage,
      stepsLog,
      durationMs,
    };
  }
}

/**
 * Simulates a delay to mimic real browser automation timing.
 */
function simulateDelay(ms: number): Promise<void> {
  // Add slight randomness (±20%) to simulate real-world variation
  const jitter = ms * 0.2 * (Math.random() - 0.5);
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}
