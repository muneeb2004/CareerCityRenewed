'use server';

import dbConnect from '@/lib/db';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';
import { StudentFeedback, OrgFeedback } from '@/models/Feedback';
import { VolunteerQuestion, OrgQuestion } from '@/models/Question';
import { Volunteer } from '@/models/Volunteer';
import { getStaffSession } from '@/lib/auth';
import { 
  generateStallVisitsExcel, 
  generateStudentFeedbackExcel, 
  generateOrganizationFeedbackExcel,
  generateVolunteerCollectionExcel
} from '@/lib/excel-export';
import { logUnhandledError } from '@/lib/security-logger';

// Helper to serialize responses from MongoDB Map to plain object
function serializeResponses(responses: Map<string, any> | Record<string, any>): Record<string, any> {
  if (responses instanceof Map) {
    const obj: Record<string, any> = {};
    responses.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return responses || {};
}

/**
 * Generate and return Excel file for stall visits
 * Returns base64 encoded Excel file
 */
export async function exportStallVisits(): Promise<{ 
  success: boolean; 
  data?: string; 
  filename?: string;
  error?: string 
}> {
  try {
    // Check staff authentication
    const session = await getStaffSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Staff login required' };
    }

    await dbConnect();

    // Fetch all students with their visited stalls
    const students = await Student.find({})
      .select('studentId fullName email visitedStalls')
      .lean();

    // Fetch all organizations
    const organizations = await Organization.find({})
      .select('organizationId name boothNumber')
      .sort({ boothNumber: 1 })
      .lean();

    if (students.length === 0) {
      return { success: false, error: 'No student data available for export' };
    }

    // Generate Excel file
    const excelBuffer = generateStallVisitsExcel(
      students.map(s => ({
        studentId: s.studentId,
        fullName: s.fullName,
        email: s.email,
        visitedStalls: s.visitedStalls || [],
      })),
      organizations.map(o => ({
        organizationId: o.organizationId,
        name: o.name,
        boothNumber: o.boothNumber,
      }))
    );

    // Convert to base64 for transmission
    const base64 = excelBuffer.toString('base64');
    const timestamp = new Date().toISOString().split('T')[0];
    
    return { 
      success: true, 
      data: base64,
      filename: `stall-visits-${timestamp}.xlsx`
    };

  } catch (error) {
    console.error('Error exporting stall visits:', error);
    await logUnhandledError(error instanceof Error ? error : new Error(String(error)), 'exportStallVisits');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to export stall visits' 
    };
  }
}

/**
 * Generate and return Excel file for student feedback responses
 * Returns base64 encoded Excel file
 */
export async function exportStudentFeedback(): Promise<{ 
  success: boolean; 
  data?: string; 
  filename?: string;
  error?: string 
}> {
  try {
    // Check staff authentication
    const session = await getStaffSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Staff login required' };
    }

    await dbConnect();

    // Fetch all student feedback
    const feedbacks = await StudentFeedback.find({}).lean();

    // Fetch all volunteer questions (used for student feedback)
    const questions = await VolunteerQuestion.find({})
      .sort({ order: 1 })
      .lean();

    // Fetch student details for enrichment
    const studentIds = feedbacks.map(f => f.studentId).filter(Boolean);
    const students = await Student.find({ studentId: { $in: studentIds } })
      .select('studentId fullName email')
      .lean();
    
    const studentMap = new Map(students.map(s => [s.studentId, s]));

    if (feedbacks.length === 0) {
      return { success: false, error: 'No student feedback data available for export' };
    }

    // Generate Excel file
    const excelBuffer = generateStudentFeedbackExcel(
      feedbacks.map(f => {
        const student = studentMap.get(f.studentId || '');
        return {
          studentId: f.studentId || 'Unknown',
          studentName: student?.fullName,
          studentEmail: student?.email,
          timestamp: f.timestamp,
          responses: serializeResponses(f.responses),
        };
      }),
      questions.map(q => ({
        questionId: q.slug,
        text: q.text,
        type: q.type,
      }))
    );

    // Convert to base64 for transmission
    const base64 = excelBuffer.toString('base64');
    const timestamp = new Date().toISOString().split('T')[0];
    
    return { 
      success: true, 
      data: base64,
      filename: `student-feedback-${timestamp}.xlsx`
    };

  } catch (error) {
    console.error('Error exporting student feedback:', error);
    await logUnhandledError(error instanceof Error ? error : new Error(String(error)), 'exportStudentFeedback');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to export student feedback' 
    };
  }
}

/**
 * Generate and return Excel file for organization feedback responses
 * Returns base64 encoded Excel file
 */
export async function exportOrganizationFeedback(): Promise<{ 
  success: boolean; 
  data?: string; 
  filename?: string;
  error?: string 
}> {
  try {
    // Check staff authentication
    const session = await getStaffSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Staff login required' };
    }

    await dbConnect();

    // Fetch all organization feedback
    const feedbacks = await OrgFeedback.find({}).lean();

    // Fetch organization feedback questions
    const questions = await OrgQuestion.find({})
      .sort({ order: 1 })
      .lean();

    // Fetch organization details for enrichment
    const orgIds = feedbacks.map(f => f.organizationId).filter(Boolean);
    const organizations = await Organization.find({ organizationId: { $in: orgIds } })
      .select('organizationId name')
      .lean();
    
    const orgMap = new Map(organizations.map(o => [o.organizationId, o]));

    if (feedbacks.length === 0) {
      return { success: false, error: 'No organization feedback data available for export' };
    }

    // Generate Excel file
    const excelBuffer = generateOrganizationFeedbackExcel(
      feedbacks.map(f => {
        const org = orgMap.get(f.organizationId || '');
        return {
          organizationId: f.organizationId || 'Unknown',
          organizationName: org?.name,
          timestamp: f.timestamp,
          responses: serializeResponses(f.responses),
        };
      }),
      questions.map(q => ({
        questionId: q.slug,
        text: q.text,
        type: q.type,
      }))
    );

    // Convert to base64 for transmission
    const base64 = excelBuffer.toString('base64');
    const timestamp = new Date().toISOString().split('T')[0];
    
    return { 
      success: true, 
      data: base64,
      filename: `organization-feedback-${timestamp}.xlsx`
    };

  } catch (error) {
    console.error('Error exporting organization feedback:', error);
    await logUnhandledError(error instanceof Error ? error : new Error(String(error)), 'exportOrganizationFeedback');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to export organization feedback' 
    };
  }
}

