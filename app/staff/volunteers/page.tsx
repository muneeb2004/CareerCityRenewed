'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllVolunteersWithStats, createVolunteer, toggleVolunteerStatus, updateVolunteer, VolunteerStats } from '@/actions/volunteers';
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
  email?: string;
  phone?: string;
  role: 'Captain' | 'Member';
  isActive: boolean;
  stats: VolunteerStats;
  createdAt?: string;
}

type SortOption = 'name' | 'role' | 'feedback' | 'status';
type FilterOption = 'all' | 'active' | 'inactive' | 'captain' | 'member';

export default function VolunteerManagement() {
  const [volunteers, setVolunteers] = useState<VolunteerWithStats[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerWithStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Toggle Confirmation State
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [toggleId, setToggleId] = useState<string | null>(null);
  const [toggleName, setToggleName] = useState<string>('');
  const [toggleCurrentStatus, setToggleCurrentStatus] = useState<boolean>(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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

  const onEditSubmit = async (data: VolunteerFormData) => {
    if (!editingVolunteer) return;
    setLoading(true);
    try {
      const result = await updateVolunteer(editingVolunteer.volunteerId, {
        name: data.name.trim(),
        email: data.email || undefined,
        phone: data.phone || undefined,
        role: data.role,
      });

      if (result.success) {
        showSuccess('Volunteer updated successfully!');
        reset();
        setShowEditForm(false);
        setEditingVolunteer(null);
        fetchVolunteers();
      } else {
        showError(result.error || 'Failed to update volunteer');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to update volunteer');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = useCallback((volunteer: VolunteerWithStats) => {
    setEditingVolunteer(volunteer);
    setValue('volunteerId', volunteer.volunteerId);
    setValue('name', volunteer.name);
    setValue('email', volunteer.email || '');
    setValue('phone', volunteer.phone || '');
    setValue('role', volunteer.role);
    setShowEditForm(true);
  }, [setValue]);

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

  // Filter and sort volunteers
  const processedVolunteers = useMemo(() => {
    let result = [...volunteers];
    
    // Apply search filter
    if (searchQuery) {
      result = result.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.volunteerId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    switch (filterBy) {
      case 'active':
        result = result.filter(v => v.isActive);
        break;
      case 'inactive':
        result = result.filter(v => !v.isActive);
        break;
      case 'captain':
        result = result.filter(v => v.role === 'Captain');
        break;
      case 'member':
        result = result.filter(v => v.role === 'Member');
        break;
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'role':
          if (a.role !== b.role) return a.role === 'Captain' ? -1 : 1;
          return a.name.localeCompare(b.name);
        case 'feedback':
          const aTotal = a.stats.totalStudentFeedback + a.stats.totalOrgFeedback;
          const bTotal = b.stats.totalStudentFeedback + b.stats.totalOrgFeedback;
          return bTotal - aTotal;
        case 'status':
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.name.localeCompare(b.name);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });
    
    return result;
  }, [volunteers, searchQuery, filterBy, sortBy]);

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
            <p className="text-gray-500 mt-1">Manage volunteer accounts and track their performance</p>
          </div>
          <button
            onClick={() => {
              reset();
              setShowAddForm(true);
            }}
            className="btn-primary flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Volunteer
          </button>
        </div>

        {/* Stats Overview - Improved Labels */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Team</p>
                <p className="text-2xl font-bold text-gray-900">{volunteers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Now</p>
                <p className="text-2xl font-bold text-green-600">{volunteers.filter(v => v.isActive).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Student Feedback</p>
                <p className="text-2xl font-bold text-blue-600">
                  {volunteers.reduce((sum, v) => sum + v.stats.totalStudentFeedback, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <svg className="w-5 h-5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Org Feedback</p>
                <p className="text-2xl font-bold text-violet-600">
                  {volunteers.reduce((sum, v) => sum + v.stats.totalOrgFeedback, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters - Improved Layout */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or volunteer ID..."
                className="input-modern w-full pl-10"
              />
            </div>
            
            {/* Filter & Sort Controls */}
            <div className="flex gap-2 flex-wrap">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-modern text-sm min-w-[140px]"
              >
                <option value="name">Sort: Name</option>
                <option value="role">Sort: Role</option>
                <option value="feedback">Sort: Feedback</option>
                <option value="status">Sort: Status</option>
              </select>
              
              {/* Filter Dropdown */}
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="input-modern text-sm min-w-[140px]"
              >
                <option value="all">Filter: All</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="captain">Captains</option>
                <option value="member">Members</option>
              </select>
            </div>
          </div>
          
          {/* Active Filter Tags */}
          {(filterBy !== 'all' || searchQuery) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Active filters:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filterBy !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  {filterBy.charAt(0).toUpperCase() + filterBy.slice(1)}
                  <button onClick={() => setFilterBy('all')} className="hover:text-purple-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              <button 
                onClick={() => { setSearchQuery(''); setFilterBy('all'); }}
                className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {processedVolunteers.length} of {volunteers.length} volunteers
          </p>
        </div>

        {/* Volunteers List */}
        {fetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : processedVolunteers.length === 0 ? (
          <EmptyState
            title={searchQuery || filterBy !== 'all' ? "No volunteers match your criteria" : "No volunteers yet"}
            description={searchQuery || filterBy !== 'all' ? "Try adjusting your search or filters" : "Add your first volunteer to get started"}
            action={!searchQuery && filterBy === 'all' ? (
              <button onClick={() => setShowAddForm(true)} className="btn-primary">
                Add Volunteer
              </button>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {processedVolunteers.map((volunteer) => (
              <div
                key={volunteer.volunteerId}
                className={`bg-white rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md group ${
                  volunteer.isActive ? 'border-gray-200' : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        volunteer.role === 'Captain' ? 'bg-linear-to-br from-amber-400 to-amber-600' : 'bg-linear-to-br from-blue-400 to-blue-600'
                      } ${!volunteer.isActive ? 'opacity-60' : ''}`}>
                        {volunteer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${volunteer.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                          {volunteer.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">{volunteer.volunteerId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        volunteer.role === 'Captain' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {volunteer.role}
                      </span>
                      {/* Edit Button */}
                      <button
                        onClick={() => handleEdit(volunteer)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                        title="Edit volunteer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                        </svg>
                        <span className="text-xs text-blue-600 font-medium">Students</span>
                      </div>
                      <p className="text-lg font-bold text-blue-700 mt-0.5">{volunteer.stats.totalStudentFeedback}</p>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-violet-600 font-medium">Organizations</span>
                      </div>
                      <p className="text-lg font-bold text-violet-700 mt-0.5">{volunteer.stats.totalOrgFeedback}</p>
                    </div>
                  </div>
                  
                  {/* Total Feedback Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Total feedback collected</span>
                      <span className="font-medium text-gray-700">{volunteer.stats.totalStudentFeedback + volunteer.stats.totalOrgFeedback}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-linear-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, ((volunteer.stats.totalStudentFeedback + volunteer.stats.totalOrgFeedback) / Math.max(...volunteers.map(v => v.stats.totalStudentFeedback + v.stats.totalOrgFeedback), 1)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer - Status Toggle */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${volunteer.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className={`text-sm font-medium ${volunteer.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                      {volunteer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(volunteer)}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                      volunteer.isActive 
                        ? 'text-red-600 hover:bg-red-100 hover:text-red-700' 
                        : 'text-green-600 hover:bg-green-100 hover:text-green-700'
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

        {/* Edit Volunteer Modal */}
        <Modal
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setEditingVolunteer(null);
            reset();
          }}
          title="Edit Volunteer"
        >
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volunteer ID
              </label>
              <input
                value={editingVolunteer?.volunteerId || ''}
                type="text"
                disabled
                className="input-modern w-full bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Volunteer ID cannot be changed
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
                  setShowEditForm(false);
                  setEditingVolunteer(null);
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
                {loading ? 'Saving...' : 'Save Changes'}
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
