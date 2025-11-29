'use client';

import Link from 'next/link';

export default function VolunteerPortal() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
          <h1 className="text-4xl font-bold text-center text-secondary mb-4">
            Volunteer Portal
          </h1>
          <p className="text-lg text-center text-gray-600">
            Welcome, Volunteer! Thank you for your service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/volunteer/student-feedback"
            className="block bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-secondary mb-2">
              Student Feedback Form
            </h3>
            <p className="text-gray-600">
              Submit feedback for a student.
            </p>
          </a>

          <a
            href="/volunteer/organization-feedback"
            className="block bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-secondary mb-2">
              Organization Feedback Form
            </h3>
            <p className="text-gray-600">
              Submit feedback for an organization on behalf of an employer.
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
