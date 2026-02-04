/**
 * Admin Customers Management Page
 * 
 * Comprehensive customer listing and management interface for administrators.
 * Displays customer information, trustworthy status, and loan history overview.
 * 
 * Business Rules Displayed:
 * - Trustworthy status computation (≥5 on-time payments over K200, zero defaults)
 * - Customer tier progression and limits
 * - Default status and borrowing restrictions
 * - KYC verification status
 * 
 * Data Flow:
 * 1. Fetch customer list with loan statistics
 * 2. Display customer table with filtering and search
 * 3. Show trustworthy status and tier information
 * 4. Provide navigation to detailed customer views
 * 5. Enable customer management actions
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CustomerTable from '@/components/admin/CustomerTable';
import CustomerFilters from '@/components/admin/CustomerFilters';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

// Mock hook - in real implementation would be useAdminCustomers
function useAdminCustomers() {
  const [state, setState] = useState({
    customers: null,
    loading: true,
    error: null,
  });

  const fetchCustomers = (filters: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // Mock data - in real implementation would call API
    setTimeout(() => {
      const mockCustomers = {
        customers: [
          {
            _id: '1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+675 123 4567',
            currentLimit: 500,
            isTrustworthy: true,
            onTimeCount: 7,
            hasDefaults: false,
            totalLoans: 12,
            activeLoans: 1,
            totalBorrowed: 4500,
            totalRepaid: 4200,
            joinedAt: '2023-06-15',
            lastLoanAt: '2024-01-15',
            kyc: {
              verified: true,
              verifiedAt: '2023-06-20',
            }
          },
          {
            _id: '2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            phone: '+675 234 5678',
            currentLimit: 200,
            isTrustworthy: false,
            onTimeCount: 2,
            hasDefaults: false,
            totalLoans: 3,
            activeLoans: 0,
            totalBorrowed: 450,
            totalRepaid: 450,
            joinedAt: '2023-11-10',
            lastLoanAt: '2023-12-20',
            kyc: {
              verified: true,
              verifiedAt: '2023-11-15',
            }
          },
          {
            _id: '3',
            name: 'Bob Wilson',
            email: 'bob@example.com',
            phone: '+675 345 6789',
            currentLimit: 50,
            isTrustworthy: false,
            onTimeCount: 0,
            hasDefaults: true,
            totalLoans: 2,
            activeLoans: 0,
            totalBorrowed: 300,
            totalRepaid: 150,
            joinedAt: '2023-08-05',
            lastLoanAt: '2023-09-10',
            kyc: {
              verified: false,
            }
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 3,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }
      };

      setState({
        customers: mockCustomers,
        loading: false,
        error: null,
      });
    }, 1000);
  };

  return { ...state, fetchCustomers };
}

export default function AdminCustomersPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    trustworthy: searchParams.get('trustworthy') || '',
    kycStatus: searchParams.get('kycStatus') || '',
    sortBy: searchParams.get('sortBy') || 'joinedAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
  });

  const { customers, loading, error, fetchCustomers } = useAdminCustomers();

  useEffect(() => {
    fetchCustomers(filters);
  }, [filters]);

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
        message="Failed to load customers" 
        onRetry={() => fetchCustomers(filters)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
        <p className="text-gray-600 mt-1">
          Manage customer accounts, trustworthy status, and loan history
        </p>
      </div>

      {/* Filters */}
      <CustomerFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Customer Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        </div>
      ) : (
        <CustomerTable 
          customers={customers?.customers || []}
          pagination={customers?.pagination}
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
