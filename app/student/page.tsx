// Prompt for Copilot: "Create Next.js page for student portal with QR scanner, check if student has session, show registration modal if first time, display visit count and recent visits"

'use client';

import { useState, useEffect } from 'react';
import {
  getStudentSession,
  clearStudentSession,
  StudentSession,
} from '../../src/lib/storage';
import { getOrganization } from '../../src/lib/firestore/organizations';
import { getStudent } from '../../src/lib/firestore/student';
import { getScansByStudent } from '../../src/lib/firestore/scans';
import StudentRegistration from '../../src/lib/components/student/StudentRegistration';
import QRScanner from '../../src/lib/components/student/QRScanner';
import { Student, Scan } from '../../src/lib/types';
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
    if (organizationData) {
      setScannedOrganization({
        id: organizationId,
        name: organizationData.name,
        booth: organizationData.boothNumber,
      });
      setShowRegistration(true);
    } else {
      toast.error('Invalid Organization QR Code');
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
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <StudentRegistration
          organizationId={scannedOrganization.id}
          organizationName={scannedOrganization.name}
          boothNumber={scannedOrganization.booth}
          onComplete={handleRegistrationComplete}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" />
      {/* Header */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-primary">
          🎓 HU Career City 2026
        </h1>
        {session && (
          <div className="mt-2">
            <p className="text-gray-600">Welcome back, {session.studentId}!</p>
            <p className="text-sm text-gray-500">{session.program}</p>
          </div>
        )}
      </div>
      {/* Stats */}
      {student && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            📊 Your Progress
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Stalls Visited</p>
              <p className="text-2xl font-bold text-primary">
                {student.scanCount}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Last Visit</p>
              <p className="text-lg font-semibold text-gray-800">
                {mounted && student.lastScanTime?.toDate().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Visit History */}
      {scans.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            🕒 Your Visit History
          </h2>
          <div className="space-y-4">
            {scans.map((scan) => (
              <div
                key={scan.scanId}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {scan.organizationName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Booth: {scan.boothNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {mounted && scan.timestamp?.toDate().toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {mounted && scan.timestamp?.toDate().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* QR Scanner */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Scan QR Code</h2>
        <QRScanner onScanSuccess={handleScanSuccess} />
      </div>
      {/* Logout */}
      {session && (
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full bg-secondary text-white py-3 rounded-lg font-semibold hover:bg-violet-600 transition"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
