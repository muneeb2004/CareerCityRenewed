import * as XLSX from 'xlsx';

/**
 * Excel Export Utilities for Career City Analytics
 * Generates Excel files for stall visits and feedback responses
 */

export interface StallVisitRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  [stallName: string]: string; // Dynamic columns for each stall
}

export interface FeedbackRow {
  id: string;
  name: string;
  email?: string;
  timestamp: string;
  [questionText: string]: string | number | undefined; // Dynamic columns for each question
}

/**
 * Generate Excel workbook for stall visits matrix
 * Rows = Students, Columns = Stalls, Cells = "visited" or blank
 */
export function generateStallVisitsExcel(
  students: Array<{
    studentId: string;
    fullName: string;
    email: string;
    visitedStalls: string[];
  }>,
  organizations: Array<{
    organizationId: string;
    name: string;
    boothNumber: string;
  }>
): Buffer {
  // Create header row with student info + all organization names
  const headers = [
    'Student ID',
    'Student Name',
    'Email',
    'Total Visits',
    ...organizations.map(org => `${org.name} (Booth ${org.boothNumber})`)
  ];

  // Create data rows
  const rows = students.map(student => {
    const visitedSet = new Set(student.visitedStalls);
    const totalVisits = student.visitedStalls.length;
    
    return [
      student.studentId,
      student.fullName,
      student.email,
      totalVisits,
      ...organizations.map(org => 
        visitedSet.has(org.organizationId) ? 'visited' : ''
      )
    ];
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  const colWidths = [
    { wch: 15 },  // Student ID
    { wch: 25 },  // Student Name
    { wch: 30 },  // Email
    { wch: 12 },  // Total Visits
    ...organizations.map(() => ({ wch: 20 })) // Organization columns
  ];
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stall Visits');

  // Add summary sheet
  const summaryData = [
    ['Summary Statistics'],
    [''],
    ['Total Students', students.length],
    ['Total Organizations', organizations.length],
    ['Total Visits', students.reduce((sum, s) => sum + s.visitedStalls.length, 0)],
    [''],
    ['Organization', 'Booth #', 'Visitor Count'],
    ...organizations.map(org => {
      const visitorCount = students.filter(s => 
        s.visitedStalls.includes(org.organizationId)
      ).length;
      return [org.name, org.boothNumber, visitorCount];
    })
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Write to buffer
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Generate Excel workbook for student feedback responses
 * Rows = Students, Columns = Questions, Cells = Responses
 */
export function generateStudentFeedbackExcel(
  feedbacks: Array<{
    studentId: string;
    studentName?: string;
    studentEmail?: string;
    timestamp: Date | string;
    responses: Record<string, string | number | string[]>;
  }>,
  questions: Array<{
    questionId: string;
    text: string;
    type: string;
  }>
): Buffer {
  // Create header row
  const headers = [
    'Student ID',
    'Student Name',
    'Email',
    'Submission Time',
    ...questions.map(q => q.text)
  ];

  // Create data rows
  const rows = feedbacks.map(feedback => {
    const timestamp = feedback.timestamp instanceof Date 
      ? feedback.timestamp.toLocaleString()
      : new Date(feedback.timestamp).toLocaleString();

    return [
      feedback.studentId,
      feedback.studentName || 'N/A',
      feedback.studentEmail || 'N/A',
      timestamp,
      ...questions.map(q => formatResponseValue(feedback.responses[q.questionId]))
    ];
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  const colWidths = [
    { wch: 15 },  // Student ID
    { wch: 25 },  // Student Name
    { wch: 30 },  // Email
    { wch: 20 },  // Timestamp
    ...questions.map(() => ({ wch: 35 })) // Question columns
  ];
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Feedback');

  // Add summary statistics sheet
  const questionStats = questions.map(q => {
    const responses = feedbacks.map(f => f.responses[q.questionId]).filter(Boolean);
    return calculateQuestionStats(q, responses);
  });

  const summaryData = [
    ['Feedback Summary'],
    [''],
    ['Total Responses', feedbacks.length],
    [''],
    ['Question', 'Response Count', 'Statistics'],
    ...questionStats.map(stat => [stat.question, stat.count, stat.stats])
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 50 }, { wch: 15 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Generate Excel workbook for organization feedback responses
 * Rows = Organizations, Columns = Questions, Cells = Responses
 */
export function generateOrganizationFeedbackExcel(
  feedbacks: Array<{
    organizationId: string;
    organizationName?: string;
    timestamp: Date | string;
    responses: Record<string, string | number | string[]>;
  }>,
  questions: Array<{
    questionId: string;
    text: string;
    type: string;
  }>
): Buffer {
  // Create header row
  const headers = [
    'Organization ID',
    'Organization Name',
    'Submission Time',
    ...questions.map(q => q.text)
  ];

  // Create data rows
  const rows = feedbacks.map(feedback => {
    const timestamp = feedback.timestamp instanceof Date 
      ? feedback.timestamp.toLocaleString()
      : new Date(feedback.timestamp).toLocaleString();

    return [
      feedback.organizationId,
      feedback.organizationName || 'N/A',
      timestamp,
      ...questions.map(q => formatResponseValue(feedback.responses[q.questionId]))
    ];
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  const colWidths = [
    { wch: 20 },  // Organization ID
    { wch: 35 },  // Organization Name
    { wch: 20 },  // Timestamp
    ...questions.map(() => ({ wch: 35 })) // Question columns
  ];
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Organization Feedback');

  // Add summary sheet
  const questionStats = questions.map(q => {
    const responses = feedbacks.map(f => f.responses[q.questionId]).filter(Boolean);
    return calculateQuestionStats(q, responses);
  });

  const summaryData = [
    ['Organization Feedback Summary'],
    [''],
    ['Total Responses', feedbacks.length],
    [''],
    ['Question', 'Response Count', 'Statistics'],
    ...questionStats.map(stat => [stat.question, stat.count, stat.stats])
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 50 }, { wch: 15 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Format response value for display in Excel cell
 */
function formatResponseValue(value: string | number | string[] | undefined): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * Calculate statistics for a question based on responses
 */
function calculateQuestionStats(
  question: { questionId: string; text: string; type: string },
  responses: (string | number | string[])[]
): { question: string; count: number; stats: string } {
  const count = responses.length;
  
  if (count === 0) {
    return { question: question.text, count: 0, stats: 'No responses' };
  }

  // For numeric/range questions, calculate average
  if (question.type === 'range' || question.type === 'number' || question.type === 'scale_text') {
    const numericResponses = responses
      .map(r => typeof r === 'number' ? r : parseFloat(String(r)))
      .filter(n => !isNaN(n));
    
    if (numericResponses.length > 0) {
      const avg = numericResponses.reduce((a, b) => a + b, 0) / numericResponses.length;
      const min = Math.min(...numericResponses);
      const max = Math.max(...numericResponses);
      return { 
        question: question.text, 
        count, 
        stats: `Avg: ${avg.toFixed(2)}, Min: ${min}, Max: ${max}` 
      };
    }
  }

  // For multiple choice questions, show distribution
  if (question.type === 'multiplechoice' || question.type === 'checkbox') {
    const distribution: Record<string, number> = {};
    responses.forEach(r => {
      const values = Array.isArray(r) ? r : [String(r)];
      values.forEach(v => {
        distribution[v] = (distribution[v] || 0) + 1;
      });
    });
    
    const topResponses = Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([val, cnt]) => `${val}: ${cnt}`)
      .join('; ');
    
    return { question: question.text, count, stats: topResponses || 'N/A' };
  }

  return { question: question.text, count, stats: `${count} responses` };
}

/**
 * Generate Excel workbook for volunteer feedback collection tracking
 * Rows = Volunteers, Columns = Students/Organizations, Cells = "collected" or blank
 */
export function generateVolunteerCollectionExcel(
  volunteers: Array<{
    volunteerId: string;
    name: string;
    email?: string;
    role: string;
  }>,
  studentFeedbacks: Array<{
    studentId: string;
    studentName?: string;
    collectedBy?: string;
  }>,
  orgFeedbacks: Array<{
    organizationId: string;
    organizationName?: string;
    collectedBy?: string;
  }>
): Buffer {
  // Create workbook
  const workbook = XLSX.utils.book_new();

  // ============================================
  // Sheet 1: Student Feedback Collection Matrix
  // ============================================
  
  // Get unique students who have feedback
  const uniqueStudents = Array.from(
    new Map(studentFeedbacks.map(f => [f.studentId, f])).values()
  );

  // Create header row for student sheet
  const studentHeaders = [
    'Volunteer ID',
    'Volunteer Name',
    'Email',
    'Role',
    'Total Students Collected',
    ...uniqueStudents.map(s => s.studentName || s.studentId)
  ];

  // Create data rows for student collection
  const studentRows = volunteers.map(volunteer => {
    const collectedStudents = studentFeedbacks
      .filter(f => f.collectedBy?.toLowerCase() === volunteer.volunteerId.toLowerCase())
      .map(f => f.studentId);
    
    const collectedSet = new Set(collectedStudents);
    
    return [
      volunteer.volunteerId,
      volunteer.name,
      volunteer.email || '',
      volunteer.role,
      collectedStudents.length,
      ...uniqueStudents.map(s => collectedSet.has(s.studentId) ? 'collected' : '')
    ];
  });

  const studentSheet = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
  studentSheet['!cols'] = [
    { wch: 15 },  // Volunteer ID
    { wch: 25 },  // Name
    { wch: 30 },  // Email
    { wch: 10 },  // Role
    { wch: 20 },  // Total Collected
    ...uniqueStudents.map(() => ({ wch: 20 }))
  ];
  XLSX.utils.book_append_sheet(workbook, studentSheet, 'Student Collection');

  // ============================================
  // Sheet 2: Organization Feedback Collection Matrix
  // ============================================
  
  // Get unique organizations who have feedback
  const uniqueOrgs = Array.from(
    new Map(orgFeedbacks.map(f => [f.organizationId, f])).values()
  );

  // Create header row for org sheet
  const orgHeaders = [
    'Volunteer ID',
    'Volunteer Name',
    'Email',
    'Role',
    'Total Orgs Collected',
    ...uniqueOrgs.map(o => o.organizationName || o.organizationId)
  ];

  // Create data rows for org collection
  const orgRows = volunteers.map(volunteer => {
    const collectedOrgs = orgFeedbacks
      .filter(f => f.collectedBy?.toLowerCase() === volunteer.volunteerId.toLowerCase())
      .map(f => f.organizationId);
    
    const collectedSet = new Set(collectedOrgs);
    
    return [
      volunteer.volunteerId,
      volunteer.name,
      volunteer.email || '',
      volunteer.role,
      collectedOrgs.length,
      ...uniqueOrgs.map(o => collectedSet.has(o.organizationId) ? 'collected' : '')
    ];
  });

  const orgSheet = XLSX.utils.aoa_to_sheet([orgHeaders, ...orgRows]);
  orgSheet['!cols'] = [
    { wch: 15 },  // Volunteer ID
    { wch: 25 },  // Name
    { wch: 30 },  // Email
    { wch: 10 },  // Role
    { wch: 20 },  // Total Collected
    ...uniqueOrgs.map(() => ({ wch: 25 }))
  ];
  XLSX.utils.book_append_sheet(workbook, orgSheet, 'Organization Collection');

  // ============================================
  // Sheet 3: Summary Statistics
  // ============================================
  
  const volunteerStats = volunteers.map(v => {
    const studentCount = studentFeedbacks.filter(
      f => f.collectedBy?.toLowerCase() === v.volunteerId.toLowerCase()
    ).length;
    const orgCount = orgFeedbacks.filter(
      f => f.collectedBy?.toLowerCase() === v.volunteerId.toLowerCase()
    ).length;
    return {
      id: v.volunteerId,
      name: v.name,
      role: v.role,
      studentCount,
      orgCount,
      total: studentCount + orgCount,
    };
  }).sort((a, b) => b.total - a.total);

  const summaryData = [
    ['Volunteer Feedback Collection Summary'],
    [''],
    ['Overall Statistics'],
    ['Total Volunteers', volunteers.length],
    ['Total Student Feedbacks', studentFeedbacks.length],
    ['Total Organization Feedbacks', orgFeedbacks.length],
    [''],
    ['Volunteer Performance'],
    ['Volunteer ID', 'Name', 'Role', 'Students', 'Organizations', 'Total'],
    ...volunteerStats.map(v => [v.id, v.name, v.role, v.studentCount, v.orgCount, v.total]),
    [''],
    ['Coverage'],
    ['Students with feedback collected', uniqueStudents.length],
    ['Organizations with feedback collected', uniqueOrgs.length],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
