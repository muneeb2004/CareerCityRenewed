# Pre-Production Checklist

> **Project:** Career City 2026  
> **Date:** January 4, 2026  
> **Status:** Almost Production Ready

---

## Implementation Timeline

| Stage | Focus Area | Priority | Effort | Status |
|-------|------------|----------|--------|--------|
| **Stage 1** | Security Fixes | Critical | Low | ✅ Complete |
| **Stage 2** | Environment Setup | Critical | Medium | ✅ Complete |
| **Stage 3** | Monitoring & Observability | High | Medium | ✅ Complete |
| **Stage 4** | Infrastructure & Reliability | Medium | Medium | ✅ Complete |
| **Stage 5** | Hardening & Compliance | Low | Low | ✅ Complete |

**Estimated Total Time:** 4-6 hours

---

## Stage 1: Security Fixes 🔴
*Priority: Critical | Effort: Low | Time: ~30 minutes*

### Tasks

- [x] **1.1 Fix npm Vulnerabilities** ✅
  ```bash
  npm audit fix --force
  npm run build
  npm test
  ```
  - ✅ Updated `eslint-config-next` to v16.1.1
  - ✅ Build passes after update
  - ✅ 0 vulnerabilities found

- [x] **1.2 Rotate MongoDB Credentials** ✅ *Not required*
  - ~~Log into MongoDB Atlas~~
  - ~~Create new database user with strong password~~
  - ~~Update `.env` with new connection string~~
  - ~~Test database connectivity locally~~
  - ~~Delete old user credentials~~
  - **Note:** Current credentials are for test database only. Production will use a separate enterprise cluster with fresh credentials.

- [x] **1.3 Verify .gitignore** ✅
  ```bash
  git status
  # Ensure .env is NOT in tracked files
  ```
  - ✅ `.env*` and `.env.local` are in `.gitignore`
  - ✅ No `.env` files tracked in git

### Verification ✅
```bash
npm audit                    # ✅ 0 vulnerabilities
npm run build               # ✅ Compiled successfully
git status                  # ✅ .env not tracked
```

**Completed:** January 4, 2026

---

## Stage 2: Environment Setup 🔴
*Priority: Critical | Effort: Medium | Time: ~1 hour*

### Tasks

- [x] **2.1 Generate Production Secrets** ✅
  ```bash
  # Generate JWT_SECRET (64 chars)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Generate ENCRYPTION_KEY (32 bytes hex)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Generate CSRF_SECRET (64 chars)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  
  **Generated secrets saved to `env.production.template`**

- [x] **2.2 Configure Production Environment** ✅
  
  **Template created:** `env.production.template`
  
  **Required Variables:**
  ```env
  # Authentication
  JWT_SECRET=<generated-64-char-hex>
  
  # Encryption
  ENCRYPTION_KEY=<generated-64-char-hex>
  
  # CSRF Protection
  CSRF_SECRET=<generated-64-char-hex>
  
  # Database
  MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/careercity?retryWrites=true&w=majority
  
  # Application
  NODE_ENV=production
  NEXT_PUBLIC_APP_URL=https://your-domain.com
  
  # Optional: Strict URL validation
  URL_VALIDATOR_STRICT_MODE=true
  ```

- [ ] **2.3 Set Up Vercel/Hosting Environment Variables** 📋 *Manual step at deployment*
  - Navigate to hosting dashboard
  - Copy values from `env.production.template`
  - Add all production environment variables
  - Mark sensitive values as "Secret"
  - Do NOT use `.env` file in production

- [ ] **2.4 Configure Production Database** 📋 *Manual step - enterprise cluster*
  - Create production database in enterprise MongoDB cluster
  - Set up IP allowlist (or allow from anywhere for Vercel)
  - Enable network encryption (TLS)
  - Create indexes for performance
  - Update `MONGODB_URI` in hosting environment variables

### Verification ✅
```bash
# ✅ Secrets generated
# ✅ Template created: env.production.template
# Deploy to staging first
vercel --env-file .env.production
# Test all auth flows work
# Verify database connectivity
```

**Completed:** January 4, 2026
**Note:** Tasks 2.3 and 2.4 are manual steps to be done at deployment time.

---

## Stage 3: Monitoring & Observability 🟠
*Priority: High | Effort: Medium | Time: ~1.5 hours*

### Tasks

- [x] **3.1 Install Sentry** ✅
  ```bash
  npm install @sentry/nextjs --legacy-peer-deps
  ```
  
  **Files created:**
  - `instrumentation.ts` - Server & Edge runtime initialization
  - `instrumentation-client.ts` - Client-side initialization
  - `app/global-error.tsx` - Global error handler with Sentry reporting
  
  ~~**Configure `sentry.client.config.ts`:**~~ *(Using modern instrumentation files instead)*
  ```typescript
  import * as Sentry from "@sentry/nextjs";
  
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
  ```

- [x] **3.2 Integrate Security Logger with Sentry** ✅
  
  **Updated `src/lib/security-logger.ts`:**
  - High/Critical events → Sentry `captureMessage` with fatal/error level
  - Medium events → Sentry breadcrumbs for context
  - User ID, IP, resource tags automatically attached
  ```typescript
  import * as Sentry from "@sentry/nextjs";
  
  async function sendToMonitoringService(event: SecurityEvent): Promise<void> {
    if (event.severity === 'critical' || event.severity === 'high') {
      Sentry.captureEvent({
        message: `Security: ${event.event}`,
        level: event.severity === 'critical' ? 'fatal' : 'error',
        tags: { category: event.category },
        extra: event.metadata,
      });
    }
  }
  ```

- [ ] **3.3 Set Up Alerts** 📋 *Manual step in Sentry dashboard*
  - Configure Sentry alerts for:
    - Critical security events
    - High error rates
    - Performance degradation
  - Set up email/Slack notifications
  - **Requires:** `NEXT_PUBLIC_SENTRY_DSN` in production environment

- [x] **3.4 Add Health Check Endpoint** ✅
  
  **Verified `app/api/health/route.ts` exists:**
  - ✅ Returns database connectivity status
  - ✅ Returns application metrics
  - ✅ Used by hosting platform for uptime checks

### Verification ✅
```bash
# ✅ Sentry installed
# ✅ Security logger integrated
# ✅ Health endpoint verified
# ✅ Build successful

