// Prompt for Copilot: "Create Next.js page for student portal with QR scanner, check if student has session, show registration modal if first time, display visit count and recent visits"

'use client';

import { useState, useEffect } from 'react';
import { getStudentSession, clearStudentSession } from '../../src/lib/storage';
import { getStudent } from '../../src/lib/firestore/student';
import StudentRegistration from '../../src/lib/components/student/StudentRegistration';
import QRScanner from '../../src/lib/components/student/QRScanner';
import { Student } from '../../src/lib/types';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentPortal() {
  const [session, setSession] = useState(getStudentSession());
  const [student, setStudent] = useState<Student | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [scannedEmployer, setScannedEmployer] = useState<{
    id: string;
    name: string;
    booth: string;
  } | null>(null);

  useEffect(() => {
    if (session) {
      loadStudentData();
    }
  }, [session]);

  const loadStudentData = async () => {
    if (!session) return;
    const studentData = await getStudent(session.studentId);
    setStudent(studentData);
  };

  const handleScanSuccess = (employerId: string) => {
    // TODO: Fetch employer details from Firestore
    // For now, mock data
    setScannedEmployer({
      id: employerId,
      name: 'Sample Employer',
      booth: 'B12',
    });
    setShowRegistration(true);
  };

  const handleRegistrationComplete = () => {
    setShowRegistration(false);
    setScannedEmployer(null);
    loadStudentData();
    setSession(getStudentSession());
  };

  const handleLogout = () => {
    clearStudentSession();
    setSession(null);
    setStudent(null);
    toast.success('Logged out successfully');
  };

  if (showRegistration && scannedEmployer) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <StudentRegistration
          employerId={scannedEmployer.id}
          employerName={scannedEmployer.name}
          boothNumber={scannedEmployer.booth}
          onComplete={handleRegistrationComplete}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      {/* Header */}
      <div className="bg-blue-600 text-white p-6">
        <h1 className="text-3xl font-bold">🎓 HU Career City 2026</h1>
        {session && (
          <div className="mt-2">
            <p className="text-blue-100">Welcome back, {session.studentId}!</p>
            <p className="text-sm text-blue-200">{session.program}</p>
          </div>
        )}
      </div>
      {/* Stats */}
      {student && (
        <div className="bg-white shadow-sm p-6 mx-4 mt-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">📊 Your Progress</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Stalls Visited</p>
              <p className="text-2xl font-bold text-blue-600">{student.scanCount}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Last Visit</p>
              <p className="text-lg font-semibold">
                {student.lastScanTime?.toDate().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* QR Scanner */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Scan QR Code</h2>
          <QRScanner onScanSuccess={handleScanSuccess} />
        </div>
      </div>
      {/* Logout */}
      {session && (
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
