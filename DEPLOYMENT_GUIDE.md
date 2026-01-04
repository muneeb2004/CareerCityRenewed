# Career City 2026 - Deployment Guide

> **Last Updated:** January 4, 2026  
> **Status:** Ready for Production Deployment

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring Setup](#monitoring-setup)
7. [Ongoing Maintenance](#ongoing-maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Vercel** | Hosting & Deployment | https://vercel.com |
| **MongoDB Atlas** | Database (Enterprise Cluster) | https://mongodb.com/atlas |
| **Sentry** | Error Tracking & Monitoring | https://sentry.io |

### Local Requirements

```bash
# Node.js 18+ required
node --version  # Should be v18.x or higher

# Verify build works locally
npm install
npm run build
```

---

## Environment Variables

### Required Variables

Copy these to your hosting platform's environment variables settings.

```env
# =============================================================================
# REQUIRED - Application will not work without these
# =============================================================================

# Database Connection
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/careercity?retryWrites=true&w=majority

# Authentication (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<64-character-hex-string>

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=<64-character-hex-string>

# CSRF Protection (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CSRF_SECRET=<64-character-hex-string>

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-actual-domain.com

# =============================================================================
# RECOMMENDED - For full functionality
# =============================================================================

# Error Tracking (get from Sentry dashboard)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Optional: Sentry source maps upload
SENTRY_ORG=your-org-name
SENTRY_PROJECT=career-city
SENTRY_AUTH_TOKEN=<sentry-auth-token>

# =============================================================================
# OPTIONAL - Enhanced security
# =============================================================================

# Strict URL validation (blocks non-whitelisted external requests)
URL_VALIDATOR_STRICT_MODE=true

# Login attempt limiting
LOGIN_MAX_ATTEMPTS=5
LOGIN_INITIAL_LOCK_MINUTES=5
LOGIN_MAX_LOCK_MINUTES=60
```

### How to Generate Secrets

Run this command to generate all three secrets at once:

```bash
node -e "
const c = require('crypto');
console.log('JWT_SECRET=' + c.randomBytes(32).toString('hex'));
console.log('ENCRYPTION_KEY=' + c.randomBytes(32).toString('hex'));
console.log('CSRF_SECRET=' + c.randomBytes(32).toString('hex'));
"
```

---

## Pre-Deployment Checklist

### 1. Update Domain References

The following files contain placeholder domains that need updating:

#### `public/.well-known/security.txt`
```
Location: public/.well-known/security.txt

Update these lines:
- Contact: mailto:security@careercity.edu     → your actual email
- Contact: https://careercity.edu/security    → your actual URL
- Policy: https://careercity.edu/security-policy
- Acknowledgments: https://careercity.edu/security/thanks
- Canonical: https://careercity.edu/.well-known/security.txt
```

#### `public/robots.txt`
```
Location: public/robots.txt

Update sitemap URL (uncomment and modify):
# Sitemap: https://careercity.edu/sitemap.xml → https://your-domain.com/sitemap.xml
```

### 2. MongoDB Enterprise Cluster Setup

1. **Create Cluster**
   - Log into MongoDB Atlas
   - Create new Enterprise cluster (or use provided credentials)
   - Select appropriate region for your users

2. **Create Database User**
   ```
   Username: careercity_prod
   Password: <strong-generated-password>
   Roles: readWrite on careercity database
   ```

3. **Configure Network Access**
   - For Vercel: Add `0.0.0.0/0` (allow from anywhere) since Vercel IPs change
   - Alternative: Use Vercel's static IPs (requires Pro plan)

4. **Get Connection String**
   ```
   mongodb+srv://careercity_prod:<password>@<cluster>.mongodb.net/careercity?retryWrites=true&w=majority
   ```

5. **Create Indexes** (run in MongoDB shell or Compass)
   ```javascript
   // Students collection
   db.students.createIndex({ sapId: 1 }, { unique: true });
   db.students.createIndex({ email: 1 });
   
   // Scans collection
   db.scans.createIndex({ studentId: 1, organizationId: 1 });
   db.scans.createIndex({ createdAt: -1 });
   
   // Organizations collection
   db.organizations.createIndex({ name: 1 });
   
   // Feedback collection
   db.feedbacks.createIndex({ studentId: 1 });
   db.feedbacks.createIndex({ organizationId: 1 });
   ```

### 3. Sentry Setup

1. **Create Project**
   - Go to https://sentry.io
   - Create new project → Select "Next.js"
   - Copy the DSN

2. **Configure Alerts** (in Sentry dashboard)
   - Go to Alerts → Create Alert Rule
   - Set up alerts for:
     - [ ] Error rate > 5% in 5 minutes
     - [ ] New issues with `security` tag
     - [ ] Performance degradation (p99 > 3s)

3. **Configure Notifications**
   - Go to Settings → Integrations
   - Set up Slack/Email notifications for alerts

---

## Deployment Steps

### Vercel Deployment

#### First-Time Setup

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Link project
vercel link

# 4. Add environment variables
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add ENCRYPTION_KEY production
vercel env add CSRF_SECRET production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_SENTRY_DSN production

# 5. Deploy to production
vercel --prod
```

#### Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import Git repository
3. Configure environment variables in Settings → Environment Variables
4. Deploy

### Alternative: Self-Hosted

```bash
# Build production bundle
npm run build

# Start production server
npm run start

# Or use PM2 for process management
pm2 start npm --name "career-city" -- start
```

---

## Post-Deployment Verification

### Automated Checks

```bash
# Run these against your deployed URL

# 1. Health check
curl https://your-domain.com/api/health

# 2. Security headers
curl -I https://your-domain.com | grep -E "(Strict-Transport|X-Frame|X-Content|Content-Security)"

# 3. Security.txt
curl https://your-domain.com/.well-known/security.txt

# 4. Robots.txt
curl https://your-domain.com/robots.txt
```

### Manual Verification Checklist

- [ ] **Authentication Flow**
  - [ ] Staff login works
  - [ ] Logout works
  - [ ] Session persists on refresh
  - [ ] Invalid credentials show error

- [ ] **Student Flow**
  - [ ] Student registration works
  - [ ] QR code generation works
  - [ ] Scan recording works

- [ ] **Volunteer Flow**
  - [ ] Organization feedback form works
  - [ ] Student feedback form works

- [ ] **Staff Dashboard**
  - [ ] Analytics page loads with data
  - [ ] Organizations page works
  - [ ] Student records page works
  - [ ] Export functionality works

- [ ] **Error Handling**
  - [ ] Trigger a test error, verify it appears in Sentry
  - [ ] Rate limiting works (try rapid requests)

### SSL/TLS Verification

1. Visit https://www.ssllabs.com/ssltest/
2. Enter your domain
3. Should score **A** or **A+**

### Performance Check

```bash
# Run Lighthouse audit
npx lighthouse https://your-domain.com --output html --output-path ./lighthouse-report.html
```

Target scores:
- Performance: > 80
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 80

---

## Monitoring Setup

### Sentry Dashboard

After deployment, configure these in Sentry:

1. **Issue Alerts**
   - New errors with `security.*` tags → Immediate notification
   - Error spike (10+ errors in 5 min) → Email/Slack alert

2. **Performance Monitoring**
   - p99 latency > 3s → Warning
   - p99 latency > 5s → Critical

3. **Release Tracking**
   - Enable in Vercel integration for automatic release tracking

### Health Monitoring (Optional)

Set up uptime monitoring with:
- **Vercel**: Built-in (Analytics tab)
- **UptimeRobot**: https://uptimerobot.com (free tier)
- **Better Uptime**: https://betteruptime.com

Monitor endpoint: `https://your-domain.com/api/health`

---

## Ongoing Maintenance

### Weekly Tasks

- [ ] Review Sentry dashboard for new issues
- [ ] Check MongoDB Atlas metrics
- [ ] Review security alerts

### Monthly Tasks

- [ ] Run `npm audit` and update dependencies
- [ ] Review and rotate secrets if needed
- [ ] Check SSL certificate expiry
- [ ] Review rate limiting logs

### Quarterly Tasks

- [ ] Run OWASP ZAP security scan
- [ ] Review and update security.txt expiry
- [ ] Load test staging environment
- [ ] Review access logs for anomalies

### Security Update Process

```bash
# Check for vulnerabilities
npm audit

# Auto-fix if safe
npm audit fix

# For breaking changes (test thoroughly!)
npm audit fix --force

# Rebuild and test
npm run build
npm test

# Deploy
vercel --prod
```

---

## Troubleshooting

### Common Issues

#### "MONGODB_URI is not defined"
- Ensure environment variable is set in Vercel dashboard
- Check it's set for the correct environment (Production/Preview/Development)

#### "JWT_SECRET must be at least 32 characters"
- Generate a new secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Update in Vercel environment variables

#### Database Connection Timeout
- Check MongoDB Atlas network access settings
- Ensure IP `0.0.0.0/0` is allowed (for Vercel)
- Verify connection string is correct

#### Rate Limit Errors in Development
- Rate limits are configured for production traffic
- For development, use `npm run dev` which has relaxed limits

#### Sentry Not Receiving Events
- Verify `NEXT_PUBLIC_SENTRY_DSN` is set correctly
- Check Sentry dashboard for any configuration issues
- Ensure the DSN starts with `https://`

### Getting Help

1. **Check Logs**: Vercel Dashboard → Deployments → Functions tab
2. **Sentry**: Review error details and stack traces
3. **Health Endpoint**: `GET /api/health` returns system status

---

## File Reference

| File | Purpose |
|------|---------|
| `env.production.template` | Environment variables reference |
| `PRE_PRODUCTION_CHECKLIST.md` | Detailed implementation checklist |
| `OWASP10.md` | Security implementation documentation |
| `load-test.yml` | Normal load testing configuration |
| `load-test-stress.yml` | Stress testing configuration |
| `STRESS_TEST.md` | Performance testing documentation |

---

## Quick Reference Commands

```bash
# Generate all secrets
node -e "const c=require('crypto'); console.log('JWT_SECRET='+c.randomBytes(32).toString('hex')); console.log('ENCRYPTION_KEY='+c.randomBytes(32).toString('hex')); console.log('CSRF_SECRET='+c.randomBytes(32).toString('hex'));"

# Build locally
npm run build

# Run production locally
npm run start

# Deploy to Vercel
vercel --prod

# Run load test
artillery run load-test.yml

# Check for vulnerabilities
npm audit

# Lighthouse audit
npx lighthouse https://your-domain.com --output html
```

---

## Contact & Handover Notes

**Original Developer:** [Your Name]  
**Handover Date:** January 4, 2026  
**Project Status:** Production Ready

### Key Architecture Decisions

1. **Authentication**: JWT with `jose` library (not `jsonwebtoken`) for Edge compatibility
2. **Database**: MongoDB with Mongoose ODM
3. **State Management**: Zustand for client state
4. **Forms**: React Hook Form with Zod validation
5. **Styling**: Tailwind CSS v4
6. **PWA**: next-pwa for offline support

### Security Implementation

All OWASP Top 10 2021 vulnerabilities addressed:
- See `OWASP10.md` for detailed implementation
- Security headers configured in `next.config.js`
- Rate limiting in `src/lib/rate-limit.ts`
- Input validation schemas in `src/lib/schemas.ts`

---

**Good luck with the deployment! 🚀**
