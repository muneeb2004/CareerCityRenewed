'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'react-hot-toast';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        toast.success('Login successful');
        router.push('/staff');
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Login failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background Image & Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-fixed" 
        style={{ backgroundImage: 'url("/HUCareerCityPhoto.jpg")' }}
      />
      <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-sm" />

      {/* Login Card */}
      <div className="card-modern max-w-md w-full relative z-10 bg-white/95 backdrop-blur-xl shadow-2xl border-white/20">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
             <Image
                src="/favicon-optimized.png"
                alt="Career City"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
          </div>
          <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-700 to-violet-700">
            Staff Portal
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            Authorized Personnel Only
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="label-modern">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="input-modern"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="label-modern">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input-modern"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary flex justify-center items-center py-3 text-base shadow-blue-600/20"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
                &copy; 2026 Habib University Career City
            </p>
        </div>
      </div>
    </div>
  );
}