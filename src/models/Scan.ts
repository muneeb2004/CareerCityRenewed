import mongoose, { Schema, model, models } from 'mongoose';

export interface IScan {
  scanId: string;
  studentId: string;
  studentEmail?: string;
  studentProgram?: string;
  organizationId: string;
  organizationName?: string;
  boothNumber?: string;
  timestamp: Date;
  scanMethod: string;
}

const ScanSchema = new Schema<IScan>(
  {
    scanId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true // Format: studentId_scanCount
    },
    studentId: { type: String, required: true, index: true },
    studentEmail: { type: String },
    studentProgram: { type: String },
    organizationId: { type: String, required: true, index: true },
    organizationName: { type: String },
    boothNumber: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    scanMethod: { type: String, default: 'qr_code' }
  },
  { 
    timestamps: true 
  }
);

// Compound indexes for common queries
ScanSchema.index({ studentId: 1, organizationId: 1 }); // "Has this student visited this org?"
ScanSchema.index({ organizationId: 1, timestamp: -1 }); // Org analytics
ScanSchema.index({ studentId: 1, timestamp: -1 }); // Student history

export const Scan = models.Scan || model<IScan>('Scan', ScanSchema);
