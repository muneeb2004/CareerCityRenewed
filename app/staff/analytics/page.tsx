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
import { Scan } from '../../../src/lib/types';
import Papa from 'papaparse';

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
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Live Analytics</h1>
          <button
            onClick={exportToCSV}
            className="bg-pastel-blue text-blue-800 px-4 py-2 rounded-lg font-semibold hover:bg-blue-300"
          >
            Export to CSV
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glassmorphic p-6">
            <h3 className="text-lg font-semibold text-gray-200">
              Total Students
            </h3>
            <p className="text-4xl font-bold text-white">
              {data.totalStudents}
            </p>
          </div>
          <div className="glassmorphic p-6">
            <h3 className="text-lg font-semibold text-gray-200">
              Total Scans
            </h3>
            <p className="text-4xl font-bold text-white">
              {data.totalScans}
            </p>
          </div>
        </div>

        {/* Charts */}
        {mounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glassmorphic p-6">
              <h3 className="text-xl font-semibold mb-4 text-white">
                Scans per Organization
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.scansPerOrg}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#cbd5e1" />
                  <YAxis stroke="#cbd5e1" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                    itemStyle={{ color: '#333' }}
                  />
                  <Legend />
                  <Bar dataKey="scans" fill="#A7C7E7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glassmorphic p-6">
              <h3 className="text-xl font-semibold mb-4 text-white">
                Scans over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.scansOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#cbd5e1" />
                  <YAxis stroke="#cbd5e1" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                    itemStyle={{ color: '#333' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="scans" stroke="#B2D8B2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
