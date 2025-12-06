'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../../../src/firestore/organizations';
import QRCodeGenerator from '../../../src/components/organization/QRCodeGenerator';
import { Organization } from '../../../src/types';
import toast, { Toaster } from 'react-hot-toast';

interface OrganizationForm {
  organizationId: string;
  name: string;
  industry: string;
  boothNumber: string;
  contactPerson: string;
  email: string;
  category: string;
}

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<OrganizationForm>({
    organizationId: '',
    name: '',
    industry: '',
    boothNumber: '',
    contactPerson: '',
    email: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [bulkQR, setBulkQR] = useState(false);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [editingOrganization, setEditingOrganization] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    const data = await getAllOrganizations();
    setOrganizations(data);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingOrganization) {
        await updateOrganization(editingOrganization, {
          name: form.name,
          industry: form.industry,
          boothNumber: form.boothNumber,
          contactPerson: form.contactPerson,
          email: form.email,
          category: form.category,
        });
        toast.success('Organization updated!');
      } else {
        const organizationId =
          form.organizationId.trim() ||
          `${form.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
        await createOrganization({
          organizationId,
          name: form.name,
          industry: form.industry,
          boothNumber: form.boothNumber,
          qrCode: organizationId,
          contactPerson: form.contactPerson,
          email: form.email,
          category: form.category,
        });
        toast.success('Organization added!');
      }

      setForm({
        organizationId: '',
        name: '',
        industry: '',
        boothNumber: '',
        contactPerson: '',
        email: '',
        category: '',
      });
      setShowAddForm(false);
      setEditingOrganization(null);
      fetchOrganizations();
    } catch (err) {
      console.error(err);
      toast.error(editingOrganization ? 'Failed to update organization' : 'Failed to add organization');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (org: Organization) => {
    setForm({
      organizationId: org.organizationId,
      name: org.name,
      industry: org.industry,
      boothNumber: org.boothNumber,
      contactPerson: org.contactPerson || '',
      email: org.email || '',
      category: org.category || '',
    });
    setEditingOrganization(org.organizationId);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this organization?')) {
      try {
        await deleteOrganization(id);
        toast.success('Organization deleted');
        fetchOrganizations();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete organization');
      }
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
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
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
            className={`${showAddForm ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' : 'btn-primary'} font-semibold py-2 px-4 rounded-xl transition-all duration-200`}
            onClick={() => {
                setShowAddForm(!showAddForm);
                if (showAddForm) {
                setEditingOrganization(null);
                setForm({
                    organizationId: '',
                    name: '',
                    industry: '',
                    boothNumber: '',
                    contactPerson: '',
                    email: '',
                    category: '',
                });
                }
            }}
            >
            {showAddForm ? 'Cancel' : 'Add Organization'}
            </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddOrganization}
          className="card-modern grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in-up"
        >
          <div className="col-span-1 md:col-span-2 mb-2">
            <h2 className="text-xl font-bold text-gray-800">
                {editingOrganization ? 'Edit Organization' : 'Add New Organization'}
            </h2>
          </div>

          <input
            name="organizationId"
            value={form.organizationId}
            onChange={handleInputChange}
            placeholder="Organization ID (e.g. google-pakistan)"
            className="input-modern"
            disabled={!!editingOrganization}
          />
          <input
            name="name"
            value={form.name}
            onChange={handleInputChange}
            placeholder="Name"
            className="input-modern"
            required
          />
          <input
            name="industry"
            value={form.industry}
            onChange={handleInputChange}
            placeholder="Industry"
            className="input-modern"
          />
          <input
            name="boothNumber"
            value={form.boothNumber}
            onChange={handleInputChange}
            placeholder="Booth Number"
            className="input-modern"
          />
          <input
            name="contactPerson"
            value={form.contactPerson}
            onChange={handleInputChange}
            placeholder="Contact Person"
            className="input-modern"
          />
          <input
            name="email"
            value={form.email}
            onChange={handleInputChange}
            placeholder="Email"
            className="input-modern"
          />
          <input
            name="category"
            value={form.category}
            onChange={handleInputChange}
            placeholder="Category"
            className="input-modern"
          />
          <button
            type="submit"
            className="col-span-1 md:col-span-2 btn-accent mt-2"
            disabled={loading}
          >
            {loading ? (editingOrganization ? 'Updating...' : 'Adding...') : (editingOrganization ? 'Update Organization' : 'Add Organization')}
          </button>
        </form>
      )}

      {/* Bulk QR Section */}
      {bulkQR && (
        <div className="card-modern">
          <h2 className="text-xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-2">
            Bulk QR Code Generator
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {organizations.map((organization) => (
              <div
                key={organization.organizationId}
                onClick={() => handleSelectOrganization(organization.organizationId)}
                className={`glass p-4 rounded-xl flex flex-col items-center border transition-all duration-200 cursor-pointer ${
                  selectedOrganizations.includes(organization.organizationId)
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200' 
                    : 'border-white/40 hover:border-blue-300 hover:bg-white/80'
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
      <div className="card-modern">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Participating Organizations
            <span className="text-sm font-normal text-gray-400 ml-2">({organizations.length})</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {organizations.map((organization) => (
            <div
              key={organization.organizationId}
              className="glass-hover p-5 rounded-xl border border-white/60 flex flex-col items-center relative group transition-all duration-300"
            >
              <div className="transform transition-transform group-hover:scale-105">
                <QRCodeGenerator organization={organization} />
              </div>
              
              <div className="mt-4 text-center w-full">
                <h3 className="font-bold text-gray-800 truncate w-full" title={organization.name}>
                    {organization.name}
                </h3>
                
                <div className="flex items-center justify-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">
                        Booth {organization.boothNumber}
                    </span>
                </div>
                 <p className="text-xs text-gray-400 mt-1 truncate">
                    {organization.industry}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm">
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
      </div>
    </div>
  );
}
