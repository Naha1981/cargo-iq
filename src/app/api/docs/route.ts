// GET /api/docs - API Documentation
import { NextResponse } from "next/server";

export async function GET() {
  const apiDocs = {
    name: "CargoIQ Platform API",
    version: "2.0.0",
    description: "South Africa's AI compliance and cost containment platform for freight forwarders",
    supabase: {
      note: "Supabase credentials are configured via environment variables. See .env.local for setup.",
    },
    auth: {
      type: "Bearer Token (Supabase JWT)",
      header: "Authorization: Bearer <supabase_access_token>",
      note: "Most endpoints work without auth for now. Pass the Supabase JWT in the Authorization header for org-scoped access.",
    },
    endpoints: [
      // Health & System
      { method: "GET", path: "/api/health", description: "Service health check", auth: false },
      { method: "POST", path: "/api/seed", description: "Seed database with demo data", auth: false },
      { method: "GET", path: "/api/docs", description: "This API documentation", auth: false },

      // Organisations
      { method: "GET", path: "/api/organisations", description: "List all organisations (optional: ?slug=xxx)", auth: false },
      { method: "POST", path: "/api/organisations", description: "Create a new organisation", auth: true, body: { name: "string", slug: "string", plan: "pilot|starter|growth|enterprise" } },
      { method: "GET", path: "/api/organisations/[id]", description: "Get organisation by ID with users and stats", auth: false },
      { method: "PATCH", path: "/api/organisations/[id]", description: "Update organisation (CW creds, settings)", auth: true },

      // Users
      { method: "GET", path: "/api/users", description: "List users (optional: ?orgId=xxx&email=xxx)", auth: false },
      { method: "POST", path: "/api/users", description: "Create a user in an organisation", auth: true, body: { orgId: "string", email: "string", fullName: "string", role: "admin|operations_manager|operator|viewer" } },

      // Shipments
      { method: "GET", path: "/api/shipments", description: "List shipments with filtering and pagination", auth: false, params: { status: "pending|review_required|approved|rejected|cw_draft_created|error", shield: "pass|hold|fail|pending", search: "text", page: "number", limit: "number" } },
      { method: "GET", path: "/api/shipments/[id]", description: "Get shipment detail with line items, docs, compliance", auth: false },
      { method: "PATCH", path: "/api/shipments/[id]", description: "Update shipment fields (user edit)", auth: true },
      { method: "POST", path: "/api/shipments/[id]/approve", description: "Approve shipment for CargoWise", auth: true, body: { acknowledgeRisks: "boolean", notes: "string" } },
      { method: "POST", path: "/api/shipments/[id]/reject", description: "Reject shipment", auth: true, body: { reason: "string (min 3 chars)" } },
      { method: "POST", path: "/api/shipments/[id]/shield", description: "Re-run compliance shield", auth: false },
      { method: "POST", path: "/api/shipments/create-from-extraction", description: "Create shipment from AI extraction data", auth: true },

      // Document Processing Pipeline
      { method: "POST", path: "/api/process", description: "Full pipeline: upload → AI extract → shipment → compliance", auth: false, body: "FormData: file, orgId?, docType?, source?" },
      { method: "POST", path: "/api/documents", description: "Upload a document (creates Document record)", auth: false, body: "FormData: file, doc_type?" },

      // AI Extraction
      { method: "POST", path: "/api/ai/extract", description: "AI document extraction (VLM for images/PDFs, LLM for text)", auth: false, body: "FormData: file?, text?, documentType?" },

      // Compliance
      { method: "POST", path: "/api/compliance", description: "Run compliance shield on raw data", auth: false, body: { invoice_data: "object", packing_list_data: "object", line_items: "array", origin_country_code: "string", customs_value_zar: "number", duties_zar: "number", declared_vat_zar: "number" } },

      // CargoWise
      { method: "POST", path: "/api/cargowise/execute", description: "Create CargoWise draft (eAdaptor XML + Playwright fallback)", auth: true, body: { shipmentId: "string" } },
      { method: "GET", path: "/api/cargowise/executions", description: "List CW execution history", auth: false, params: { shipmentId: "string", limit: "number" } },

      // Email Ingestion
      { method: "POST", path: "/api/ingest/email", description: "Ingest email with attachments (JSON body)", auth: false, body: { orgId: "string?", fromAddress: "string", subject: "string", bodyPreview: "string?", attachments: "Array<{filename, fileType, base64Content}>" } },

      // Analytics
      { method: "GET", path: "/api/analytics", description: "Dashboard analytics (counts, trends, shield summary)", auth: false },

      // RLA Status
      { method: "GET", path: "/api/rla-status", description: "List RLA statuses for an org (?orgId=xxx)", auth: false },
      { method: "POST", path: "/api/rla-status", description: "Add/update an RLA status", auth: true, body: { orgId: "string", importerCode: "string", importerName: "string", rlaStatus: "active|suspended|inactive|unverified" } },

      // WiseLayer
      { method: "GET", path: "/api/wiselayer", description: "WiseLayer cost optimization data (?orgId=xxx)", auth: false },
    ],
    webSocket: {
      url: "/?XTransformPort=3003",
      events: ["shipment:created", "shipment:approved", "shipment:rejected", "shield:completed", "cw:draft_created", "cw:draft_failed", "email:ingested", "notification"],
      note: "Connect via Socket.io client: io('/?XTransformPort=3003')",
    },
    dataModels: {
      shipment: {
        statuses: ["pending", "review_required", "approved", "rejected", "in_cargowise", "cw_draft_created", "error"],
        shieldStatuses: ["pass", "hold", "fail", "pending"],
        confidenceLevels: ["high", "medium", "low"],
        sources: ["email", "whatsapp", "manual_upload"],
      },
      organisation: {
        plans: ["pilot", "starter", "growth", "enterprise"],
        statuses: ["active", "suspended", "cancelled"],
      },
      user: {
        roles: ["admin", "operations_manager", "operator", "viewer"],
      },
      compliance: {
        modules: ["invoice_pl", "hs_code", "vat_engine"],
        results: ["pass", "hold", "fail"],
      },
    },
  };

  return NextResponse.json(apiDocs, {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}
