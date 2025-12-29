/**
 * Stress Testing API (v2.0.0)
 * 
 * Provides portfolio stress testing with predefined and custom scenarios:
 * - Predefined scenarios: 5%, 10%, 15%, 20% default rates
 * - Custom scenario support with user-defined default rates
 * - Portfolio health assessment and recovery analysis
 * - Rate limited to 5 requests per minute
 * - Returns raw data for frontend formatting
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimitAndAdminBypass } from '@/lib/rateLimiting';
import { performStressTest, getAvailableStressScenarios, STRESS_SCENARIOS } from '@/services/simulationService';
import { z } from 'zod';

/**
 * Request validation schema
 */
const StressTestSchema = z.object({
  scenario: z.enum(['MILD', 'MODERATE', 'SEVERE', 'EXTREME', 'custom']),
  customDefaultRate: z.number().min(0).max(1).optional(),
  includeRecovery: z.boolean().optional().default(true),
  includeRecommendations: z.boolean().optional().default(true),
});

/**
 * Main API handler with rate limiting
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validationResult = StressTestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { scenario, customDefaultRate, includeRecovery, includeRecommendations } = validationResult.data;

    // Validate custom scenario
    if (scenario === 'custom') {
      if (customDefaultRate === undefined) {
        return NextResponse.json(
          { error: 'Custom default rate is required for custom scenario' },
          { status: 400 }
        );
      }

      if (customDefaultRate < 0 || customDefaultRate > 1) {
        return NextResponse.json(
          { error: 'Custom default rate must be between 0 and 1 (0% to 100%)' },
          { status: 400 }
        );
      }
    }

    // Perform stress test
    const stressTestResult = await performStressTest(
      scenario as keyof typeof STRESS_SCENARIOS | 'custom',
      customDefaultRate
    );

    // Filter response based on requested data
    const response: any = {
      scenario: stressTestResult.scenario,
      impact: stressTestResult.impact,
      portfolioHealth: {
        healthScore: stressTestResult.portfolioHealth.healthScore,
        riskLevel: stressTestResult.portfolioHealth.riskLevel,
      },
    };

    if (includeRecommendations) {
      response.portfolioHealth.recommendations = stressTestResult.portfolioHealth.recommendations;
    }

    if (includeRecovery) {
      response.recovery = stressTestResult.recovery;
    }

    // Add metadata
    response.metadata = {
      requestedAt: new Date().toISOString(),
      includeRecovery,
      includeRecommendations,
      dataSource: 'stress_test_analysis',
      version: '2.0.0',
    };

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('Stress test error:', error);

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
export const POST = withRateLimitAndAdminBypass('STRESS_TESTING')(handler);

/**
 * GET handler for available scenarios
 */
async function getHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const scenarios = getAvailableStressScenarios();
    
    return NextResponse.json({
      success: true,
      data: {
        predefinedScenarios: scenarios,
        customScenario: {
          key: 'custom',
          name: 'Custom Scenario',
          description: 'User-defined default rate',
          defaultRateRange: {
            min: 0,
            max: 1,
            step: 0.01,
          },
        },
        metadata: {
          requestedAt: new Date().toISOString(),
          dataSource: 'stress_test_scenarios',
          version: '2.0.0',
        },
      },
    });

  } catch (error) {
    console.error('Get scenarios error:', error);

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

// Apply rate limiting to GET as well
export const GET = withRateLimitAndAdminBypass('STRESS_TESTING')(getHandler);

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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
