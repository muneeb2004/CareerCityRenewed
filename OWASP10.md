# OWASP Security Implementation Guide for Career City 2026

## Overview
This guide implements OWASP Top 10 2021 security patches focusing on client-side and application-level protections. Since the database is institution-controlled, we focus on what you can control: your Next.js application, client code, and API routes.

---

## 1. Broken Access Control (A01:2021)

### Problem
Users can access resources they shouldn't (e.g., viewing other students' data, scanning on behalf of others).

### Implementation

#### Server Action Authorization

```typescript
// src/lib/auth.ts
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface Session {
  studentId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('session')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as Session;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized: Please log in');
  }
  
  return session;
}

export async function createSession(studentId: string, email: string) {
  const token = jwt.sign(
    { studentId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}
```

#### Protect Server Actions

```typescript
// src/actions/scan.ts
'use server';

import { requireAuth } from '@/lib/auth';
import { recordVisit } from '@/lib/scan-service';

export async function recordVisitAction(organizationId: string) {
  // ✅ CRITICAL: Verify user is authenticated
  const session = await requireAuth();
  
  // ✅ CRITICAL: Use session studentId, NOT client-provided ID
  // This prevents users from scanning on behalf of others
  const result = await recordVisit(session.studentId, organizationId);
  
  return result;
}

// ❌ VULNERABLE - Don't do this!
export async function recordVisitVulnerable(studentId: string, orgId: string) {
  // Anyone can pass any studentId!
  return await recordVisit(studentId, orgId);
}
```

#### Protect Student Data Access

```typescript
// src/actions/student.ts
'use server';

import { requireAuth } from '@/lib/auth';

export async function getMyProfile() {
  const session = await requireAuth();
  
  // Only return current user's data
  const student = await Student.findOne({ 
    studentId: session.studentId 
  }).lean();
  
  return student;
}

export async function getStudentScans() {
  const session = await requireAuth();
  
  // Only return scans for authenticated user
  const scans = await Scan.find({ 
    studentId: session.studentId 
  })
  .sort({ timestamp: -1 })
  .limit(100)
  .lean();
  
  return scans;
}

// ❌ NEVER expose this publicly
async function getStudentByIdAdmin(studentId: string) {
  // This should only be accessible to admin users
  // Add role-based access control
  const session = await requireAuth();
  if (session.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  
  return await Student.findOne({ studentId }).lean();
}
```

**Impact:** Prevents unauthorized access to data.

---

## 2. Cryptographic Failures (A02:2021)

### Problem
Sensitive data transmitted or stored without proper encryption.

### Implementation

#### Encrypt Sensitive Data in Transit

```typescript
// next.config.js
module.exports = {
  // Force HTTPS in production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
        ],
      },
    ];
  },
};
```

#### Hash Sensitive Identifiers

```typescript
// src/lib/crypto.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Hash for non-reversible identifiers
export function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}
```

#### Store Tokens Securely (Client)

```typescript
// ❌ BAD - Don't store sensitive data in localStorage
localStorage.setItem('studentId', studentId); // Vulnerable to XSS

// ✅ GOOD - Use httpOnly cookies (set by server)
// Client can't access these via JavaScript
// src/actions/auth.ts
'use server';

import { createSession } from '@/lib/auth';

export async function loginStudent(studentId: string, email: string) {
  // Validate credentials first...
  
  // Set httpOnly cookie
  await createSession(studentId, email);
  
  return { success: true };
}
```

**Impact:** Protects sensitive data from interception.

---

## 3. Injection (A03:2021)

### Problem
Malicious input can execute unintended commands or queries.

### Implementation

#### Input Validation and Sanitization

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// Define strict schemas
export const StudentIdSchema = z.string()
  .regex(/^STU_[A-Z0-9]{8}$/, 'Invalid student ID format')
  .min(12)
  .max(12);

export const OrganizationIdSchema = z.string()
  .regex(/^ORG_[A-Z0-9]{6}$/, 'Invalid organization ID format')
  .min(10)
  .max(10);

export const FeedbackSchema = z.object({
  responses: z.record(z.string(), z.union([
    z.string().max(1000), // Limit text length
    z.number().min(1).max(5), // Rating range
  ])),
});

export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(255);

// Sanitize HTML input
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Remove special characters for IDs
export function sanitizeId(input: string): string {
  return input.replace(/[^A-Za-z0-9_-]/g, '');
}
```

#### Validate All Inputs in Server Actions

```typescript
// src/actions/scan.ts
'use server';

import { requireAuth } from '@/lib/auth';
import { OrganizationIdSchema } from '@/lib/validation';

