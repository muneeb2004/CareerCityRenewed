'use client';

import Link from 'next/link';

export default function VolunteerPortal() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="glassmorphic p-8 mb-8">
          <h1 className="text-4xl font-bold text-center text-white mb-4">
            Volunteer Portal
          </h1>
          <p className="text-lg text-center text-gray-200">
            Welcome, Volunteer! Thank you for your service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/volunteer/time-log"
            className="block glassmorphic p-6 hover:bg-white/30 transition-colors"
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              Time Log
            </h3>
            <p className="text-gray-200">
              Check-in and check-out for your shift.
            </p>
          </Link>

          <Link
            href="/volunteer/cv-check"
            className="block glassmorphic p-6 hover:bg-white/30 transition-colors"
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              CV Check
            </h3>
            <p className="text-gray-200">
              Mark students whose CVs you have checked.
            </p>
          </Link>

          <Link
            href="/volunteer/data-entry"
            className="block glassmorphic p-6 hover:bg-white/30 transition-colors"
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              Detailed Data Entry
            </h3>
            <p className="text-gray-200">
              Log detailed interactions with students.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
