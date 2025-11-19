
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-xl w-full text-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-700">🎓 HU Career City 2026</h1>
        <p className="text-lg text-gray-700 mb-8">
          Welcome to the official portal for the Habib University Career City 2026 event. Please select your portal below to get started.
        </p>
        <div className="flex flex-col gap-4">
          <a
            href="/student"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
          >
            Student Portal
          </a>
          <a
            href="/staff/employers"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition text-lg"
          >
            Staff: Employer Management
          </a>
        </div>
      </div>
    </div>
  );
}
