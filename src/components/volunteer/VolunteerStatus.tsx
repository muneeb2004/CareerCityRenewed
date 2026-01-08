'use client';

import { useEffect, useCallback } from 'react';
import { useVolunteerStore, useVolunteerSession, useIsVolunteerLoggedIn, useVolunteerStats } from '@/lib/store/volunteerStore';
import { getVolunteerStats } from '@/actions/volunteers';
import { haptics } from '@/lib/haptics';

interface VolunteerStatusProps {
  showStats?: boolean;
  compact?: boolean;
}

export default function VolunteerStatus({ showStats = true, compact = false }: VolunteerStatusProps) {
  const session = useVolunteerSession();
  const isLoggedIn = useIsVolunteerLoggedIn();
  const stats = useVolunteerStats();
  const logout = useVolunteerStore((state) => state.logout);
  const setStats = useVolunteerStore((state) => state.setStats);
  const statsLastFetched = useVolunteerStore((state) => state.statsLastFetched);

  // Fetch stats on mount and when session changes
  const fetchStats = useCallback(async () => {
    if (!session?.volunteerId) return;
    
    // Cache for 30 seconds
    if (statsLastFetched && Date.now() - statsLastFetched < 30000 && stats) {
      return;
    }

    try {
      const newStats = await getVolunteerStats(session.volunteerId);
      setStats(newStats);
    } catch (error) {
      console.error('Failed to fetch volunteer stats:', error);
    }
  }, [session?.volunteerId, statsLastFetched, stats, setStats]);

  useEffect(() => {
    if (isLoggedIn && showStats) {
      fetchStats();
    }
  }, [isLoggedIn, showStats, fetchStats]);

  const handleLogout = useCallback(() => {
    haptics.impact();
    logout();
  }, [logout]);

  const handleRefreshStats = useCallback(() => {
    haptics.tap();
    useVolunteerStore.getState().clearStats();
    fetchStats();
  }, [fetchStats]);

  if (!isLoggedIn || !session) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {session.volunteerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">{session.volunteerName}</span>
        </div>
        {showStats && stats && (
          <div className="flex items-center gap-2 text-xs text-gray-500 border-l border-gray-200 pl-3">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
              {stats.totalStudentFeedback}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4z" clipRule="evenodd" />
              </svg>
              {stats.totalOrgFeedback}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Logout"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="bg-linear-to-r from-blue-600 to-violet-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white text-lg font-bold">
                {session.volunteerName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-white font-semibold">{session.volunteerName}</h3>
              <p className="text-blue-100 text-sm flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                {session.role} • {session.volunteerId}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
      
      {showStats && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Your Stats</h4>
            <button
              onClick={handleRefreshStats}
              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
              title="Refresh stats"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {stats?.totalStudentFeedback ?? '-'}
              </div>
              <div className="text-xs text-blue-600 font-medium">Students</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-5 h-5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-violet-700">
                {stats?.totalOrgFeedback ?? '-'}
              </div>
              <div className="text-xs text-violet-600 font-medium">Organizations</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
