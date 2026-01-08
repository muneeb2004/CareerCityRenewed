import mongoose, { Schema, model, models } from 'mongoose';

export interface IVolunteer {
  volunteerId: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'Captain' | 'Member';
  isActive: boolean;
  createdAt: Date;
}

const VolunteerSchema = new Schema<IVolunteer>(
  {
    volunteerId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    role: { 
      type: String, 
      enum: ['Captain', 'Member'],
      default: 'Member'
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  { 
    timestamps: true 
  }
);

export const Volunteer = models.Volunteer || model<IVolunteer>('Volunteer', VolunteerSchema);
