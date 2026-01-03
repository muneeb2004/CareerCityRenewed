import mongoose, { Schema, model, models } from 'mongoose';

export interface IOrganization {
  organizationId: string;
  name: string;
  industry: string;
  boothNumber: string;
  qrCode: string;
  logo?: string;
  contactPerson: string;
  email: string;
  category: string;
  visitors: string[]; // Array of Student IDs
  visitorCount: number;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    organizationId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    name: { type: String, required: true },
    industry: { type: String, required: true },
    boothNumber: { type: String, required: true },
    qrCode: { type: String, required: true },
    logo: { type: String },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    category: { type: String, required: true },
    visitors: [{ type: String }],
    visitorCount: { type: Number, default: 0 }
  },
  { 
    timestamps: true 
  }
);

export const Organization = models.Organization || model<IOrganization>('Organization', OrganizationSchema);
