/**
 * Historical Portfolio Analysis API (v2.0.0)
 * 
 * Provides historical analysis with configurable date ranges:
 * - 30 days minimum, 2 years maximum, 6 months default
 * - Portfolio performance metrics and trends
 * - Breakdown by tier, term, and monthly data
 * - Rate limited to 10 requests per minute
 * - Returns raw data for frontend formatting
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimitAndAdminBypass } from '@/lib/rateLimiting';
import { analyzeHistoricalPortfolio, getDefaultDateRange, validateDateRange } from '@/services/simulationService';
import { z } from 'zod';

/**
 * Request validation schema
 */
const HistoricalAnalysisSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeBreakdown: z.boolean().optional().default(true),
  includeTrends: z.boolean().optional().default(true),
});

/**
 * Main API handler with rate limiting
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    // Only allow GET requests
    if (request.method !== 'GET') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    const includeBreakdown = url.searchParams.get('includeBreakdown') !== 'false';
    const includeTrends = url.searchParams.get('includeTrends') !== 'false';

    // Validate input
    const validationResult = HistoricalAnalysisSchema.safeParse({
      startDate: startDateParam,
      endDate: endDateParam,
      includeBreakdown,
      includeTrends,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
    } else {
      // Use default range
      const defaultRange = getDefaultDateRange();
      startDate = defaultRange.startDate;
      endDate = defaultRange.endDate;
    }

    // Validate date range
    const rangeValidation = validateDateRange(startDate, endDate);
    if (!rangeValidation.isValid) {
      return NextResponse.json(
        { error: rangeValidation.error },
        { status: 400 }
      );
    }

    // Use adjusted dates if provided
    if (rangeValidation.adjustedStartDate) {
      startDate = rangeValidation.adjustedStartDate;
    }
    if (rangeValidation.adjustedEndDate) {
      endDate = rangeValidation.adjustedEndDate;
    }

    // Perform historical analysis
    const analysis = await analyzeHistoricalPortfolio(startDate, endDate);

    // Filter response based on requested data
    const response: any = {
      dateRange: analysis.dateRange,
      portfolio: analysis.portfolio,
      performance: analysis.performance,
    };

    if (includeBreakdown) {
      response.breakdown = analysis.breakdown;
    }

    if (includeTrends) {
      response.trends = analysis.trends;
    }

    // Add metadata
    response.metadata = {
      requestedAt: new Date().toISOString(),
      includeBreakdown,
      includeTrends,
      dataSource: 'historical_portfolio_analysis',
      version: '2.0.0',
    };

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('Historical analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const GET = withRateLimitAndAdminBypass('HISTORICAL_ANALYSIS')(handler);

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