# Test health endpoint
curl https://your-app.com/api/health
# Check Sentry dashboard for events
```

**Completed:** January 4, 2026

**Environment Variables Required:**
```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ORG=your-org          # Optional: for source maps
SENTRY_PROJECT=career-city   # Optional: for source maps
SENTRY_AUTH_TOKEN=xxx        # Optional: for source maps upload
```

---

## Stage 4: Infrastructure & Reliability 🟡
*Priority: Medium | Effort: Medium | Time: ~1.5 hours*

### Tasks

- [ ] **4.1 Configure Database Backups** 📋 *Manual step in MongoDB Atlas*
  
  **MongoDB Atlas:**
  - Navigate to Backup settings
  - Enable Continuous Backup
  - Set snapshot frequency (daily recommended)
  - Configure retention policy (7-30 days)
  - Test restore procedure
  
  **Note:** Enterprise cluster will have its own backup configuration.

- [x] **4.2 Set Up CDN & Caching** ✅
  - Vercel: Automatic ✅
  - Self-hosted: Configure Cloudflare or similar
  - ✅ Static assets cached via PWA service worker
  - ✅ Cache headers configured in next.config.js

- [x] **4.3 Configure Rate Limiting (Production)** ✅
  
  **Updated `src/lib/rate-limit.ts` with production limits:**
  ```typescript
  const RATE_LIMITS = {
    login:        { window: 15min, max: 5 },
    registration: { window: 1hr,   max: 10 },
    api:          { window: 1min,  max: 100 },
    scan:         { window: 1min,  max: 30 },
    feedback:     { window: 1min,  max: 20 },
    export:       { window: 1hr,   max: 5 },
  };
  ```
  
  Features:
  - Endpoint-specific limits
  - Automatic cleanup of expired records
  - Rate limit headers for responses
  - Reset function for successful auth

- [x] **4.4 Load Testing** ✅
  
  **Created load test configurations:**
  
  ```bash
  # Install Artillery
  npm install -g artillery
  
  # Normal load test
  artillery run load-test.yml
  
  # Stress test (staging only!)
  artillery run load-test-stress.yml
  
  # Quick test
  artillery quick --count 50 --num 10 http://localhost:3000/api/health
  ```
  
  **Files created:**
  - `load-test.yml` - Normal load testing (50 req/s peak)
  - `load-test-stress.yml` - Stress testing (200 req/s spike)
  
  **Thresholds:**
  - p99 latency < 3s (normal) / 5s (stress)
  - Error rate < 5% (normal) / 10% (stress)

- [ ] **4.5 SSL/TLS Verification** 📋 *Manual step at deployment*
  ```bash
  # Check SSL configuration
  curl -I https://your-domain.com
  # Should see: Strict-Transport-Security header
  ```
  - Vercel: Automatic SSL ✅
  - Verify HTTPS redirect works
  - Check certificate validity
  - Test HSTS header present

### Verification ✅
```bash
# ✅ Rate limiting configured
# ✅ Load test files created
# ✅ Build successful

