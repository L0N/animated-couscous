/**
 * Admin Loan Management API
 * 
 * Handles loan application viewing and management for administrators.
 * 
 * Data Flow:
 * GET: Authentication → Query parsing → Database lookup → Loan aggregation → Response
 * 
 * Features:
 * - Paginated loan listing with filtering
 * - Status-based filtering (pending, approved, disbursed, etc.)
 * - Customer information aggregation
 * - KYC document access for verification
 * - Comprehensive loan details for decision making
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { validateRequestBody } from '@/lib/validation';
import Loan from '@/models/Loan';
import User from '@/models/User';
import Payment from '@/models/Payment';
import { LoanStatus, UserRole } from '@/types';

/**
 * Query parameters validation schema for loan listing
 */
const loansQuerySchema = z.object({
  status: z.enum([
    LoanStatus.APPLIED,
    LoanStatus.APPROVED, 
    LoanStatus.DISBURSED,
    LoanStatus.REPAID,
    LoanStatus.OVERDUE,
    LoanStatus.DEFAULTED
  ]).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'amount', 'dueDate', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(), // Search by customer name, email, or loan reference
}).strict();

/**
 * Aggregate loan data with customer information for admin viewing
 */
async function aggregateLoansWithCustomerData(filters: any, pagination: any, sort: any) {
  const pipeline = [
    // Match loans based on filters
    { $match: filters },
    
    // Join with user data
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'customer'
      }
    },
    
    // Unwind customer array (should be single document)
    { $unwind: '$customer' },
    
    // Join with payments data
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'loanId',
        as: 'payments'
      }
    },
    
    // Add computed fields
    {
      $addFields: {
        customerName: '$customer.name',
        customerEmail: '$customer.email',
        customerPhone: '$customer.phone',
        customerKycVerified: '$customer.kyc.verified',
        customerCurrentLimit: '$customer.currentLimit',
        customerIsTrustworthy: '$customer.isTrustworthy',
        customerStatus: '$customer.status',
        totalPayments: { $size: '$payments' },
        pendingPayments: {
          $size: {
            $filter: {
              input: '$payments',
              cond: { $eq: ['$$this.status', 'pending'] }
            }
          }
        },
        remainingBalance: {
          $subtract: [
            '$totalRepayable',
            { $add: ['$totalPrincipalRepaid', '$totalInterestRepaid'] }
          ]
        },
        daysOverdue: {
          $cond: {
            if: { $and: [
              { $in: ['$status', ['overdue', 'defaulted']] },
              { $ne: ['$overdueSince', null] }
            ]},
            then: {
              $divide: [
                { $subtract: [new Date(), '$overdueSince'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            },
            else: 0
          }
        }
      }
    },
    
    // Sort
    { $sort: sort },
    
    // Pagination
    { $skip: (pagination.page - 1) * pagination.limit },
    { $limit: pagination.limit },
    
    // Project final fields
    {
      $project: {
        // Loan fields
        _id: 1,
        reference: 1,
        amount: 1,
        termDays: 1,
        interestRate: 1,
        interestAmount: 1,
        totalRepayable: 1,
        totalPrincipalRepaid: 1,
        totalInterestRepaid: 1,
        status: 1,
        disbursedAt: 1,
        dueDate: 1,
        repaidAt: 1,
        overdueSince: 1,
        isAutoApproved: 1,
        rejectionReason: 1,
        createdAt: 1,
        updatedAt: 1,
        
        // v2.0.1 fields
        loanVersion: 1,
        outstandingPrincipal: 1,
        accruedInterest: 1,
        lastInterestCalcDate: 1,
        totalInterestCharged: 1,
        annualInterestRate: 1,
        hasPartialPayments: 1,
        extendedDueDate: 1,
        interestFrozenAt: 1,
        
        // Customer fields
        customer: {
          id: '$customer._id',
          name: '$customerName',
          email: '$customerEmail',
          phone: '$customerPhone',
          currentLimit: '$customerCurrentLimit',
          isTrustworthy: '$customerIsTrustworthy',
          status: '$customerStatus',
          kyc: {
            verified: '$customerKycVerified',
            idType: '$customer.kyc.idType',
            idNumber: '$customer.kyc.idNumber',
            idDocumentUrl: '$customer.kyc.idDocumentUrl',
            employmentProof: '$customer.kyc.employmentProof',
            bankStatement: '$customer.kyc.bankStatement'
          },
          onTimeCount: '$customer.onTimeCount',
          consecutiveOnTimePayments: '$customer.consecutiveOnTimePayments',
          totalConsecutiveOnTimePayments: '$customer.totalConsecutiveOnTimePayments',
          trustworthyPath: '$customer.trustworthyPath'
        },
        
        // Computed fields
        remainingBalance: 1,
        totalPayments: 1,
        pendingPayments: 1,
        daysOverdue: 1
      }
    }
  ];

  return await Loan.aggregate(pipeline);
}

/**
 * GET /api/admin/loans
 * 
 * Retrieve paginated list of loans with filtering and customer information
 * 
 * Data Flow:
 * 1. Authentication → Verify admin access
 * 2. Query validation → Parse and validate query parameters
 * 3. Filter construction → Build MongoDB filters from query params
 * 4. Data aggregation → Join loans with customer and payment data
 * 5. Response → Return paginated results with metadata
 */
export async function GET(request: NextRequest) {
  try {
    // === STEP 1: AUTHENTICATION ===
    // Verify admin access
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return auth.error;
    }

    await connectDB();

    // === STEP 2: QUERY PARAMETER PARSING ===
    // Extract and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      search: searchParams.get('search') || undefined,
    };

    // Validate query parameters
    const validation = await validateRequestBody(loansQuerySchema, queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { status, page, limit, sortBy, sortOrder, search } = validation.data;

    // === STEP 3: FILTER CONSTRUCTION ===
    // Build MongoDB filters based on query parameters
    const filters: any = {};

    // Status filter
    if (status) {
      filters.status = status;
    }

    // Search filter (customer name, email, or loan reference)
    if (search) {
      // First, find users matching the search term
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = matchingUsers.map(user => user._id);

      // Then filter loans by matching users or loan reference
      filters.$or = [
        { userId: { $in: userIds } },
        { reference: { $regex: search, $options: 'i' } }
      ];
    }

    // === STEP 4: SORTING CONFIGURATION ===
    // Configure sorting based on parameters
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // === STEP 5: DATA AGGREGATION ===
    // Get loans with customer data and computed fields
    const loans = await aggregateLoansWithCustomerData(
      filters,
      { page, limit },
      sort
    );

    // Get total count for pagination
    const totalCount = await Loan.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / limit);

    // === STEP 6: RESPONSE GENERATION ===
    // Return paginated results with metadata
    return NextResponse.json({
      success: true,
      loans,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      filters: {
        status: status || 'all',
        search: search || null
      }
    });

  } catch (error) {
    console.error('Admin loans listing error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve loans' },
      { status: 500 }
    );
  }
}
