import mongoose, { Schema, model, models } from 'mongoose';

export interface IQuestion {
  slug: string; // The slugified ID (e.g. "how-was-your-day")
  text: string;
  type: string;
  options?: string[];
  minLabel?: string;
  maxLabel?: string;
  scaleMax?: number;
  followUpLabel?: string;
  placeholder?: string;
  allowOther?: boolean;
  order?: number;
  // Specific to volunteer questions
  isPerOrganization?: boolean;
  linkedToQuestionId?: string;
  selectionCount?: number;
  selectionMode?: 'exactly' | 'up_to';
}

const QuestionSchema = new Schema<IQuestion>(
  {
    slug: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    text: { type: String, required: true },
    type: { type: String, required: true },
    options: [{ type: String }],
    minLabel: String,
    maxLabel: String,
    scaleMax: Number,
    followUpLabel: String,
    placeholder: String,
    allowOther: Boolean,
    order: { type: Number, default: 0 },
    
    // Specific fields
    isPerOrganization: Boolean,
    linkedToQuestionId: String,
    selectionCount: Number,
    selectionMode: { type: String, enum: ['exactly', 'up_to'] }
  },
  { 
    timestamps: true 
  }
);

// Indexes for ordering
QuestionSchema.index({ order: 1 });

// We export two models using the same schema structure but different collections
export const VolunteerQuestion = models.VolunteerQuestion || model<IQuestion>('VolunteerQuestion', QuestionSchema);
export const OrgQuestion = models.OrgQuestion || model<IQuestion>('OrgQuestion', QuestionSchema);