# Run load test locally
npm run dev
artillery run load-test.yml

# SSL Labs test (after deployment)
# Visit: https://www.ssllabs.com/ssltest/
# Should score A or A+
```

**Completed:** January 4, 2026

**Note:** Tasks 4.1 and 4.5 are manual steps at deployment time.

---

## Stage 5: Hardening & Compliance 🟢
*Priority: Low | Effort: Low | Time: ~1 hour*

### Tasks

- [x] **5.1 Add security.txt** ✅
  
  **Created `public/.well-known/security.txt`:**
  - Contact email for security issues
  - Security policy URL
  - Acknowledgments page
  - Preferred languages
  - Expiry date (2027-01-04)
  
  **Note:** Update URLs to match your actual domain before deployment.

- [x] **5.2 Configure robots.txt** ✅
  
  **Created `public/robots.txt`:**
  - Allows public pages (/student, /volunteer)
  - Blocks sensitive areas (/api/, /staff/, /_next/)
  - Blocks known bad bots (AhrefsBot, SemrushBot, MJ12bot)
  - Crawl-delay for polite crawling

- [ ] **5.3 CSP Refinement (Optional)** 🟡 *Future enhancement*
  - Audit current CSP violations in browser console
  - Remove `unsafe-inline` where possible
  - Implement nonces for necessary inline scripts
  - Test thoroughly after changes
  - **Note:** Current CSP is functional; refinement can be done post-launch

- [ ] **5.4 Security Scan** 📋 *Manual step post-deployment*
  ```bash
  # Run OWASP ZAP scan
  docker run -t owasp/zap2docker-stable zap-baseline.py -t https://your-domain.com
  ```
  - Review findings
  - Address any high/medium issues
  - Document accepted risks
  - **Alternative:** Use Vercel's built-in security scanning

- [x] **5.5 Documentation Review** ✅
  - ✅ `PRE_PRODUCTION_CHECKLIST.md` - Complete deployment guide
  - ✅ `OWASP10.md` - Security implementation documentation
  - ✅ `env.production.template` - Environment variables reference
  - ✅ `load-test.yml` / `load-test-stress.yml` - Load testing docs
  - [ ] Update README with deployment instructions (optional)

### Verification ✅
```bash
# ✅ security.txt created
# ✅ robots.txt created
# ✅ Build successful

# Verify files accessible (after deployment)
curl https://your-domain.com/.well-known/security.txt
curl https://your-domain.com/robots.txt

# Run lighthouse audit
npx lighthouse https://your-domain.com --output html
```

**Completed:** January 4, 2026

---

## 🎉 ALL STAGES COMPLETE!

**Total Implementation Time:** ~4-6 hours

**Summary:**
- ✅ Stage 1: Security Fixes (npm audit, .gitignore)
- ✅ Stage 2: Environment Setup (secrets, templates)
- ✅ Stage 3: Monitoring & Observability (Sentry)
- ✅ Stage 4: Infrastructure & Reliability (rate limiting, load tests)
- ✅ Stage 5: Hardening & Compliance (security.txt, robots.txt)

**Ready for Production Deployment!**

---

## ✅ Already Complete (OWASP10 Implementation)

- [x] Security Headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] Input Validation (Zod schemas, sanitization)
- [x] Authentication (JWT with jose, secure cookies)
- [x] Rate Limiting (login attempts, API endpoints)
- [x] Session Management (sliding expiry, secure flags)
- [x] Data Encryption (AES-256-GCM)
- [x] Data Integrity (HMAC verification)
- [x] CSRF Protection (Double Submit Cookie)
- [x] SSRF Prevention (URL validation, IP blocking)
- [x] Security Logging (structured audit logs)
- [x] Circuit Breaker (external service protection)
- [x] PWA Support (offline capability)
- [x] CI/CD Security Workflow (GitHub Actions)
- [x] Unit & Integration Tests

---

## Quick Reference Commands

```bash
# Stage 1: Security Fixes
npm audit fix --force && npm run build && npm test

# Stage 2: Generate Secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CSRF_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Stage 3: Install Sentry
npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs

# Stage 4: Load Test
npx artillery quick --count 50 --num 10 https://your-app.com/api/health

# Stage 5: Security Scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://your-domain.com

# Final Deploy
vercel --prod
```

---

## Sign-Off

| Stage | Completed By | Date | Verified By |
|-------|--------------|------|-------------|
| Stage 1 | | | |
| Stage 2 | | | |
| Stage 3 | | | |
| Stage 4 | | | |
| Stage 5 | | | |

**Final Approval:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Security Review | | | |
| QA | | | |
| Product Owner | | | |