/**
 * Generate and return Excel file for volunteer feedback collection tracking
 * Returns base64 encoded Excel file showing which volunteers collected feedback from which students/organizations
 */
export async function exportVolunteerCollection(): Promise<{ 
  success: boolean; 
  data?: string; 
  filename?: string;
  error?: string 
}> {
  try {
    // Check staff authentication
    const session = await getStaffSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Staff login required' };
    }

    await dbConnect();

    // Fetch all volunteers
    const volunteers = await Volunteer.find({})
      .select('volunteerId name email role')
      .lean();

    // Fetch all student feedback with collectedBy info
    const studentFeedbacks = await StudentFeedback.find({})
      .select('studentId collectedBy')
      .lean();

    // Fetch all organization feedback with collectedBy info
    const orgFeedbacks = await OrgFeedback.find({})
      .select('organizationId collectedBy')
      .lean();

    // Fetch student details for enrichment
    const studentIds = studentFeedbacks.map(f => f.studentId).filter(Boolean);
    const students = await Student.find({ studentId: { $in: studentIds } })
      .select('studentId fullName')
      .lean();
    const studentMap = new Map(students.map(s => [s.studentId, s]));

    // Fetch organization details for enrichment
    const orgIds = orgFeedbacks.map(f => f.organizationId).filter(Boolean);
    const organizations = await Organization.find({ organizationId: { $in: orgIds } })
      .select('organizationId name')
      .lean();
    const orgMap = new Map(organizations.map(o => [o.organizationId, o]));

    if (volunteers.length === 0) {
      return { success: false, error: 'No volunteer data available for export' };
    }

    // Generate Excel file
    const excelBuffer = generateVolunteerCollectionExcel(
      volunteers.map(v => ({
        volunteerId: v.volunteerId,
        name: v.name,
        email: v.email,
        role: v.role,
      })),
      studentFeedbacks.map(f => {
        const student = studentMap.get(f.studentId || '');
        return {
          studentId: f.studentId || 'Unknown',
          studentName: student?.fullName,
          collectedBy: f.collectedBy,
        };
      }),
      orgFeedbacks.map(f => {
        const org = orgMap.get(f.organizationId || '');
        return {
          organizationId: f.organizationId || 'Unknown',
          organizationName: org?.name,
          collectedBy: f.collectedBy,
        };
      })
    );

    // Convert to base64 for transmission
    const base64 = excelBuffer.toString('base64');
    const timestamp = new Date().toISOString().split('T')[0];
    
    return { 
      success: true, 
      data: base64,
      filename: `volunteer-collection-${timestamp}.xlsx`
    };

  } catch (error) {
    console.error('Error exporting volunteer collection:', error);
    await logUnhandledError(error instanceof Error ? error : new Error(String(error)), 'exportVolunteerCollection');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to export volunteer collection data' 
    };
  }
}

/**
 * Export all analytics data as a combined download
 * Returns an array of base64 encoded files
 */
export async function exportAllAnalytics(): Promise<{
  success: boolean;
  files?: Array<{ data: string; filename: string }>;
  error?: string;
}> {
  try {
    // Check staff authentication
    const session = await getStaffSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: Staff login required' };
    }

    const files: Array<{ data: string; filename: string }> = [];

    // Export stall visits
    const stallVisitsResult = await exportStallVisits();
    if (stallVisitsResult.success && stallVisitsResult.data) {
      files.push({
        data: stallVisitsResult.data,
        filename: stallVisitsResult.filename!,
      });
    }

    // Export student feedback
    const studentFeedbackResult = await exportStudentFeedback();
    if (studentFeedbackResult.success && studentFeedbackResult.data) {
      files.push({
        data: studentFeedbackResult.data,
        filename: studentFeedbackResult.filename!,
      });
    }

    // Export organization feedback
    const orgFeedbackResult = await exportOrganizationFeedback();
    if (orgFeedbackResult.success && orgFeedbackResult.data) {
      files.push({
        data: orgFeedbackResult.data,
        filename: orgFeedbackResult.filename!,
      });
    }

    // Export volunteer collection tracking
    const volunteerCollectionResult = await exportVolunteerCollection();
    if (volunteerCollectionResult.success && volunteerCollectionResult.data) {
      files.push({
        data: volunteerCollectionResult.data,
        filename: volunteerCollectionResult.filename!,
      });
    }

    if (files.length === 0) {
      return { success: false, error: 'No data available for export' };
    }

    return { success: true, files };

  } catch (error) {
    console.error('Error exporting all analytics:', error);
    await logUnhandledError(error instanceof Error ? error : new Error(String(error)), 'exportAllAnalytics');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to export analytics' 
    };
  }
}
