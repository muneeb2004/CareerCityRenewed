# Client-Side Performance Enhancements for High-Traffic Apps

## 1. Optimize Component Rendering with React Best Practices

### Use React.memo for Expensive Components

**Problem:** Components re-render unnecessarily when parent state changes.

**Solution:** Memoize components that don't need frequent updates.

```typescript
// ❌ BAD - Re-renders on every parent update
const OrganizationCard = ({ org }: { org: Organization }) => {
  return (
    <div className="card">
      <h3>{org.name}</h3>
      <p>Visitors: {org.visitorCount}</p>
    </div>
  );
};

// ✅ GOOD - Only re-renders when org data changes
const OrganizationCard = React.memo(({ org }: { org: Organization }) => {
  return (
    <div className="card">
      <h3>{org.name}</h3>
      <p>Visitors: {org.visitorCount}</p>
    </div>
  );
});

// ✅ EVEN BETTER - Custom comparison for complex objects
const OrganizationCard = React.memo(
  ({ org }: { org: Organization }) => {
    return (
      <div className="card">
        <h3>{org.name}</h3>
        <p>Visitors: {org.visitorCount}</p>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if these specific fields change
    return prevProps.org.visitorCount === nextProps.org.visitorCount &&
           prevProps.org.name === nextProps.org.name;
  }
);
```

### Optimize Expensive Calculations with useMemo

```typescript
// ❌ BAD - Recalculates on every render
const StudentDashboard = ({ scans }: { scans: Scan[] }) => {
  const stats = calculateStatistics(scans); // Expensive operation
  const sortedOrgs = scans.sort((a, b) => b.timestamp - a.timestamp);
  
  return <div>{/* Display stats */}</div>;
};

// ✅ GOOD - Only recalculates when scans change
const StudentDashboard = ({ scans }: { scans: Scan[] }) => {
  const stats = useMemo(() => {
    return calculateStatistics(scans);
  }, [scans]);
  
  const sortedOrgs = useMemo(() => {
    return [...scans].sort((a, b) => b.timestamp - a.timestamp);
  }, [scans]);
  
  return <div>{/* Display stats */}</div>;
};
```

### Optimize Event Handlers with useCallback

```typescript
// ❌ BAD - Creates new function on every render
const QRScanner = ({ studentId }: { studentId: string }) => {
  const [scanning, setScanning] = useState(false);
  
  const handleScan = (orgId: string) => {
    recordVisit(studentId, orgId);
  };
  
  return <Scanner onScan={handleScan} />;
};

// ✅ GOOD - Reuses same function reference
const QRScanner = ({ studentId }: { studentId: string }) => {
  const [scanning, setScanning] = useState(false);
  
  const handleScan = useCallback((orgId: string) => {
    recordVisit(studentId, orgId);
  }, [studentId]); // Only recreate if studentId changes
  
  return <Scanner onScan={handleScan} />;
};
```

**Impact:** 30-50% reduction in unnecessary re-renders.

---

## 2. Implement Optimistic UI Updates

**Problem:** Users wait for server response before seeing feedback, making the app feel slow.

**Solution:** Update UI immediately, then sync with server.

```typescript
'use client';

import { useState, useTransition } from 'react';
import { recordVisit } from '@/actions/scan';

const QRScanner = ({ studentId }: { studentId: string }) => {
  const [scannedOrgs, setScannedOrgs] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (orgId: string) => {
    // 1. IMMEDIATE UI update (optimistic)
    setScannedOrgs(prev => [...prev, orgId]);
    setError(null);

    // 2. Server action in background
    startTransition(async () => {
      try {
        const result = await recordVisit(studentId, orgId);
        
        if (!result.success) {
          // Rollback on failure
          setScannedOrgs(prev => prev.filter(id => id !== orgId));
          setError(result.error || 'Failed to record scan');
        }
      } catch (err) {
        // Rollback on error
        setScannedOrgs(prev => prev.filter(id => id !== orgId));
        setError('Network error. Please try again.');
      }
    });
  };

  return (
    <div>
      <ScannerComponent onScan={handleScan} />
      
      {isPending && <LoadingSpinner />}
      
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}
      
      <div className="scanned-list">
        {scannedOrgs.map(orgId => (
          <div key={orgId} className={isPending ? 'pending' : 'confirmed'}>
            ✓ Scanned: {orgId}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Impact:** App feels instant even with 500ms server latency.

---

## 3. Virtualize Long Lists

**Problem:** Rendering 1,000+ items in a list causes performance issues.

**Solution:** Only render visible items using virtualization.

```bash
npm install @tanstack/react-virtual
```

```typescript
'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

