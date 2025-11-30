// Prompt for Copilot: "Create Next.js page for student portal with QR scanner, check if student has session, show registration modal if first time, display visit count and recent visits"

'use client';

import { useState, useEffect } from 'react';
import {
  getStudentSession,
  clearStudentSession,
  StudentSession,
} from '../../src/lib/storage';
import { getOrganization, updateOrganizationVisitors } from '../../src/firestore/organizations';
import { getStudent, updateStudentVisit } from '../../src/firestore/student';
import { getScansByStudent, createScan } from '../../src/firestore/scans';
import { generateEmail } from '../../src/lib/validation';
import StudentRegistration from '../../src/components/student/StudentRegistration';
import QRScanner from '../../src/components/student/QRScanner';
import { Student, Scan } from '../../src/types';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentPortal() {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [scannedOrganization, setScannedOrganization] = useState<{
    id: string;
    name: string;
    booth: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSession(getStudentSession());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session) {
      loadStudentData();
    }
  }, [session]);

  const loadStudentData = async () => {
    if (!session) return;
    const studentData = await getStudent(session.studentId);
    setStudent(studentData);
    const scanData = await getScansByStudent(session.studentId);
    setScans(scanData);
  };

  const handleScanSuccess = async (organizationId: string) => {
    const organizationData = await getOrganization(organizationId);
    if (!organizationData) {
      toast.error('Invalid Organization QR Code');
      return;
    }

    if (session) {
      try {
        // 1. Update Student Visit
        await updateStudentVisit(session.studentId, organizationId);
        
        // 2. Update Organization Visitors
        await updateOrganizationVisitors(organizationId, session.studentId);

        // 3. Create Scan Record
        await createScan(
          session.studentId,
          generateEmail(session.studentId),
          session.program,
          organizationId,
          organizationData.name,
          organizationData.boothNumber
        );

        toast.success(`Visited ${organizationData.name}!`);
        loadStudentData();
      } catch (error) {
        console.error('Error recording visit:', error);
        toast.error('Failed to record visit.');
      }
    } else {
      setScannedOrganization({
        id: organizationId,
        name: organizationData.name,
        booth: organizationData.boothNumber,
      });
      setShowRegistration(true);
    }
  };

  const handleRegistrationComplete = () => {
    setShowRegistration(false);
    setScannedOrganization(null);
    loadStudentData();
    setSession(getStudentSession());
  };

  const handleLogout = () => {
    clearStudentSession();
    setSession(null);
    setStudent(null);
    setScans([]);
    toast.success('Logged out successfully');
  };

  if (showRegistration && scannedOrganization) {
    return (
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <div className="w-full max-w-md">
            <StudentRegistration
            organizationId={scannedOrganization.id}
            organizationName={scannedOrganization.name}
            boothNumber={scannedOrganization.booth}
            onComplete={handleRegistrationComplete}
            />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="card-modern flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                🎓 HU Career City 2026
                </h1>
                {session && (
                <div className="mt-2">
                    <p className="text-gray-700 font-medium">Welcome back, <span className="text-blue-600">{session.studentId}</span>!</p>
                    <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">{session.program}</p>
                </div>
                )}
            </div>
             {session && (
                <button
                    onClick={handleLogout}
                    className="btn-secondary text-sm py-2 px-4"
                >
                    Logout
                </button>
            )}
        </div>

        {/* Stats */}
        {student && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-modern flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Stalls Visited</p>
                        <p className="text-4xl font-bold text-blue-600 mt-1">
                            {student.scanCount}
                        </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                </div>
                <div className="card-modern flex items-center justify-between">
                     <div>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Last Visit</p>
                        <p className="text-xl font-bold text-gray-800 mt-1">
                            {mounted && student.lastScanTime?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* QR Scanner */}
            <div className="lg:col-span-1 order-2 lg:order-1">
                 <div className="card-modern h-full">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4c1 1 0 0 1 1 1v3c0 1-1 1-1 1h-1v-1a2 2 0 1 0-2 0v1h-1a2 2 0 0 0-2 0v-1H9.05a1 1 0 0 0-.82-1.566a2 2 0 0 0-2.806 0A1 1 0 0 0 5 12v2a1 1 0 0 0 1 1h1v1c0 1 0 1 1 1h1v-1.82a1 1 0 0 0-.26-.726A2 2 0 0 0 7.17 11H7v-.17a1 1 0 0 0-1.147-.983A2 2 0 0 0 5 11h.02a1 1 0 0 0 .01-1.832A1 1 0 0 0 5.03 7h.05a2 2 0 0 0 3.84 0h.05A1 1 0 0 0 9 7h1.05a1 1 0 0 0 .82-1.566A2 2 0 0 0 10.05 5H9a1 1 0 0 0-1 .99V7m3 0h5" /></svg>
                        Scan QR Code
                    </h2>
                    <QRScanner onScanSuccess={handleScanSuccess} />
                </div>
            </div>

            {/* Visit History */}
            <div className="lg:col-span-2 order-1 lg:order-2">
                {scans.length > 0 ? (
                    <div className="card-modern h-full">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                         <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Your Visit History
                    </h2>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {scans.map((scan) => (
                        <div
                            key={scan.scanId}
                            className="glass-hover flex items-center justify-between p-4 rounded-xl border border-white/50"
                        >
                            <div>
                            <p className="font-bold text-gray-800 text-lg">
                                {scan.organizationName}
                            </p>
                            <p className="text-sm text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                Booth: {scan.boothNumber}
                            </p>
                            </div>
                            <div className="text-right">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {mounted && scan.timestamp?.toDate().toLocaleDateString()}
                            </p>
                            <p className="text-sm font-bold text-gray-700">
                                {mounted && scan.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                            </div>
                        </div>
                        ))}
                    </div>
                    </div>
                ) : (
                    <div className="card-modern h-full flex flex-col items-center justify-center text-gray-500 py-12">
                         <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <p className="text-lg font-medium">No visits recorded yet.</p>
                        <p className="text-sm">Start scanning QR codes at stalls!</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
