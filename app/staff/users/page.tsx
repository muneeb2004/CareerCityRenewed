'use client';

import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CardSkeleton } from '@/lib/components/ui/Skeleton';
import { EmptyState } from '@/lib/components/ui/EmptyState';
import { Modal } from '@/lib/components/ui/Modal';
import { ConfirmationModal } from '@/lib/components/ui/ConfirmationModal';
import { Select } from '@/lib/components/ui/Select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PullToRefresh } from '@/lib/components/ui/PullToRefresh';

// Form validation schema
const userSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  role: z.enum(['admin', 'staff', 'volunteer']),
});

const editUserSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  role: z.enum(['admin', 'staff', 'volunteer']),
});

const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UserFormData = z.infer<typeof userSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'staff' | 'volunteer';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // Add user form
  const addForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      name: '',
      email: '',
      password: '',
      role: 'staff',
    }
  });

  // Edit user form
  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  });

  // Reset password form
  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const fetchUsers = useCallback(async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/admin/users');
      
      if (!res.ok) {
        if (res.status === 403) {
          showError('Admin access required');
          return;
        }
        throw new Error('Failed to fetch users');
      }
      
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
      showError('Failed to load users');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onAddSubmit = async (data: UserFormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username.toLowerCase().trim(),
          name: data.name.trim(),
          email: data.email || undefined,
          password: data.password,
          role: data.role,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        showSuccess('User created successfully!');
        addForm.reset();
        setShowAddForm(false);
        fetchUsers();
      } else {
        showError(result.error || 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const onEditSubmit = async (data: EditUserFormData) => {
    if (!editingUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email || undefined,
          role: data.role,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        showSuccess('User updated successfully!');
        editForm.reset();
        setShowEditForm(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        showError(result.error || 'Failed to update user');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordFormData) => {
    if (!editingUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: data.newPassword }),
      });

      const result = await res.json();

      if (res.ok) {
        showSuccess(`Password reset for ${editingUser.username}`);
        resetForm.reset();
        setShowResetPassword(false);
        setEditingUser(null);
      } else {
        showError(result.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    editForm.setValue('name', user.name);
    editForm.setValue('email', user.email || '');
    editForm.setValue('role', user.role);
    setShowEditForm(true);
  };

  const handleResetPassword = (user: User) => {
    setEditingUser(user);
    resetForm.reset();
    setShowResetPassword(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (res.ok) {
        showSuccess(`User ${user.isActive ? 'deactivated' : 'activated'}`);
        fetchUsers();
      } else {
        const result = await res.json();
        showError(result.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to update status');
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showSuccess('User deleted');
        fetchUsers();
      } else {
        const result = await res.json();
        showError(result.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to delete user');
    } finally {
      setShowDeleteModal(false);
      setDeleteUser(null);
    }
  };

  // Filter users by search
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700';
      case 'staff': return 'bg-blue-100 text-blue-700';
      case 'volunteer': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <PullToRefresh onRefresh={fetchUsers}>
      <div className="space-y-6">
        <Toaster position="top-center" />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              User Management
            </h1>
            <p className="text-gray-500 mt-1">Manage staff and admin accounts</p>
          </div>
          <button
            onClick={() => {
              addForm.reset();
              setShowAddForm(true);
            }}
            className="btn-primary flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Total</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Admins</p>
                <p className="text-2xl font-bold text-red-600">{users.filter(u => u.role === 'admin').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Staff</p>
                <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'staff').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Active</p>
                <p className="text-2xl font-bold text-green-600">{users.filter(u => u.isActive).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, username, or email..."
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Users List */}
        {fetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title={searchQuery ? "No users match your search" : "No users yet"}
            description={searchQuery ? "Try a different search term" : "Create your first user to get started"}
            action={!searchQuery ? (
              <button onClick={() => setShowAddForm(true)} className="btn-primary">
                Add User
              </button>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`bg-white rounded-xl border shadow-sm transition-all hover:shadow-md group ${
                  user.isActive ? 'border-gray-200' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        user.role === 'admin' 
                          ? 'bg-linear-to-br from-red-400 to-red-600' 
                          : user.role === 'staff' 
                            ? 'bg-linear-to-br from-blue-400 to-blue-600'
                            : 'bg-linear-to-br from-green-400 to-green-600'
                      } ${!user.isActive ? 'opacity-60' : ''}`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${user.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                          {user.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">@{user.username}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </div>

                  {user.email && (
                    <p className="text-sm text-gray-500 mb-2 truncate">
                      {user.email}
                    </p>
                  )}

                  <div className="text-xs text-gray-400">
                    {user.lastLogin 
                      ? `Last login: ${new Date(user.lastLogin).toLocaleDateString()}`
                      : 'Never logged in'
                    }
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    <span className={`text-sm ${user.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit user"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleResetPassword(user)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                      title="Reset password"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`p-1.5 rounded-lg ${
                        user.isActive 
                          ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {user.isActive ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add User Modal */}
        <Modal
          isOpen={showAddForm}
          onClose={() => {
            setShowAddForm(false);
            addForm.reset();
          }}
          title="Add New User"
        >
          <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                {...addForm.register('username')}
                type="text"
                placeholder="johndoe"
                className="input-modern w-full"
              />
              {addForm.formState.errors.username && (
                <p className="text-red-500 text-sm mt-1">{addForm.formState.errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                {...addForm.register('name')}
                type="text"
                placeholder="John Doe"
                className="input-modern w-full"
              />
              {addForm.formState.errors.name && (
                <p className="text-red-500 text-sm mt-1">{addForm.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <Select
                options={[
                  { value: 'volunteer', label: 'Volunteer' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'admin', label: 'Admin' },
                ]}
                value={addForm.watch('role')}
                onChange={(value) => addForm.setValue('role', value as 'admin' | 'staff' | 'volunteer')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400">(optional)</span>
              </label>
              <input
                {...addForm.register('email')}
                type="email"
                placeholder="john@example.com"
                className="input-modern w-full"
              />
              {addForm.formState.errors.email && (
                <p className="text-red-500 text-sm mt-1">{addForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                {...addForm.register('password')}
                type="password"
                placeholder="••••••••"
                className="input-modern w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                Min 8 chars, uppercase, lowercase, and number
              </p>
              {addForm.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{addForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  addForm.reset();
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Edit User Modal */}
        <Modal
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setEditingUser(null);
            editForm.reset();
          }}
          title="Edit User"
        >
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                value={editingUser?.username || ''}
                disabled
                className="input-modern w-full bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                {...editForm.register('name')}
                type="text"
                className="input-modern w-full"
              />
              {editForm.formState.errors.name && (
                <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <Select
                options={[
                  { value: 'volunteer', label: 'Volunteer' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'admin', label: 'Admin' },
                ]}
                value={editForm.watch('role')}
                onChange={(value) => editForm.setValue('role', value as 'admin' | 'staff' | 'volunteer')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400">(optional)</span>
              </label>
              <input
                {...editForm.register('email')}
                type="email"
                className="input-modern w-full"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingUser(null);
                  editForm.reset();
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Reset Password Modal */}
        <Modal
          isOpen={showResetPassword}
          onClose={() => {
            setShowResetPassword(false);
            setEditingUser(null);
            resetForm.reset();
          }}
          title={`Reset Password for ${editingUser?.username}`}
        >
          <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                {...resetForm.register('newPassword')}
                type="password"
                placeholder="••••••••"
                className="input-modern w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                Min 8 chars, uppercase, lowercase, and number
              </p>
              {resetForm.formState.errors.newPassword && (
                <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                {...resetForm.register('confirmPassword')}
                type="password"
                placeholder="••••••••"
                className="input-modern w-full"
              />
              {resetForm.formState.errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowResetPassword(false);
                  setEditingUser(null);
                  resetForm.reset();
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteUser(null);
          }}
          onConfirm={confirmDelete}
          title="Delete User"
          message={`Are you sure you want to delete "${deleteUser?.name}"? This action will deactivate the account.`}
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </PullToRefresh>
  );
}