const ScansList = ({ scans }: { scans: Scan[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: scans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height of each item
    overscan: 5, // Render 5 extra items above/below viewport
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '600px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ScanItem scan={scans[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Alternative for simpler cases - Infinite Scroll:**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';

const InfiniteScans = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  const loadMore = async () => {
    setLoading(true);
    const newScans = await getScans(page, 50);
    
    setScans(prev => [...prev, ...newScans.scans]);
    setPage(prev => prev + 1);
    setHasMore(newScans.scans.length === 50);
    setLoading(false);
  };

  return (
    <div>
      {scans.map(scan => (
        <ScanItem key={scan.scanId} scan={scan} />
      ))}
      
      <div ref={observerRef} style={{ height: '20px' }}>
        {loading && <LoadingSpinner />}
      </div>
    </div>
  );
};
```

**Impact:** Handle 10,000+ items without lag.

---

## 4. Debounce Search and Filters

**Problem:** Searching on every keystroke sends too many requests.

**Solution:** Wait for user to stop typing before searching.

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

// Custom hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in component
const StudentSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300); // 300ms delay
  const [results, setResults] = useState<Student[]>([]);

  useEffect(() => {
    if (debouncedSearch) {
      searchStudents(debouncedSearch).then(setResults);
    }
  }, [debouncedSearch]);

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search students..."
      />
      
      {/* Show loading indicator while typing */}
      {searchTerm !== debouncedSearch && <LoadingIndicator />}
      
      <StudentList students={results} />
    </div>
  );
};
```

**Impact:** Reduces API calls by 80-90%.

---

## 5. Add Loading Skeletons (Better UX)

**Problem:** Blank screens while loading make app feel broken.

**Solution:** Show skeleton placeholders.

```typescript
'use client';

const OrganizationListSkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-20 bg-gray-200 rounded-lg" />
      </div>
    ))}
  </div>
);

const OrganizationList = () => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrganizations().then(data => {
      setOrgs(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <OrganizationListSkeleton />;
  }

  return (
    <div>
      {orgs.map(org => (
        <OrganizationCard key={org.organizationId} org={org} />
      ))}
    </div>
  );
};
```

**Better with Suspense (Next.js):**

```typescript
import { Suspense } from 'react';

// Server Component
async function OrganizationList() {
  const orgs = await getOrganizations();
  
  return (
    <div>
      {orgs.map(org => (
        <OrganizationCard key={org.organizationId} org={org} />
      ))}
    </div>
  );
}

// Page
export default function OrgsPage() {
  return (
    <Suspense fallback={<OrganizationListSkeleton />}>
      <OrganizationList />
    </Suspense>
  );
}
```

**Impact:** App feels 2x faster due to perceived performance.

---

## 6. Implement Progressive Loading

**Problem:** Loading everything at once is slow and unnecessary.

**Solution:** Load critical content first, then enhance.

```typescript
'use client';

const StudentDashboard = ({ studentId }: { studentId: string }) => {
  const [coreData, setCoreData] = useState<CoreData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recommendations, setRecommendations] = useState<Rec[] | null>(null);

  useEffect(() => {
    // Priority 1: Load core data immediately (blocks render)
    getCoreData(studentId).then(setCoreData);

    // Priority 2: Load analytics after core data
    getCoreData(studentId).then(() => {
      getAnalytics(studentId).then(setAnalytics);
    });

    // Priority 3: Load recommendations last (nice-to-have)
    setTimeout(() => {
      getRecommendations(studentId).then(setRecommendations);
    }, 1000);
  }, [studentId]);

  if (!coreData) {
    return <LoadingSkeleton />;
  }

  return (
    <div>
      {/* Always visible */}
      <StudentInfo data={coreData} />
      
      {/* Shows when ready */}
      {analytics ? (
        <AnalyticsPanel data={analytics} />
      ) : (
        <AnalyticsSkeleton />
      )}
      
      {/* Optional enhancement */}
      {recommendations && (
        <RecommendationsPanel items={recommendations} />
      )}
    </div>
  );
};
```

**Impact:** Initial render 60% faster.

---

## 7. Add Local State Management (Reduce Server Calls)

**Problem:** Fetching the same data repeatedly wastes bandwidth.

**Solution:** Cache data in client state.

```typescript
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Global state store
interface AppState {
  organizations: Organization[];
  questions: Question[];
  studentData: Student | null;
  
  setOrganizations: (orgs: Organization[]) => void;
  setQuestions: (questions: Question[]) => void;
  setStudentData: (student: Student) => void;
  
  // Computed values
  visitedOrgsCount: () => number;
}

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      organizations: [],
      questions: [],
      studentData: null,
      
      setOrganizations: (orgs) => set({ organizations: orgs }),
      setQuestions: (questions) => set({ questions }),
      setStudentData: (student) => set({ studentData: student }),
      
      visitedOrgsCount: () => get().studentData?.visitedStalls.length || 0,
    }),
    {
      name: 'career-city-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        studentData: state.studentData,
        organizations: state.organizations,
      }),
    }
  )
);

// Usage in components
const StudentProfile = () => {
  const studentData = useAppStore(state => state.studentData);
  const visitedCount = useAppStore(state => state.visitedOrgsCount());
  
  return (
    <div>
      <h2>{studentData?.name}</h2>
      <p>Visited: {visitedCount} organizations</p>
    </div>
  );
};

// Fetch once, use everywhere
const App = () => {
  const setOrganizations = useAppStore(state => state.setOrganizations);
  
  useEffect(() => {
    // Only fetch if not already loaded
    if (useAppStore.getState().organizations.length === 0) {
      getOrganizations().then(setOrganizations);
    }
  }, []);
  
  return <Routes />;
};
```

**Impact:** 70% reduction in repeat API calls.

---

## 8. Optimize Images and Assets

### Image Optimization

```typescript
import Image from 'next/image';

// ❌ BAD - Loads full-size images
<img src="/org-logo.png" alt="Logo" />

// ✅ GOOD - Automatic optimization
<Image
  src="/org-logo.png"
  alt="Logo"
  width={200}
  height={200}
  quality={75}
  loading="lazy" // Lazy load off-screen images
/>

// ✅ EVEN BETTER - Responsive images
<Image
  src="/hero.jpg"
  alt="Hero"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  priority={false} // Don't load immediately
/>
```

### Lazy Load Components

```typescript
import dynamic from 'next/dynamic';

// Only load heavy components when needed
const QRScanner = dynamic(() => import('@/components/QRScanner'), {
  loading: () => <LoadingSpinner />,
  ssr: false, // Don't render on server
});

const FeedbackChart = dynamic(() => import('@/components/FeedbackChart'), {
  loading: () => <ChartSkeleton />,
});

const Dashboard = () => {
  const [showScanner, setShowScanner] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowScanner(true)}>
        Start Scanning
      </button>
      
      {/* Only loads when button clicked */}
      {showScanner && <QRScanner />}
      
      {/* Loads in background after initial render */}
      <FeedbackChart />
    </div>
  );
};
```

**Impact:** 40% smaller initial bundle size.

---

## 9. Add Offline Support (PWA)

**Problem:** App breaks when network is unstable.

**Solution:** Cache critical resources and queue actions.

```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // Your Next.js config
});
```

```typescript
// src/lib/offline-queue.ts
interface QueuedAction {
  id: string;
  action: 'recordVisit' | 'submitFeedback';
  data: any;
  timestamp: number;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];
  private readonly STORAGE_KEY = 'offline_queue';

  constructor() {
    this.loadQueue();
    this.setupOnlineListener();
  }

  add(action: string, data: any) {
    const queuedAction: QueuedAction = {
      id: crypto.randomUUID(),
      action: action as any,
      data,
      timestamp: Date.now(),
    };

    this.queue.push(queuedAction);
    this.saveQueue();
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
    }
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const action = this.queue[0];
      
      try {
        await this.executeAction(action);
        this.queue.shift();
        this.saveQueue();
      } catch (error) {
        console.error('Failed to process queued action:', error);
        break; // Stop processing on first failure
      }
    }
  }

  private async executeAction(action: QueuedAction) {
    switch (action.action) {
      case 'recordVisit':
        return recordVisit(action.data.studentId, action.data.orgId);
      case 'submitFeedback':
        return submitFeedback(action.data);
    }
  }

  private saveQueue() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
  }

  private loadQueue() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.queue = JSON.parse(saved);
    }
  }
}

export const offlineQueue = new OfflineQueue();

// Usage
const handleScan = async (orgId: string) => {
  if (!navigator.onLine) {
    offlineQueue.add('recordVisit', { studentId, orgId });
    toast.success('Scan queued. Will sync when online.');
    return;
  }
  
  await recordVisit(studentId, orgId);
};
```

**Impact:** App works in poor network conditions.

---

## 10. Implement Error Boundaries

**Problem:** One component crash breaks entire app.

**Solution:** Isolate failures with error boundaries.

```typescript
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service (e.g., Sentry)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
const Dashboard = () => (
  <div>
    <ErrorBoundary fallback={<StudentProfileFallback />}>
      <StudentProfile />
    </ErrorBoundary>
    
    <ErrorBoundary fallback={<ScanListFallback />}>
      <ScansList />
    </ErrorBoundary>
  </div>
);
```

**Impact:** Graceful degradation instead of white screen.

---

## Performance Monitoring Checklist

**Measure these metrics:**

```typescript
// src/lib/performance.ts
export function measurePerformance() {
  if (typeof window === 'undefined') return;

  // Core Web Vitals
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(entry.name, entry.startTime);
      
      // Send to analytics
      if (entry.entryType === 'largest-contentful-paint') {
        console.log('LCP:', entry.startTime); // Target: < 2.5s
      }
      if (entry.entryType === 'first-input') {
        console.log('FID:', (entry as any).processingStart - entry.startTime); // Target: < 100ms
      }
    }
  });

  observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });

  // Custom metrics
  performance.mark('app-interactive');
  
  window.addEventListener('load', () => {
    const loadTime = performance.now();
    console.log('Total load time:', loadTime); // Target: < 3s
  });
}
```

---

## Quick Implementation Priority

**Stage 1 (High Impact):**
- [ ] Add React.memo to list items
- [ ] Implement optimistic UI for QR scanning
- [ ] Add loading skeletons
- [ ] Optimize images with Next.js Image

**Stage 2 (Medium Impact):**
- [ ] Add virtualization to long lists
- [ ] Implement debounced search
- [ ] Set up Zustand for state management
- [ ] Add error boundaries

**Stage 3 (Polish):**
- [ ] Implement offline support
- [ ] Add progressive loading
- [ ] Lazy load heavy components
- [ ] Set up performance monitoring

**Expected Results:**
- Initial page load: < 2 seconds
- Time to interactive: < 3 seconds
- Smooth 60fps scrolling
- Works offline with queued actions
- No crashes from single component failures