'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function VolunteerPortal() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="card-modern text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/favicon-optimized.png"
              alt="Career City Logo"
              width={64}
              height={64}
              className="rounded-xl shadow-lg"
            />
          </div>
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-accent to-accent-yellow mb-2">
            Volunteer Portal
          </h1>
          <p className="text-lg text-gray-600">
            Welcome! Thank you for helping us make Career City a success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/volunteer/student-feedback"
            className="card-modern glass-hover group block text-left relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
             </div>
             <div className="relative z-10">
                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-2 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Student Feedback
                </h3>
                <p className="text-gray-600">
                Submit feedback for a student interaction. Help us track engagement and student performance.
                </p>
            </div>
          </Link>

          <Link
            href="/volunteer/organization-feedback"
            className="card-modern glass-hover group block text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-24 h-24 text-violet-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd"></path></svg>
            </div>
            <div className="relative z-10">
                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-violet-600 transition-colors mb-2 flex items-center gap-2">
                    <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Org Feedback
                </h3>
                <p className="text-gray-600">
                Collect and submit feedback from organizations. Ensure their experience is being recorded.
                </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
