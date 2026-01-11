'use client';

import { useAuth } from '@/context/AuthContext';
import ChangePassword from '@/components/ChangePassword';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-xl"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          My Profile
        </h1>
        <p className="text-gray-500 mt-1">Manage your account settings</p>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-linear-to-r from-blue-50 to-white">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg ${
               user?.role === 'admin' 
                 ? 'bg-linear-to-br from-red-400 to-red-600' 
                 : user?.role === 'staff' 
                   ? 'bg-linear-to-br from-blue-400 to-blue-600'
                   : 'bg-linear-to-br from-green-400 to-green-600'
            }`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
              <p className="text-gray-500 font-mono">@{user?.username}</p>
              <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 uppercase tracking-wide">
                  {user?.role}
                </span>
                {user?.email && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                    {user?.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Component */}
      <ChangePassword />
    </div>
  );
}
