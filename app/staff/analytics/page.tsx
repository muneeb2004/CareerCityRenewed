'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getAnalyticsDashboardData, AnalyticsDashboardData } from '@/actions/analytics';
import { Skeleton } from '@/lib/components/ui/Skeleton';
import { ExportAnalyticsPanel } from '@/components/staff/ExportAnalyticsPanel';

// Dynamically import Recharts components with SSR disabled
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });

// Colors for charts
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const dashboardData = await getAnalyticsDashboardData();
      setData(dashboardData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Get color based on value relative to average
  const getBarColor = (value: number, avg: number) => {
    if (value >= avg * 1.2) return COLORS.success;
    if (value >= avg * 0.8) return COLORS.primary;
    return COLORS.warning;
  };

  const avgVisitors = data?.organizationVisits.length 
    ? data.organizationVisits.reduce((sum, org) => sum + org.visitorCount, 0) / data.organizationVisits.length 
    : 0;

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
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Key Metrics - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Total Students
            </h3>
            {loading ? (
              <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <p className="text-4xl font-bold text-blue-600 mt-2">
                {data?.summary.totalStudents || 0}
              </p>
            )}
          </div>
          <div className="p-4 bg-blue-100 rounded-full text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Total Scans */}
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Total Scans
            </h3>
            {loading ? (
              <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <>
                <p className="text-4xl font-bold text-emerald-600 mt-2">
                  {data?.summary.totalScans || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {data?.summary.avgScansPerStudent || 0} avg/student
                </p>
              </>
            )}
          </div>
          <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
        </div>

        {/* Organizations */}
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Organizations
            </h3>
            {loading ? (
              <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <>
                <p className="text-4xl font-bold text-purple-600 mt-2">
                  {data?.summary.totalOrganizations || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {data?.summary.activeVolunteers || 0} active volunteers
                </p>
              </>
            )}
          </div>
          <div className="p-4 bg-purple-100 rounded-full text-purple-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>

        {/* Feedback Rate */}
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Feedback Rate
            </h3>
            {loading ? (
              <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <>
                <p className="text-4xl font-bold text-amber-600 mt-2">
                  {data?.summary.studentFeedbackRate || 0}%
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {data?.summary.studentFeedbackCount || 0} of {data?.summary.totalStudents || 0} students
                </p>
              </>
            )}
          </div>
          <div className="p-4 bg-amber-100 rounded-full text-amber-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Feedback Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-modern">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">Student Feedback Progress</h3>
            <span className="text-sm font-medium text-gray-600">
              {data?.summary.studentFeedbackCount || 0} / {data?.summary.totalStudents || 0}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${data?.summary.studentFeedbackRate || 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data?.summary.studentFeedbackRate || 0}% collected
          </p>
        </div>

        <div className="card-modern">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">Organization Feedback Progress</h3>
            <span className="text-sm font-medium text-gray-600">
              {data?.summary.orgFeedbackCount || 0} / {data?.summary.totalOrganizations || 0}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${data?.summary.orgFeedbackRate || 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data?.summary.orgFeedbackRate || 0}% collected
          </p>
        </div>
      </div>

      {/* Charts Row 1: Activity Over Time & Engagement Distribution */}
      {loading ? (
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
          {/* Activity Over Time - Area Chart */}
          <div className="card-modern">
            <h3 className="text-xl font-bold mb-2 text-gray-800">Activity Over Time</h3>
            <p className="text-sm text-gray-500 mb-4">Hourly breakdown of scans and unique students</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.hourlyActivity || []}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="scans" 
                  stroke={COLORS.primary} 
                  fillOpacity={1} 
                  fill="url(#colorScans)" 
                  strokeWidth={2}
                  name="Total Scans"
                />
                <Area 
                  type="monotone" 
                  dataKey="uniqueStudents" 
                  stroke={COLORS.success} 
                  fillOpacity={1} 
                  fill="url(#colorStudents)" 
                  strokeWidth={2}
                  name="Unique Students"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Student Engagement Distribution */}
          <div className="card-modern">
            <h3 className="text-xl font-bold mb-2 text-gray-800">Student Engagement</h3>
            <p className="text-sm text-gray-500 mb-4">Distribution of stalls visited per student</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.engagementDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="stallsVisited" 
                  stroke="#6b7280" 
                  fontSize={12} 
                  tickLine={false}
                  tickFormatter={(value) => value === 5 ? '5+' : value === 0 ? '0' : String(value)}
                />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value) => [value, 'Students']}
                  labelFormatter={(label) => `${label === 5 ? '5+' : label} stalls visited`}
                />
                <Bar dataKey="studentCount" fill={COLORS.purple} radius={[4, 4, 0, 0]} name="Students">
                  {data?.engagementDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.stallsVisited >= 3 ? COLORS.success : entry.stallsVisited >= 1 ? COLORS.primary : COLORS.warning}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Organizations - Horizontal Bar Chart */}
      {loading ? (
        <div className="card-modern">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      ) : mounted && (
        <div className="card-modern">
          <h3 className="text-xl font-bold mb-2 text-gray-800">Organization Popularity</h3>
          <p className="text-sm text-gray-500 mb-4">
            Ranked by visitor count • Average: {Math.round(avgVisitors)} visitors
          </p>
          <ResponsiveContainer width="100%" height={Math.max(300, (data?.organizationVisits.length || 0) * 40)}>
            <BarChart 
              data={data?.organizationVisits.slice(0, 15) || []} 
              layout="vertical"
              margin={{ left: 20, right: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#6b7280" 
                fontSize={12} 
                tickLine={false}
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value, _name, props) => [
                  `${value} visitors`,
                  `Booth ${(props as any).payload.boothNumber}`
                ]}
              />
              <Bar dataKey="visitorCount" radius={[0, 4, 4, 0]} name="Visitors">
                {data?.organizationVisits.slice(0, 15).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.visitorCount, avgVisitors)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.success }} />
              <span className="text-gray-600">Above average</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.primary }} />
              <span className="text-gray-600">Average</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.warning }} />
              <span className="text-gray-600">Below average</span>
            </div>
          </div>
        </div>
      )}

      {/* Volunteer Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volunteer Leaderboard */}
        <div className="card-modern">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Volunteer Leaderboard</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {data?.volunteerPerformance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No volunteer data available</p>
              ) : (
                data?.volunteerPerformance.map((volunteer, index) => (
                  <div 
                    key={volunteer.volunteerId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-amber-50 border border-amber-200' :
                      index === 1 ? 'bg-gray-50 border border-gray-200' :
                      index === 2 ? 'bg-orange-50 border border-orange-200' :
                      'bg-white border border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-amber-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800">{volunteer.name}</p>
                        <p className="text-xs text-gray-500">{volunteer.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{volunteer.totalCollected}</p>
                      <p className="text-xs text-gray-500">
                        {volunteer.studentFeedbackCount}S / {volunteer.orgFeedbackCount}O
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="card-modern">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Recent Activity</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {data?.recentScans.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              ) : (
                data?.recentScans.map((scan, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <div>
                        <p className="font-medium text-gray-800">{scan.studentId}</p>
                        <p className="text-sm text-gray-500">visited {scan.organizationName}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">{scan.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Excel Export Section */}
      <ExportAnalyticsPanel />
    </div>
  );
}
