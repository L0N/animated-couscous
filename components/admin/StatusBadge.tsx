/**
 * Status Badge Component
 * 
 * Displays loan status with appropriate color coding and styling.
 * Used throughout the admin interface for consistent status display.
 * 
 * Features:
 * - Color-coded status indicators
 * - Consistent styling
 * - Readable status labels
 */

'use client';

interface StatusBadgeProps {
  status: string;
}

const statusConfig = {
  applied: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
  },
  approved: {
    label: 'Approved',
    className: 'bg-blue-100 text-blue-800',
  },
  disbursed: {
    label: 'Disbursed',
    className: 'bg-green-100 text-green-800',
  },
  repaid: {
    label: 'Repaid',
    className: 'bg-gray-100 text-gray-800',
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-red-100 text-red-800',
  },
  defaulted: {
    label: 'Defaulted',
    className: 'bg-red-100 text-red-800',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
