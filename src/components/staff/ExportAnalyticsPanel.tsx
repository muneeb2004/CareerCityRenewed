'use client';

import { useState } from 'react';
import { 
  exportStallVisits, 
  exportStudentFeedback, 
  exportOrganizationFeedback,
  exportVolunteerCollection,
  exportAllAnalytics 
} from '@/actions/exports';
import toast from 'react-hot-toast';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => Promise<{ success: boolean; data?: string; filename?: string; error?: string }>;
}

/**
 * Download a base64 encoded file
 */
function downloadBase64File(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function ExportAnalyticsPanel() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportOptions: ExportOption[] = [
    {
      id: 'stall-visits',
      label: 'Stall Visits',
      description: 'Matrix of students vs stalls showing visit status',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
      action: exportStallVisits,
    },
    {
      id: 'student-feedback',
      label: 'Student Feedback',
      description: 'All student feedback responses with questions as columns',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ),
      action: exportStudentFeedback,
    },
    {
      id: 'org-feedback',
      label: 'Organization Feedback',
      description: 'All organization feedback responses with questions as columns',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      action: exportOrganizationFeedback,
    },
    {
      id: 'volunteer-collection',
      label: 'Volunteer Collection',
      description: 'Track which volunteers collected feedback from students/organizations',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      action: exportVolunteerCollection,
    },
  ];

  const handleExport = async (option: ExportOption) => {
    setExporting(option.id);
    const toastId = toast.loading(`Generating ${option.label} export...`);

    try {
      const result = await option.action();
      
      if (result.success && result.data && result.filename) {
        downloadBase64File(result.data, result.filename);
        toast.success(`${option.label} exported successfully!`, { id: toastId });
      } else {
        toast.error(result.error || 'Export failed', { id: toastId });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data. Please try again.', { id: toastId });
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    setExporting('all');
    const toastId = toast.loading('Generating all exports...');

    try {
      const result = await exportAllAnalytics();
      
      if (result.success && result.files) {
        // Download each file with a small delay to avoid browser blocking
        for (let i = 0; i < result.files.length; i++) {
          const file = result.files[i];
          setTimeout(() => {
            downloadBase64File(file.data, file.filename);
          }, i * 500);
        }
        toast.success(`${result.files.length} files exported successfully!`, { id: toastId });
      } else {
        toast.error(result.error || 'Export failed', { id: toastId });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data. Please try again.', { id: toastId });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="card-modern">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Export Analytics</h3>
          <p className="text-gray-500 text-sm mt-1">
            Download Excel files with detailed analytics data
          </p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exporting !== null}
          className="btn-primary flex items-center gap-2"
        >
          {exporting === 'all' ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Export All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {exportOptions.map((option) => (
          <div
            key={option.id}
            className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col h-full"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-800">{option.label}</h4>
                <p className="text-sm text-gray-500 mt-1">{option.description}</p>
              </div>
            </div>
            <button
              onClick={() => handleExport(option)}
              disabled={exporting !== null}
              className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {exporting === option.id ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Excel
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <h4 className="font-medium text-gray-700 mb-2">Export Details:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Stall Visits:</strong> Each row = student, each column = stall, cells show &quot;visited&quot; if student went to that stall</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Feedback:</strong> Each row = student/organization, each column = question, cells contain actual responses</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Volunteer Collection:</strong> Each row = volunteer, each column = student/organization, cells show &quot;collected&quot; if volunteer gathered that feedback</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Summary Sheets:</strong> Each export includes a summary sheet with statistics</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
