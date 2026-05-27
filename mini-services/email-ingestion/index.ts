// CargoIQ Email Ingestion Mini-Service
// Polls IMAP inbox, processes freight emails, extracts attachments,
// and triggers the CargoIQ processing pipeline.
// Port: 3002

import { ImapFlow, FetchMessageObject } from "imapflow";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import http from "http";

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT = 3002;
const STATE_FILE = join(import.meta.dir, "state.json");

const IMAP_HOST = process.env.IMAP_HOST || "";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993");
const IMAP_USER = process.env.IMAP_USER || "";
const IMAP_PASS = process.env.IMAP_PASS || "";
const IMAP_FOLDER = process.env.IMAP_FOLDER || "INBOX";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "30000");
const CARGOIQ_API_URL = process.env.CARGOIQ_API_URL || "http://localhost:3000";

const DEMO_MODE = !IMAP_HOST || !IMAP_USER || !IMAP_PASS;
const DEMO_INTERVAL_MS = 60000; // Generate fake emails every 60s

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceState {
  lastProcessedUid: number;
  emailsProcessed: number;
  attachmentsExtracted: number;
  freightCount: number;
  nonFreightCount: number;
  unknownCount: number;
  lastPollTime: string | null;
  imapConnected: boolean;
  processingLog: LogEntry[];
}

interface LogEntry {
  timestamp: string;
  type: "info" | "error" | "success" | "warn";
  message: string;
}

interface ProcessedAttachment {
  filename: string;
  fileType: string;
  base64Content: string;
}

interface InboundEmailData {
  fromAddress: string;
  subject: string;
  bodyPreview: string;
  receivedAt: string;
  attachments: ProcessedAttachment[];
  classification: "freight" | "non_freight" | "unknown";
  classificationMethod: "heuristic" | "llm" | "demo";
  uid?: number;
}

// ─── State Management ─────────────────────────────────────────────────────────

function loadState(): ServiceState {
  const defaults: ServiceState = {
    lastProcessedUid: 0,
    emailsProcessed: 0,
    attachmentsExtracted: 0,
    freightCount: 0,
    nonFreightCount: 0,
    unknownCount: 0,
    lastPollTime: null,
    imapConnected: false,
    processingLog: [],
  };

  if (existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      return { ...defaults, ...data, processingLog: data.processingLog || [] };
    } catch {
      return defaults;
    }
  }
  return defaults;
}

