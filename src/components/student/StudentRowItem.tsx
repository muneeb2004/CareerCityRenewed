'use client';

import React from 'react';
import { Student } from '@/types';

interface StudentRowItemProps {
  student: Student;
  isSelected: boolean;
  hasFeedback: boolean;
  onSelect: (student: Student) => void;
  style?: React.CSSProperties;
}

/**
 * Memoized StudentRowItem component for virtualized student lists.
 * Only re-renders when student data, selection state, or feedback status changes.
 */
export const StudentRowItem = React.memo(function StudentRowItem({
  student,
  isSelected,
  hasFeedback,
  onSelect,
  style,
}: StudentRowItemProps) {
  return (
    <div style={{ ...style, paddingBottom: '8px' }}>
      <div
        onClick={() => onSelect(student)}
        className={`p-4 rounded-xl border cursor-pointer h-full transition-all duration-200 ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="truncate">
            <div className="font-bold text-gray-800 truncate">
              {student.fullName || 'No Name'}
            </div>
            <div className="text-sm text-gray-500">
              ID: {student.studentId}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {student.email}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm">
              <span className="font-semibold text-blue-600">
                {student.visitedStalls?.length || 0}
              </span>{' '}
              <span className="text-gray-500">visits</span>
            </div>
            {hasFeedback && (
              <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full mt-1">
                Feedback ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific fields change
  return (
    prevProps.student.studentId === nextProps.student.studentId &&
    prevProps.student.fullName === nextProps.student.fullName &&
    prevProps.student.email === nextProps.student.email &&
    prevProps.student.visitedStalls?.length === nextProps.student.visitedStalls?.length &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.hasFeedback === nextProps.hasFeedback
  );
});

export default StudentRowItem;