export async function recordVisitAction(organizationId: string) {
  // 1. Authenticate
  const session = await requireAuth();
  
  // 2. Validate input
  const validatedOrgId = OrganizationIdSchema.parse(organizationId);
  
  // 3. Sanitize (defense in depth)
  const sanitized = sanitizeId(validatedOrgId);
  
  // 4. Execute with validated data
  const result = await recordVisit(session.studentId, sanitized);
  
  return result;
}
```

#### Prevent NoSQL Injection

```typescript
// src/actions/student.ts
'use server';

import { StudentIdSchema } from '@/lib/validation';

export async function getStudentData(studentId: string) {
  // ❌ VULNERABLE - Direct use of user input
  // User could pass: { $ne: null } to bypass query
  const student = await Student.findOne({ studentId });
  
  // ✅ SAFE - Validate and type-check
  const validatedId = StudentIdSchema.parse(studentId);
  const student = await Student.findOne({ 
    studentId: { $eq: validatedId } // Explicit operator
  }).lean();
  
  return student;
}

// ❌ NEVER do this with user input
async function searchStudentsUnsafe(query: any) {
  return await Student.find(query); // Can execute arbitrary queries!
}

// ✅ SAFE - Whitelist allowed fields
async function searchStudentsSafe(name: string) {
  const sanitizedName = sanitizeHtml(name);
  return await Student.find({
    name: { $regex: sanitizedName, $options: 'i' }
  }).lean();
}
```

**Impact:** Prevents injection attacks.

---

## 4. Insecure Design (A04:2021)

### Problem
Application lacks security controls by design.

### Implementation

#### Rate Limiting

```typescript
// src/lib/rate-limit.ts
import { headers } from 'next/headers';

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

export function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = store[identifier];
  
  // Clean up expired entries
  if (Object.keys(store).length > 10000) {
    for (const key in store) {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    }
  }
  
  if (!record || now > record.resetAt) {
    store[identifier] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  
  if (record.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { 
    success: true, 
    remaining: maxRequests - record.count, 
    resetAt: record.resetAt 
  };
}

export async function checkRateLimit(maxRequests = 10, windowMs = 60000) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for') || 
             headersList.get('x-real-ip') || 
             'unknown';
  
  return rateLimit(ip, maxRequests, windowMs);
}
```

#### Apply Rate Limiting

```typescript
// src/actions/scan.ts
'use server';

import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function recordVisitAction(organizationId: string) {
  const session = await requireAuth();
  
  // Limit: 20 scans per minute per student
  const rateLimitResult = await checkRateLimit(20, 60000);
  
  if (!rateLimitResult.success) {
    throw new Error(
      `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)} seconds.`
    );
  }
  
  // Proceed with scan...
}
```

#### CSRF Protection (Built into Next.js Server Actions)

```typescript
// Next.js automatically includes CSRF protection for Server Actions
// But you can add extra validation

// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Verify origin for state-changing requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    if (origin && !origin.endsWith(host!)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

**Impact:** Prevents abuse and unauthorized requests.

---

## 5. Security Misconfiguration (A05:2021)

### Problem
Default configurations, unnecessary features, or verbose errors expose vulnerabilities.

### Implementation

#### Secure Headers

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable browser XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires these
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.anthropic.com", // Your APIs
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // Permissions Policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
```

#### Environment Variable Security

```bash
# .env.example (commit this)
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_key_here
ENCRYPTION_KEY=your_32_byte_hex_key_here
NEXT_PUBLIC_API_URL=https://your-domain.com

# .env.local (NEVER commit this)
# Add actual values here
```

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes in hex
  NEXT_PUBLIC_API_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

// Validate on startup
try {
  envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  process.exit(1);
}
```

#### Error Handling (Don't Leak Information)

```typescript
// src/actions/scan.ts
'use server';

export async function recordVisitAction(organizationId: string) {
  try {
    // Your logic...
  } catch (error) {
    // ❌ BAD - Exposes internal details
    throw new Error(`Database error: ${error.message}`);
    
    // ✅ GOOD - Generic message to client
    console.error('Scan error:', error); // Log for debugging
    throw new Error('Unable to record scan. Please try again.');
  }
}

// Centralized error handler
export function handleError(error: unknown): string {
  if (process.env.NODE_ENV === 'development') {
    // Show details in development
    console.error(error);
    return error instanceof Error ? error.message : 'Unknown error';
  }
  
  // Generic message in production
  return 'An error occurred. Please try again.';
}
```

**Impact:** Reduces attack surface.

---