function saveState(state: ServiceState): void {
  // Keep only last 100 log entries in persisted state
  const trimmed = {
    ...state,
    processingLog: state.processingLog.slice(-100),
  };
  try {
    writeFileSync(STATE_FILE, JSON.stringify(trimmed, null, 2));
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

let state = loadState();

function log(type: LogEntry["type"], message: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
  };
  state.processingLog.push(entry);
  // Keep only last 200 entries in memory
  if (state.processingLog.length > 200) {
    state.processingLog = state.processingLog.slice(-200);
  }
  const prefix = {
    info: "ℹ️",
    error: "❌",
    success: "✅",
    warn: "⚠️",
  }[type];
  console.log(`[${entry.timestamp}] ${prefix} ${message}`);
}

// ─── Email Classification ─────────────────────────────────────────────────────

const FREIGHT_KEYWORDS = [
  "invoice",
  "packing list",
  "packinglist",
  "b/l",
  "bill of lading",
  "awb",
  "airway bill",
  "air waybill",
  "shipment",
  "customs",
  "clearance",
  "freight",
  "cargo",
  "import",
  "export",
  "container",
  "vessel",
  "booking",
  "delivery note",
  "proforma",
  "commercial invoice",
  "house bill",
  "master bill",
  "hbl",
  "mbl",
  "coo",
  "certificate of origin",
  "fcr",
  "forwarder",
  "logistics",
  "shipping",
  "port",
  "terminal",
  "warehousing",
  "consignment",
  "declaration",
  "tariff",
  "duties",
  "sars",
  "customs duty",
  "bond",
];

const FREIGHT_FILE_PATTERNS = [
  /inv/i,
  /invoice/i,
  /packing/i,
  /pl[-_]/i,
  /b[-_]?l[-_]/i,
  /bol/i,
  /awb/i,
  /hbl/i,
  /mbl/i,
  /shipment/i,
  /customs/i,
  /clearance/i,
  /cargo/i,
  /freight/i,
  /container/i,
  /bl[-_]\d/i,
  /coo/i,
  /delivery/i,
  /proforma/i,
  /booking/i,
];

function classifyByHeuristic(
  subject: string,
  attachmentFilenames: string[]
): { classification: "freight" | "non_freight" | "unknown"; confidence: number } {
  const subjectLower = subject.toLowerCase();
  let freightScore = 0;
  let totalChecks = FREIGHT_KEYWORDS.length + FREIGHT_FILE_PATTERNS.length * attachmentFilenames.length;

  if (totalChecks === 0) totalChecks = 1;

  // Check subject for freight keywords
  for (const keyword of FREIGHT_KEYWORDS) {
    if (subjectLower.includes(keyword)) {
      freightScore += 3; // Subject match is weighted more
    }
  }

  // Check attachment filenames
  for (const filename of attachmentFilenames) {
    const filenameLower = filename.toLowerCase();
    for (const pattern of FREIGHT_FILE_PATTERNS) {
      if (pattern.test(filenameLower)) {
        freightScore += 2; // Filename match is weighted
      }
    }
  }

  const confidence = freightScore / totalChecks;

  if (freightScore >= 3) {
    return { classification: "freight", confidence };
  } else if (freightScore === 0) {
    return { classification: "unknown", confidence: 0 };
  } else {
    return { classification: "unknown", confidence };
  }
}

async function classifyWithLLM(
  subject: string,
  from: string,
  bodyPreview: string
): Promise<"freight" | "non_freight"> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a freight forwarding email classifier for a South African logistics company. " +
            "Classify emails as 'freight' or 'non_freight' based on content. " +
            "Freight emails relate to: shipments, invoices, bills of lading, airway bills, customs, " +
            "cargo, import/export, containers, vessels, packing lists, clearance, forwarding. " +
            "Respond with ONLY the word 'freight' or 'non_freight'. No other text.",
        },
        {
          role: "user",
          content: `Subject: ${subject}\nFrom: ${from}\nBody: ${bodyPreview.substring(0, 2000)}`,
        },
      ],
      stream: false,
    });

    const content = response?.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    if (content.includes("freight") && !content.includes("non_freight")) {
      return "freight";
    }
    return "non_freight";
  } catch (err) {
    log("error", `LLM classification failed: ${err instanceof Error ? err.message : String(err)}`);
    return "unknown" as "non_freight";
  }
}

async function classifyEmail(
  subject: string,
  from: string,
  bodyPreview: string,
  attachmentFilenames: string[]
): Promise<{ classification: "freight" | "non_freight" | "unknown"; method: "heuristic" | "llm" }> {
  // Step 1: Try heuristic classification
  const heuristic = classifyByHeuristic(subject, attachmentFilenames);

  if (heuristic.classification === "freight") {
    return { classification: "freight", method: "heuristic" };
  }

  if (heuristic.classification === "unknown" && heuristic.confidence > 0) {
    // Borderline — try LLM
    const llmResult = await classifyWithLLM(subject, from, bodyPreview);
    return { classification: llmResult, method: "llm" };
  }

  // No freight signals at all — try LLM as last resort
  if (subject.length > 5 || bodyPreview.length > 50) {
    const llmResult = await classifyWithLLM(subject, from, bodyPreview);
    return { classification: llmResult, method: "llm" };
  }

  return { classification: "unknown", method: "heuristic" };
}

// ─── CargoIQ Ingestion Webhook ────────────────────────────────────────────────

