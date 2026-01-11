'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'react-hot-toast';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  
  // Setup form fields
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const router = useRouter();

  // Check if setup is required (no users in database)
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch('/api/auth/setup');
        const data = await res.json();
        setShowSetup(data.setupRequired);
      } catch (error) {
        console.error('Failed to check setup status:', error);
      } finally {
        setCheckingSetup(false);
      }
    };
    
    checkSetup();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Login successful');
        window.location.href = '/staff';
      } else {
        toast.error(data.message || 'Login failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    // Validate password strength
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error('Password must contain at least one lowercase letter');
      return;
    }
    if (!/\d/.test(password)) {
      toast.error('Password must contain at least one number');
      return;
    }
    
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          name: setupName,
          email: setupEmail || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Admin account created! Please log in.');
        setShowSetup(false);
        setPassword('');
        setConfirmPassword('');
        setSetupName('');
        setSetupEmail('');
      } else {
        toast.error(data.error || 'Setup failed');
      }
    } catch (error) {
      toast.error('An error occurred during setup');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-cover bg-center bg-fixed" 
          style={{ backgroundImage: 'url("/HUCareerCityPhoto.jpg")' }}
        />
        <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-sm" />
        <div className="relative z-10">
          <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background Image & Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-fixed" 
        style={{ backgroundImage: 'url("/HUCareerCityPhoto.jpg")' }}
      />
      <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-sm" />

      {/* Login/Setup Card */}
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
            {showSetup ? 'Initial Setup' : 'Staff Portal'}
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            {showSetup 
              ? 'Create your first admin account' 
              : 'Authorized Personnel Only'
            }
          </p>
        </div>

        {showSetup ? (
          // Setup Form
          <form className="space-y-4" onSubmit={handleSetup}>
            <div>
              <label htmlFor="username" className="label-modern">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="input-modern"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="name" className="label-modern">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="input-modern"
                placeholder="Admin User"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="email" className="label-modern">
                Email <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input-modern"
                placeholder="admin@example.com"
                value={setupEmail}
                onChange={(e) => setSetupEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="label-modern">
                Password <span className="text-red-500">*</span>
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
              <p className="mt-1 text-xs text-gray-500">
                Min 8 chars, uppercase, lowercase, and number
              </p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="label-modern">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="input-modern"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary flex justify-center items-center py-3 text-base shadow-blue-600/20 mt-6"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Admin Account'
              )}
            </button>
          </form>
        ) : (
          // Login Form
          <form className="space-y-6" onSubmit={handleLogin}>
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
        )}
        
        <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
                &copy; 2026 Habib University Career City
            </p>
        </div>
      </div>
    </div>
  );
}