## 6. Vulnerable and Outdated Components (A06:2021)

### Problem
Using dependencies with known vulnerabilities.

### Implementation

#### Regular Dependency Audits

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (careful - test after)
npm audit fix

# For unfixable issues
npm audit fix --force
```

#### Automated Checks (GitHub Actions)

```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly
  push:
    branches: [ main ]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm audit --audit-level=moderate
      - run: npm outdated
```

#### Keep Dependencies Updated

```json
// package.json - Pin major versions, allow patches
{
  "dependencies": {
    "next": "^14.0.0",      // Allow 14.x.x
    "mongoose": "^8.0.0",   // Allow 8.x.x
    "zod": "^3.22.0"        // Allow 3.22.x
  }
}
```

**Impact:** Prevents exploitation of known vulnerabilities.

---

## 7. Identification and Authentication Failures (A07:2021)

### Problem
Weak authentication mechanisms allow unauthorized access.

### Implementation

#### Strong Session Management

```typescript
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function createSecureSession(studentId: string, email: string) {
  const token = await new SignJWT({ studentId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function verifySession() {
  try {
    const token = cookies().get('session')?.value;
    if (!token) return null;
    
    const verified = await jwtVerify(token, secret);
    return verified.payload as { studentId: string; email: string };
  } catch (error) {
    return null;
  }
}
```

#### Implement Login Attempt Limiting

```typescript
// src/lib/login-limiter.ts
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginAttempts(identifier: string): {
  allowed: boolean;
  remaining: number;
  lockedUntil?: number;
} {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  
  if (!record || now > record.lockedUntil) {
    return { allowed: true, remaining: 5 };
  }
  
  if (record.count >= 5) {
    return {
      allowed: false,
      remaining: 0,
      lockedUntil: record.lockedUntil,
    };
  }
  
  return { allowed: true, remaining: 5 - record.count };
}

export function recordFailedLogin(identifier: string) {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  
  if (!record || now > record.lockedUntil) {
    loginAttempts.set(identifier, {
      count: 1,
      lockedUntil: now + 15 * 60 * 1000, // Lock for 15 minutes after 5 attempts
    });
  } else {
    record.count++;
  }
}

export function clearLoginAttempts(identifier: string) {
  loginAttempts.delete(identifier);
}
```

#### Use in Login Action

```typescript
// src/actions/auth.ts
'use server';

import { checkLoginAttempts, recordFailedLogin, clearLoginAttempts } from '@/lib/login-limiter';

export async function loginAction(studentId: string, password: string) {
  // Check if locked
  const attempts = checkLoginAttempts(studentId);
  if (!attempts.allowed) {
    throw new Error(`Too many failed attempts. Try again in ${Math.ceil((attempts.lockedUntil! - Date.now()) / 60000)} minutes.`);
  }
  
  // Validate credentials
  const isValid = await validateCredentials(studentId, password);
  
  if (!isValid) {
    recordFailedLogin(studentId);
    throw new Error('Invalid credentials');
  }
  
  // Success - clear attempts and create session
  clearLoginAttempts(studentId);
  await createSecureSession(studentId, email);
  
  return { success: true };
}
```

**Impact:** Prevents brute force attacks.

---

## 8. Software and Data Integrity Failures (A08:2021)

### Problem
Code or data is modified without verification.

### Implementation

#### Verify Data Integrity

```typescript
// src/lib/integrity.ts
import crypto from 'crypto';

export function generateChecksum(data: any): string {
  const jsonString = JSON.stringify(data);
  return crypto
    .createHash('sha256')
    .update(jsonString)
    .digest('hex');
}

export function verifyChecksum(data: any, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(data);
  return actualChecksum === expectedChecksum;
}

// Usage in critical operations
export async function submitFeedbackWithIntegrity(
  responses: any,
  checksum: string
) {
  // Verify data wasn't tampered with
  if (!verifyChecksum(responses, checksum)) {
    throw new Error('Data integrity check failed');
  }
  
  // Proceed with submission
  await saveFeedback(responses);
}
```

#### Client-Side Implementation

```typescript
// Client component
'use client';

import { generateChecksum } from '@/lib/integrity';

const FeedbackForm = () => {
  const handleSubmit = async (responses: any) => {
    // Generate checksum on client
    const checksum = generateChecksum(responses);
    
    // Send both data and checksum
    await submitFeedback(responses, checksum);
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
};
```

#### Subresource Integrity for CDN Resources

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* ✅ Use SRI for external scripts */}
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"
          integrity="sha512-WFN04846sdKMIP5LKNphMaWzU7YpMyCU245etK3g/2ARYbPK9Ub18eG+ljU96qKRCWh+quCY7yefSmlkQw1ANQ=="
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Impact:** Ensures data hasn't been tampered with.

---

## 9. Security Logging and Monitoring Failures (A09:2021)

### Problem
Insufficient logging prevents detection of attacks.

### Implementation

#### Comprehensive Logging

```typescript
// src/lib/security-logger.ts
interface SecurityEvent {
  type: 'auth' | 'access' | 'error' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  userId?: string;
  ip?: string;
  timestamp: Date;
  metadata?: any;
}

export function logSecurityEvent(event: SecurityEvent) {
  const logEntry = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  
  // Log to console (or send to monitoring service)
  console.log('[SECURITY]', JSON.stringify(logEntry));
  
  // In production, send to service like DataDog, Sentry, etc.
  if (process.env.NODE_ENV === 'production') {
    // sendToMonitoringService(logEntry);
  }
}

// Usage examples
export function logFailedLogin(studentId: string, ip: string) {
  logSecurityEvent({
    type: 'auth',
    severity: 'medium',
    message: 'Failed login attempt',
    userId: studentId,
    ip,
    timestamp: new Date(),
  });
}

export function logUnauthorizedAccess(studentId: string, resource: string) {
  logSecurityEvent({
    type: 'access',
    severity: 'high',
    message: `Unauthorized access attempt to ${resource}`,
    userId: studentId,
    timestamp: new Date(),
  });
}

export function logSuspiciousActivity(description: string, metadata: any) {
  logSecurityEvent({
    type: 'suspicious',
    severity: 'critical',
    message: description,
    timestamp: new Date(),
    metadata,
  });
}
```

#### Apply Logging to Server Actions

```typescript
// src/actions/scan.ts
'use server';

import { logSecurityEvent, logUnauthorizedAccess } from '@/lib/security-logger';
import { headers } from 'next/headers';

export async function recordVisitAction(organizationId: string) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  
  try {
    const session = await requireAuth();
    
    // Log successful scan
    logSecurityEvent({
      type: 'access',
      severity: 'low',
      message: 'QR scan recorded',
      userId: session.studentId,
      ip,
      timestamp: new Date(),
      metadata: { organizationId },
    });
    
    return await recordVisit(session.studentId, organizationId);
  } catch (error) {
    // Log failed attempt
    logUnauthorizedAccess('unknown', 'scan');
    throw error;
  }
}
```

**Impact:** Enables detection and response to attacks.

---

## 10. Server-Side Request Forgery (SSRF) (A10:2021)

### Problem
Application fetches remote resources without validation.

### Implementation

#### Validate External URLs

```typescript
// src/lib/url-validator.ts
const ALLOWED_DOMAINS = [
  'api.anthropic.com',
  'cdn.yourdomain.com',
  // Add other trusted domains
];

export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // Check against whitelist
    const hostname = parsed.hostname;
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      return false;
    }
    
    // Block private IP ranges
    const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/;
    if (privateIpRegex.test(hostname)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Usage
export async function fetchExternalResource(url: string) {
  if (!isUrlSafe(url)) {
    throw new Error('URL not allowed');
  }
  
  return await fetch(url);
}
```

**Impact:** Prevents SSRF attacks.

---

# Implementation Stages

Based on existing codebase analysis, here's the staged implementation plan:

## Current Security Status

**Already Implemented:**
- [x] Basic JWT authentication with `jose` library (`src/lib/jwt.ts`)
- [x] Staff session middleware (`middleware.ts`)
- [x] Basic rate limiting (`src/lib/rate-limit.ts`)
- [x] Student ID validation (`src/lib/validation.ts`)
- [x] Circuit breaker pattern (`src/lib/circuit-breaker.ts`)
- [x] Deduplication for scans (`src/lib/deduplication.ts`)

**Not Yet Implemented:**
- [x] Security headers in next.config.js *(Stage 1 - COMPLETED)*
- [x] Enhanced input validation with Zod schemas *(Stage 2 - COMPLETED)*
- [x] Security event logging *(Stage 3 - COMPLETED)*
- [x] Login attempt limiting *(Stage 4 - COMPLETED)*
- [x] Session management improvements *(Stage 4 - COMPLETED)*
- [x] Data encryption utilities *(Stage 5 - COMPLETED)*
- [x] Data integrity checks *(Stage 5 - COMPLETED)*
- [x] CSRF protection enhancement *(Stage 6 - COMPLETED)*
- [x] URL validation for SSRF prevention *(Stage 6 - COMPLETED)*

---

## Stage 1: Security Headers & Configuration ✅ COMPLETED
*Priority: Critical | Effort: Low | Impact: High*

**Tasks:**
- [x] Add comprehensive security headers to `next.config.js`
- [x] Create environment validation (`src/lib/env-validation.ts`)
- [x] Improve error handling to not leak internal details

**Files:**
- `next.config.js` - Security headers
- `src/lib/env-validation.ts` - Environment variable validation
- `src/lib/error-handler.ts` - Centralized error handling

---

## Stage 2: Enhanced Input Validation ✅ COMPLETED
*Priority: Critical | Effort: Medium | Impact: High*

**Tasks:**
- [x] Add Zod schemas for all input types
- [x] Create sanitization utilities
- [x] Apply validation to all Server Actions
- [x] Prevent NoSQL injection with `safeEquals()`

**Files created:**
- `src/lib/schemas.ts` - Comprehensive Zod validation schemas for:
  - StudentIdSchema, StudentEmailSchema, OrganizationIdSchema
  - FeedbackResponsesSchema, QuestionSchema
  - CreateOrganizationSchema, CreateStudentSchema, RecordVisitSchema
  - Helper functions: `validateOrThrow()`, `validate()`, `isSafeValue()`
- `src/lib/sanitize.ts` - Input sanitization utilities:
  - `sanitizeHtml()`, `stripHtml()`, `sanitizeId()`, `sanitizeSlug()`
  - `sanitizeText()`, `sanitizeName()`, `sanitizeEmail()`
  - `sanitizeForMongo()`, `safeEquals()` for NoSQL injection prevention
  - `sanitizeFeedbackResponses()` for complex objects

**Files updated:**
- `src/actions/feedback.ts` - Validation for student/org feedback
- `src/actions/organizations.ts` - Validation for CRUD operations
- `src/actions/questions.ts` - Validation for question management
- `src/actions/scans.ts` - Validation for visit recording
- `src/actions/student.ts` - Validation for student creation/retrieval

---

## Stage 3: Security Logging & Monitoring ✅ COMPLETED
*Priority: High | Effort: Medium | Impact: High*

**Tasks:**
- [x] Create security event logger
- [x] Add logging to authentication flows
- [x] Add logging to critical operations
- [x] Track suspicious activities

**Files created:**
- `src/lib/security-logger.ts` - Comprehensive security event logging with:
  - `SecurityEvent` interface with type-safe event types and severity levels
  - `logSecurityEvent()` core logging function with structured JSON output
  - Authentication loggers: `logLoginSuccess()`, `logLoginFailure()`, `logLogout()`, `logSessionExpired()`, `logInvalidToken()`
  - Access control loggers: `logUnauthorizedAccess()`, `logForbiddenAccess()`, `logResourceCreated()`, `logResourceUpdated()`, `logResourceDeleted()`
  - Rate limit loggers: `logRateLimitExceeded()`, `logRateLimitWarning()`
  - Security loggers: `logValidationFailure()`, `logInjectionAttempt()`, `logDataIntegrityFailure()`
  - Suspicious activity loggers: `logSuspiciousActivity()`, `logBruteForceAttempt()`, `logUnhandledError()`
  - Composite loggers: `logScanOperation()`, `logFeedbackSubmission()`, `logStudentRegistration()`, `logOrganizationOperation()`
  - Helper functions: `getClientIp()`, `getUserAgent()`, `maskSensitiveData()`, `sanitizeMetadata()`

**Files updated:**
- `app/api/auth/login/route.ts` - Added login success/failure logging
- `app/api/auth/logout/route.ts` - Added logout event logging
- `src/lib/jwt.ts` - Added token verification failure logging
- `src/actions/feedback.ts` - Added feedback submission logging
- `src/actions/organizations.ts` - Added CRUD operation logging
- `src/actions/questions.ts` - Added question management logging
- `src/actions/scans.ts` - Added scan operation and rate limit logging
- `src/actions/student.ts` - Added student registration logging

---

## Stage 4: Authentication Hardening ✅ COMPLETED
*Priority: High | Effort: Medium | Impact: High*

**Tasks:**
- [x] Implement login attempt limiting
- [x] Add session management improvements
- [x] Student authentication flow
- [x] Token refresh mechanism

**Files created:**
- `src/lib/login-limiter.ts` - Comprehensive login attempt tracking with:
  - `LoginAttemptRecord` interface for tracking attempts per identifier
  - `LoginAttemptResult` interface for check results
  - Configurable settings via environment variables:
    - `LOGIN_MAX_ATTEMPTS` (default: 5)
    - `LOGIN_INITIAL_LOCK_MINUTES` (default: 5)
    - `LOGIN_MAX_LOCK_MINUTES` (default: 60)
    - `LOGIN_ATTEMPT_WINDOW_MS` (default: 15 minutes)
    - `LOGIN_PROGRESSIVE_LOCKOUT` (default: true)
  - `checkLoginAllowed(username, ip)` - Dual-check for both username and IP-based lockout
  - `recordFailedLogin(username, ip)` - Records failed attempts with progressive lockout
  - `clearLoginAttempts(username, ip)` - Clears attempts after successful login
  - `getAttemptStatus(username, ip)` - Gets remaining attempts count
  - `getLockoutStatus()` - Gets current lockout information
  - `getLockoutStats()` - Monitoring statistics for active lockouts
  - Progressive lockout escalation: 5min → 10min → 20min → 40min → 60min (max)
  - Automatic security logging integration for brute force detection

- `src/actions/auth.ts` - Authentication server actions:
  - `LoginResult` interface for standardized login responses
  - `SessionInfo` interface for session information
  - `staffLogin(username, password)` - Staff login with brute force protection
  - `staffLogout()` - Staff logout with security logging
  - `studentLogin(studentId, email)` - Student login with validation
  - `studentLogout()` - Student logout
  - `getStaffSessionInfo()` - Get current staff session details
  - `getStudentSessionInfo()` - Get current student session details
  - `refreshStaffSession()` - Automatic token refresh for staff
  - `refreshStudentSession()` - Automatic token refresh for students

**Files updated:**
- `src/lib/auth.ts` - Enhanced auth utilities:
  - `StaffSession` interface with username, role, iat, exp
  - `StudentSession` interface with studentId, email, iat, exp
  - `SESSION_CONFIG` with separate staff (24h) and student (7d) durations
  - `createStaffSession(username, role)` - Creates secure staff sessions
  - `createStudentSession(studentId, email)` - Creates secure student sessions
  - `getStaffSession()` / `getStudentSession()` - Retrieves typed sessions
  - `destroyStaffSession()` / `destroyStudentSession()` - Secure logout
  - `shouldRefreshToken(payload)` - Token refresh logic (2h threshold)
  - `requireStaffAuth()` / `requireStudentAuth()` - Auth guard functions
  - `requireRole(allowedRoles)` - Role-based access control

- `app/api/auth/login/route.ts` - Integrated brute force protection:
  - Pre-authentication lockout check with `checkLoginAllowed()`
  - 429 status response for locked accounts
  - Remaining attempts displayed in error messages
  - Failed login recording with `recordFailedLogin()`
  - Successful login clears attempts with `clearLoginAttempts()`
  - Uses `createStaffSession()` instead of manual cookie setting

- `app/api/auth/logout/route.ts` - Improved logout flow:
  - Uses `getStaffSession()` for session retrieval
  - Uses `destroyStaffSession()` for secure logout

---

## Stage 5: Data Protection ✅ COMPLETED
*Priority: Medium | Effort: Medium | Impact: Medium*

**Tasks:**
- [x] Create encryption utilities
- [x] Add data integrity checks
- [x] Implement checksum verification

**Files created:**
- `src/lib/crypto.ts` - Comprehensive cryptographic utilities:
  - **Encryption/Decryption:**
    - AES-256-GCM authenticated encryption with `encrypt()` / `decrypt()`
    - Object encryption with `encryptObject()` / `decryptObject()`
    - Custom key encryption with `encryptWithKey()` / `decryptWithKey()`
  - **Hashing:**
    - `hashSHA256()` / `hashSHA512()` - Secure hashing
    - `hmacSHA256()` / `verifyHmac()` - HMAC signatures with constant-time comparison
    - `hashForKey()` - Short hash for cache keys/identifiers
  - **Password Security:**
    - `hashPassword()` - PBKDF2 with 100,000 iterations
    - `verifyPassword()` - Constant-time password verification
  - **Key Derivation:**
    - `deriveKey()` - PBKDF2 key derivation
    - `generateSalt()` - Cryptographic salt generation
  - **Random Generation:**
    - `randomBytes()` / `randomHex()` / `randomBase64()` - Secure random data
    - `randomUUID()` - UUID v4 generation
    - `generateToken()` - URL-safe tokens
    - `generateVerificationCode()` - Numeric verification codes
  - **Utilities:**
    - `constantTimeEqual()` / `secureCompare()` - Timing attack prevention
    - `maskSensitive()` - Sensitive data masking for logs
    - `obfuscateEmail()` / `obfuscateStudentId()` - PII obfuscation
    - `isValidHex()` / `isEncryptedFormat()` - Format validation

- `src/lib/integrity.ts` - Data integrity verification:
  - **Checksums:**
    - `generateChecksum()` - SHA-256 checksum with sorted JSON
    - `generateFastChecksum()` - MD5 for quick non-security validation
    - `verifyChecksum()` - Constant-time checksum verification
  - **HMAC Signatures:**
    - `signData()` / `verifySignature()` - HMAC-SHA256 signatures
  - **Integrity Payloads:**
    - `createIntegrityPayload()` - Timestamped data with checksum
    - `verifyIntegrityPayload()` - Expiry and checksum verification
  - **Signed Data (Replay Protection):**
    - `generateNonce()` / `checkAndUseNonce()` - Nonce management
    - `createSignedData()` - Data with signature & replay protection
    - `verifySignedData()` - Full verification with anti-replay
  - **Request Tokens:**
    - `generateRequestToken()` - Form submission tokens
    - `verifyRequestToken()` - Token verification for CSRF-like protection
  - **Data Fingerprinting:**
    - `generateFingerprint()` - Short hash for change detection
    - `hasDataChanged()` - Detect data modifications
  - **Audit Trail:**
    - `createAuditEntry()` - Blockchain-like hash chain entries
    - `verifyAuditEntry()` / `verifyAuditChain()` - Chain integrity
  - **Helpers:**
    - `validateFormIntegrity()` - Quick form data verification
    - `packageSecureData()` / `unpackSecureData()` - Secure data transmission

- `src/lib/client-integrity.ts` - Browser-compatible integrity utilities:
  - `generateClientChecksum()` - SubtleCrypto SHA-256 for browsers
  - `generateFingerprint()` - Quick fingerprint generation
  - `createIntegrityPayload()` - Client-side payload creation
  - `useIntegrity()` - React hook for integrity operations

**Files updated:**
- `src/actions/feedback.ts` - Added integrity verification:
  - `addStudentFeedback()` now accepts optional `checksum` parameter
  - `addOrganizationFeedback()` now accepts optional `checksum` parameter
  - Verifies checksums before processing, logs mismatches

- `src/actions/student.ts` - Added integrity verification:
  - `createStudent()` now accepts optional `checksum` parameter
  - Verifies registration data integrity before processing
  - Uses obfuscation for logged PII

---

## Stage 6: SSRF & Advanced Protection ✅ COMPLETED
*Priority: Low | Effort: Low | Impact: Medium*

**Tasks:**
- [x] URL validation for external requests
- [x] Enhance CSRF protection
- [x] Dependency audit automation

**Files created:**
- `src/lib/url-validator.ts` - Comprehensive SSRF prevention:
  - **URL Validation:**
    - `validateUrl(url, options)` - Full URL validation with detailed results
    - `isUrlSafe(url)` - Quick boolean safety check
    - `sanitizeUrl(url)` - Remove credentials and normalize
    - `extractHostname(url)` - Safe hostname extraction
    - `isSameOrigin(url1, url2)` - Origin comparison
  - **Private IP Detection:**
    - `isPrivateAddress(hostname)` - Detect private/internal IPs
    - IPv4 private range detection (10.x, 172.16-31.x, 192.168.x, 127.x)
    - IPv6 private address detection (::1, fe80::, fc/fd::)
    - IPv4-mapped IPv6 detection
  - **Domain Management:**
    - Configurable allowed/blocked domain lists
    - `addAllowedDomain()` / `removeAllowedDomain()` - Runtime configuration
    - `addBlockedDomain()` - Block domains dynamically
    - Strict mode via `URL_VALIDATOR_STRICT_MODE` env var
  - **Safe Fetch Wrappers:**
    - `safeFetch(url, init, options)` - Validated fetch with timeout
    - `safeFetchWithRedirects(url, init, options)` - Follow redirects safely
    - Automatic redirect validation
    - Configurable timeout and max redirects
  - **Cloud Metadata Protection:**
    - `isCloudMetadataUrl(url)` - Detect AWS/GCP/Azure metadata endpoints
    - Blocks 169.254.169.254, metadata.google.internal, etc.
  - **Pattern Matching:**
    - `urlMatchesPattern(url, pattern)` - Glob-like URL matching
    - `validateUrlPatterns(url, allowed, blocked)` - Pattern-based validation

- `src/lib/csrf.ts` - Enhanced CSRF protection:
  - **Token Management:**
    - `generateCsrfToken()` - Secure token with timestamp and signature
    - `validateCsrfToken(token)` - Verify token validity and expiry
    - HMAC-SHA256 signed tokens with 24-hour expiry
  - **Cookie Handling:**
    - `setCsrfCookie()` - Set CSRF cookie with secure options
    - `getCsrfCookie()` - Retrieve current token
    - `clearCsrfCookie()` - Clear on logout
  - **Request Validation:**
    - `validateCsrfRequest()` - Double Submit Cookie pattern
    - `validateOrigin()` - Origin header validation
    - `validateRequest()` - Combined CSRF + origin validation
  - **Server Action Protection:**
    - `withCsrfProtection(action)` - Wrapper for full CSRF protection
    - `withOriginProtection(action)` - Lighter weight origin-only check
  - **Client Support:**
    - `getCsrfToken()` - Get token for client-side use
    - `getCsrfHeaders(token)` - Generate headers for fetch requests

- `.github/workflows/security.yml` - Automated security audits:
  - **Dependency Audit:**
    - `npm audit` with moderate and critical level checks
    - JSON output artifact for tracking
    - Fails on critical vulnerabilities
  - **Outdated Dependencies:**
    - `npm outdated` check
    - Major version update detection
  - **CodeQL Analysis:**
    - JavaScript/TypeScript security scanning
    - Security and quality queries
  - **Secret Scanning:**
    - Gitleaks integration for exposed secrets
    - Full repository history scan
  - **License Compliance:**
    - license-checker for dependency licenses
    - Warns on GPL/AGPL restrictive licenses
  - **Build Security Check:**
    - Verifies build succeeds
    - Scans build output for exposed secrets
  - **Security Headers Analysis:**
    - Verifies next.config.js header configuration
    - Manual trigger workflow
  - **Summary Report:**
    - GitHub Step Summary with all check results
    - Visual status table

---

## Implementation Timeline

| Stage | Focus Area | Priority | Effort | Status |
|-------|------------|----------|--------|--------|
| **Stage 1** | Security Headers & Config | Critical | Low | ✅ Complete |
| **Stage 2** | Input Validation | Critical | Medium | ✅ Complete |
| **Stage 3** | Security Logging | High | Medium | ✅ Complete |
| **Stage 4** | Auth Hardening | High | Medium | ✅ Complete |
| **Stage 5** | Data Protection | Medium | Medium | ✅ Complete |
| **Stage 6** | SSRF & Advanced | Low | Low | ✅ Complete |

**Recommended order:** Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 6

---

## Security Checklist

### Immediate (Critical)

- [x] Implement authentication and session management *(Existing: `src/lib/jwt.ts`, `src/lib/auth.ts`)*
- [x] Add input validation to all Server Actions *(Stage 2 - `src/lib/schemas.ts`, `src/lib/sanitize.ts`)*
- [x] Enable security headers in `next.config.js` *(Stage 1 - COMPLETED)*
- [x] Add rate limiting to authentication endpoints *(Existing: `src/lib/rate-limit.ts`)*
- [x] Remove error messages that expose internal details *(Stage 1 - `src/lib/error-handler.ts`)*

### Short-term (Important)

- [x] Implement CSRF protection for state-changing operations *(Stage 6 - COMPLETED)*
- [x] Add request logging for security events *(Stage 3 - COMPLETED)*
- [x] Set up automated dependency auditing *(Stage 6 - COMPLETED)*
- [x] Implement login attempt limiting *(Stage 4 - COMPLETED)*
- [x] Add data integrity checks for critical operations *(Stage 5 - COMPLETED)*

### Ongoing (Maintenance)

- [ ] Weekly dependency audits (`npm audit`)
- [ ] Monthly security header reviews
- [ ] Quarterly penetration testing
- [ ] Review logs for suspicious activity
- [ ] Keep Next.js and dependencies updated

---

## Testing Security

### Manual Testing

```bash
# Test rate limiting
for i in {1..30}; do curl -X POST https://your-app.com/api/scan; done

# Test CSRF (should fail)
curl -X POST https://your-app.com/api/scan \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"orgId":"ORG_123"}'

# Test injection
curl -X POST https://your-app.com/api/scan \
  -d '{"studentId":{"$ne":null}}'
```

### Automated Security Scanning

```bash
# Install OWASP ZAP or similar tool
npm install -g zaproxy

# Run security scan

### Quick Start Commands
# 1. Install security dependencies
npm install zod jsonwebtoken jose

# 2. Generate secure keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Add to .env.local
JWT_SECRET=<your_generated_key>
ENCRYPTION_KEY=<another_generated_key>

# 4. Run security audit
npm audit

# 5. Test security headers
curl -I https://your-app.vercel.app
```</parameter>