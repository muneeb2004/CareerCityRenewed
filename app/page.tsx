import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card-modern max-w-xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/favicon-optimized.png"
              alt="Career City Logo"
              width={80}
              height={80}
              className="rounded-xl shadow-lg"
            />
          </div>
          <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-violet-600 pb-2">
            HU Career City
            <span className="block text-3xl font-bold text-gray-700 mt-2">2026</span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Welcome to the official portal for the Habib University Career City
            2026 event. Your gateway to professional connections.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 pt-4">
          <Link
            href="/student"
            className="btn-primary flex items-center justify-center gap-2 group"
          >
            <span>Student Portal</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <Link
            href="/staff"
            className="btn-secondary flex items-center justify-center gap-2 group"
          >
             <span>Staff Portal</span>
             <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </Link>
          <Link
            href="/volunteer"
            className="btn-accent flex items-center justify-center gap-2 group"
          >
             <span>Volunteer Portal</span>
             <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
