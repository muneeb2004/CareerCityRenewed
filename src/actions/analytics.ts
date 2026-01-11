'use server';

import dbConnect from '@/lib/db';
import { Student } from '@/models/Student';
import { Organization } from '@/models/Organization';
import { Volunteer } from '@/models/Volunteer';
import { Scan } from '@/models/Scan';
import { StudentFeedback, OrgFeedback } from '@/models/Feedback';
import { getStaffSession } from '@/lib/auth';

export interface AnalyticsSummary {
  totalStudents: number;
  totalScans: number;
  totalOrganizations: number;
  activeVolunteers: number;
  avgScansPerStudent: number;
  studentFeedbackCount: number;
  orgFeedbackCount: number;
  studentFeedbackRate: number;
  orgFeedbackRate: number;
}

export interface OrganizationVisits {
  organizationId: string;
  name: string;
  boothNumber: string;
  visitorCount: number;
}

export interface EngagementDistribution {
  stallsVisited: number;
  studentCount: number;
}

export interface HourlyActivity {
  hour: string;
  scans: number;
  uniqueStudents: number;
}

export interface VolunteerPerformance {
  volunteerId: string;
  name: string;
  role: string;
  studentFeedbackCount: number;
  orgFeedbackCount: number;
  totalCollected: number;
}

export interface AnalyticsDashboardData {
  summary: AnalyticsSummary;
  organizationVisits: OrganizationVisits[];
  engagementDistribution: EngagementDistribution[];
  hourlyActivity: HourlyActivity[];
  volunteerPerformance: VolunteerPerformance[];
  recentScans: Array<{
    studentId: string;
    organizationName: string;
    timestamp: string;
  }>;
}

/**
 * Get comprehensive analytics data for the dashboard
 */
