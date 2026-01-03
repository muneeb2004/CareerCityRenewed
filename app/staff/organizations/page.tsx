'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '@/actions/organizations';
import QRCodeGenerator from '@/components/organization/QRCodeGenerator';
import { Organization } from '@/types';
import { Toaster } from 'react-hot-toast';
import { showSuccess, showError } from '@/lib/utils/toast';
import { CardSkeleton } from '@/lib/components/ui/Skeleton';
import { EmptyState } from '@/lib/components/ui/EmptyState';
import { Modal } from '@/lib/components/ui/Modal';
import { ConfirmationModal } from '@/lib/components/ui/ConfirmationModal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useOrganizationStore } from '@/lib/store/organizationStore';
import { PullToRefresh } from '@/lib/components/ui/PullToRefresh';

const organizationSchema = z.object({
  organizationId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  industry: z.string().optional(),
  boothNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  category: z.string().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export default function OrganizationManagement() {
  const { organizations, fetchOrganizations } = useOrganizationStore();
  const [fetching, setFetching] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkQR, setBulkQR] = useState(false);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [editingOrganization, setEditingOrganization] = useState<string | null>(null);
  
  // Delete Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
        organizationId: '',
        name: '',
        industry: '',
        boothNumber: '',
        contactPerson: '',
        email: '',
        category: '',
    }
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchOrganizations();
      } catch (error) {
        console.error(error);
        showError("Failed to load organizations");
      } finally {
        setFetching(false);
      }
    };
    loadData();
  }, [fetchOrganizations]);

  const onSubmit = async (data: OrganizationFormData) => {
    setLoading(true);
    try {
      if (editingOrganization) {
        await updateOrganization(editingOrganization, {
          name: data.name,
          industry: data.industry || '',
          boothNumber: data.boothNumber || '',
          contactPerson: data.contactPerson || '',
          email: data.email || '',
          category: data.category || '',
        });
        showSuccess('Organization updated!');
      } else {
        const organizationId =
          data.organizationId?.trim() ||
          `${data.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
        await createOrganization({
          organizationId,
          name: data.name,
          industry: data.industry || '',
          boothNumber: data.boothNumber || '',
          qrCode: organizationId,
          contactPerson: data.contactPerson || '',
          email: data.email || '',
          category: data.category || '',
        });
        showSuccess('Organization added!');
      }

      reset();
      setShowAddForm(false);
      setEditingOrganization(null);
      fetchOrganizations(true);
    } catch (err) {
      console.error(err);
      showError(editingOrganization ? 'Failed to update organization' : 'Failed to add organization');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingOrganization(org.organizationId);
    // Reset form with organization values
    reset({
        organizationId: org.organizationId,
        name: org.name,
        industry: org.industry || '',
        boothNumber: org.boothNumber || '',
        contactPerson: org.contactPerson || '',
        email: org.email || '',
        category: org.category || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteOrganization(deleteId);
      showSuccess('Organization deleted');
      fetchOrganizations(true);
    } catch (err) {
      console.error(err);
      showError('Failed to delete organization');
    }
  };

  const handleBulkQR = () => {
    setBulkQR(!bulkQR);
    setSelectedOrganizations([]);
  };

  const handleSelectOrganization = (id: string) => {
    setSelectedOrganizations((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="card-modern flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">
            Organization Management
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage participating companies and their details</p>
        </div>
        
        <div className="flex gap-3">
            <button
            className="btn-secondary text-sm py-2 px-4"
            onClick={handleBulkQR}
            >
            {bulkQR ? 'Hide Bulk QR' : 'Generate Bulk QR'}
            </button>
            <button
            className="btn-primary font-semibold py-2 px-4 rounded-lg transition-all duration-200"
            onClick={() => {
                setEditingOrganization(null);
                reset({
                    organizationId: '',
                    name: '',
                    industry: '',
                    boothNumber: '',
                    contactPerson: '',
                    email: '',
                    category: '',
                });
                setShowAddForm(true);
            }}
            >
            Add Organization
            </button>
        </div>
      </div>

      {/* Drawer Form */}
      <Modal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={editingOrganization ? 'Edit Organization' : 'Add New Organization'}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col h-full"
        >
          <div className="flex-1 overflow-y-auto space-y-4 pb-4"> {/* Scrollable content */}
            <div>
              <label className="label-modern">Organization ID</label>
              <input
                {...register('organizationId')}
                placeholder="e.g. google-pakistan"
                className="input-modern"
                disabled={!!editingOrganization}
              />
              {errors.organizationId && <p className="text-xs text-red-500 mt-1">{errors.organizationId.message}</p>}
              <p className="text-xs text-gray-500 mt-1">Unique identifier for the system.</p>
            </div>
            
            <div>
              <label className="label-modern">Name</label>
              <input
                {...register('name')}
                placeholder="e.g. Google"
                className="input-modern"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label-modern">Industry</label>
              <input
                {...register('industry')}
                placeholder="e.g. Technology"
                className="input-modern"
              />
              {errors.industry && <p className="text-xs text-red-500 mt-1">{errors.industry.message}</p>}
            </div>

            <div>
              <label className="label-modern">Booth Number</label>
              <input
                {...register('boothNumber')}
                placeholder="e.g. A-12"
                className="input-modern"
              />
              {errors.boothNumber && <p className="text-xs text-red-500 mt-1">{errors.boothNumber.message}</p>}
            </div>

            <div>
              <label className="label-modern">Contact Person</label>
              <input
                {...register('contactPerson')}
                placeholder="Full Name"
                className="input-modern"
              />
              {errors.contactPerson && <p className="text-xs text-red-500 mt-1">{errors.contactPerson.message}</p>}
            </div>

            <div>
              <label className="label-modern">Email</label>
              <input
                {...register('email')}
                placeholder="contact@company.com"
                className="input-modern"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label-modern">Category</label>
              <input
                {...register('category')}
                placeholder="e.g. Gold Sponsor"
                className="input-modern"
              />
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
            </div>
          </div> {/* End scrollable content */}

          <div className="pt-4 border-t border-gray-100 mt-auto"> {/* Fixed footer for button */}
            <button
              type="submit"
              className="btn-accent w-full"
              disabled={loading}
            >
              {loading ? (editingOrganization ? 'Updating...' : 'Adding...') : (editingOrganization ? 'Update Organization' : 'Add Organization')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk QR Section */}
      {bulkQR && (
        <div className="card-modern">
          <h2 className="text-xl font-bold mb-6 text-gray-900 border-b border-gray-100 pb-2">
            Bulk QR Code Generator
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {organizations.map((organization) => (
              <div
                key={organization.organizationId}
                onClick={() => handleSelectOrganization(organization.organizationId)}
                className={`p-4 rounded-xl flex flex-col items-center border transition-all duration-200 cursor-pointer shadow-sm ${
                  selectedOrganizations.includes(organization.organizationId)
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 ring-offset-1' 
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="w-full flex justify-end">
                    <input
                    type="checkbox"
                    checked={selectedOrganizations.includes(organization.organizationId)}
                    onChange={() => {}} // Handled by parent div
                    className="mb-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 pointer-events-none"
                    />
                </div>
                <div className="transform scale-90 pointer-events-none">
                    <QRCodeGenerator organization={organization} />
                </div>
                <span className="mt-3 text-sm font-bold text-gray-700 text-center">
                  {organization.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization List */}
      <div className="card-modern h-auto min-h-[50vh] md:h-[calc(100vh-200px)] flex flex-col">
        <h2 className="text-xl font-bold mb-6 text-gray-900 flex items-center gap-2 shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Participating Organizations
            {!fetching && <span className="text-sm font-normal text-gray-400 ml-2">({organizations.length})</span>}
        </h2>
        
        <PullToRefresh onRefresh={async () => await fetchOrganizations(true)}>
            {fetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
                ))}
            </div>
            ) : organizations.length === 0 ? (
            <EmptyState
                title="No Organizations Found"
                description="Get started by adding the first organization to the event."
                action={
                <button
                    onClick={() => setShowAddForm(true)}
                    className="btn-primary py-2 px-4 text-sm"
                >
                    Add Organization
                </button>
                }
            />
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {organizations.map((organization) => (
                <div
                key={organization.organizationId}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center relative group transition-all duration-300 hover:shadow-md hover:border-blue-300"
                >
                <div className="transform transition-transform group-hover:scale-105">
                    <QRCodeGenerator organization={organization} />
                </div>
                
                <div className="mt-4 text-center w-full">
                    <h3 className="font-bold text-gray-800 truncate w-full" title={organization.name}>
                        {organization.name}
                    </h3>
                    
                    <div className="flex items-center justify-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium border border-blue-100">
                            Booth {organization.boothNumber}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 truncate">
                        {organization.industry}
                    </p>
                </div>

                <div className="flex items-center gap-2 mt-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2 bg-white border border-gray-100 p-1 rounded-lg shadow-sm">
                    <button
                    onClick={() => handleEdit(organization)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Edit"
                    >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                    onClick={() => handleDelete(organization.organizationId)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                    >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
                </div>
            ))}
            </div>
            )}
        </PullToRefresh>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Organization"
        message="Are you sure you want to delete this organization? This action cannot be undone and will remove all associated data."
        confirmText="Delete Organization"
      />
    </div>
  );
}
