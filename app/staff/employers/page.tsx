// Prompt for Copilot: "Create Next.js page for staff to add employers, generate QR codes in bulk, display employer list with QR preview"

'use client';

import { useState, useEffect } from 'react';
import { getAllEmployers, createEmployer } from '../../../src/lib/firestore/employers';
import QRCodeGenerator from '../../../src/lib/components/employer/QRCodeGenerator';
import { Employer } from '../../../src/lib/types';
import toast, { Toaster } from 'react-hot-toast';

interface EmployerForm {
  employerId: string;
  name: string;
  industry: string;
  boothNumber: string;
  contactPerson: string;
  email: string;
  category: string;
}

export default function EmployerManagement() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<EmployerForm>({
    employerId: '',
    name: '',
    industry: '',
    boothNumber: '',
    contactPerson: '',
    email: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [bulkQR, setBulkQR] = useState(false);
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);

  useEffect(() => {
    fetchEmployers();
  }, []);

  const fetchEmployers = async () => {
    const data = await getAllEmployers();
    setEmployers(data);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddEmployer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createEmployer({
        ...form,
        qrCode: form.employerId,
      });
      toast.success('Employer added!');
      setForm({
        employerId: '',
        name: '',
        industry: '',
        boothNumber: '',
        contactPerson: '',
        email: '',
        category: '',
      });
      setShowAddForm(false);
      fetchEmployers();
    } catch (err) {
      toast.error('Failed to add employer');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkQR = () => {
    setBulkQR(!bulkQR);
    setSelectedEmployers([]);
  };

  const handleSelectEmployer = (id: string) => {
    setSelectedEmployers((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Staff Employer Management</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Employer'}
        </button>
      </div>
      {showAddForm && (
        <form onSubmit={handleAddEmployer} className="bg-white p-6 rounded-lg shadow mb-8 grid grid-cols-2 gap-4">
          <input name="employerId" value={form.employerId} onChange={handleInputChange} placeholder="Employer ID" className="border p-2 rounded" required />
          <input name="name" value={form.name} onChange={handleInputChange} placeholder="Name" className="border p-2 rounded" required />
          <input name="industry" value={form.industry} onChange={handleInputChange} placeholder="Industry" className="border p-2 rounded" />
          <input name="boothNumber" value={form.boothNumber} onChange={handleInputChange} placeholder="Booth Number" className="border p-2 rounded" />
          <input name="contactPerson" value={form.contactPerson} onChange={handleInputChange} placeholder="Contact Person" className="border p-2 rounded" />
          <input name="email" value={form.email} onChange={handleInputChange} placeholder="Email" className="border p-2 rounded" />
          <input name="category" value={form.category} onChange={handleInputChange} placeholder="Category" className="border p-2 rounded" />
          <button type="submit" className="col-span-2 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700" disabled={loading}>
            {loading ? 'Adding...' : 'Add Employer'}
          </button>
        </form>
      )}
      <div className="mb-6">
        <button
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700"
          onClick={handleBulkQR}
        >
          {bulkQR ? 'Hide Bulk QR' : 'Generate Bulk QR Codes'}
        </button>
      </div>
      {bulkQR && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4">Bulk QR Code Generator</h2>
          <div className="grid grid-cols-4 gap-4">
            {employers.map((employer) => (
              <div key={employer.employerId} className="border p-2 rounded flex flex-col items-center">
                <input
                  type="checkbox"
                  checked={selectedEmployers.includes(employer.employerId)}
                  onChange={() => handleSelectEmployer(employer.employerId)}
                />
                <QRCodeGenerator employer={employer} />
                <span className="mt-2 text-sm">{employer.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Employer List</h2>
        <div className="grid grid-cols-4 gap-4">
          {employers.map((employer) => (
            <div key={employer.employerId} className="border p-2 rounded flex flex-col items-center">
              <QRCodeGenerator employer={employer} />
              <span className="mt-2 text-sm font-semibold">{employer.name}</span>
              <span className="text-xs text-gray-500">Booth: {employer.boothNumber}</span>
              <span className="text-xs text-gray-500">Industry: {employer.industry}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
