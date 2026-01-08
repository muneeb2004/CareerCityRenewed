'use server';

import dbConnect from '@/lib/db';
import { Volunteer, IVolunteer } from '@/models/Volunteer';
import { StudentFeedback, OrgFeedback } from '@/models/Feedback';
import { handleError } from '@/lib/error-handler';
import { safeEquals } from '@/lib/sanitize';

// --- Volunteer Validation & Retrieval ---

export interface ValidateVolunteerResult {
  success: boolean;
  volunteer?: {
    volunteerId: string;
    name: string;
    role: 'Captain' | 'Member';
  };
  error?: string;
}

/**
 * Validate a volunteer ID and return their details if valid
 */
export async function validateVolunteer(volunteerId: string): Promise<ValidateVolunteerResult> {
  await dbConnect();

  try {
    const trimmedId = volunteerId.toLowerCase().trim();
    
    if (!trimmedId) {
      return { success: false, error: 'Volunteer ID is required' };
    }

    const volunteer = await Volunteer.findOne({ 
      volunteerId: safeEquals(trimmedId),
      isActive: true 
    }).lean() as IVolunteer | null;

    if (!volunteer) {
      return { success: false, error: 'Volunteer ID not found or inactive' };
    }

    return {
      success: true,
      volunteer: {
        volunteerId: volunteer.volunteerId,
        name: volunteer.name,
        role: volunteer.role,
      },
    };
  } catch (error) {
    console.error('Error validating volunteer:', error);
    const handled = handleError(error);
    return { success: false, error: handled.message };
  }
}

/**
 * Get volunteer by ID (internal use)
 */
export async function getVolunteerById(volunteerId: string): Promise<IVolunteer | null> {
  await dbConnect();

  try {
    const trimmedId = volunteerId.toLowerCase().trim();
    const volunteer = await Volunteer.findOne({ 
      volunteerId: safeEquals(trimmedId) 
    }).lean() as IVolunteer | null;
    
    return volunteer;
  } catch (error) {
    console.error('Error getting volunteer:', error);
    return null;
  }
}

// --- Volunteer Statistics ---

export interface VolunteerStats {
  totalStudentFeedback: number;
  totalOrgFeedback: number;
}

/**
 * Get feedback statistics for a specific volunteer
 */
export async function getVolunteerStats(volunteerId: string): Promise<VolunteerStats> {
  await dbConnect();

  try {
    const trimmedId = volunteerId.toLowerCase().trim();

    // Count student feedback collected by this volunteer
    const studentCount = await StudentFeedback.countDocuments({ 
      collectedBy: safeEquals(trimmedId) 
    });

    // Count organization feedback collected by this volunteer
    const orgCount = await OrgFeedback.countDocuments({ 
      collectedBy: safeEquals(trimmedId) 
    });

    return {
      totalStudentFeedback: studentCount,
      totalOrgFeedback: orgCount,
    };
  } catch (error) {
    console.error('Error getting volunteer stats:', error);
    return {
      totalStudentFeedback: 0,
      totalOrgFeedback: 0,
    };
  }
}

// --- Volunteer Management (for admin use) ---

export interface CreateVolunteerInput {
  volunteerId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: 'Captain' | 'Member';
}

/**
 * Create a new volunteer (admin function)
 */
export async function createVolunteer(input: CreateVolunteerInput): Promise<{ success: boolean; error?: string }> {
  await dbConnect();

  try {
    const { volunteerId, name, email, phone, role = 'Member' } = input;
    
    const trimmedId = volunteerId.toLowerCase().trim();
    
    // Check if volunteer already exists
    const existing = await Volunteer.findOne({ volunteerId: safeEquals(trimmedId) });
    if (existing) {
      return { success: false, error: 'Volunteer ID already exists' };
    }

    await Volunteer.create({
      volunteerId: trimmedId,
      name: name.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      role,
      isActive: true,
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating volunteer:', error);
    const handled = handleError(error);
    return { success: false, error: handled.message };
  }
}

/**
 * Get all volunteers with their stats
 */
export async function getAllVolunteersWithStats(): Promise<Array<{
  volunteerId: string;
  name: string;
  role: 'Captain' | 'Member';
  isActive: boolean;
  stats: VolunteerStats;
}>> {
  await dbConnect();

  try {
    const volunteers = await Volunteer.find({}).lean() as IVolunteer[];
    
    const results = await Promise.all(
      volunteers.map(async (v) => {
        const stats = await getVolunteerStats(v.volunteerId);
        return {
          volunteerId: v.volunteerId,
          name: v.name,
          role: v.role,
          isActive: v.isActive,
          stats,
        };
      })
    );

    return results;
  } catch (error) {
    console.error('Error getting all volunteers:', error);
    return [];
  }
}

/**
 * Toggle volunteer active status
 */
export async function toggleVolunteerStatus(volunteerId: string): Promise<{ success: boolean; isActive?: boolean; error?: string }> {
  await dbConnect();

  try {
    const trimmedId = volunteerId.toLowerCase().trim();
    
    const volunteer = await Volunteer.findOne({ volunteerId: safeEquals(trimmedId) });
    if (!volunteer) {
      return { success: false, error: 'Volunteer not found' };
    }

    volunteer.isActive = !volunteer.isActive;
    await volunteer.save();

    return { success: true, isActive: volunteer.isActive };
  } catch (error) {
    console.error('Error toggling volunteer status:', error);
    const handled = handleError(error);
    return { success: false, error: handled.message };
  }
}
