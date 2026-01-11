'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import api from '@/services/api';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePassword() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch('newPassword') || '';

  const requirements = [
    { regex: /.{8,}/, label: 'At least 8 characters' },
    { regex: /[A-Z]/, label: 'One uppercase letter' },
    { regex: /[a-z]/, label: 'One lowercase letter' },
    { regex: /\d/, label: 'One number' },
  ];

  const onSubmit = async (data: ChangePasswordFormData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if (response.data.success) {
        toast.success('Password changed successfully');
        reset();
      } else {
        toast.error(response.data.error || 'Failed to change password');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
        <p className="text-sm text-gray-500">Update your account password</p>
      </div>
      
      <div className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
          <div>
            <label className="label-modern">
              Current Password
            </label>
            <input
              type="password"
              {...register('currentPassword')}
              className="input-modern w-full"
            />
            {errors.currentPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="label-modern">
              New Password
            </label>
            <input
              type="password"
              {...register('newPassword')}
              className="input-modern w-full"
            />
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.newPassword.message}</p>
            )}
            
            {/* Password Strength Indicators */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {requirements.map((req, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    req.regex.test(newPassword) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-xs ${
                    req.regex.test(newPassword) ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label-modern">
              Confirm New Password
            </label>
            <input
              type="password"
              {...register('confirmNewPassword')}
              className="input-modern w-full"
            />
            {errors.confirmNewPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmNewPassword.message}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full sm:w-auto"
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
