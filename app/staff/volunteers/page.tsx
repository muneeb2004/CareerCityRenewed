'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllVolunteersWithStats, createVolunteer, toggleVolunteerStatus, VolunteerStats } from '@/actions/volunteers';
import { Toaster } from 'react-hot-toast';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CardSkeleton } from '@/lib/components/ui/Skeleton';
import { EmptyState } from '@/lib/components/ui/EmptyState';
import { Modal } from '@/lib/components/ui/Modal';
import { ConfirmationModal } from '@/lib/components/ui/ConfirmationModal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PullToRefresh } from '@/lib/components/ui/PullToRefresh';

const volunteerSchema = z.object({
  volunteerId: z.string().min(1, 'Volunteer ID is required').regex(/^[a-zA-Z0-9_-]+$/, 'ID can only contain letters, numbers, hyphens, and underscores'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['Captain', 'Member']),
});

type VolunteerFormData = z.infer<typeof volunteerSchema>;

interface VolunteerWithStats {
  volunteerId: string;
  name: string;
  role: 'Captain' | 'Member';
  isActive: boolean;
  stats: VolunteerStats;
}

export default function VolunteerManagement() {
  const [volunteers, setVolunteers] = useState<VolunteerWithStats[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toggle Confirmation State
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [toggleId, setToggleId] = useState<string | null>(null);
  const [toggleName, setToggleName] = useState<string>('');
  const [toggleCurrentStatus, setToggleCurrentStatus] = useState<boolean>(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VolunteerFormData>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: {
      volunteerId: '',
      name: '',
      email: '',
      phone: '',
      role: 'Member',
    }
  });

  const fetchVolunteers = useCallback(async () => {
    try {
      setFetching(true);
      const data = await getAllVolunteersWithStats();
      setVolunteers(data);
    } catch (error) {
      console.error(error);
      showError("Failed to load volunteers");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  const onSubmit = async (data: VolunteerFormData) => {
    setLoading(true);
    try {
      const result = await createVolunteer({
        volunteerId: data.volunteerId.toLowerCase().trim(),
        name: data.name.trim(),
        email: data.email || undefined,
        phone: data.phone || undefined,
        role: data.role,
      });

      if (result.success) {
        showSuccess('Volunteer added successfully!');
        reset();
        setShowAddForm(false);
        fetchVolunteers();
      } else {
        showError(result.error || 'Failed to add volunteer');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to add volunteer');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = useCallback((volunteer: VolunteerWithStats) => {
    setToggleId(volunteer.volunteerId);
    setToggleName(volunteer.name);
    setToggleCurrentStatus(volunteer.isActive);
    setShowToggleModal(true);
  }, []);

  const confirmToggle = async () => {
    if (!toggleId) return;
    try {
      const result = await toggleVolunteerStatus(toggleId);
      if (result.success) {
        showSuccess(`Volunteer ${result.isActive ? 'activated' : 'deactivated'}`);
        fetchVolunteers();
      } else {
        showError(result.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to update status');
    } finally {
      setShowToggleModal(false);
      setToggleId(null);
    }
  };

  // Filter volunteers based on search
  const filteredVolunteers = volunteers.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.volunteerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: Active first, then by name
  const sortedVolunteers = [...filteredVolunteers].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <PullToRefresh onRefresh={fetchVolunteers}>
      <div className="space-y-6">
        <Toaster position="top-center" />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Volunteer Management
            </h1>
            <p className="text-gray-500 mt-1">Assign and manage volunteer IDs</p>
          </div>
          <button
            onClick={() => {
              reset();
              setShowAddForm(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Volunteer
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Volunteers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{volunteers.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{volunteers.filter(v => v.isActive).length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Students</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {volunteers.reduce((sum, v) => sum + v.stats.totalStudentFeedback, 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Orgs</p>
            <p className="text-2xl font-bold text-violet-600 mt-1">
              {volunteers.reduce((sum, v) => sum + v.stats.totalOrgFeedback, 0)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search volunteers by name or ID..."
            className="input-modern w-full pl-10"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Volunteers List */}
        {fetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : sortedVolunteers.length === 0 ? (
          <EmptyState
            title={searchQuery ? "No volunteers found" : "No volunteers yet"}
            description={searchQuery ? "Try a different search term" : "Add your first volunteer to get started"}
            action={!searchQuery ? (
              <button onClick={() => setShowAddForm(true)} className="btn-primary">
                Add Volunteer
              </button>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedVolunteers.map((volunteer) => (
              <div
                key={volunteer.volunteerId}
                className={`bg-white rounded-xl border shadow-sm p-5 transition-all duration-200 hover:shadow-md ${
                  volunteer.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      volunteer.role === 'Captain' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}>
                      {volunteer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{volunteer.name}</h3>
                      <p className="text-sm text-gray-500 font-mono">{volunteer.volunteerId}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    volunteer.role === 'Captain' 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {volunteer.role}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                    </svg>
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-900">{volunteer.stats.totalStudentFeedback}</span> students
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-900">{volunteer.stats.totalOrgFeedback}</span> orgs
                    </span>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${volunteer.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    <span className="text-sm text-gray-600">{volunteer.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(volunteer)}
                    className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                      volunteer.isActive 
                        ? 'text-red-600 hover:bg-red-50' 
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {volunteer.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Volunteer Modal */}
        <Modal
          isOpen={showAddForm}
          onClose={() => {
            setShowAddForm(false);
            reset();
          }}
          title="Add New Volunteer"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volunteer ID <span className="text-red-500">*</span>
              </label>
              <input
                {...register('volunteerId')}
                type="text"
                placeholder="e.g., vol001"
                className="input-modern w-full"
              />
              {errors.volunteerId && (
                <p className="text-red-500 text-sm mt-1">{errors.volunteerId.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                This ID will be used by volunteers to log in
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                type="text"
                placeholder="Full name"
                className="input-modern w-full"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select {...register('role')} className="input-modern w-full">
                <option value="Member">Member</option>
                <option value="Captain">Captain</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400">(optional)</span>
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="volunteer@example.com"
                className="input-modern w-full"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-gray-400">(optional)</span>
              </label>
              <input
                {...register('phone')}
                type="tel"
                placeholder="Phone number"
                className="input-modern w-full"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  reset();
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
                {loading ? 'Adding...' : 'Add Volunteer'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Toggle Status Confirmation Modal */}
        <ConfirmationModal
          isOpen={showToggleModal}
          onClose={() => {
            setShowToggleModal(false);
            setToggleId(null);
          }}
          onConfirm={confirmToggle}
          title={toggleCurrentStatus ? 'Deactivate Volunteer' : 'Activate Volunteer'}
          message={
            toggleCurrentStatus
              ? `Are you sure you want to deactivate "${toggleName}"? They will not be able to log in until reactivated.`
              : `Are you sure you want to activate "${toggleName}"? They will be able to log in and collect feedback.`
          }
          confirmText={toggleCurrentStatus ? 'Deactivate' : 'Activate'}
          variant={toggleCurrentStatus ? 'danger' : 'info'}
        />
      </div>
    </PullToRefresh>
  );
}
