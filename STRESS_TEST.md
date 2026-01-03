# Stress Testing Guide: Career City 2026

## Overview
This guide covers how to stress test your Career City application after migrating to MongoDB, focusing on the critical operations: student registration, QR scanning, and feedback submission.

---

## Setup

### 1. Install Testing Tools

```bash
# Install k6 (recommended for load testing)
brew install k6  # macOS
# OR
choco install k6  # Windows
# OR
sudo apt-get install k6  # Linux

# Alternative: Artillery (JavaScript-based)
npm install -g artillery

# For monitoring
npm install --save-dev clinic autocannon
```

### 2. Set Up Test Environment

**Important:** Never stress test your production database directly.

```env
# .env.test
MONGODB_URI=mongodb+srv://test-cluster.mongodb.net/careercity-test
NEXT_PUBLIC_API_URL=https://staging.careercity.com
```

---

## Test Scenarios

### Scenario 1: Student Registration Load

**Goal:** Test how many students can register simultaneously.

**k6 Script** (`tests/load/registration.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Peak load
    { duration: '3m', target: 200 },  // Stay at peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.1'],              // Error rate under 10%
  },
};

export default function () {
  const studentId = `STUDENT_${Date.now()}_${__VU}_${__ITER}`;
  
  const payload = JSON.stringify({
    studentId: studentId,
    name: `Test Student ${__VU}`,
    email: `test${__VU}@example.com`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    `${__ENV.API_URL}/api/students/register`,
    payload,
    params
  );

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
    'has studentId': (r) => JSON.parse(r.body).studentId !== undefined,
  });

  errorRate.add(!success);
  sleep(1);
}
```

**Run the test:**
```bash
k6 run tests/load/registration.js
```

---

### Scenario 2: QR Code Scanning (Critical)

**Goal:** Simulate event day with hundreds of students scanning QR codes simultaneously.

**k6 Script** (`tests/load/qr-scanning.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const transactionFailures = new Rate('transaction_failures');

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Quick ramp
    { duration: '5m', target: 300 },   // Event peak
    { duration: '10m', target: 500 },  // Max capacity test
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'],     // 99% under 3s
    transaction_failures: ['rate<0.01'],    // Less than 1% failures
    errors: ['rate<0.05'],                  // Less than 5% errors
  },
};

// Pre-populate test data
const students = [];
const organizations = ['ORG_001', 'ORG_002', 'ORG_003', 'ORG_004', 'ORG_005'];

export function setup() {
  // Create 500 test students before the test
  for (let i = 0; i < 500; i++) {
    students.push(`STU_TEST_${i}`);
  }
  return { students, organizations };
}

export default function (data) {
  // Random student scans random organization
  const studentId = data.students[Math.floor(Math.random() * data.students.length)];
  const orgId = data.organizations[Math.floor(Math.random() * data.organizations.length)];

  const payload = JSON.stringify({
    studentId: studentId,
    organizationId: orgId,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    `${__ENV.API_URL}/api/scans/record`,
    payload,
    params
  );

  const success = check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
    'response time < 3000ms': (r) => r.timings.duration < 3000,
  });

  // Track transaction-specific failures
  if (res.status === 500) {
    transactionFailures.add(1);
  }

  errorRate.add(!success);
  
  // Realistic delay between scans (1-5 seconds)
  sleep(Math.random() * 4 + 1);
}

export function teardown(data) {
  // Optional: cleanup test data
  console.log('Test completed. Check MongoDB for data integrity.');
}
```

**Run the test:**
```bash
API_URL=https://staging.careercity.com k6 run tests/load/qr-scanning.js
```

---

### Scenario 3: Feedback Submission

**Artillery Script** (`tests/load/feedback.yml`):

```yaml
config:
  target: "https://staging.careercity.com"
  phases:
    - duration: 300
      arrivalRate: 10  # 10 users per second
      name: "Warm up"
    - duration: 600
      arrivalRate: 50  # 50 users per second
      name: "Peak load"
  processor: "./feedback-processor.js"

scenarios:
  - name: "Submit Volunteer Feedback"
    flow:
      - post:
          url: "/api/feedback/volunteer"
          json:
            studentId: "{{ $randomString() }}"
            responses:
              question_1: "{{ $randomNumber(1, 5) }}"
              question_2: "Great experience!"
          capture:
            - json: "$.feedbackId"
              as: "feedbackId"
      - think: 2

  - name: "Submit Organization Feedback"
    weight: 2  # Twice as likely as volunteer feedback
    flow:
      - post:
          url: "/api/feedback/organization"
          json:
            studentId: "{{ $randomString() }}"
            organizationId: "ORG_{{ $randomNumber(1, 10) }}"
            responses:
              rating: "{{ $randomNumber(1, 5) }}"
              comment: "Test feedback"
      - think: 3
```

**Run:**
```bash
artillery run tests/load/feedback.yml
```

---

## Monitoring During Tests

### 1. MongoDB Atlas Monitoring

Log into MongoDB Atlas and watch:
- **Connections:** Should stay below 80% of max
- **Query Performance:** Check slow queries (> 100ms)
- **CPU Usage:** Should remain under 70%
- **Memory:** Watch for memory spikes

### 2. Real-Time Application Monitoring

**Add monitoring endpoint** (`app/api/health/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return NextResponse.json({
    status: dbState === 1 ? 'healthy' : 'unhealthy',
    database: states[dbState],
    timestamp: new Date().toISOString(),
  });
}
```

**Monitor it during tests:**
```bash
watch -n 1 'curl -s https://staging.careercity.com/api/health | jq'
```

### 3. Server Logs

**Tail your Next.js logs:**
```bash
# If deployed on Vercel
vercel logs --follow

# If using PM2
pm2 logs

# If using Docker
docker logs -f container_name
```

---

## Key Metrics to Track

### Success Criteria

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Response Time (p95) | < 1000ms | < 2000ms |
| Response Time (p99) | < 2000ms | < 3000ms |
| Error Rate | < 1% | < 5% |
| Transaction Success | > 99% | > 95% |
| Concurrent Users | 500+ | 300+ |
| Database CPU | < 60% | < 80% |
| Connection Pool | < 70% used | < 90% used |

### Red Flags

🚨 **Stop the test if you see:**
- Error rate > 10%
- Database connections maxed out
- Response times > 5 seconds
- Transaction rollback rate > 5%
- Memory leaks (continuously increasing)

---

## Advanced: Chaos Testing

### Test Database Connection Failures

```javascript
// tests/chaos/connection-failure.js
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  duration: '5m',
  vus: 50,
};

export default function () {
  // Simulate sudden connection drops
  if (Math.random() < 0.1) {
    // 10% chance to hit during "network issue"
    sleep(5); // Simulate delay
  }
  
  const res = http.post(`${__ENV.API_URL}/api/scans/record`, {
    studentId: 'TEST_STUDENT',
    organizationId: 'TEST_ORG',
  });
  
  // Application should handle gracefully
  check(res, {
    'graceful degradation': (r) => r.status !== 500,
  });
}
```

---

## Testing Checklist

- [ ] Set up isolated test environment (staging database)
- [ ] Pre-populate test data (students, organizations, questions)
- [ ] Run baseline test (50 users) to establish metrics
- [ ] Run registration load test (200 concurrent users)
- [ ] Run QR scanning stress test (500 concurrent users)
- [ ] Run feedback submission test (1000 submissions/minute)
- [ ] Monitor MongoDB performance during all tests
- [ ] Check application logs for errors
- [ ] Verify data integrity after tests (no duplicate scans, correct counts)
- [ ] Run chaos test (connection failures, timeouts)
- [ ] Document all bottlenecks and optimization opportunities
- [ ] Re-run tests after optimizations

---

## After Testing: Optimization

If tests reveal issues, optimize in this order:

1. **Add Database Indexes**
   ```javascript
   // Check which queries are slow
   db.scans.explain("executionStats").find({ studentId: "XXX" })
   ```

2. **Increase Connection Pool**
   ```typescript
   // lib/db.ts
   mongoose.connect(MONGODB_URI, {
     maxPoolSize: 50, // Increase from default 10
     minPoolSize: 10,
   });
   ```

3. **Add Caching** (Redis for frequently accessed data)

4. **Optimize Queries** (use `.lean()`, `.select()`, limit fields)

5. **Scale MongoDB** (increase cluster tier in Atlas)

---

## Quick Start Commands

```bash
# 1. Setup test environment
npm install -g k6 artillery

# 2. Create test students
node scripts/create-test-data.js

# 3. Run quick smoke test (30 seconds)
k6 run --duration 30s --vus 10 tests/load/qr-scanning.js

# 4. Run full stress test
k6 run tests/load/qr-scanning.js

# 5. Monitor health during test (separate terminal)
watch -n 1 'curl -s http://localhost:3000/api/health | jq'

# 6. Check MongoDB metrics
# Go to: https://cloud.mongodb.com/v2/<project>/metrics/replicaSet/<cluster>
```

---

## Expected Results

**Healthy Application:**
- Handles 500 concurrent QR scans with < 2s response time
- Zero transaction failures
- Database CPU stays below 60%
- No memory leaks over 30-minute test
- Error rate < 1%

**If you hit issues:**
- Document exact scenario (users, duration, operation)
- Check MongoDB slow query logs
- Review connection pool usage
- Look for N+1 query patterns
- Consider horizontal scaling (sharding) for very large scale