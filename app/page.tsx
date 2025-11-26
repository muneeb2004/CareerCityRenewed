import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="glassmorphic p-10 max-w-xl w-full text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">
          🎓 HU Career City 2026
        </h1>
        <p className="text-lg text-gray-800 mb-8">
          Welcome to the official portal for the Habib University Career City
          2026 event. Please select your portal below to get started.
        </p>
        <div className="flex flex-col gap-4">
          <Link
            href="/student"
            className="w-full bg-pastel-blue text-blue-800 py-3 rounded-lg font-semibold hover:bg-blue-300 transition text-lg"
          >
            Student Portal
          </Link>
          <Link
            href="/staff/organizations"
            className="w-full bg-pastel-green text-green-800 py-3 rounded-lg font-semibold hover:bg-green-300 transition text-lg"
          >
            Staff Portal
          </Link>
          <Link
            href="/volunteer"
            className="w-full bg-pastel-purple text-purple-800 py-3 rounded-lg font-semibold hover:bg-purple-300 transition text-lg"
          >
            Volunteer Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
