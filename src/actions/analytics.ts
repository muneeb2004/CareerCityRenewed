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
    const avgScansPerStudent = totalStudents > 0 ? Math.round((totalScans / totalStudents) * 10) / 10 : 0;
    const studentFeedbackCount = studentFeedbacks.length;
    const orgFeedbackCount = orgFeedbacks.length;
    const studentFeedbackRate = totalStudents > 0 ? Math.round((studentFeedbackCount / totalStudents) * 100) : 0;
    const orgFeedbackRate = totalOrganizations > 0 ? Math.round((orgFeedbackCount / totalOrganizations) * 100) : 0;

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
    const engagementMap: Record<number, number> = {};
    students.forEach(student => {
      const stallCount = student.visitedStalls?.length || 0;
      // Group 5+ together
      const bucket = stallCount >= 5 ? 5 : stallCount;
      engagementMap[bucket] = (engagementMap[bucket] || 0) + 1;
    });
    
    const engagementDistribution: EngagementDistribution[] = [0, 1, 2, 3, 4, 5].map(num => ({
      stallsVisited: num,
      studentCount: engagementMap[num] || 0,
    }));

    // === HOURLY ACTIVITY ===
    const hourlyMap: Record<string, { scans: number; students: Set<string> }> = {};
    scans.forEach(scan => {
      const date = new Date(scan.timestamp);
      const hour = date.toLocaleTimeString([], { hour: '2-digit', hour12: true });
      
      if (!hourlyMap[hour]) {
        hourlyMap[hour] = { scans: 0, students: new Set() };
      }
      hourlyMap[hour].scans++;
      hourlyMap[hour].students.add(scan.studentId);
    });

    const hourlyActivity: HourlyActivity[] = Object.entries(hourlyMap)
      .map(([hour, data]) => ({
        hour,
        scans: data.scans,
        uniqueStudents: data.students.size,
      }))
      .sort((a, b) => {
        // Sort by hour chronologically
        const parseHour = (h: string) => {
          const match = h.match(/(\d+)\s*(AM|PM)/i);
          if (!match) return 0;
          let hour = parseInt(match[1]);
          if (match[2].toUpperCase() === 'PM' && hour !== 12) hour += 12;
          if (match[2].toUpperCase() === 'AM' && hour === 12) hour = 0;
          return hour;
        };
        return parseHour(a.hour) - parseHour(b.hour);
      });

    // === VOLUNTEER PERFORMANCE ===
    const volunteerStatsMap: Record<string, { student: number; org: number }> = {};
    
    studentFeedbacks.forEach(f => {
      const collectedBy = f.collectedBy?.toLowerCase();
      if (collectedBy) {
        if (!volunteerStatsMap[collectedBy]) {
          volunteerStatsMap[collectedBy] = { student: 0, org: 0 };
        }
        volunteerStatsMap[collectedBy].student++;
      }
    });

    orgFeedbacks.forEach(f => {
      const collectedBy = f.collectedBy?.toLowerCase();
      if (collectedBy) {
        if (!volunteerStatsMap[collectedBy]) {
          volunteerStatsMap[collectedBy] = { student: 0, org: 0 };
        }
        volunteerStatsMap[collectedBy].org++;
      }
    });

    const volunteerPerformance: VolunteerPerformance[] = volunteers
      .map(v => {
        const stats = volunteerStatsMap[v.volunteerId.toLowerCase()] || { student: 0, org: 0 };
        return {
          volunteerId: v.volunteerId,
          name: v.name,
          role: v.role,
          studentFeedbackCount: stats.student,
          orgFeedbackCount: stats.org,
          totalCollected: stats.student + stats.org,
        };
      })
      .sort((a, b) => b.totalCollected - a.totalCollected);

    // === RECENT SCANS (last 10) ===
    const recentScans = scans.slice(0, 10).map(scan => ({
      studentId: scan.studentId,
      organizationName: scan.organizationName || 'Unknown',
      timestamp: new Date(scan.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }),
    }));

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
