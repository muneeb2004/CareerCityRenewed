import mongoose, { Schema, model, models } from 'mongoose';

/**
 * AnalyticsScan Model
 * Records scan events for analytics purposes.
 * Enriched with student data from StudentRecord collection.
 */
export interface IAnalyticsScan {
  _id: mongoose.Types.ObjectId;
  studentId: string;      // Full combined ID "xx1234" or "xx12345"
  extractedId: string;    // Extracted digits "1234" or "12345"
  stallId: string;        // Organization/Stall ID
  timestamp: Date;
  classYear?: string;     // Enriched from StudentRecord
  major?: string;         // Enriched from StudentRecord
  name?: string;          // Enriched from StudentRecord
  recordedBy?: string;    // Username of who recorded the scan
  createdAt: Date;
}

const AnalyticsScanSchema = new Schema<IAnalyticsScan>(
  {
    studentId: { 
      type: String, 
      required: true, 
      index: true,
      trim: true
    },
    extractedId: { 
      type: String, 
      required: true,
      index: true,
      trim: true 
    },
    stallId: { 
      type: String, 
      required: true,
      index: true,
      trim: true 
    },
    timestamp: { 
      type: Date, 
      required: true,
      default: Date.now,
      index: true 
    },
    classYear: { type: String },
    major: { type: String },
    name: { type: String },
    recordedBy: { type: String, index: true },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound indexes for common analytics queries
AnalyticsScanSchema.index({ stallId: 1, timestamp: -1 });           // Stall analytics
AnalyticsScanSchema.index({ extractedId: 1, timestamp: -1 });       // Student history
AnalyticsScanSchema.index({ classYear: 1, stallId: 1 });            // Class year by stall
AnalyticsScanSchema.index({ major: 1, stallId: 1 });                // Major by stall
AnalyticsScanSchema.index({ studentId: 1, stallId: 1 }, { unique: true }); // Prevent duplicate scans

export const AnalyticsScan = models.AnalyticsScan || model<IAnalyticsScan>('AnalyticsScan', AnalyticsScanSchema);
