'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getStudentSession, clearStudentSession, StudentSession } from '../../src/lib/storage';
import { getOrganization } from '../../src/actions/organizations';
import { getStudent } from '../../src/actions/student';
import { getScansByStudent, recordVisit } from '../../src/actions/scans';
import { generateEmail } from '../../src/lib/validation';
import StudentRegistration from '../../src/components/student/StudentRegistration';
import QRScanner from '../../src/components/student/QRScanner';
import { Student, Scan } from '../../src/types';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image';

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

  // Use ref to track scanned IDs for stable reference
  const scannedIdsRef = useRef<string[]>([]);

  // Update scanned IDs ref when scans change
  useEffect(() => {
    scannedIdsRef.current = scans.map(s => s.organizationId);
  }, [scans]);

  // Memoize scanned IDs array to prevent QRScanner re-renders
  const scannedIds = useMemo(() => scans.map(s => s.organizationId), [scans]);

  useEffect(() => {
    setSession(getStudentSession());
    setMounted(true);
  }, []);

  const loadStudentData = useCallback(async () => {
    if (!session) return;
    try {
      const studentData = await getStudent(session.studentId);
      // Cast the result to Student type compatible with frontend (handling any slight mismatches)
      setStudent(studentData as unknown as Student);
      
      const scanData = await getScansByStudent(session.studentId);
      setScans(scanData as unknown as Scan[]);
    } catch (error) {
      console.error('Error loading student data:', error);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadStudentData();
    }
  }, [session, loadStudentData]);

  // Stable callback using ref to avoid re-renders
  const handleScanSuccess = useCallback(async (organizationId: string) => {
    console.log('Portal: Scan detected', organizationId);
    
    // Check using ref for immediate feedback (before state updates)
    if (scannedIdsRef.current.includes(organizationId)) {
      toast.error('You have already visited this employer!');
      return;
    }

    try {
      const organizationData = await getOrganization(organizationId);
      if (!organizationData) {
        toast.error('Invalid Organization QR Code');
        return;
      }

      if (session) {
        // Record the visit using a transaction
        await recordVisit(
          session.studentId,
          generateEmail(session.studentId),
          session.program,
          organizationId,
          organizationData.name,
          organizationData.boothNumber
        );

        toast.success(`Visited ${organizationData.name}!`);
        
        // Update scanned IDs ref immediately for next scan
        scannedIdsRef.current = [...scannedIdsRef.current, organizationId];
        
        // Refresh data
        await loadStudentData();
      } else {
        // Not logged in - show registration
        setScannedOrganization({
          id: organizationId,
          name: organizationData.name,
          booth: organizationData.boothNumber,
        });
        setShowRegistration(true);
      }
    } catch (error) {
      console.error('Error recording visit:', error);
      toast.error('Failed to record visit.');
    }
  }, [session, loadStudentData]); // Removed scans dependency

  const handleRegistrationComplete = useCallback(() => {
    setShowRegistration(false);
    setScannedOrganization(null);
    setSession(getStudentSession());
  }, []);

  const handleLogout = useCallback(() => {
    clearStudentSession();
    setSession(null);
    setStudent(null);
    setScans([]);
    toast.success('Logged out successfully');
  }, []);

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
          <div className="flex items-center gap-4">
            <Image
              src="/favicon-optimized.png"
              alt="Career City Logo"
              width={512}
              height={512}
              className="w-auto h-20 object-contain"
              priority
            />
            <div>
              <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600">
                HU Career City 2026
              </h1>
              {session && (
                <div className="mt-2">
                  <p className="text-gray-900 font-medium">
                    Welcome back, <span className="text-blue-600">{session.studentId}</span>!
                  </p>
                  <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">
                    {session.program}
                  </p>
                </div>
              )}
            </div>
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

        {/* QR Scanner and Visit History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* QR Scanner */}
          <div className="lg:col-span-1 order-1">
            <div className="card-modern h-full">
              <h2 className="text-xl font-bold mb-4 text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h4v4H3V4zm14 0h4v4h-4V4zM3 16h4v4H3v-4zm14 0h4v4h-4v-4zm-7-7h4v4h-4V9zm0 7h4v4h-4v-4zm-7-7h4v4H3V9zm14 0h4v4h-4V9z" />
                </svg>
                Scan QR Code
              </h2>
              {/* Use stable key and memoized scannedIds */}
              <QRScanner
                key="main-scanner"
                onScan={handleScanSuccess}
                alreadyScannedIds={scannedIds}
              />
            </div>
          </div>

          {/* Visit History */}
          <div className="lg:col-span-2 order-2">
            {scans.length > 0 ? (
              <div className="card-modern h-full">
                <h2 className="text-xl font-bold mb-4 text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Your Visit History
                </h2>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {scans.map((scan) => (
                    <div
                      key={scan.scanId}
                      className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md hover:border-blue-300 transition-all duration-200"
                    >
                      <div>
                        <p className="font-bold text-gray-900 text-lg">
                          {scan.organizationName}
                        </p>
                        <p className="text-sm text-blue-700 font-medium bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md inline-block mt-1">
                          Booth: {scan.boothNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {mounted && new Date(scan.timestamp as unknown as string).toLocaleDateString()}
                        </p>
                        <p className="text-sm font-bold text-gray-700">
                          {mounted && new Date(scan.timestamp as unknown as string).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card-modern h-full flex flex-col items-center justify-center text-gray-500 py-12">
                <svg className="w-16 h-16 mb-4 opacity-50 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No visits recorded yet.</p>
                <p className="text-sm text-gray-500">Start scanning QR codes at stalls!</p>
              </div>
            )}
          </div>
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
              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="card-modern flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Last Visit</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {mounted && new Date(student.lastScanTime as unknown as string).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}