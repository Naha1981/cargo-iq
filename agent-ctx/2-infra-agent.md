# Task 2 — Infra Agent + Services Config Builder

## Summary
Created the CargoIQ infrastructure monitoring layer with a self-healing service monitor agent.

## Files Created
| File | Purpose |
|------|---------|
| `/infra/services.json` | Service registry with 2 entries (CargoIQ API + AI Worker) |
| `/infra/agent/monitor.ts` | Self-healing infra agent (~340 lines TypeScript) |
| `/infra/agent/package.json` | Standalone bun package for agent |
| `/infra/uptime/endpoints.txt` | Reference file for external uptime monitors |

## Key Features
- **ServiceStatus tracking**: alive / degraded / down states per service
- **checkService()**: HTTP health checks with configurable timeout (AbortController)
- **wakeService()**: Exponential backoff retries (1s → 2s → 4s → 8s → 16s, capped 30s)
- **Degraded mode**: 2+ failures = degraded, 5+ = down
- **Auto-recovery**: Logs RECOVERY event when degraded/down service returns
- **Dashboard** (port 3099): Dark-themed HTML with stats cards, service table, color-coded badges, 30s auto-refresh
- **JSON API** (GET /api/status): Full service metadata including uptime %, failure counts, timestamps
- **Graceful shutdown**: SIGINT/SIGTERM handlers clearing all timers

## Verification
- Agent starts and registers both services from services.json
- Health checks execute immediately on startup
- Dashboard returns HTTP 200 with HTML content
- `/api/status` returns proper JSON with all fields
- No Next.js dependencies — fully standalone

## How to Run
```bash
bun run infra/agent/monitor.ts
# Dashboard: http://localhost:3099
# API: http://localhost:3099/api/status
```
