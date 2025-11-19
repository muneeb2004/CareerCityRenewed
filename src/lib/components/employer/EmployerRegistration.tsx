// Prompt for Copilot: "Create quick employer registration form with company name, contact person, phone, email, booth number, category dropdown - no authentication"

'use client';

import { useState } from 'react';
import { createEmployer } from '../../firestore/employers';
import { slugify } from '../../utils';
import toast from 'react-hot-toast';
import { Employer } from '../../types';
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

export default function EmployerRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    contactNumber: '',
    contactEmail: '',
    boothNumber: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [employerId, setEmployerId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.contactPerson || !formData.boothNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      // Generate employer ID from company name
      const empId = slugify(formData.name);
      
      // Create employer record
      const employer: Omit<Employer, 'visitors' | 'visitorCount'> = {
        employerId: empId,
        name: formData.name,
        industry: formData.category,
        boothNumber: formData.boothNumber,
        qrCode: empId, // QR will encode this ID
        contactPerson: formData.contactPerson,
        email: formData.contactEmail,
        category: formData.category,
        // feedbackLink and registeredAt are not in Employer type, so omit them
      };

      await createEmployer(employer);
      
      setEmployerId(empId);
      setRegistered(true);
      toast.success('Registration successful!');
      
      // Save to localStorage for quick access
      localStorage.setItem('employer_id', empId);
      localStorage.setItem('employer_name', formData.name);
      
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold mb-4">Registration Complete!</h2>
          <p className="text-gray-600 mb-6">
            Your QR code and booth information have been generated.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="font-semibold">Company: {formData.name}</p>
            <p className="text-gray-600">Booth: {formData.boothNumber}</p>
            <p className="text-gray-600">Employer ID: {employerId}</p>
          </div>

          <div className="space-y-3">
            <a
              href={`/employer/qr/${employerId}`}
              className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              View & Download QR Code
            </a>
            <a
              href={`/employer/feedback/${employerId}`}
              className="block w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Access Feedback Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Employer Registration</h2>
      <p className="text-gray-600 mb-6">
        Quick registration for Career City 2026
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Google Pakistan"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contact Person Name *
          </label>
          <input
            type="text"
            required
            value={formData.contactPerson}
            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Ahmed Khan"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Number *
            </label>
            <input
              type="tel"
              required
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="03XX-XXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="recruiter@company.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Booth Number *
            </label>
            <input
              type="text"
              required
              value={formData.boothNumber}
              onChange={(e) => setFormData({ ...formData, boothNumber: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., B12"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition"
        >
          {loading ? 'Registering...' : 'Register Company'}
        </button>
      </form>
    </div>
  );
}