export async function getAnalyticsDashboardData(): Promise<AnalyticsDashboardData> {
  await dbConnect();

  try {
    // Fetch all data in parallel for efficiency
    const [
      students,
      organizations,
      volunteers,
      scans,
      studentFeedbacks,
      orgFeedbacks,
    ] = await Promise.all([
      Student.find({}).select('studentId visitedStalls scanCount feedbackSubmitted').lean(),
      Organization.find({}).select('organizationId name boothNumber visitorCount').lean(),
      Volunteer.find({ isActive: true }).select('volunteerId name role').lean(),
      Scan.find({}).sort({ timestamp: -1 }).lean(),
      StudentFeedback.find({}).select('studentId collectedBy').lean(),
      OrgFeedback.find({}).select('organizationId collectedBy').lean(),
    ]);

    // === SUMMARY METRICS ===
    const totalStudents = students.length;
    const totalScans = scans.length;
    const totalOrganizations = organizations.length;
    const activeVolunteers = volunteers.length;
    
    // Safe average calculation - avoid NaN when no students
    const avgScansPerStudent = totalStudents > 0 
      ? Math.round((totalScans / totalStudents) * 10) / 10 
      : 0;
    
    // Count total feedback entries
    const studentFeedbackCount = studentFeedbacks.length;
    const orgFeedbackCount = orgFeedbacks.length;
    
    // Calculate feedback rate based on UNIQUE students/orgs who have given feedback
    // This ensures rate never exceeds 100%
    const uniqueStudentsWithFeedback = new Set(
      studentFeedbacks.map(f => f.studentId).filter(Boolean)
    ).size;
    const uniqueOrgsWithFeedback = new Set(
      orgFeedbacks.map(f => f.organizationId).filter(Boolean)
    ).size;
    
    // Cap rates at 100% as safeguard (should never exceed if data is consistent)
    const studentFeedbackRate = totalStudents > 0 
      ? Math.min(100, Math.round((uniqueStudentsWithFeedback / totalStudents) * 100))
      : 0;
    const orgFeedbackRate = totalOrganizations > 0 
      ? Math.min(100, Math.round((uniqueOrgsWithFeedback / totalOrganizations) * 100))
      : 0;

    // === ORGANIZATION VISITS (sorted by visitor count) ===
    const organizationVisits: OrganizationVisits[] = organizations
      .map(org => ({
        organizationId: org.organizationId,
        name: org.name,
        boothNumber: org.boothNumber,
        visitorCount: org.visitorCount || 0,
      }))
      .sort((a, b) => b.visitorCount - a.visitorCount);

    // === ENGAGEMENT DISTRIBUTION ===
    // Initialize all buckets to 0 to ensure consistent output
    const engagementMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    students.forEach(student => {
      const stallCount = Array.isArray(student.visitedStalls) 
        ? student.visitedStalls.length 
        : 0;
      // Group 5+ together, ensure non-negative
      const bucket = Math.max(0, Math.min(stallCount, 5));
      engagementMap[bucket] = (engagementMap[bucket] || 0) + 1;
    });
    
    const engagementDistribution: EngagementDistribution[] = [0, 1, 2, 3, 4, 5].map(num => ({
      stallsVisited: num,
      studentCount: engagementMap[num] || 0,
    }));

    // === HOURLY ACTIVITY ===
    const hourlyMap: Record<number, { scans: number; students: Set<string> }> = {};
    scans.forEach(scan => {
      if (!scan.timestamp) return; // Skip invalid timestamps
      
      const date = new Date(scan.timestamp);
      // Guard against invalid dates
      if (isNaN(date.getTime())) return;
      
      const hour = date.getHours(); // Use numeric hour (0-23) for reliable sorting
      
      if (!hourlyMap[hour]) {
        hourlyMap[hour] = { scans: 0, students: new Set() };
      }
      hourlyMap[hour].scans++;
      if (scan.studentId) {
        hourlyMap[hour].students.add(scan.studentId);
      }
    });

    // Format hour for display (12-hour format)
    const formatHour = (hour: number): string => {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      if (hour < 12) return `${hour} AM`;
      return `${hour - 12} PM`;
    };

    const hourlyActivity: HourlyActivity[] = Object.entries(hourlyMap)
      .map(([hourStr, data]) => ({
        hour: formatHour(parseInt(hourStr)),
        scans: data.scans,
        uniqueStudents: data.students.size,
      }))
      .sort((a, b) => {
        // Sort by original hour value
        const getHourNum = (h: string) => {
          const match = h.match(/^(\d+)\s*(AM|PM)$/i);
          if (!match) return 0;
          let hour = parseInt(match[1]);
          const isPM = match[2].toUpperCase() === 'PM';
          if (hour === 12) return isPM ? 12 : 0;
          return isPM ? hour + 12 : hour;
        };
        return getHourNum(a.hour) - getHourNum(b.hour);
      });

    // === VOLUNTEER PERFORMANCE ===
    const volunteerStatsMap: Record<string, { student: number; org: number }> = {};
    
    // Initialize stats for all active volunteers to ensure they appear even with 0 feedback
    volunteers.forEach(v => {
      const id = v.volunteerId?.toLowerCase()?.trim();
      if (id) {
        volunteerStatsMap[id] = { student: 0, org: 0 };
      }
    });

    studentFeedbacks.forEach(f => {
      const collectedBy = f.collectedBy?.toLowerCase()?.trim();
      if (collectedBy) {
        if (!volunteerStatsMap[collectedBy]) {
          volunteerStatsMap[collectedBy] = { student: 0, org: 0 };
        }
        volunteerStatsMap[collectedBy].student++;
      }
    });

    orgFeedbacks.forEach(f => {
      const collectedBy = f.collectedBy?.toLowerCase()?.trim();
      if (collectedBy) {
        if (!volunteerStatsMap[collectedBy]) {
          volunteerStatsMap[collectedBy] = { student: 0, org: 0 };
        }
        volunteerStatsMap[collectedBy].org++;
      }
    });

    const volunteerPerformance: VolunteerPerformance[] = volunteers
      .filter(v => v.volunteerId) // Ensure volunteer has valid ID
      .map(v => {
        const stats = volunteerStatsMap[v.volunteerId.toLowerCase().trim()] || { student: 0, org: 0 };
        return {
          volunteerId: v.volunteerId,
          name: v.name || 'Unknown',
          role: v.role || 'Member',
          studentFeedbackCount: stats.student,
          orgFeedbackCount: stats.org,
          totalCollected: stats.student + stats.org,
        };
      })
      .sort((a, b) => b.totalCollected - a.totalCollected);

    // === RECENT SCANS (last 10) ===
    const recentScans = scans
      .filter(scan => scan.timestamp && scan.studentId) // Filter out invalid entries
      .slice(0, 10)
      .map(scan => {
        const date = new Date(scan.timestamp);
        const isValidDate = !isNaN(date.getTime());
        
        return {
          studentId: scan.studentId || 'Unknown',
          organizationName: scan.organizationName || 'Unknown',
          timestamp: isValidDate 
            ? date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })
            : 'Unknown time',
        };
      });

    return {
      summary: {
        totalStudents,
        totalScans,
        totalOrganizations,
        activeVolunteers,
        avgScansPerStudent,
        studentFeedbackCount,
        orgFeedbackCount,
        studentFeedbackRate,
        orgFeedbackRate,
      },
      organizationVisits,
      engagementDistribution,
      hourlyActivity,
      volunteerPerformance,
      recentScans,
    };

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    // Return empty data on error
    return {
      summary: {
        totalStudents: 0,
        totalScans: 0,
        totalOrganizations: 0,
        activeVolunteers: 0,
        avgScansPerStudent: 0,
        studentFeedbackCount: 0,
        orgFeedbackCount: 0,
        studentFeedbackRate: 0,
        orgFeedbackRate: 0,
      },
      organizationVisits: [],
      engagementDistribution: [],
      hourlyActivity: [],
      volunteerPerformance: [],
      recentScans: [],
    };
  }
}