async function postToCargoIQ(emailData: InboundEmailData): Promise<boolean> {
  try {
    const payload = {
      fromAddress: emailData.fromAddress,
      subject: emailData.subject,
      bodyPreview: emailData.bodyPreview,
      receivedAt: emailData.receivedAt,
      classification: emailData.classification,
      classificationMethod: emailData.classificationMethod,
      attachments: emailData.attachments.map((a) => ({
        filename: a.filename,
        fileType: a.fileType,
        base64Content: a.base64Content,
      })),
    };

    // Use XTransformPort for gateway routing
    const url = `${CARGOIQ_API_URL}/api/ingest/email?XTransformPort=3000`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      log("success", `Posted freight email to CargoIQ: "${emailData.subject}" (${emailData.attachments.length} attachments)`);
      return true;
    } else {
      const text = await response.text();
      log("error", `CargoIQ ingestion failed (${response.status}): ${text.substring(0, 200)}`);
      return false;
    }
  } catch (err) {
    log("error", `Failed to post to CargoIQ: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ─── IMAP Polling ─────────────────────────────────────────────────────────────

let imapClient: ImapFlow | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

function getReconnectDelay(): number {
  return Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
}

async function connectImap(): Promise<boolean> {
  if (DEMO_MODE) return false;

  try {
    imapClient = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: {
        user: IMAP_USER,
        pass: IMAP_PASS,
      },
      logger: false as any,
    });

    // Handle connection errors
    imapClient.on("error", (err: Error) => {
      log("error", `IMAP connection error: ${err.message}`);
      state.imapConnected = false;
    });

    imapClient.on("close", () => {
      state.imapConnected = false;
      log("warn", "IMAP connection closed");
    });

    await imapClient.connect();
    state.imapConnected = true;
    reconnectAttempts = 0;
    log("success", `Connected to IMAP: ${IMAP_HOST} as ${IMAP_USER}`);
    return true;
  } catch (err) {
    state.imapConnected = false;
    log("error", `IMAP connection failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function pollImap(): Promise<number> {
  if (!imapClient || !state.imapConnected) {
    const connected = await connectImap();
    if (!connected) return 0;
  }

  let processedCount = 0;

  try {
    const lock = await imapClient!.getMailboxLock(IMAP_FOLDER);
    try {
      // Fetch messages newer than last processed UID
      const fetchRange = state.lastProcessedUid > 0 ? `${state.lastProcessedUid + 1}:*` : "1:*";

      for await (const message of imapClient!.fetch(fetchRange, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        const uid = message.uid;
        if (!uid || uid <= state.lastProcessedUid) continue;

        try {
          const envelope = message.envelope;
          const from = envelope.from?.[0]?.address || "unknown@unknown.com";
          const subject = envelope.subject || "(No Subject)";
          const date = envelope.date || new Date();

          // Parse the email source for body and attachments
          const source = message.source;
          const bodyPreview = extractBodyFromSource(source);
          const attachments = extractAttachmentsFromSource(source);

          // Classify
          const attachmentFilenames = attachments.map((a) => a.filename);
          const { classification, method } = await classifyEmail(subject, from, bodyPreview, attachmentFilenames);

          const emailData: InboundEmailData = {
            fromAddress: from,
            subject,
            bodyPreview,
            receivedAt: date.toISOString(),
            attachments,
            classification,
            classificationMethod: method,
            uid,
          };

          // Process freight emails
          if (classification === "freight") {
            await postToCargoIQ(emailData);
            state.freightCount++;
          } else if (classification === "non_freight") {
            state.nonFreightCount++;
            log("info", `Non-freight email skipped: "${subject}" from ${from}`);
          } else {
            state.unknownCount++;
            log("info", `Unclassified email: "${subject}" from ${from}`);
          }

          state.emailsProcessed++;
          state.attachmentsExtracted += attachments.length;
          state.lastProcessedUid = uid;

          processedCount++;
        } catch (msgErr) {
          log("error", `Error processing message UID ${uid}: ${msgErr instanceof Error ? msgErr.message : String(msgErr)}`);
        }
      }

      // Try to move processed to "Processed" folder
      if (processedCount > 0) {
        try {
          await imapClient!.mailboxCreate("Processed").catch(() => {});
          // Note: moving messages would require more complex logic
          // For now, we track via UID
        } catch {
          // Folder may already exist
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    log("error", `IMAP poll error: ${err instanceof Error ? err.message : String(err)}`);
    state.imapConnected = false;

    // Attempt reconnection with exponential backoff
    reconnectAttempts++;
    const delay = getReconnectDelay();
    log("info", `Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
    setTimeout(async () => {
      await connectImap();
    }, delay);
  }

  return processedCount;
}

// ─── Email Source Parsing (Simplified) ────────────────────────────────────────

function extractBodyFromSource(source: Buffer): string {
  const text = source.toString("utf-8");
  // Simple extraction: find text/plain content
  const plainMatch = text.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\nContent-Type:|$)/i);
  if (plainMatch) {
    let body = plainMatch[1].trim();
    // Remove quoted-printable encoding markers
    body = body.replace(/=\r?\n/g, "");
    body = body.replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return body.substring(0, 5000);
  }

  // Fallback: just take any readable text after headers
  const headerEnd = text.indexOf("\r\n\r\n");
  if (headerEnd > -1) {
    return text.substring(headerEnd + 4, headerEnd + 5004).replace(/=\r?\n/g, "");
  }

  return text.substring(0, 2000);
}

function extractAttachmentsFromSource(source: Buffer): ProcessedAttachment[] {
  const attachments: ProcessedAttachment[] = [];
  const text = source.toString("binary");

  // Find multipart boundary
  const boundaryMatch = text.match(/boundary="?([^"\r\n]+)"?/i);
  if (!boundaryMatch) return attachments;

  const boundary = boundaryMatch[1];
  const parts = text.split(`--${boundary}`);

  for (const part of parts) {
    // Check for Content-Disposition: attachment
    const dispositionMatch = part.match(/Content-Disposition:\s*attachment;\s*filename="?([^"\r\n]+)"?/i);
    if (!dispositionMatch) continue;

    const filename = dispositionMatch[1];
    const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream";

    // Extract attachment content (after double CRLF)
    const contentStart = part.indexOf("\r\n\r\n");
    if (contentStart === -1) continue;

    let content = part.substring(contentStart + 4);
    // Trim trailing boundary markers
    content = content.replace(/\r?\n--.*$/, "").trimEnd();

    // Check if base64 encoded
    const encodingMatch = part.match(/Content-Transfer-Encoding:\s*base64/i);
    let base64Content: string;

    if (encodingMatch) {
      // Already base64, just clean it up
      base64Content = content.replace(/[\r\n\s]/g, "");
    } else {
      // Encode the raw content to base64
      try {
        const buf = Buffer.from(content, "binary");
        base64Content = buf.toString("base64");
      } catch {
        continue;
      }
    }

    // Determine file type
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const fileType = getFileType(ext, contentType);

    attachments.push({
      filename,
      fileType,
      base64Content,
    });
  }

  return attachments;
}

function getFileType(ext: string, contentType: string): string {
  const typeMap: Record<string, string> = {
    pdf: "pdf",
    doc: "docx",
    docx: "docx",
    xls: "xlsx",
    xlsx: "xlsx",
    png: "png",
    jpg: "jpg",
    jpeg: "jpg",
    gif: "gif",
    tif: "tiff",
    tiff: "tiff",
    zip: "zip",
    csv: "csv",
    txt: "txt",
    rtf: "rtf",
  };

  if (typeMap[ext]) return typeMap[ext];

  // Try content type
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("word") || contentType.includes("document")) return "docx";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "xlsx";
  if (contentType.includes("image")) return "img";

  return ext || "unknown";
}

// ─── Demo Mode ────────────────────────────────────────────────────────────────

const DEMO_SENDERS = [
  "operations@maersk.com",
  "shipping@msc.com",
  "logistics@cma-cgm.com",
  "forwarding@bidcargo.co.za",
  "customs@prospect.co.za",
  "operations@grindrod.co.za",
  "shipping@safmarine.com",
  "logistics@imperial.co.za",
  "cargo@transnet.net",
  "freight@barloworld.co.za",
];

const DEMO_SUBJECTS = [
  "Shipment Documents: INV-2026-{num} / B/L MAFU-{num}",
  "Commercial Invoice & Packing List - Container MSKU-{num}",
  "AWB 157-{num} - Air Shipment from Shanghai to Johannesburg",
  "Customs Clearance Documents - Import {num}",
  "Freight Invoice #{num} - Durban to Cape Town",
  "B/L COSA-{num} - Vessel COSCO FORTUNE - ETD Durban",
  "Packing List & Invoice for Shipment #{num}",
  "Import Clearance: Container TCLU-{num} - Arrived Port Elizabeth",
  "Export Documentation - Booking Ref BK-{num}",
  "Proforma Invoice - Cargo Shipment {num} - CIF Durban",
  "Delivery Note - Warehouse Release #{num}",
  "House Bill of Lading HBL-{num} - Consolidated Shipment",
];

const DEMO_ATTACHMENT_TEMPLATES = [
  { filename: "INV-2026-{num}.pdf", fileType: "pdf", type: "commercial_invoice" },
  { filename: "PL-2026-{num}.pdf", fileType: "pdf", type: "packing_list" },
  { filename: "B-L-MAFU-{num}.pdf", fileType: "pdf", type: "bill_of_lading" },
  { filename: "AWB-157-{num}.pdf", fileType: "pdf", type: "airway_bill" },
  { filename: "Customs-Declaration-{num}.pdf", fileType: "pdf", type: "customs_declaration" },
  { filename: "Packing-List-{num}.xlsx", fileType: "xlsx", type: "packing_list" },
  { filename: "COO-{num}.pdf", fileType: "pdf", type: "certificate_of_origin" },
  { filename: "Delivery-Note-{num}.pdf", fileType: "pdf", type: "delivery_note" },
];

function generateDemoEmail(): InboundEmailData {
  const num = String(40000 + Math.floor(Math.random() * 9999));
  const sender = DEMO_SENDERS[Math.floor(Math.random() * DEMO_SENDERS.length)];
  const subject = DEMO_SUBJECTS[Math.floor(Math.random() * DEMO_SUBJECTS.length)].replaceAll("{num}", num);

  // Generate 1-3 attachments
  const attachmentCount = 1 + Math.floor(Math.random() * 3);
  const attachments: ProcessedAttachment[] = [];

  const usedIndices = new Set<number>();
  for (let i = 0; i < attachmentCount; i++) {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * DEMO_ATTACHMENT_TEMPLATES.length);
    } while (usedIndices.has(idx) && usedIndices.size < DEMO_ATTACHMENT_TEMPLATES.length);
    usedIndices.add(idx);

    const template = DEMO_ATTACHMENT_TEMPLATES[idx];
    const filename = template.filename.replaceAll("{num}", num);

    // Generate a minimal fake PDF/content in base64
    const fakeContent = generateFakeAttachmentContent(template.type, num);
    attachments.push({
      filename,
      fileType: template.fileType,
      base64Content: fakeContent,
    });
  }

  // Body preview
  const bodyPreview = generateDemoBody(subject, sender, num);

  return {
    fromAddress: sender,
    subject,
    bodyPreview,
    receivedAt: new Date().toISOString(),
    attachments,
    classification: "freight",
    classificationMethod: "demo",
  };
}

function generateFakeAttachmentContent(type: string, num: string): string {
  // Generate minimal content that looks like the right type
  const content = `[CargoIQ Demo Attachment - ${type} #${num}]

This is a simulated freight document for development purposes.
Generated at: ${new Date().toISOString()}

Document Type: ${type}
Reference: ${num}
Status: DEMO

--- DOCUMENT CONTENT ---
Shipper: Demo Shipping Co.
Consignee: Demo Imports (Pty) Ltd
Origin: CNSHA (Shanghai)
Destination: ZADUR (Durban)
Gross Weight: ${(1000 + Math.random() * 20000).toFixed(1)} KGS
Net Weight: ${(800 + Math.random() * 18000).toFixed(1)} KGS
Packages: ${Math.floor(1 + Math.random() * 500)}
HS Code: ${String(10000000 + Math.floor(Math.random() * 89999999))}
Invoice Value: USD ${(5000 + Math.random() * 95000).toFixed(2)}
Incoterms: CIF
--- END DOCUMENT ---`;

  return Buffer.from(content).toString("base64");
}

function generateDemoBody(subject: string, sender: string, num: string): string {
  return `Dear CargoIQ Team,

Please find attached the shipping documents for your reference.

Subject: ${subject}
Reference: ${num}
From: ${sender}

Kindly process the attached documents at your earliest convenience.
Should you require any additional information, please do not hesitate to contact us.

Best regards,
Operations Team
${sender}`;
}

async function runDemoMode(): Promise<void> {
  const email = generateDemoEmail();
  log("info", `[DEMO] Generated freight email: "${email.subject}" from ${email.fromAddress} (${email.attachments.length} attachments)`);

  // Post to CargoIQ
  await postToCargoIQ(email);

  state.emailsProcessed++;
  state.freightCount++;
  state.attachmentsExtracted += email.attachments.length;
  state.lastPollTime = new Date().toISOString();
  saveState(state);
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────

let isPolling = false;

async function performPoll(): Promise<number> {
  if (isPolling) {
    log("warn", "Poll already in progress, skipping");
    return 0;
  }

  isPolling = true;
  let count = 0;

  try {
    if (DEMO_MODE) {
      await runDemoMode();
      count = 1;
    } else {
      count = await pollImap();
    }

    state.lastPollTime = new Date().toISOString();
    saveState(state);

    if (count > 0) {
      log("success", `Poll complete: processed ${count} email(s)`);
    }
  } catch (err) {
    log("error", `Poll error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isPolling = false;
  }

  return count;
}

function startPollLoop(): void {
  const interval = DEMO_MODE ? DEMO_INTERVAL_MS : POLL_INTERVAL_MS;

  const tick = async () => {
    await performPoll();
    pollTimer = setTimeout(tick, interval);
  };

  // Initial poll after 3 seconds
  pollTimer = setTimeout(tick, 3000);
  log("info", `Poll loop started (interval: ${interval}ms, mode: ${DEMO_MODE ? "DEMO" : "IMAP"})`);
}

function stopPollLoop(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function buildDashboardHTML(): string {
  const recentLogs = state.processingLog.slice(-20).reverse();
  const mode = DEMO_MODE ? "DEMO" : "IMAP";
  const modeColor = DEMO_MODE ? "#f59e0b" : "#10b981";
  const connectedColor = state.imapConnected ? "#10b981" : "#ef4444";
  const connectedText = DEMO_MODE ? "Demo Mode" : (state.imapConnected ? "Connected" : "Disconnected");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CargoIQ Email Ingestion Service</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
    }
    .header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 20px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      color: #f0f6fc;
    }
    .header h1 span { color: #d4a017; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 32px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
    }
    .stat-card .label {
      font-size: 12px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: 700;
      color: #f0f6fc;
    }
    .stat-card .value.freight { color: #10b981; }
    .stat-card .value.non-freight { color: #6b7280; }
    .stat-card .value.unknown { color: #f59e0b; }
    .section {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #30363d;
    }
    .section-header h2 {
      font-size: 14px;
      font-weight: 600;
      color: #f0f6fc;
    }
    .btn {
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #30363d;
      background: #21262d;
      color: #c9d1d9;
      transition: all 0.15s;
    }
    .btn:hover { background: #30363d; }
    .btn-primary {
      background: #d4a017;
      color: #000;
      border-color: #d4a017;
    }
    .btn-primary:hover { background: #b8860b; }
    .log-list {
      max-height: 480px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #30363d #0d1117;
    }
    .log-list::-webkit-scrollbar { width: 8px; }
    .log-list::-webkit-scrollbar-track { background: #0d1117; }
    .log-list::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
    .log-entry {
      display: flex;
      gap: 12px;
      padding: 10px 20px;
      border-bottom: 1px solid #21262d;
      font-size: 13px;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .log-entry:hover { background: #161b22; }
    .log-time { color: #8b949e; white-space: nowrap; min-width: 160px; }
    .log-type { min-width: 20px; }
    .log-msg { color: #c9d1d9; word-break: break-word; }
    .log-msg.error { color: #f85149; }
    .log-msg.success { color: #3fb950; }
    .log-msg.warn { color: #d29922; }
    .classification-bar {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 12px;
    }
    .classification-bar .freight { background: #10b981; }
    .classification-bar .non-freight { background: #6b7280; }
    .classification-bar .unknown { background: #f59e0b; }
    .classification-legend {
      display: flex;
      gap: 24px;
      margin-top: 8px;
      font-size: 12px;
    }
    .classification-legend span { display: flex; align-items: center; gap: 6px; }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid #21262d;
      font-size: 13px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-key { color: #8b949e; }
    .info-value { color: #f0f6fc; font-weight: 500; }
    .api-links {
      padding: 16px 20px;
      font-size: 13px;
    }
    .api-links a {
      color: #58a6ff;
      text-decoration: none;
    }
    .api-links a:hover { text-decoration: underline; }
    .api-links code {
      background: #21262d;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', monospace;
      font-size: 12px;
    }
    @media (max-width: 768px) {
      .container { padding: 16px; }
      .header { padding: 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .stat-card { padding: 12px; }
      .stat-card .value { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Cargo<span>IQ</span> Email Ingestion</h1>
    <div style="display:flex; gap:12px; align-items:center;">
      <span class="badge" style="background:${modeColor}22; color:${modeColor}; border:1px solid ${modeColor}44;">
        <span class="badge-dot" style="background:${modeColor};"></span>
        ${mode} Mode
      </span>
      ${!DEMO_MODE ? `<span class="badge" style="background:${connectedColor}22; color:${connectedColor}; border:1px solid ${connectedColor}44;">
        <span class="badge-dot" style="background:${connectedColor};"></span>
        ${connectedText}
      </span>` : ''}
    </div>
  </div>

  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Emails Processed</div>
        <div class="value">${state.emailsProcessed}</div>
      </div>
      <div class="stat-card">
        <div class="label">Attachments Extracted</div>
        <div class="value">${state.attachmentsExtracted}</div>
      </div>
      <div class="stat-card">
        <div class="label">Freight Emails</div>
        <div class="value freight">${state.freightCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Non-Freight</div>
        <div class="value non-freight">${state.nonFreightCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Unclassified</div>
        <div class="value unknown">${state.unknownCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Last Poll</div>
        <div class="value" style="font-size:14px;">${state.lastPollTime ? new Date(state.lastPollTime).toLocaleString() : "Never"}</div>
      </div>
    </div>

    ${
      state.emailsProcessed > 0 ? `
    <div style="margin-bottom:24px;">
      <div class="classification-bar">
        ${state.freightCount > 0 ? `<div class="freight" style="width:${(state.freightCount / state.emailsProcessed * 100).toFixed(1)}%"></div>` : ''}
        ${state.nonFreightCount > 0 ? `<div class="non-freight" style="width:${(state.nonFreightCount / state.emailsProcessed * 100).toFixed(1)}%"></div>` : ''}
        ${state.unknownCount > 0 ? `<div class="unknown" style="width:${(state.unknownCount / state.emailsProcessed * 100).toFixed(1)}%"></div>` : ''}
      </div>
      <div class="classification-legend">
        <span><span class="legend-dot" style="background:#10b981;"></span> Freight (${state.emailsProcessed > 0 ? (state.freightCount / state.emailsProcessed * 100).toFixed(1) : 0}%)</span>
        <span><span class="legend-dot" style="background:#6b7280;"></span> Non-Freight (${state.emailsProcessed > 0 ? (state.nonFreightCount / state.emailsProcessed * 100).toFixed(1) : 0}%)</span>
        <span><span class="legend-dot" style="background:#f59e0b;"></span> Unknown (${state.emailsProcessed > 0 ? (state.unknownCount / state.emailsProcessed * 100).toFixed(1) : 0}%)</span>
      </div>
    </div>
    ` : ''
    }

    <div class="section">
      <div class="section-header">
        <h2>Service Configuration</h2>
        <button class="btn btn-primary" onclick="triggerPoll()">Trigger Poll Now</button>
      </div>
      <div class="info-row">
        <span class="info-key">Mode</span>
        <span class="info-value">${DEMO_MODE ? "Demo (no IMAP credentials)" : "IMAP Live"}</span>
      </div>
      <div class="info-row">
        <span class="info-key">IMAP Host</span>
        <span class="info-value">${DEMO_MODE ? "N/A" : IMAP_HOST}</span>
      </div>
      <div class="info-row">
        <span class="info-key">IMAP User</span>
        <span class="info-value">${DEMO_MODE ? "N/A" : IMAP_USER}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Poll Interval</span>
        <span class="info-value">${DEMO_MODE ? "60s (demo)" : `${POLL_INTERVAL_MS / 1000}s`}</span>
      </div>
      <div class="info-row">
        <span class="info-key">CargoIQ API</span>
        <span class="info-value">${CARGOIQ_API_URL}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Last Processed UID</span>
        <span class="info-value">${state.lastProcessedUid}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Service Uptime</span>
        <span class="info-value" id="uptime">-</span>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Recent Processing Log (Last 20)</h2>
      </div>
      <div class="log-list">
        ${
          recentLogs.length === 0
            ? '<div class="log-entry"><span class="log-msg" style="color:#8b949e;">No entries yet. Waiting for first poll...</span></div>'
            : recentLogs.map((entry) => `
          <div class="log-entry">
            <span class="log-time">${new Date(entry.timestamp).toLocaleString()}</span>
            <span class="log-type">${
              entry.type === "error" ? "❌" :
              entry.type === "success" ? "✅" :
              entry.type === "warn" ? "⚠️" : "ℹ️"
            }</span>
            <span class="log-msg ${entry.type}">${escapeHtml(entry.message)}</span>
          </div>
        `).join("")
        }
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>API Endpoints</h2>
      </div>
      <div class="api-links">
        <p><code>GET /</code> — This dashboard</p>
        <p><code>GET /api/status</code> — <a href="/api/status">JSON status API</a></p>
        <p><code>POST /api/trigger</code> — Manually trigger email poll</p>
        <p><code>POST /api/webhook</code> — Receive email data via webhook (SendGrid/Mailgun)</p>
      </div>
    </div>
  </div>

  <script>
    const startTime = Date.now();
    function updateUptime() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      document.getElementById('uptime').textContent =
        h + 'h ' + m + 'm ' + s + 's';
    }
    setInterval(updateUptime, 1000);
    updateUptime();

    async function triggerPoll() {
      try {
        const res = await fetch('/api/trigger', { method: 'POST' });
        const data = await res.json();
        alert('Poll triggered! Processed ' + data.emailsProcessed + ' email(s).');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        alert('Error triggering poll: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStatusJSON() {
  return {
    service: "cargoiq-email-ingestion",
    version: "1.0.0",
    mode: DEMO_MODE ? "demo" : "imap",
    imap: {
      host: DEMO_MODE ? null : IMAP_HOST,
      user: DEMO_MODE ? null : IMAP_USER,
      connected: state.imapConnected,
      folder: DEMO_MODE ? null : IMAP_FOLDER,
    },
    lastPollTime: state.lastPollTime,
    lastProcessedUid: state.lastProcessedUid,
    stats: {
      emailsProcessed: state.emailsProcessed,
      attachmentsExtracted: state.attachmentsExtracted,
      freightCount: state.freightCount,
      nonFreightCount: state.nonFreightCount,
      unknownCount: state.unknownCount,
    },
    pollInterval: DEMO_MODE ? DEMO_INTERVAL_MS : POLL_INTERVAL_MS,
    recentLog: state.processingLog.slice(-20).reverse(),
    timestamp: new Date().toISOString(),
  };
}

const serverStartTime = Date.now();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET / — Dashboard
  if (req.method === "GET" && url.pathname === "/") {
    const html = buildDashboardHTML();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // GET /api/status — JSON status
  if (req.method === "GET" && url.pathname === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildStatusJSON(), null, 2));
    return;
  }

  // POST /api/trigger — Manual poll trigger
  if (req.method === "POST" && url.pathname === "/api/trigger") {
    log("info", "Manual poll triggered via API");
    const count = await performPoll();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      emailsProcessed: count,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // POST /api/webhook — Webhook receiver
  if (req.method === "POST" && url.pathname === "/api/webhook") {
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      const data = JSON.parse(body);
      const { from: fromAddress, subject, body: bodyPreview, attachments: webhookAttachments } = data;

      if (!fromAddress || !subject) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing required fields: from, subject" }));
        return;
      }

      log("info", `Webhook received: "${subject}" from ${fromAddress}`);

      const attachments: ProcessedAttachment[] = (webhookAttachments || []).map(
        (a: { filename: string; contentType: string; content: string }) => ({
          filename: a.filename || "unknown",
          fileType: getFileType(a.filename?.split(".").pop()?.toLowerCase() || "", a.contentType || ""),
          base64Content: a.content || "",
        })
      );

      const attachmentFilenames = attachments.map((a) => a.filename);
      const { classification, method } = await classifyEmail(subject, fromAddress, bodyPreview || "", attachmentFilenames);

      const emailData: InboundEmailData = {
        fromAddress,
        subject,
        bodyPreview: bodyPreview || "",
        receivedAt: new Date().toISOString(),
        attachments,
        classification,
        classificationMethod: method,
      };

      if (classification === "freight") {
        await postToCargoIQ(emailData);
        state.freightCount++;
      } else if (classification === "non_freight") {
        state.nonFreightCount++;
        log("info", `Webhook: Non-freight email skipped: "${subject}"`);
      } else {
        state.unknownCount++;
        log("info", `Webhook: Unclassified email: "${subject}"`);
      }

      state.emailsProcessed++;
      state.attachmentsExtracted += attachments.length;
      state.lastPollTime = new Date().toISOString();
      saveState(state);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        classification,
        classificationMethod: method,
        attachmentsReceived: attachments.length,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      log("error", `Webhook processing error: ${err instanceof Error ? err.message : String(err)}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error", message: err instanceof Error ? err.message : "Unknown error" }));
    }
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  log("info", `Received ${signal}, shutting down gracefully...`);
  stopPollLoop();

  if (imapClient && state.imapConnected) {
    try {
      await imapClient.logout();
      log("info", "IMAP connection closed");
    } catch {
      // Ignore errors on shutdown
    }
  }

  saveState(state);

  server.close(() => {
    log("info", "HTTP server closed");
    process.exit(0);
  });

  // Force exit after 5s
  setTimeout(() => {
    process.exit(0);
  }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Start Service ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  log("info", `CargoIQ Email Ingestion Service started on port ${PORT}`);
  log("info", `Mode: ${DEMO_MODE ? "DEMO (no IMAP credentials configured)" : "IMAP LIVE"}`);

  if (DEMO_MODE) {
    log("info", "Set IMAP_HOST, IMAP_USER, IMAP_PASS environment variables to enable live IMAP polling");
  }

  startPollLoop();
});
