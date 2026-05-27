# Task 10-a — Security Libs Rebuilder

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `/src/middleware.ts` | Created | Production middleware with CORS, rate limiting, security headers, JWT auth |
| `/src/lib/crypto.ts` | Created | AES-256-GCM encryption service |
| `/src/lib/auth.ts` | Created | JWT authentication + tenant isolation |
| `/src/lib/api-utils.ts` | Created | Shared API utilities |
| `/Caddyfile` | Updated | Hardened config with port whitelist + security headers |

## Key Implementation Details

### Middleware (src/middleware.ts)
- CORS: Reads CORS_ALLOWED_ORIGINS env var (default: http://localhost:3000), NOT "*"
- Rate limiting: 30 req/min per IP sliding window on /api/ routes, returns 429 with Retry-After
- Security headers on ALL responses: X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, X-XSS-Protection: 1; mode=block, Referrer-Policy: strict-origin-when-cross-origin
- JWT auth on non-public /api/ routes (lazy-loads jose for Edge Runtime)
- Public routes: /api/health, /api/public, /api/seed
- Blocks /api/seed in production
- Dev/sandbox mode when JWT_SECRET_KEY not set
- Injects X-Org-Id and X-User-Id headers on successful JWT verify
- **Important fix**: Must use `NextResponse.next({ request: { headers } })` consistently in Next.js 16 — bare `NextResponse.next()` causes empty response bodies

### Crypto (src/lib/crypto.ts)
- AES-256-GCM with base64 payload: [IV 16B][AuthTag 16B][Ciphertext]
- Key derivation: ENCRYPTION_SECRET_KEY (base64url) → ENCRYPTION_KEY (scrypt) → dev default
- Ready for Organisation.cwCredentialsEnc field encryption

### Auth (src/lib/auth.ts)
- Uses jose library (Edge-compatible)
- Dev mode: {orgId: 'dev-org', userId: 'dev-user', email: 'dev@cargoiq.co.za'}
- requireAuth() returns AuthPayload | NextResponse (401)
- addOrgFilter() for Prisma tenant isolation

### API Utils (src/lib/api-utils.ts)
- getOrgIdFromRequest: header → query → first org in DB
- portToCountryCode: SA ports (ZADUR→ZA, ZACPT→ZA, ZAJNB→ZA, ZAPRI→ZA, ZAELN→ZA, ZARBY→ZA, ZASDB→ZA) + UN/LOCODE convention
- estimateZarValue: approximate rates for 8 currencies

### Caddyfile
- Port whitelist: 3000, 3002, 3003, 3099 only
- Security headers: SAMEORIGIN, HSTS, CSP, nosniff, COOP/COOP

## Verification
- All 4 source files pass ESLint with zero errors
- /api/health returns 200 + security headers
- /api/shipments returns 200 (dev-mode auth)
- Main page returns 200 with X-Frame-Options
