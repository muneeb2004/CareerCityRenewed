// Prompt for Copilot: "Create Next.js page for staff to add employers, generate QR codes in bulk, display employer list with QR preview"

'use client';



import { useState, useEffect } from 'react';

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

    console.log('Add Organization button pressed');

    console.log('Form data:', form);

    setLoading(true);

    try {

      // Generate organizationId if not provided

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

      setLoading(false);

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

    <div className="min-h-screen p-8">

      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-6">

        <h1 className="text-3xl font-bold text-white">

          Staff Organization Management

        </h1>

        <button

          className="bg-pastel-blue text-blue-800 px-4 py-2 rounded-lg font-semibold hover:bg-blue-300"

          onClick={() => setShowAddForm(!showAddForm)}

        >

          {showAddForm ? 'Cancel' : 'Add Organization'}

        </button>

      </div>

      {showAddForm && (

        <form

          onSubmit={handleAddOrganization}

          className="glassmorphic p-6 mb-8 grid grid-cols-2 gap-4"

        >

          <input

            name="organizationId"

            value={form.organizationId}

            onChange={handleInputChange}

            placeholder="Organization ID (e.g. google-pakistan, apple-20251125)"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

          />

          <input

            name="name"

            value={form.name}

            onChange={handleInputChange}

            placeholder="Name"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

            required

          />

          <input

            name="industry"

            value={form.industry}

            onChange={handleInputChange}

            placeholder="Industry (e.g. healthcare, technology, manufacturing, retail)"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

          />

          <input

            name="boothNumber"

            value={form.boothNumber}

            onChange={handleInputChange}

            placeholder="Booth Number (e.g. B12, A01, C7)"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

          />

          <input

            name="contactPerson"

            value={form.contactPerson}

            onChange={handleInputChange}

            placeholder="Contact Person"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

          />

          <input

            name="email"

            value={form.email}

            onChange={handleInputChange}

            placeholder="Email"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

          />

          <input

            name="category"

            value={form.category}

            onChange={handleInputChange}

            placeholder="Category (e.g. smartphones, athletic shoes, soft drinks, sedans)"

            className="border p-2 rounded bg-white/20 text-white placeholder-gray-200"

          />

          <button

            type="submit"

            className="col-span-2 bg-pastel-green text-green-800 py-2 rounded-lg font-semibold hover:bg-green-300"

            disabled={loading}

          >

            {loading ? 'Adding...' : 'Add Organization'}

          </button>

        </form>

      )}

      <div className="mb-6">

        <button

          className="bg-pastel-purple text-purple-800 px-4 py-2 rounded-lg font-semibold hover:bg-purple-300"

          onClick={handleBulkQR}

        >

          {bulkQR ? 'Hide Bulk QR' : 'Generate Bulk QR Codes'}

        </button>

      </div>

      {bulkQR && (

        <div className="glassmorphic p-6 mb-8">

          <h2 className="text-xl font-bold mb-4 text-white">

            Bulk QR Code Generator

          </h2>

          <div className="grid grid-cols-4 gap-4">

            {organizations.map((organization) => (

              <div

                key={organization.organizationId}

                className="glassmorphic border p-2 rounded flex flex-col items-center"

              >

                <input

                  type="checkbox"

                  checked={selectedOrganizations.includes(organization.organizationId)}

                  onChange={() => handleSelectOrganization(organization.organizationId)}

                />

                <QRCodeGenerator organization={organization} />

                <span className="mt-2 text-sm text-white">{organization.name}</span>

              </div>

            ))}

          </div>

        </div>

      )}

      <div className="glassmorphic p-6">

        <h2 className="text-xl font-bold mb-4 text-white">Organization List</h2>

        <div className="grid grid-cols-4 gap-4">

          {organizations.map((organization) => (

            <div

              key={organization.organizationId}

              className="glassmorphic border p-2 rounded flex flex-col items-center"

            >

              <QRCodeGenerator organization={organization} />

              <span className="mt-2 text-sm font-semibold text-white">

                {organization.name}

              </span>

              <span className="text-xs text-gray-200">

                Booth: {organization.boothNumber}

              </span>

              <span className="text-xs text-gray-200">

                Industry: {organization.industry}

              </span>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}
