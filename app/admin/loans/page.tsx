/**
 * Admin Loans Management Page
 * 
 * Comprehensive loan listing and management interface for administrators.
 * Provides filtering, searching, and navigation to detailed loan views.
 * 
 * Features:
 * - Loan listing with pagination
 * - Status-based filtering
 * - Search functionality
 * - Sortable columns
 * - Quick actions
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdminLoans } from '@/lib/hooks/useAdminApi';
import LoanTable from '@/components/admin/LoanTable';
import LoanFilters from '@/components/admin/LoanFilters';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

export default function AdminLoansPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
  });

  const { loans, loading, error, fetchLoans } = useAdminLoans();

  useEffect(() => {
    fetchLoans(filters);
  }, [fetchLoans, filters]);

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1, // Reset to page 1 when filters change
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  if (error) {
    return (
      <ErrorDisplay 
        message="Failed to load loans" 
        onRetry={() => fetchLoans(filters)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Loan Management</h1>
        <p className="text-gray-600 mt-1">
          Review and manage loan applications
        </p>
      </div>

      {/* Filters */}
      <LoanFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Loan Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        </div>
      ) : (
        <LoanTable 
          loans={loans?.loans || []}
          pagination={loans?.pagination}
          onPageChange={handlePageChange}
          onSort={(sortBy, sortOrder) => 
            handleFilterChange({ sortBy, sortOrder })
          }
          currentSort={{
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
          }}
        />
      )}
    </div>
  );
}
