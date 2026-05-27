---
Task ID: 3
Agent: Pipeline API Builder
Task: Build Document Processing Pipeline API for CargoIQ

Work Log:
- Read all existing files: prisma schema, document upload, AI extraction, compliance shield, shipments, approve, reject, analytics, seed, db client, types, worklog
- Identified that /api/shipments/[id]/reject/route.ts already existed with full implementation
- Created /src/lib/prompts.ts — Shared AI prompts with EXTRACTION_SYSTEM_PROMPT, ExtractionResult type, DocumentType, defaultExtraction(), parseExtractionResponse() with line_items support
- Created /src/lib/compliance-engine.ts — Extracted all 3 compliance modules (checkInvoicePl, checkHsCode, checkSacuVat) plus runComplianceShield() wrapper from /api/compliance/route.ts for reuse
- Created /src/lib/reference-generator.ts — CIQ-YYYY-NNNNN reference generation using DB query for next number
- Created /src/lib/ai-extraction.ts — Shared AI extraction helper using z-ai-web-dev-sdk, supports file (VLM) and text (LLM) extraction paths
- Created /src/app/api/process/route.ts — Main processing pipeline: upload → save document → AI extraction → shipment creation → line items → link document → compliance shield → compliance events → audit logs
- Created /src/app/api/shipments/[id]/shield/route.ts — Re-run compliance shield: fetches shipment + line items, runs all 3 modules, updates shipment, creates compliance events, writes audit log
- Created /src/app/api/shipments/create-from-extraction/route.ts — Create shipment from pre-extracted data: accepts extracted fields + document info, creates shipment with reference, links documents, runs compliance shield
- Created /src/app/api/ingest/email/route.ts — Email ingestion webhook: accepts fromAddress/subject/bodyPreview/attachments, creates InboundEmail record, saves attachments to disk, creates Document records, classifies freight vs non-freight, triggers full processing pipeline for freight emails
- Updated /src/app/api/analytics/route.ts — Added: recentTrend (7-day counts), topOriginPorts (top 5), avgConfidenceBySource (email/whatsapp/manual_upload breakdown), shieldPassRate, pipelineStatus (counts per stage)
- Updated /src/app/api/compliance/route.ts — Refactored to import runComplianceShield from /src/lib/compliance-engine.ts, keeps same API interface
- Updated /src/app/api/ai/extract/route.ts — Refactored to import shared prompts from /src/lib/prompts.ts, keeps same API interface
- Fixed 4 lint errors: renamed `module` loop variable to `mod` in all 4 new API files to comply with @next/next/no-assign-module-variable rule
- Installed socket.io-client package (was missing dependency)
- All source file lint errors fixed (remaining 15 errors are from compiled dependency code, not our files)
- Dev server compiles and serves all new endpoints with 200 responses

Stage Summary:
- 4 shared libraries created: prompts.ts, compliance-engine.ts, reference-generator.ts, ai-extraction.ts
- 4 new API routes created: /api/process, /api/shipments/[id]/shield, /api/shipments/create-from-extraction, /api/ingest/email
- 3 existing routes updated: /api/compliance (imported from shared lib), /api/ai/extract (imported from shared lib), /api/analytics (enhanced with 5 new metrics)
- Full document processing pipeline operational: upload → AI extraction → shipment creation → compliance shield → audit logging
- Email ingestion with freight classification and automated pipeline triggering
- All lint checks pass for source files
