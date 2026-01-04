'use server';

import dbConnect from '@/lib/db';
import { VolunteerQuestion, OrgQuestion, IQuestion } from '@/models/Question';
import { revalidatePath } from 'next/cache';
import { QuestionSlugSchema, QuestionSchema, validateOrThrow } from '@/lib/schemas';
import { safeEquals, sanitizeSlug, sanitizeText } from '@/lib/sanitize';
import { handleError } from '@/lib/error-handler';
import { 
  logResourceCreated, 
  logResourceUpdated, 
  logResourceDeleted,
  logUnhandledError 
} from '@/lib/security-logger';

// Helper to serialize MongoDB documents for client components
function serializeQuestion(q: any): any {
  return {
    ...q,
    questionId: q.slug, // Map slug to questionId for frontend compatibility
    _id: q._id.toString(),
    createdAt: q.createdAt?.toISOString?.() ?? q.createdAt,
    updatedAt: q.updatedAt?.toISOString?.() ?? q.updatedAt,
  };
}

// Helper to create a meaningful ID from text
const createSlug = (text: string): string => {
  return sanitizeSlug(text) || `question-${Date.now()}`;
};

// --- Volunteer Questions ---

export async function createVolunteerQuestion(question: Omit<IQuestion, 'slug'>): Promise<string> {
  await dbConnect();
  
  try {
    // Validate question data
    const validated = validateOrThrow(QuestionSchema, question);
    const slug = createSlug(validated.text);
    
    await VolunteerQuestion.findOneAndUpdate(
      { slug: safeEquals(slug) }, 
      { ...validated, slug }, 
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Log question creation
    await logResourceCreated('volunteer_question', slug);

    revalidatePath('/staff/student-questions');
    return slug;
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function getAllVolunteerQuestions(): Promise<any[]> {
  await dbConnect();
  
  try {
    const questions = await VolunteerQuestion.find({}).sort({ order: 1 }).lean();
    return questions.map(serializeQuestion);
  } catch (error) {
    console.error('Error getting volunteer questions:', error);
    return [];
  }
}

export async function updateVolunteerQuestion(slug: string, data: Partial<IQuestion>): Promise<void> {
  await dbConnect();
  
  try {
    // Validate inputs
    const validatedSlug = validateOrThrow(QuestionSlugSchema, slug);
    const validatedData = validateOrThrow(QuestionSchema.partial(), data);
    
    await VolunteerQuestion.findOneAndUpdate({ slug: safeEquals(validatedSlug) }, validatedData);
    
    // Log question update
    await logResourceUpdated('volunteer_question', validatedSlug, undefined, Object.keys(validatedData));
    
    revalidatePath('/staff/student-questions');
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function deleteVolunteerQuestion(slug: string): Promise<void> {
  await dbConnect();
  
  try {
    // Validate input
    const validatedSlug = validateOrThrow(QuestionSlugSchema, slug);
    
    await VolunteerQuestion.findOneAndDelete({ slug: safeEquals(validatedSlug) });
    
    // Log question deletion
    await logResourceDeleted('volunteer_question', validatedSlug);
    
    revalidatePath('/staff/student-questions');
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function bulkUpdateVolunteerQuestions(updates: { slug: string; data: Partial<IQuestion> }[]): Promise<void> {
  await dbConnect();
  
  try {
    // Validate each update
    const validatedUpdates = updates.map(update => ({
      slug: validateOrThrow(QuestionSlugSchema, update.slug),
      data: validateOrThrow(QuestionSchema.partial(), update.data),
    }));

    const bulkOps = validatedUpdates.map(update => ({
      updateOne: {
        filter: { slug: safeEquals(update.slug) },
        update: { $set: update.data }
      }
    }));

    await VolunteerQuestion.bulkWrite(bulkOps);
    revalidatePath('/staff/student-questions');
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

// --- Organization Feedback Questions ---

export async function createOrganizationFeedbackQuestion(question: Omit<IQuestion, 'slug'>): Promise<string> {
  await dbConnect();

  try {
    // Validate question data
    const validated = validateOrThrow(QuestionSchema, question);
    const slug = createSlug(validated.text);

    await OrgQuestion.findOneAndUpdate(
      { slug: safeEquals(slug) },
      { ...validated, slug },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Log question creation
    await logResourceCreated('org_question', slug);

    revalidatePath('/staff/organization-feedback-questions');
    return slug;
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function getAllOrganizationFeedbackQuestions(): Promise<any[]> {
  await dbConnect();

  try {
    const questions = await OrgQuestion.find({}).sort({ order: 1 }).lean();
    return questions.map(serializeQuestion);
  } catch (error) {
    console.error('Error getting org questions:', error);
    return [];
  }
}

export async function updateOrganizationFeedbackQuestion(slug: string, data: Partial<IQuestion>): Promise<void> {
  await dbConnect();
  
  try {
    // Validate inputs
    const validatedSlug = validateOrThrow(QuestionSlugSchema, slug);
    const validatedData = validateOrThrow(QuestionSchema.partial(), data);
    
    await OrgQuestion.findOneAndUpdate({ slug: safeEquals(validatedSlug) }, validatedData);
    
    // Log question update
    await logResourceUpdated('org_question', validatedSlug, undefined, Object.keys(validatedData));
    
    revalidatePath('/staff/organization-feedback-questions');
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function deleteOrganizationFeedbackQuestion(slug: string): Promise<void> {
  await dbConnect();
  
  try {
    // Validate input
    const validatedSlug = validateOrThrow(QuestionSlugSchema, slug);
    
    await OrgQuestion.findOneAndDelete({ slug: safeEquals(validatedSlug) });
    
    // Log question deletion
    await logResourceDeleted('org_question', validatedSlug);
    
    revalidatePath('/staff/organization-feedback-questions');
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function bulkUpdateOrganizationFeedbackQuestions(updates: { slug: string; data: Partial<IQuestion> }[]): Promise<void> {
  await dbConnect();
  
  try {
    // Validate each update
    const validatedUpdates = updates.map(update => ({
      slug: validateOrThrow(QuestionSlugSchema, update.slug),
      data: validateOrThrow(QuestionSchema.partial(), update.data),
    }));

    const bulkOps = validatedUpdates.map(update => ({
      updateOne: {
        filter: { slug: safeEquals(update.slug) },
        update: { $set: update.data }
      }
    }));

    await OrgQuestion.bulkWrite(bulkOps);
    revalidatePath('/staff/organization-feedback-questions');
  } catch (error) {
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}
