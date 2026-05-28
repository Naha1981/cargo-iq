# Task 5 — CargoWise Integration (CargoIQ)

## Work Completed

### 1. CargoWise eAdaptor XML Generator — `/src/lib/cargowise-xml.ts`
- Generates WiseTech eAdaptor UniversalShipment XML for creating customs entries in CargoWise
- Follows the UniversalShipment v1.1 schema with proper namespaces
- Includes: ShipmentHeader (senderRef, consignmentNum, shipmentMode, direction, DRAFT status)
- Organization parties: Shipper, Consignee, NotifyParty with addresses
- Routing: originPort, destinationPort, vesselOrFlight, ETD, ETA
- Cargo details: description, HS codes, weights, package counts
- Commercial: invoice number, value, currency, incoterms
- Customs: declared values, VAT calculation
- Line items with HS codes, descriptions, quantities, weights, values
- XML escaping for special characters
- Shipment ALWAYS created in "Draft" status — NEVER submitted directly

### 2. CargoWise Execution API — `/src/app/api/cargowise/execute/route.ts`
- POST endpoint accepting `{ shipmentId }`
- Fetches shipment from DB with org's CargoWise config
- Generates eAdaptor XML via `generateShipmentXml()`
- Tries eAdaptor first (if org has cwServerUrl + cwCredentialsEnc)
- Falls back to Playwright simulation if eAdaptor fails or isn't configured
- Creates CwExecution record with full audit trail
- Updates shipment status to "cw_draft_created" on success
- Writes AuditLog entry
- Sends real-time notification via WebSocket (cw:draft_created / cw:draft_failed)
- Blocks execution if shieldStatus is "fail"

### 3. CargoWise Connection Test API — `/src/app/api/cargowise/test/route.ts`
- POST endpoint accepting org credentials
- Tests connection to eAdaptor endpoint
- Returns connection status with detailed error messages
- Updates org credentials on successful test

### 4. CargoWise Execution History API — `/src/app/api/cargowise/executions/route.ts`
- GET endpoint with filtering (orgId, shipmentId, status, executionType)
- Pagination support (limit, offset)
- Includes shipment reference data in response

### 5. Playwright Browser Automation Fallback — `/src/lib/cargowise-playwright.ts`
- SIMULATION of Playwright browser automation
- 8-step process: validate credentials → launch browser → navigate → login → create shipment → fill form → save draft → screenshot
- Realistic timing with jitter (2-3 seconds total)
- Returns stepsLog, screenshotUrl, draftUrl
- Creates CwExecution records with executionType: "playwright"
- Clearly documented as simulation

### 6. WebSocket Notification Service — `/mini-services/notification-service/`
- Socket.io service running on port 3003
- POST /emit endpoint for broadcasting events
- GET /health endpoint for monitoring
- 10 supported event types: shipment:created, shipment:updated, shipment:approved, shipment:rejected, shield:completed, cw:draft_created, cw:draft_failed, email:ingested, extraction:complete, notification
- Channel subscription support
- CORS configured for gateway proxy pattern
- Graceful shutdown handling

### 7. Notification Dispatch Helper — `/src/lib/notify.ts`
- `notify(event, data)` — sends POST to localhost:3003/emit
- `notifyShipment(event, shipmentId, extra)` — convenience for shipment events
- `notifyCw(event, shipmentId, extra)` — convenience for CW events
- Non-blocking: notification failures don't break main flow

### 8. Enhanced CargoWise View in `page.tsx`
- Real-time WebSocket connection to notification service (via socket.io-client)
- Connection test button calling /api/cargowise/test
- "Create CW Draft" button calling /api/cargowise/execute
- "Preview eAdaptor XML" button with syntax-highlighted XML display
- Live Notifications panel showing real-time events
- Integration Methods info panel (eAdaptor XML + Playwright)
- Demo toggle for connected/not-connected states
- Two-column layout with actions on left, notifications on right

## Key Design Decisions
- eAdaptor XML always creates shipments in "Draft" status only
- Playwright fallback is clearly documented as simulation
- WebSocket uses default Socket.io path (/socket.io/) to avoid conflict with HTTP endpoints
- Frontend connects via `io({ transports: ["websocket"], path: "/socket.io", query: { XTransformPort: "3003" } })`
- All CargoWise operations create CwExecution records for audit trail
- Notification failures are non-blocking (warn but don't throw)

## Files Created/Modified
- `/src/lib/cargowise-xml.ts` — NEW
- `/src/lib/cargowise-playwright.ts` — NEW
- `/src/lib/notify.ts` — NEW
- `/src/app/api/cargowise/execute/route.ts` — NEW
- `/src/app/api/cargowise/test/route.ts` — NEW
- `/src/app/api/cargowise/executions/route.ts` — NEW
- `/mini-services/notification-service/index.ts` — NEW
- `/mini-services/notification-service/package.json` — NEW
- `/src/app/page.tsx` — MODIFIED (CargoWise view enhanced with WebSocket + API integration)
