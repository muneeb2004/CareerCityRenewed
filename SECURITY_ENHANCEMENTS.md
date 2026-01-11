# Security Enhancements - Student Data System

This document summarizes the security measures implemented for the student data import and validation system.

## 1. File System Security

### Data Directory Protection
- **Location**: `next.config.js`
- **Protection**: All requests to `/data/*` are blocked via URL rewrite to `/api/blocked`
- **Purpose**: Prevents direct access to CSV files containing student data

## 2. Authentication & Authorization

### Role-Based Access Control
- **Implementation**: `src/lib/api-security.ts` - `checkAuth()` function
- **Role Hierarchy**: volunteer < staff < admin
- **Endpoint Protection**:
  - `/api/admin/import-students` - Admin only
  - `/api/students/ids` - Staff/Volunteer required
  - `/api/analytics/scan` - Volunteer or higher
  - `/api/students/validate/:id` - Public (rate limited)

## 3. Rate Limiting

### Endpoint-Specific Limits
- **Configuration**: `src/lib/api-security.ts` - `ENDPOINT_RATE_LIMITS`

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/students/validate/:id` | 100 requests | 1 minute | Prevent ID enumeration |
| `/api/students/ids` | 10 requests | 1 hour | Prevent mass downloads |
| `/api/admin/import-students` | 5 requests | 1 hour | Prevent abuse |
| `/api/analytics/scan` | 1000 requests | 1 hour | Reasonable usage |

## 4. Audit Logging

### Audit Log Model
- **Location**: `src/models/AuditLog.ts`
- **Actions Logged**:
  - `import` - CSV import operations
  - `validate` - ID validation attempts (failed only logged with details)
  - `download_ids` - ID list downloads
  - `scan` - Analytics scan operations
  - `access_denied` - Unauthorized access attempts
  - `rate_limit` - Rate limit violations
  - `suspicious_activity` - Detected suspicious patterns

### Data Retention
- TTL index automatically deletes logs after 90 days
- Personally identifiable data is masked (e.g., `AB****` for student IDs)

## 5. Input Validation & Sanitization

### Student ID Format Validation
- **Function**: `isValidCombinedIdFormat()` in `api-security.ts`
- **Format**: 2 letters + 4-5 digits (e.g., `AB1234` or `AB12345`)
- **Applied**: All endpoints accepting student IDs

### Input Sanitization
- **Function**: `sanitizeInput()` in `api-security.ts`
- **Protection**: Removes MongoDB operators (`$`, `.`) to prevent NoSQL injection
- **Applied**: All user-provided string inputs

## 6. Timing Attack Prevention

### Random Response Delays
- **Function**: `addRandomDelay()` in `api-security.ts`
- **Delay Range**: 50-150ms randomized
- **Applied**: `/api/students/validate/:id` endpoint
- **Purpose**: Prevents attackers from determining if an ID exists based on response time

### Constant-Time Comparison
- **Function**: `constantTimeCompare()` in `api-security.ts`
- **Purpose**: Available for comparing sensitive values without timing leakage

## 7. Frontend Security

### Encrypted ID Cache
- **Implementation**: `src/lib/encrypted-storage.ts`
- **Encryption**: AES-256-GCM with PBKDF2 key derivation
- **Key Generation**: Device-specific key using navigator fingerprint + random salt
- **Cache Duration**: 5 minutes
- **Purpose**: Prevents casual extraction of student IDs from browser storage

### Student Validation Cache
- **Location**: `src/lib/student-validation-cache.ts`
- **Features**:
  - In-memory cache for fast lookups
  - Encrypted localStorage persistence
  - Automatic cache invalidation
  - Graceful offline fallback

## 8. Suspicious Activity Detection

### Failed Validation Pattern Detection
- **Function**: `checkSuspiciousValidationPattern()` in `audit-logger.ts`
- **Threshold**: 50 failed validations within 5 minutes from same IP
- **Response**: Extra 1-second delay, logged as suspicious activity

## 9. Response Security

### Error Information Hiding
- Generic error messages returned to clients
- Detailed errors logged server-side only
- Validation failures return `{ valid: false }` without reason

### Minimal Data Exposure
- ID validation only returns `{ valid: boolean }`
- Student queries only return `_id` field
- No personal data exposed through validation endpoint

## 10. Security Headers

### Added in `next.config.js`:
```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}
```

## API Endpoint Security Matrix

| Endpoint | Auth | Role | Rate Limit | Audit | Input Validation |
|----------|------|------|------------|-------|------------------|
| POST `/api/admin/import-students` | ✅ | Admin | 5/hr | ✅ | ✅ |
| GET `/api/students/validate/:id` | ❌ | - | 100/min | ✅ | ✅ |
| GET `/api/students/ids` | ✅ | Volunteer+ | 10/hr | ✅ | N/A |
| POST `/api/analytics/scan` | ✅ | Volunteer+ | 1000/hr | ✅ | ✅ |

## Files Modified/Created

### New Files
- `src/models/AuditLog.ts` - Audit logging model
- `src/lib/api-security.ts` - Security utility functions
- `src/lib/audit-logger.ts` - Audit logging service
- `src/lib/encrypted-storage.ts` - Client-side encryption utilities

### Modified Files
- `next.config.js` - Added file protection and security headers
- `app/api/admin/import-students/route.ts` - Added auth, rate limiting, audit
- `app/api/students/validate/[id]/route.ts` - Added rate limiting, timing protection, audit
- `app/api/students/ids/route.ts` - Added auth, rate limiting, audit
- `app/api/analytics/scan/route.ts` - Added auth, rate limiting, audit
- `src/models/AnalyticsScan.ts` - Added `recordedBy` field
- `src/lib/student-validation-cache.ts` - Updated to use encrypted storage

## Recommendations for Production

1. **Environment Variables**: Ensure all secrets are in `.env.local` and never committed
2. **HTTPS**: Deploy behind HTTPS (Vercel handles this automatically)
3. **MongoDB**: Use Atlas with IP whitelisting and authentication
4. **Monitoring**: Set up alerts for suspicious activity patterns
5. **Regular Audits**: Review audit logs periodically
6. **Dependency Updates**: Keep all packages updated for security patches
