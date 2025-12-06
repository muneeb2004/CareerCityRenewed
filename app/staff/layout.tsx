'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import PageTransition from '@/lib/components/ui/PageTransition';
import Breadcrumbs from '@/lib/components/ui/Breadcrumbs';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/lib/components/ui/ErrorFallback';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 z-30 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/favicon-optimized.png"
            alt="Career City Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-bold text-gray-800">Staff Portal</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-gray-900/95 backdrop-blur-xl border-r border-white/10 text-white p-6 shadow-2xl 
          transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        aria-label="Sidebar Navigation"
      >
        <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <Image
                src="/favicon-optimized.png"
                alt="Career City Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
                Staff Portal
              </h2>
            </div>
            <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider">Administration</p>
        </div>
       
        <nav className="space-y-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-150px)]">
            <Link 
                href="/staff" 
                className={`block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group ${pathname === '/staff' ? 'bg-white/10 text-blue-300' : ''}`}
            >
                <span className="group-hover:text-blue-300 transition-colors">Dashboard</span>
            </Link>

            <Link 
                href="/staff/organizations" 
                className={`block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group ${pathname === '/staff/organizations' ? 'bg-white/10 text-blue-300' : ''}`}
            >
                <span className="group-hover:text-blue-300 transition-colors">Organizations</span>
            </Link>
            
            <Link 
                href="/staff/organization-feedback-questions" 
                className={`block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group ${pathname === '/staff/organization-feedback-questions' ? 'bg-white/10 text-blue-300' : ''}`}
            >
                <span className="group-hover:text-blue-300 transition-colors">Org Feedback Questions</span>
            </Link>
            
            <Link 
                href="/staff/student-questions" 
                className={`block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group ${pathname === '/staff/student-questions' ? 'bg-white/10 text-blue-300' : ''}`}
            >
                <span className="group-hover:text-blue-300 transition-colors">Student Questions</span>
            </Link>

            <Link 
                href="/staff/student-records" 
                className={`block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group ${pathname === '/staff/student-records' ? 'bg-white/10 text-blue-300' : ''}`}
            >
                <span className="group-hover:text-blue-300 transition-colors">Student Records</span>
            </Link>
            
            <Link 
                href="/staff/analytics" 
                className={`block px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:translate-x-1 flex items-center gap-3 group ${pathname === '/staff/analytics' ? 'bg-white/10 text-blue-300' : ''}`}
            >
                 <span className="group-hover:text-blue-300 transition-colors">Analytics</span>
            </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 transition-all duration-300 h-screen flex flex-col pt-20 md:pt-0">
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-8">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
              <Breadcrumbs />
              <PageTransition>
                  {children}
              </PageTransition>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
