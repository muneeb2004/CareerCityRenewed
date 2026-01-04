'use client';

import React from 'react';
import { Organization } from '@/types';
import QRCodeGenerator from './QRCodeGenerator';

interface OrganizationCardProps {
  organization: Organization;
  isSelected?: boolean;
  onEdit?: (org: Organization) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  showActions?: boolean;
  selectable?: boolean;
}

/**
 * Memoized OrganizationCard component to prevent unnecessary re-renders
 * in list views. Only re-renders when organization data or selection state changes.
 */
export const OrganizationCard = React.memo(function OrganizationCard({
  organization,
  isSelected = false,
  onEdit,
  onDelete,
  onSelect,
  showActions = true,
  selectable = false,
}: OrganizationCardProps) {
  return (
    <div
      onClick={selectable ? () => onSelect?.(organization.organizationId) : undefined}
      className={`bg-white p-5 rounded-xl border shadow-sm flex flex-col items-center relative group transition-all duration-300 hover:shadow-md hover:border-blue-300 ${
        selectable ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 ring-offset-1'
          : 'border-gray-200'
      }`}
    >
      {/* Selection Checkbox for Bulk QR */}
      {selectable && (
        <div className="w-full flex justify-end">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}} // Handled by parent div
            className="mb-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 pointer-events-none"
          />
        </div>
      )}

      {/* QR Code */}
      <div className={`transform transition-transform ${selectable ? 'scale-90 pointer-events-none' : 'group-hover:scale-105'}`}>
        <QRCodeGenerator organization={organization} />
      </div>

      {/* Organization Info */}
      <div className="mt-4 text-center w-full">
        <h3 className="font-bold text-gray-800 truncate w-full" title={organization.name}>
          {organization.name}
        </h3>

        <div className="flex items-center justify-center gap-2 mt-1 text-xs text-gray-500">
          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium border border-blue-100">
            Booth {organization.boothNumber}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1 truncate">
          {organization.industry}
        </p>
      </div>

      {/* Action Buttons */}
      {showActions && (onEdit || onDelete) && (
        <div className="flex items-center gap-2 mt-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2 bg-white border border-gray-100 p-1 rounded-lg shadow-sm">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(organization);
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(organization.organizationId);
              }}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific fields change
  return (
    prevProps.organization.organizationId === nextProps.organization.organizationId &&
    prevProps.organization.name === nextProps.organization.name &&
    prevProps.organization.boothNumber === nextProps.organization.boothNumber &&
    prevProps.organization.industry === nextProps.organization.industry &&
    prevProps.organization.visitorCount === nextProps.organization.visitorCount &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.selectable === nextProps.selectable
  );
});

export default OrganizationCard;
