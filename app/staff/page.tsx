'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Scan, Student } from '@/types';
import { Skeleton } from '@/lib/components/ui/Skeleton';
import { getAllStudents } from '@/firestore/student';

export default function StaffDashboard() {
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for scans
    const scansQuery = query(
      collection(db, 'scans'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(scansQuery, (snapshot) => {
      const scansData = snapshot.docs.map(
        (doc) => ({ ...doc.data(), scanId: doc.id } as Scan)
      );
      setRecentScans(scansData);
      // In a real app, we'd probably count total docs differently or use aggregation
      // For now, we'll rely on a separate fetch or just the recent ones if scaling is an issue
    });

    // Fetch total counts (mocking real-time for totals to avoid heavy reads)
    const fetchCounts = async () => {
      try {
        // We can reuse the existing getAllStudents but optimizing it would be better
        // For this dashboard, we'll just get the count
        const students = await getAllStudents();
        setTotalStudents(students.length);
        
        // For total scans, we might need a separate count if the collection is huge
        // but for now let's assume we can get it or just show "Recent Activity" focus
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
        setLoading(false);
      }
    };

    fetchCounts();

    return () => unsubscribe();
  }, []);

  const formatDate = (date: any) => {
    if (!date) return '';
    return new Date(date.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
            Command Center
          </h1>
          <p className="text-gray-500 mt-1">System Overview & Quick Actions</p>
        </div>
        <div className="text-sm text-gray-400 font-medium">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-xl border border-white/60 flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Students</p>
            {loading ? (
               <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <p className="text-4xl font-bold text-gray-800 mt-2">{totalStudents}</p>
            )}
          </div>
          <div className="p-4 bg-blue-50 text-blue-500 rounded-full group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="glass p-6 rounded-xl border border-white/60 flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Active Scans</p>
            {loading ? (
               <Skeleton className="h-10 w-24 mt-2" />
            ) : (
               // Placeholder for total scans if we had it, or just "Live" indicator
               <div className="flex items-center gap-2 mt-2">
                 <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                 </span>
                 <span className="text-lg font-bold text-emerald-600">Live Feed</span>
               </div>
            )}
          </div>
           <div className="p-4 bg-emerald-50 text-emerald-500 rounded-full group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4c1 1 0 0 1 1 1v3c0 1-1 1-1 1h-1v-1a2 2 0 1 0-2 0v1h-1a2 2 0 0 0-2 0v-1H9.05a1 1 0 0 0-.82-1.566a2 2 0 0 0-2.806 0A1 1 0 0 0 5 12v2a1 1 0 0 0 1 1h1v1c0 1 0 1 1 1h1v-1.82a1 1 0 0 0-.26-.726A2 2 0 0 0 7.17 11H7v-.17a1 1 0 0 0-1.147-.983A2 2 0 0 0 5 11h.02a1 1 0 0 0 .01-1.832A1 1 0 0 0 5.03 7h.05a2 2 0 0 0 3.84 0h.05A1 1 0 0 0 9 7h1.05a1 1 0 0 0 .82-1.566A2 2 0 0 0 10.05 5H9a1 1 0 0 0-1 .99V7m3 0h5" /></svg>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="glass p-6 rounded-xl border border-white/60 flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
             <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Quick Action</p>
             <Link href="/staff/organizations" className="mt-3 inline-flex items-center gap-2 text-violet-600 font-semibold hover:text-violet-700 transition-colors">
                Manage Orgs <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
             </Link>
          </div>
          <div className="p-4 bg-violet-50 text-violet-500 rounded-full group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
           <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Feed */}
        <div className="card-modern">
          <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Recent Activity Feed
          </h3>
          <div className="space-y-4">
            {loading ? (
               Array.from({length: 5}).map((_, i) => (
                   <div key={i} className="flex items-center gap-4 p-3 border-b border-gray-100 last:border-0">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                      </div>
                   </div>
               ))
            ) : recentScans.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent activity.</p>
            ) : (
                recentScans.map((scan) => (
                    <div key={scan.scanId} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                            {scan.studentId.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                                Student {scan.studentId}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                Checked in at <span className="text-blue-600 font-medium">{scan.organizationName}</span>
                            </p>
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                            {formatDate(scan.timestamp)}
                        </div>
                    </div>
                ))
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
             <Link href="/staff/analytics" className="text-sm text-blue-600 font-medium hover:text-blue-700">
                View Full Analytics &rarr;
             </Link>
          </div>
        </div>

        {/* Quick Navigation Grid */}
        <div className="grid grid-cols-2 gap-4 h-fit">
           <Link href="/staff/organizations" className="glass-hover p-6 rounded-xl border border-white/60 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-blue-50 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Organizations</span>
           </Link>
           <Link href="/staff/student-records" className="glass-hover p-6 rounded-xl border border-white/60 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-emerald-600 transition-colors">Students</span>
           </Link>
           <Link href="/staff/student-questions" className="glass-hover p-6 rounded-xl border border-white/60 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-violet-50 text-violet-500 rounded-xl group-hover:bg-violet-500 group-hover:text-white transition-colors duration-300">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-violet-600 transition-colors">Questionnaire</span>
           </Link>
           <Link href="/staff/analytics" className="glass-hover p-6 rounded-xl border border-white/60 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-amber-50 text-amber-500 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-amber-600 transition-colors">Analytics</span>
           </Link>
        </div>
      </div>
    </div>
  );
}
