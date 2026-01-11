import mongoose, { Schema, model, models } from 'mongoose';

/**
 * StudentRecord Model
 * Stores imported student data from CSV for validation purposes.
 * This is separate from the main Student model which tracks student activity during the event.
 */
export interface IStudentRecord {
  _id: mongoose.Types.ObjectId;
  id: string;           // Student ID from CSV (4 or 5 digits, e.g., "1234" or "12345")
  classYear: string;    // e.g., "Class of 2025"
  major: string;        // e.g., "BS CS"
  name: string;         // Full name
  createdAt: Date;
  updatedAt: Date;
}

const StudentRecordSchema = new Schema<IStudentRecord>(
  {
    id: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true,
      trim: true
    },
    classYear: { 
      type: String, 
      required: true,
      trim: true 
    },
    major: { 
      type: String, 
      required: true,
      trim: true 
    },
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
  },
  { 
    timestamps: true 
  }
);

// Index for quick lookups
StudentRecordSchema.index({ id: 1 });
StudentRecordSchema.index({ classYear: 1 });
StudentRecordSchema.index({ major: 1 });

export const StudentRecord = models.StudentRecord || model<IStudentRecord>('StudentRecord', StudentRecordSchema);
