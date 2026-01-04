'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getAllScans } from '@/actions/scans';
import { Scan, toDate } from '@/types';
import Papa from 'papaparse';
import { Skeleton } from '@/lib/components/ui/Skeleton';

// Dynamically import Recharts components with SSR disabled
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });

interface SummaryData {
  totalStudents: number;
  totalScans: number;
}

interface ChartData {
  scansPerOrg: { name: string; scans: number }[];
  scansOverTime: { time: string; scans: number }[];
}

export default function AnalyticsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  
  // Priority 1: Summary metrics (shown immediately)
  const [summary, setSummary] = useState<SummaryData>({
    totalStudents: 0,
    totalScans: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  
  // Priority 2: Chart data (deferred, computationally expensive)
  const [chartData, setChartData] = useState<ChartData>({
    scansPerOrg: [],
    scansOverTime: [],
  });
  const [chartsLoading, setChartsLoading] = useState(true);
  
  const [mounted, setMounted] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Process summary data (fast operation)
  const processSummary = useCallback((scansData: Scan[]): SummaryData => {
    return {
      totalScans: scansData.length,
      totalStudents: new Set(scansData.map((s) => s.studentId)).size,
    };
  }, []);

  // Process chart data (slower, deferred)
  const processCharts = useCallback((scansData: Scan[]): ChartData => {
    const scansPerOrg: { [key: string]: number } = {};
    scansData.forEach((scan) => {
      const orgName = scan.organizationName || 'Unknown';
      scansPerOrg[orgName] = (scansPerOrg[orgName] || 0) + 1;
    });
    const scansPerOrgArray = Object.entries(scansPerOrg).map(
      ([name, scans]) => ({ name, scans })
    );

    const scansOverTime: { [key: string]: number } = {};
    scansData.forEach((scan) => {
      const timestamp = toDate(scan.timestamp);
      const time = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      scansOverTime[time] = (scansOverTime[time] || 0) + 1;
    });
    const scansOverTimeArray = Object.entries(scansOverTime).map(
      ([time, scans]) => ({ time, scans })
    );

    return {
      scansPerOrg: scansPerOrgArray,
      scansOverTime: scansOverTimeArray,
    };
  }, []);

  // Priority 1: Fetch and show summary first
  const fetchData = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const scansData = await getAllScans() as unknown as Scan[];
      setScans(scansData);
      
      // Immediately show summary (fast)
      setSummary(processSummary(scansData));
      setSummaryLoading(false);
      setLastRefresh(new Date());
      
      // Defer chart processing (slower, non-blocking)
      setChartsLoading(true);
      // Use setTimeout to allow UI to update before heavy computation
      setTimeout(() => {
        setChartData(processCharts(scansData));
        setChartsLoading(false);
      }, 100);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setSummaryLoading(false);
      setChartsLoading(false);
    }
  }, [processSummary, processCharts]);

  useEffect(() => {
    setMounted(true);
    fetchData();

    // Auto-refresh every 30 seconds for near real-time updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const exportToCSV = () => {
    const csv = Papa.unparse(scans);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'scans.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-modern flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
            Live Analytics
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Auto-refreshes every 30s • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
        </div>
        <div className="flex gap-2">
          <button
              onClick={fetchData}
              disabled={summaryLoading}
              className="btn-secondary flex items-center gap-2"
          >
              <svg className={`w-5 h-5 ${summaryLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
          </button>
          <button
              onClick={exportToCSV}
              className="btn-secondary flex items-center gap-2"
          >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export to CSV
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Total Students
            </h3>
            {summaryLoading ? (
                <Skeleton className="h-10 w-24 mt-2" />
            ) : (
                <p className="text-4xl font-bold text-blue-600 mt-2">
                {summary.totalStudents}
                </p>
            )}
          </div>
          <div className="p-4 bg-blue-100 rounded-full text-blue-600">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Total Scans
            </h3>
            {summaryLoading ? (
                <Skeleton className="h-10 w-24 mt-2" />
            ) : (
                <p className="text-4xl font-bold text-emerald-600 mt-2">
                {summary.totalScans}
                </p>
            )}
          </div>
           <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h4v4H3V4zm14 0h4v4h-4V4zM3 16h4v4H3v-4zm14 0h4v4h-4v-4zm-7-7h4v4h-4V9zm0 7h4v4h-4v-4zm-7-7h4v4H3V9zm14 0h4v4h-4V9z" /></svg>
          </div>
        </div>
      </div>

      {/* Charts */}
      {chartsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-modern">
                <Skeleton className="h-8 w-48 mb-6" />
                <Skeleton className="h-[300px] w-full rounded-xl" />
            </div>
            <div className="card-modern">
                <Skeleton className="h-8 w-48 mb-6" />
                <Skeleton className="h-[300px] w-full rounded-xl" />
            </div>
        </div>
      ) : mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-modern">
            <h3 className="text-xl font-bold mb-6 text-gray-800">
              Scans per Organization
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.scansPerOrg}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#374151', fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="scans" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card-modern">
            <h3 className="text-xl font-bold mb-6 text-gray-800">
              Scans over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.scansOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#374151', fontWeight: 600 }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="scans"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: '#10B981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
