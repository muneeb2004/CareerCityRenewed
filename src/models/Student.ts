import mongoose, { Schema, model, models } from 'mongoose';

export interface IStudent {
  studentId: string;
  email: string;
  fullName: string;
  program?: string;
  visitedStalls: string[]; // Organization IDs
  scanCount: number;
  feedbackSubmitted: boolean;
  feedbackId?: string;
  registeredAt: Date;
  lastScanTime: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    studentId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true,
      trim: true
    },
    email: { type: String, required: true },
    fullName: { type: String, required: true },
    program: { type: String },
    visitedStalls: [{ type: String }],
    scanCount: { type: Number, default: 0 },
    feedbackSubmitted: { type: Boolean, default: false },
    feedbackId: { type: String },
    registeredAt: { type: Date, default: Date.now },
    lastScanTime: { type: Date, default: Date.now }
  },
  { 
    timestamps: true 
  }
);

export const Student = models.Student || model<IStudent>('Student', StudentSchema);
