'use client';

import { useState, useCallback } from 'react';
import { createOrganization } from '../../firestore/organizations';
import { slugify } from '../../lib/utils';
import { haptics } from '../../lib/haptics';
import toast from 'react-hot-toast';
import { Organization } from '../../types';
import { serverTimestamp } from 'firebase/firestore';

const CATEGORIES = [
  'Technology',
  'Finance & Banking',
  'Manufacturing',
  'FMCG',
  'Design & Creative',
  'Consulting',
  'Healthcare',
  'Education',
  'Other',
];

export default function OrganizationRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    contactNumber: '',
    contactEmail: '',
    boothNumber: '',
    category: '',
    industry: '',
  });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [organizationId, setOrganizationId] = useState('');

      const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('Form submitted');
      haptics.impact();
  
      // Validation
      if (!formData.name || !formData.contactPerson || !formData.boothNumber) {
        toast.error('Please fill all required fields');
        haptics.error();
        return;
      }
  
      setLoading(true);
  
      try {
        // Generate organization ID from company name
        const orgId = slugify(formData.name);
        console.log('Generated organization ID:', orgId);
  
        // Create organization record
        const organization: Omit<Organization, 'visitors' | 'visitorCount'> = {
          organizationId: orgId,
          name: formData.name,
          industry: formData.category,
          boothNumber: formData.boothNumber,
          qrCode: orgId, // QR will encode this ID
          contactPerson: formData.contactPerson,
          email: formData.contactEmail,
          category: formData.category,
        };
  
        console.log('Organization data:', organization);
  
        await createOrganization(organization);
  
        console.log('Organization created successfully');
  
        setOrganizationId(orgId);
        setRegistered(true);
        haptics.success();
        toast.success('Registration successful!');
  
        // Save to localStorage for quick access
        localStorage.setItem('organization_id', orgId);
        localStorage.setItem('organization_name', formData.name);
      } catch (err) {
        console.error('Registration failed with error:', err);
        haptics.error();
        toast.error('Registration failed. Please check the console for details.');
      } finally {
        setLoading(false);
      }
    };
  if (registered) {
    return (
      <div className="card-modern max-w-2xl mx-auto">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2 text-gray-900">Registration Complete!</h2>
          <p className="text-gray-600 mb-8">
            Your QR code and booth information have been generated successfully.
          </p>

          <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl mb-8 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <p className="text-sm text-gray-500 mb-1">Company</p>
                  <p className="font-semibold text-gray-900">{formData.name}</p>
               </div>
               <div>
                  <p className="text-sm text-gray-500 mb-1">Booth</p>
                  <p className="font-semibold text-gray-900">{formData.boothNumber}</p>
               </div>
               <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Organization ID</p>
                  <p className="font-mono text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 inline-block">{organizationId}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={`/organization/qr/${organizationId}`}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              View QR Code
            </a>
            <a
              href={`/organization/feedback/${organizationId}`}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Feedback Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-modern max-w-2xl mx-auto">
      <div className="mb-8 border-b border-gray-100 pb-6">
        <h2 className="text-2xl font-bold text-gray-900">Organization Registration</h2>
        <p className="text-gray-500 mt-1">
          Enter your organization details for Career City 2026.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="label-modern">
            Company Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-modern"
            placeholder="e.g., Tech Solutions Inc."
          />
        </div>

        <div>
          <label className="label-modern">
            Contact Person Name *
          </label>
          <input
            type="text"
            required
            value={formData.contactPerson}
            onChange={(e) =>
              setFormData({ ...formData, contactPerson: e.target.value })
            }
            className="input-modern"
            placeholder="e.g., Sarah Smith"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label-modern">
              Contact Number *
            </label>
            <input
              type="tel"
              required
              value={formData.contactNumber}
              onChange={(e) =>
                setFormData({ ...formData, contactNumber: e.target.value })
              }
              className="input-modern"
              placeholder="03XX-XXXXXXX"
            />
          </div>

          <div>
            <label className="label-modern">
              Contact Email
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) =>
                setFormData({ ...formData, contactEmail: e.target.value })
              }
              className="input-modern"
              placeholder="recruiter@company.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label-modern">
              Booth Number *
            </label>
            <input
              type="text"
              required
              value={formData.boothNumber}
              onChange={(e) =>
                setFormData({ ...formData, boothNumber: e.target.value })
              }
              className="input-modern"
              placeholder="e.g., B-12"
            />
          </div>

          <div>
            <label className="label-modern">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="input-modern"
            >
              <option value="">Select Category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
            <label className="label-modern">
              Industry / Specialization
            </label>
            <input
              type="text"
              required
              value={formData.industry}
              onChange={(e) =>
                setFormData({ ...formData, industry: e.target.value })
              }
              className="input-modern"
              placeholder="Specific industry focus (e.g. Cloud Computing, AI)"
            />
          </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex justify-center items-center py-3 text-base"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : 'Register Organization'}
          </button>
        </div>
      </form>
    </div>
  );
}
