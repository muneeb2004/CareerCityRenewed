import mongoose, { Schema, model, models } from 'mongoose';

export interface IFeedback {
  feedbackId: string;
  studentId?: string; // For StudentFeedback
  organizationId?: string; // For OrgFeedback
  responses: Record<string, string | number | string[]>;
  timestamp: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    feedbackId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    studentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    responses: { type: Map, of: Schema.Types.Mixed }, // Flexible key-value storage
    timestamp: { type: Date, default: Date.now }
  },
  { 
    timestamps: true 
  }
);

export const StudentFeedback = models.StudentFeedback || model<IFeedback>('StudentFeedback', FeedbackSchema);
export const OrgFeedback = models.OrgFeedback || model<IFeedback>('OrgFeedback', FeedbackSchema);
