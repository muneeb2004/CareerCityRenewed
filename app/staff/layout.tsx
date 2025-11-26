import Link from 'next/link';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h2 className="text-2xl font-bold mb-6">Staff Portal</h2>
        <nav>
          <ul>
            <li className="mb-2">
              <Link href="/staff/organizations" className="hover:text-gray-300">
                Organizations
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/staff/feedback-questions" className="hover:text-gray-300">
                Organization Feedback Questions
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/staff/volunteer-questions" className="hover:text-gray-300">
                Volunteer Questions
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/staff/analytics" className="hover:text-gray-300">
                Analytics
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-6 bg-gray-100">{children}</main>
    </div>
  );
}
