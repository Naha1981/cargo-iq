/**
 * CargoIQ Infrastructure Monitoring Agent
 *
 * Self-healing service monitor that:
 * - Reads services from services.json
 * - Checks each service at configured intervals
 * - Implements exponential backoff on retry
 * - Tracks failure counts per service
 * - Implements "degraded mode" after 5 consecutive failures
 * - Auto-recovers when a degraded service comes back online
 * - Serves a dashboard on port 3099
 *
 * Usage:
 *   bun run infra/agent/monitor.ts
 *
 * Architecture:
 *
 *                 ┌────────────────────┐
 *                 │ Infra Agent        │
 *                 │ monitor.ts         │
 *                 │ (Port 3099)        │
 *                 └─────────┬──────────┘
 *                           │
 *         ┌─────────────────┼──────────────────┐
 *         ▼                 ▼                  ▼
 *   CargoIQ API       Auth Service        AI Workers
 *    /api/health       /health            /health
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatusValue = "alive" | "degraded" | "down";

interface ServiceConfig {
  name: string;
  url: string;
  interval: number;   // seconds between checks
  retries: number;    // max retries per check cycle
  timeout: number;    // ms per request
  critical: boolean;
}

interface ServiceStatus {
  name: string;
  url: string;
  status: ServiceStatusValue;
  failureCount: number;
  lastCheck: string | null;
  lastError: string | null;
  uptime: number;     // percentage (0-100)
  critical: boolean;
  totalChecks: number;
  successfulChecks: number;
  consecutiveFailures: number;
  lastRecovery: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEGRADED_THRESHOLD = 5;          // consecutive failures before degraded
const BACKOFF_BASE = 1000;             // 1 second
const BACKOFF_CAP = 30000;             // 30 seconds
const PORT = 3099;

// ─── State ────────────────────────────────────────────────────────────────────

const serviceStatuses = new Map<string, ServiceStatus>();
const checkTimers = new Map<string, Timer>();
let startTime = new Date();

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level: "INFO" | "WARN" | "ERROR" | "RECOVERY", message: string): void {
  const timestamp = new Date().toISOString();
  const prefix = level === "RECOVERY" ? "🔄 RECOVERY" : level;
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// ─── Exponential Backoff ──────────────────────────────────────────────────────

function getBackoffDelay(attempt: number): number {
  return Math.min(BACKOFF_BASE * Math.pow(2, attempt), BACKOFF_CAP);
}

// ─── Service Check ────────────────────────────────────────────────────────────

async function checkService(config: ServiceConfig): Promise<{ ok: boolean; error: string | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(config.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "CargoIQ-InfraAgent/1.0",
        "Accept": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { ok: true, error: null };
    } else {
      return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ─── Wake Service ─────────────────────────────────────────────────────────────

async function wakeService(config: ServiceConfig): Promise<boolean> {
  log("INFO", `Attempting to wake service: ${config.name} at ${config.url}`);

  for (let attempt = 0; attempt < config.retries; attempt++) {
    const delay = getBackoffDelay(attempt);
    log("INFO", `Wake attempt ${attempt + 1}/${config.retries} for ${config.name} (backoff ${delay}ms)`);

    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const result = await checkService(config);
    if (result.ok) {
      log("RECOVERY", `Service ${config.name} woke up on attempt ${attempt + 1}`);
      return true;
    }
  }

  log("WARN", `Failed to wake service: ${config.name} after ${config.retries} attempts`);
  return false;
}

// ─── Update Service Status ────────────────────────────────────────────────────

function updateServiceStatus(config: ServiceConfig, checkResult: { ok: boolean; error: string | null }): void {
  const existing = serviceStatuses.get(config.name);
  const now = new Date().toISOString();

  const totalChecks = (existing?.totalChecks ?? 0) + 1;
  const successfulChecks = (existing?.successfulChecks ?? 0) + (checkResult.ok ? 1 : 0);
  const consecutiveFailures = checkResult.ok ? 0 : (existing?.consecutiveFailures ?? 0) + 1;

  let status: ServiceStatusValue;
  let lastRecovery = existing?.lastRecovery ?? null;

  if (checkResult.ok) {
    if (existing?.status === "degraded" || existing?.status === "down") {
      lastRecovery = now;
      log("RECOVERY", `Service ${config.name} recovered from ${existing.status} to alive`);
    }
    status = "alive";
  } else if (consecutiveFailures >= DEGRADED_THRESHOLD) {
    status = "down";
    log("ERROR", `Service ${config.name} marked as DOWN after ${consecutiveFailures} consecutive failures`);
  } else if (consecutiveFailures >= 2) {
    status = "degraded";
    log("WARN", `Service ${config.name} marked as DEGRADED (${consecutiveFailures} consecutive failures)`);
  } else {
    status = "degraded";
    log("WARN", `Service ${config.name} check failed (${consecutiveFailures} failure(s))`);
  }

  const uptime = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 10000) / 100 : 0;

  const updated: ServiceStatus = {
    name: config.name,
    url: config.url,
    status,
    failureCount: consecutiveFailures,
    lastCheck: now,
    lastError: checkResult.ok ? null : checkResult.error,
    uptime,
    critical: config.critical,
    totalChecks,
    successfulChecks,
    consecutiveFailures,
    lastRecovery,
  };

  serviceStatuses.set(config.name, updated);
}

// ─── Single Check Cycle ──────────────────────────────────────────────────────

async function runCheckCycle(config: ServiceConfig): Promise<void> {
  log("INFO", `Checking service: ${config.name} at ${config.url}`);
  const result = await checkService(config);
  updateServiceStatus(config, result);

  // If service just went down, try to wake it
  const status = serviceStatuses.get(config.name);
  if (status && status.status === "down" && status.consecutiveFailures === DEGRADED_THRESHOLD) {
    log("INFO", `Service ${config.name} just went down — initiating wake sequence`);
    const woke = await wakeService(config);
    if (woke) {
      const wakeResult = { ok: true, error: null };
      updateServiceStatus(config, wakeResult);
    }
  }
}

// ─── Schedule Periodic Checks ─────────────────────────────────────────────────

function scheduleChecks(config: ServiceConfig): void {
  const intervalMs = config.interval * 1000;

  // Run first check immediately
  runCheckCycle(config).catch((err) => {
    log("ERROR", `Check cycle error for ${config.name}: ${err}`);
  });

  // Schedule recurring checks
  const timer = setInterval(() => {
    runCheckCycle(config).catch((err) => {
      log("ERROR", `Check cycle error for ${config.name}: ${err}`);
    });
  }, intervalMs);

  checkTimers.set(config.name, timer);
}

// ─── Dashboard HTML ───────────────────────────────────────────────────────────

function generateDashboardHTML(): string {
  const statuses = Array.from(serviceStatuses.values());
  const aliveCount = statuses.filter((s) => s.status === "alive").length;
  const degradedCount = statuses.filter((s) => s.status === "degraded").length;
  const downCount = statuses.filter((s) => s.status === "down").length;

  const statusColor = (s: ServiceStatusValue): string => {
    switch (s) {
      case "alive": return "#16a34a";    // green
      case "degraded": return "#d97706"; // amber
      case "down": return "#dc2626";     // red
    }
  };

  const statusBg = (s: ServiceStatusValue): string => {
    switch (s) {
      case "alive": return "#f0fdf4";
      case "degraded": return "#fffbeb";
      case "down": return "#fef2f2";
    }
  };

  const statusLabel = (s: ServiceStatusValue): string => s.toUpperCase();

  const serviceRows = statuses
    .map(
      (s) => `
    <tr>
      <td style="padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
        ${s.name}
        ${s.critical ? '<span style="background: #dc2626; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">CRITICAL</span>' : ""}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 13px; color: #6b7280;">
        ${s.url}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <span style="background: ${statusBg(s.status)}; color: ${statusColor(s.status)}; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 12px; letter-spacing: 0.5px;">
          ${statusLabel(s.status)}
        </span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${s.consecutiveFailures > 0 ? "#dc2626" : "#16a34a"};">
        ${s.consecutiveFailures}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${s.uptime}%
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
        ${s.lastCheck ? new Date(s.lastCheck).toLocaleString() : "—"}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${s.lastError ?? "—"}
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CargoIQ Infra Agent — Service Monitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-bottom: 1px solid #334155;
      padding: 24px 32px;
    }
    .header h1 { font-size: 24px; font-weight: 700; color: #f8fafc; }
    .header p { font-size: 14px; color: #94a3b8; margin-top: 4px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px 32px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-card .number { font-size: 32px; font-weight: 700; }
    .stat-card .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .green { color: #4ade80; }
    .amber { color: #fbbf24; }
    .red { color: #f87171; }
    .blue { color: #60a5fa; }
    .table-wrapper {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      background: #0f172a;
      border-bottom: 1px solid #334155;
    }
    td { color: #e2e8f0; }
    .footer {
      text-align: center;
      padding: 24px;
      color: #475569;
      font-size: 12px;
      margin-top: 24px;
    }
    .pulse {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .refresh-note { font-size: 12px; color: #64748b; margin-top: 12px; }
  </style>
  <meta http-equiv="refresh" content="30">
</head>
<body>
  <div class="header">
    <h1><span class="pulse" style="background: #4ade80;"></span>CargoIQ Infra Agent</h1>
    <p>Self-healing service monitor — Port ${PORT} — Started ${startTime.toISOString()}</p>
  </div>
  <div class="container">
    <div class="stats">
      <div class="stat-card">
        <div class="number blue">${statuses.length}</div>
        <div class="label">Total Services</div>
      </div>
      <div class="stat-card">
        <div class="number green">${aliveCount}</div>
        <div class="label">Alive</div>
      </div>
      <div class="stat-card">
        <div class="number amber">${degradedCount}</div>
        <div class="label">Degraded</div>
      </div>
      <div class="stat-card">
        <div class="number red">${downCount}</div>
        <div class="label">Down</div>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>URL</th>
            <th>Status</th>
            <th>Failures</th>
            <th>Uptime</th>
            <th>Last Check</th>
            <th>Last Error</th>
          </tr>
        </thead>
        <tbody>
          ${serviceRows || '<tr><td colspan="7" style="text-align: center; padding: 32px; color: #64748b;">No services configured</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="refresh-note">Dashboard auto-refreshes every 30 seconds. API: GET /api/status</p>
  </div>
  <div class="footer">
    CargoIQ (Pty) Ltd &mdash; Infra Agent v1.0 &mdash; Johannesburg, South Africa
  </div>
</body>
</html>`;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function startServer(): void {
  const server = Bun.serve({
    port: PORT,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/status") {
        const statuses = Array.from(serviceStatuses.values());
        return new Response(
          JSON.stringify(
            {
              agent: {
                uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
                startedAt: startTime.toISOString(),
                servicesMonitored: statuses.length,
              },
              services: statuses,
            },
            null,
            2
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Default: dashboard
      return new Response(generateDashboardHTML(), {
        headers: { "Content-Type": "text/html" },
      });
    },
  });

  log("INFO", `Dashboard available at http://localhost:${server.port}`);
  log("INFO", `Status API available at http://localhost:${server.port}/api/status`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("INFO", "CargoIQ Infra Agent starting...");

  // Read services configuration
  const configPath = join(dirname(fileURLToPath(import.meta.url)), "..", "services.json");
  log("INFO", `Reading services from: ${configPath}`);

  let services: ServiceConfig[];
  try {
    const raw = readFileSync(configPath, "utf-8");
    services = JSON.parse(raw) as ServiceConfig[];
  } catch (err) {
    log("ERROR", `Failed to read services.json: ${err}`);
    process.exit(1);
  }

  if (services.length === 0) {
    log("WARN", "No services configured in services.json");
  }

  // Initialize service statuses
  for (const svc of services) {
    serviceStatuses.set(svc.name, {
      name: svc.name,
      url: svc.url,
      status: "alive", // assume alive until first check
      failureCount: 0,
      lastCheck: null,
      lastError: null,
      uptime: 100,
      critical: svc.critical,
      totalChecks: 0,
      successfulChecks: 0,
      consecutiveFailures: 0,
      lastRecovery: null,
    });
    log("INFO", `Registered service: ${svc.name} (${svc.url}) — interval ${svc.interval}s, retries ${svc.retries}, critical ${svc.critical}`);
  }

  // Start the dashboard server
  startServer();

  // Schedule periodic health checks
  for (const svc of services) {
    scheduleChecks(svc);
  }

  log("INFO", `Monitoring ${services.length} service(s). Press Ctrl+C to stop.`);

  // Graceful shutdown
  process.on("SIGINT", () => {
    log("INFO", "Shutting down Infra Agent...");
    for (const [name, timer] of checkTimers) {
      clearInterval(timer);
      log("INFO", `Stopped check timer for ${name}`);
    }
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("INFO", "Received SIGTERM, shutting down...");
    for (const [name, timer] of checkTimers) {
      clearInterval(timer);
      log("INFO", `Stopped check timer for ${name}`);
    }
    process.exit(0);
  });
}

main().catch((err) => {
  log("ERROR", `Fatal error: ${err}`);
  process.exit(1);
});
