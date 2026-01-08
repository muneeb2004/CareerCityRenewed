'use client';

import { useState, useCallback } from 'react';
import { useVolunteerStore } from '@/lib/store/volunteerStore';
import { validateVolunteer } from '@/actions/volunteers';
import { haptics } from '@/lib/haptics';

interface VolunteerLoginProps {
  onLoginSuccess?: () => void;
}

export default function VolunteerLogin({ onLoginSuccess }: VolunteerLoginProps) {
  const [volunteerId, setVolunteerId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const login = useVolunteerStore((state) => state.login);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const trimmedId = volunteerId.trim().toLowerCase();
    if (!trimmedId) {
      setError('Please enter your Volunteer ID');
      haptics.error();
      return;
    }

    setIsLoading(true);
    haptics.impact();

    try {
      const result = await validateVolunteer(trimmedId);
      
      if (result.success && result.volunteer) {
        login({
          volunteerId: result.volunteer.volunteerId,
          volunteerName: result.volunteer.name,
          role: result.volunteer.role,
        });
        haptics.success();
        onLoginSuccess?.();
      } else {
        setError(result.error || 'Invalid Volunteer ID. Please try again.');
        haptics.error();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
      haptics.error();
    } finally {
      setIsLoading(false);
    }
  }, [volunteerId, login, onLoginSuccess]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-violet-600 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Volunteer Login</h2>
          <p className="text-blue-100">Enter your ID to start collecting feedback</p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="volunteerId" className="block text-sm font-semibold text-gray-700 mb-2">
              Volunteer ID
            </label>
            <input
              type="text"
              id="volunteerId"
              value={volunteerId}
              onChange={(e) => {
                setVolunteerId(e.target.value);
                setError(null);
              }}
              placeholder="e.g., vol001"
              className={`w-full px-4 py-3 border-2 rounded-xl text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                error 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500'
              }`}
              autoFocus
              autoComplete="off"
              disabled={isLoading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-6 bg-linear-to-r from-blue-600 to-violet-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Start Session
              </>
            )}
          </button>
          
          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an ID? Contact your team captain.
          </p>
        </form>
      </div>
    </div>
  );
}
