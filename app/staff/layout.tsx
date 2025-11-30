import Link from 'next/link';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900/95 backdrop-blur-xl border-r border-white/10 text-white p-6 fixed h-full z-10 shadow-2xl">
        <div className="mb-10">
             <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
                Staff Portal
            </h2>
            <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider">Administration</p>
        </div>
       
        <nav className="space-y-2">
            <Link 
                href="/staff/organizations" 
                className="block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group"
            >
                <span className="group-hover:text-blue-300 transition-colors">Organizations</span>
            </Link>
            
            <Link 
                href="/staff/organization-feedback-questions" 
                className="block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group"
            >
                <span className="group-hover:text-blue-300 transition-colors">Org Feedback Questions</span>
            </Link>
            
            <Link 
                href="/staff/student-questions" 
                className="block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group"
            >
                <span className="group-hover:text-blue-300 transition-colors">Student Questions</span>
            </Link>
            
            <Link 
                href="/staff/analytics" 
                className="block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group"
            >
                 <span className="group-hover:text-blue-300 transition-colors">Analytics</span>
            </Link>
        </nav>
      </aside>
      <main className="flex-1 p-4 sm:p-8 ml-64">{children}</main>
    </div>
  );
}
