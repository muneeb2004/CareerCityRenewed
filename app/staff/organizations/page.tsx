'use client';

import { useState, useEffect } from 'react';

import Link from 'next/link';

import {
  getAllOrganizations,
  createOrganization,
} from '../../../src/lib/firestore/organizations';
import QRCodeGenerator from '../../../src/lib/components/organization/QRCodeGenerator';
import { Organization } from '../../../src/lib/types';
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

      fetchOrganizations();

    } catch (err) {

      console.error(err);

      toast.error('Failed to add organization');

    } finally {

      setLoading(false);

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

    <div className="min-h-screen p-4 sm:p-6 lg:p-8">

      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-6">

              <h1 className="text-3xl font-bold text-gray-800">

                Staff Organization Management

              </h1>

              <div className="flex space-x-2">

                <button

                  className="bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600"

                  onClick={() => setShowAddForm(!showAddForm)}

                >

                  {showAddForm ? 'Cancel' : 'Add Organization'}

                </button>

              </div>

            </div>

      {showAddForm && (

        <form

          onSubmit={handleAddOrganization}

          className="bg-white shadow-lg rounded-lg p-6 mb-8 grid grid-cols-2 gap-4"

        >

          <input

            name="organizationId"

            value={form.organizationId}

            onChange={handleInputChange}

            placeholder="Organization ID (e.g. google-pakistan)"

            className="border p-2 rounded"

          />

          <input

            name="name"

            value={form.name}

            onChange={handleInputChange}

            placeholder="Name"

            className="border p-2 rounded"

            required

          />

          <input

            name="industry"

            value={form.industry}

            onChange={handleInputChange}

            placeholder="Industry"

            className="border p-2 rounded"

          />

          <input

            name="boothNumber"

            value={form.boothNumber}

            onChange={handleInputChange}

            placeholder="Booth Number"

            className="border p-2 rounded"

          />

          <input

            name="contactPerson"

            value={form.contactPerson}

            onChange={handleInputChange}

            placeholder="Contact Person"

            className="border p-2 rounded"

          />

          <input

            name="email"

            value={form.email}

            onChange={handleInputChange}

            placeholder="Email"

            className="border p-2 rounded"

          />

          <input

            name="category"

            value={form.category}

            onChange={handleInputChange}

            placeholder="Category"

            className="border p-2 rounded"

          />

          <button

            type="submit"

            className="col-span-2 bg-accent text-white py-2 rounded-lg font-semibold hover:bg-emerald-600"

            disabled={loading}

          >

            {loading ? 'Adding...' : 'Add Organization'}

          </button>

        </form>

      )}

      <div className="mb-6">

        <button

          className="bg-secondary text-white px-4 py-2 rounded-lg font-semibold hover:bg-violet-600"

          onClick={handleBulkQR}

        >

          {bulkQR ? 'Hide Bulk QR' : 'Generate Bulk QR Codes'}

        </button>

      </div>

      {bulkQR && (

        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">

          <h2 className="text-xl font-bold mb-4 text-gray-800">

            Bulk QR Code Generator

          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

            {organizations.map((organization) => (

              <div

                key={organization.organizationId}

                className="bg-gray-50 p-4 rounded-lg flex flex-col items-center"

              >

                <input

                  type="checkbox"

                  checked={selectedOrganizations.includes(organization.organizationId)}

                  onChange={() => handleSelectOrganization(organization.organizationId)}

                  className="mb-2"

                />

                <QRCodeGenerator organization={organization} />

                <span className="mt-2 text-sm font-semibold text-gray-800">

                  {organization.name}

                </span>

              </div>

            ))}

          </div>

        </div>

      )}

      <div className="bg-white shadow-lg rounded-lg p-6">

        <h2 className="text-xl font-bold mb-4 text-gray-800">

          Organization List

        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

          {organizations.map((organization) => (

            <div

              key={organization.organizationId}

              className="bg-gray-50 p-4 rounded-lg flex flex-col items-center"

            >

              <QRCodeGenerator organization={organization} />

              <span className="mt-2 text-sm font-semibold text-gray-800">

                {organization.name}

              </span>

              <span className="text-xs text-gray-500">

                Booth: {organization.boothNumber}

              </span>

              <span className="text-xs text-gray-500">

                Industry: {organization.industry}

              </span>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}
