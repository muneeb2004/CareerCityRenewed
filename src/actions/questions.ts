'use server';

import dbConnect from '@/lib/db';
import { VolunteerQuestion, OrgQuestion, IQuestion } from '@/models/Question';
import { revalidatePath } from 'next/cache';

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
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// --- Volunteer Questions ---

export async function createVolunteerQuestion(question: Omit<IQuestion, 'slug'>): Promise<string> {
  await dbConnect();
  
  const slug = createSlug(question.text) || `question-${Date.now()}`;
  
  try {
    await VolunteerQuestion.findOneAndUpdate(
      { slug }, 
      { ...question, slug }, 
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    revalidatePath('/staff/student-questions');
    return slug;
  } catch (error) {
    console.error('Error creating volunteer question:', error);
    throw error;
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
    await VolunteerQuestion.findOneAndUpdate({ slug }, data);
    revalidatePath('/staff/student-questions');
  } catch (error) {
    console.error('Error updating volunteer question:', error);
    throw error;
  }
}

export async function deleteVolunteerQuestion(slug: string): Promise<void> {
  await dbConnect();
  
  try {
    await VolunteerQuestion.findOneAndDelete({ slug });
    revalidatePath('/staff/student-questions');
  } catch (error) {
    console.error('Error deleting volunteer question:', error);
    throw error;
  }
}

// --- Organization Feedback Questions ---

export async function createOrganizationFeedbackQuestion(question: Omit<IQuestion, 'slug'>): Promise<string> {
  await dbConnect();

  const slug = createSlug(question.text) || `question-${Date.now()}`;

  try {
    await OrgQuestion.findOneAndUpdate(
      { slug },
      { ...question, slug },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    revalidatePath('/staff/organization-feedback-questions');
    return slug;
  } catch (error) {
    console.error('Error creating org question:', error);
    throw error;
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
    await OrgQuestion.findOneAndUpdate({ slug }, data);
    revalidatePath('/staff/organization-feedback-questions');
  } catch (error) {
    console.error('Error updating org question:', error);
    throw error;
  }
}

export async function deleteOrganizationFeedbackQuestion(slug: string): Promise<void> {
  await dbConnect();
  
  try {
    await OrgQuestion.findOneAndDelete({ slug });
    revalidatePath('/staff/organization-feedback-questions');
  } catch (error) {
    console.error('Error deleting org question:', error);
    throw error;
  }
}
