'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Scan } from '../../../src/types';
import Papa from 'papaparse';
import { Skeleton } from '../../../src/lib/components/ui/Skeleton';

interface AnalyticsData {
  totalStudents: number;
  totalScans: number;
  scansPerOrg: { name: string; scans: number }[];
  scansOverTime: { time: string; scans: number }[];
}

export default function AnalyticsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [data, setData] = useState<AnalyticsData>({
    totalStudents: 0,
    totalScans: 0,
    scansPerOrg: [],
    scansOverTime: [],
  });
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const scansQuery = query(
      collection(db, 'scans'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(scansQuery, (snapshot) => {
      const scansData = snapshot.docs.map(
        (doc) => ({ ...doc.data(), scanId: doc.id } as Scan)
      );
      setScans(scansData);

      // Process scans for analytics
      const totalScans = scansData.length;

      const scansPerOrg: { [key: string]: number } = {};
      scansData.forEach((scan) => {
        scansPerOrg[scan.organizationName] =
          (scansPerOrg[scan.organizationName] || 0) + 1;
      });
      const scansPerOrgArray = Object.entries(scansPerOrg).map(
        ([name, scans]) => ({ name, scans })
      );

      const scansOverTime: { [key: string]: number } = {};
      scansData.forEach((scan) => {
        const time = scan.timestamp
          .toDate()
          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        scansOverTime[time] = (scansOverTime[time] || 0) + 1;
      });
      const scansOverTimeArray = Object.entries(scansOverTime).map(
        ([time, scans]) => ({ time, scans })
      );

      // For total students, we need to query the students collection
      // For now, we can get a unique count from the scans
      const totalStudents = new Set(scansData.map((s) => s.studentId)).size;

      setData({
        totalStudents,
        totalScans,
        scansPerOrg: scansPerOrgArray,
        scansOverTime: scansOverTimeArray,
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
            Live Analytics
            </h1>
            <p className="text-gray-500 text-sm mt-1">Real-time insights into event activity</p>
        </div>
        <button
            onClick={exportToCSV}
            className="btn-secondary flex items-center gap-2"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export to CSV
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-modern flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Total Students
            </h3>
            {loading ? (
                <Skeleton className="h-10 w-24 mt-2" />
            ) : (
                <p className="text-4xl font-bold text-blue-600 mt-2">
                {data.totalStudents}
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
            {loading ? (
                <Skeleton className="h-10 w-24 mt-2" />
            ) : (
                <p className="text-4xl font-bold text-emerald-600 mt-2">
                {data.totalScans}
                </p>
            )}
          </div>
           <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4c1 1 0 0 1 1 1v3c0 1-1 1-1 1h-1v-1a2 2 0 1 0-2 0v1h-1a2 2 0 0 0-2 0v-1H9.05a1 1 0 0 0-.82-1.566a2 2 0 0 0-2.806 0A1 1 0 0 0 5 12v2a1 1 0 0 0 1 1h1v1c0 1 0 1 1 1h1v-1.82a1 1 0 0 0-.26-.726A2 2 0 0 0 7.17 11H7v-.17a1 1 0 0 0-1.147-.983A2 2 0 0 0 5 11h.02a1 1 0 0 0 .01-1.832A1 1 0 0 0 5.03 7h.05a2 2 0 0 0 3.84 0h.05A1 1 0 0 0 9 7h1.05a1 1 0 0 0 .82-1.566A2 2 0 0 0 10.05 5H9a1 1 0 0 0-1 .99V7m3 0h5" /></svg>
          </div>
        </div>
      </div>

      {/* Charts */}
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
          <div className="card-modern">
            <h3 className="text-xl font-bold mb-6 text-gray-800">
              Scans per Organization
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.scansPerOrg}>
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
              <LineChart data={data.scansOverTime}>
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
