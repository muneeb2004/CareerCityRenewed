'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Scan, Student } from '@/types';
import { Skeleton } from '@/lib/components/ui/Skeleton';
import { getAllStudents } from '@/actions/student';
import { getAllScans } from '@/actions/scans';

export default function StaffDashboard() {
  // Priority 1: Quick stats (blocks initial render)
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [totalScans, setTotalScans] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Priority 2: Recent activity (loaded after stats)
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [scansLoading, setScansLoading] = useState(true);
  
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Priority 1: Load quick stats first (fast, critical for dashboard)
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const students = await getAllStudents();
      setTotalStudents(students.length);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Priority 2: Load recent scans after stats are ready
  const fetchRecentScans = useCallback(async () => {
    try {
      setScansLoading(true);
      const scans = await getAllScans();
      setTotalScans(scans.length);
      // Get recent 5 scans (already sorted by timestamp desc from action)
      setRecentScans((scans as unknown as Scan[]).slice(0, 5));
    } catch (error) {
      console.error("Error fetching recent scans:", error);
    } finally {
      setScansLoading(false);
    }
  }, []);

  // Progressive loading: stats first, then scans
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Load scans after stats are loaded (or after a short delay)
  useEffect(() => {
    if (!statsLoading) {
      fetchRecentScans();
    }
  }, [statsLoading, fetchRecentScans]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchRecentScans();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchRecentScans]);

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Command Center
          </h1>
          <p className="text-gray-500 mt-1">System Overview & Quick Actions</p>
        </div>
        <div className="text-sm text-gray-500 font-medium bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Students Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all duration-200">
          <div>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Students</p>
            {statsLoading ? (
               <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <p className="text-4xl font-bold text-gray-900 mt-2">{totalStudents}</p>
            )}
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>

        {/* Active Scans Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-emerald-300 transition-all duration-200">
          <div>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Active Scans</p>
            {scansLoading ? (
               <Skeleton className="h-10 w-24 mt-2" />
            ) : (
               <div className="flex items-center gap-2 mt-2">
                 <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                 </span>
                 <span className="text-lg font-bold text-emerald-600">Live Feed</span>
               </div>
            )}
          </div>
           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h4v4H3V4zm14 0h4v4h-4V4zM3 16h4v4H3v-4zm14 0h4v4h-4v-4zm-7-7h4v4h-4V9zm0 7h4v4h-4v-4zm-7-7h4v4H3V9zm14 0h4v4h-4V9z" /></svg>
          </div>
        </div>

        {/* Quick Action Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-violet-300 transition-all duration-200 cursor-pointer" onClick={() => window.location.href='/staff/organizations'}>
          <div>
             <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Quick Action</p>
             <Link href="/staff/organizations" className="mt-2 inline-flex items-center gap-2 text-violet-700 font-bold hover:text-violet-800 transition-colors text-lg">
                Manage Orgs <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
             </Link>
          </div>
          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Feed */}
        <div className="card-modern">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              Recent Activity
            </h3>
             <Link href="/staff/student-records" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                View All Students &rarr;
             </Link>
          </div>
          
          <div className="space-y-0 divide-y divide-gray-100">
            {scansLoading ? (
               Array.from({length: 5}).map((_, i) => (
                   <div key={i} className="flex items-center gap-4 py-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                      </div>
                   </div>
               ))
            ) : recentScans.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500 font-medium">No recent activity detected.</p>
                </div>
            ) : (
                recentScans.map((scan) => (
                    <div key={scan.scanId} className="flex items-center gap-4 py-4 hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0 border border-blue-200">
                            {scan.studentId.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                                Student {scan.studentId}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                Checked in at <span className="text-blue-700 font-medium">{scan.organizationName}</span>
                            </p>
                        </div>
                        <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 whitespace-nowrap">
                            {formatDate(scan.timestamp)}
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Quick Navigation Grid */}
        <div className="grid grid-cols-2 gap-4 h-fit">
           <Link href="/staff/organizations" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Organizations</span>
           </Link>
           <Link href="/staff/student-records" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Students</span>
           </Link>
           <Link href="/staff/student-questions" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:bg-violet-600 group-hover:text-white transition-colors duration-200">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Questionnaire</span>
           </Link>
           <Link href="/staff/analytics" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 group">
               <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               </div>
               <span className="font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Analytics</span>
           </Link>
        </div>
      </div>
    </div>
  );
}