# Task 10-c: API Routes Rebuilder

## Summary
Recreated 13 missing API routes for the CargoIQ platform that were lost during a session reset.

## Routes Created

1. **`/api/shipments/[id]/shield`** (POST) — Re-run compliance shield for a shipment
2. **`/api/shipments/create-from-extraction`** (POST) — Create shipment from pre-extracted data
3. **`/api/process`** (POST) — Main processing pipeline (FormData upload → AI extraction → shipment → shield)
4. **`/api/ingest/email`** (POST) — Email ingestion webhook with freight classification
5. **`/api/cargowise/execute`** (POST) — Execute CargoWise draft creation (eAdaptor → Playwright fallback)
6. **`/api/cargowise/executions`** (GET) — Execution history with filtering and pagination
7. **`/api/cargowise/test`** (POST) — Test CargoWise connection
8. **`/api/organisations`** (GET) — List organisations (scoped to authenticated org)
9. **`/api/organisations/[id]`** (GET) — Get single organisation with decrypted credentials
10. **`/api/users`** (GET) — List users scoped to authenticated org
11. **`/api/rla-status`** (GET) — RLA status with summary stats
12. **`/api/wiselayer`** (GET) — WiseLayer transaction data with compaction summary
13. **`/api/public/email-inbound`** (POST) — Public email inbound webhook (no auth)

## Key Implementation Details

- All routes import `db` from `@/lib/db` (not `@prisma/client` directly)
- All routes use `getOrgIdFromRequest` from `@/lib/api-utils` for tenant isolation
- Compliance Shield integration via `@/lib/compliance-engine` (runComplianceShield)
- Reference generation via `@/lib/reference-generator` (generateNextReference)
- AI extraction via `@/lib/ai-extraction` (extractFromDocument)
- CargoWise XML via `@/lib/cargowise-xml` (generateShipmentXml)
- Playwright simulation via `@/lib/cargowise-playwright` (simulateCargowiseEntry)
- Notifications via `@/lib/notify` (notifyShipment, notifyCw)
- Crypto via `@/lib/crypto` (safeDecrypt, isEncrypted)
- All routes have proper error handling with try/catch and status codes
- No `module` variable name used (Next.js lint rule)
- All existing routes left untouched

## Lint Results
- Zero errors in src/ files (15 errors exist only in dependency build artifacts)
