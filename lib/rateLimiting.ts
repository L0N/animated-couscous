/**
 * Rate Limiting Library (v2.0.0)
 * 
 * Provides protection for computationally intensive endpoints:
 * - Historical analysis: 10 requests per minute
 * - Stress testing: 5 requests per minute
 * - General simulation: 8 requests per minute
 * - Per-user and global rate limiting
 * - Graceful degradation with informative error responses
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  HISTORICAL_ANALYSIS: {
    requests: parseInt(process.env.RATE_LIMIT_HISTORICAL || '10'),
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many historical analysis requests. Please wait before trying again.',
  },
  STRESS_TESTING: {
    requests: parseInt(process.env.RATE_LIMIT_STRESS_TEST || '5'),
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many stress test requests. Please wait before trying again.',
  },
  SIMULATION_GENERAL: {
    requests: parseInt(process.env.RATE_LIMIT_SIMULATION || '8'),
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many simulation requests. Please wait before trying again.',
  },
  FORWARD_PROJECTION: {
    requests: parseInt(process.env.RATE_LIMIT_FORWARD || '8'),
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many forward projection requests. Please wait before trying again.',
  },
  BREAKEVEN_ANALYSIS: {
    requests: parseInt(process.env.RATE_LIMIT_BREAKEVEN || '6'),
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many break-even analysis requests. Please wait before trying again.',
  },
  GLOBAL_API: {
    requests: parseInt(process.env.RATE_LIMIT_GLOBAL || '100'),
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many API requests. Please slow down.',
  },
} as const;

/**
 * In-memory rate limit store (for development/small scale)
 * In production, consider using Redis or similar
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest): string {
  // Try to get user ID from session/auth
  const userId = request.headers.get('x-user-id') || 
                 request.cookies.get('user-id')?.value;
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check rate limit for a specific endpoint
 */
export function checkRateLimit(
  request: NextRequest,
  limitType: keyof typeof RATE_LIMITS
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
} {
  const config = RATE_LIMITS[limitType];
  const clientId = getClientId(request);
  const key = `${limitType}:${clientId}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Initialize or reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check if limit exceeded
  if (entry.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      message: config.message,
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(limitType: keyof typeof RATE_LIMITS) {
  return function rateLimitMiddleware(request: NextRequest) {
    const result = checkRateLimit(request, limitType);
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: result.message,
          retryAfter,
          resetTime: new Date(result.resetTime).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMITS[limitType].requests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    return {
      headers: {
        'X-RateLimit-Limit': RATE_LIMITS[limitType].requests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
      },
    };
  };
}

/**
 * Apply rate limiting to API response
 */
export function applyRateLimit(
  request: NextRequest,
  response: NextResponse,
  limitType: keyof typeof RATE_LIMITS
): NextResponse {
  const result = checkRateLimit(request, limitType);
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: result.message,
        retryAfter,
        resetTime: new Date(result.resetTime).toISOString(),
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': RATE_LIMITS[limitType].requests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', RATE_LIMITS[limitType].requests.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  
  return response;
}

/**
 * Rate limit decorator for API handlers
 */
export function withRateLimit(limitType: keyof typeof RATE_LIMITS) {
  return function decorator(handler: (request: NextRequest) => Promise<NextResponse>) {
    return async function rateLimitedHandler(request: NextRequest): Promise<NextResponse> {
      const result = checkRateLimit(request, limitType);
      
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: result.message,
            retryAfter,
            resetTime: new Date(result.resetTime).toISOString(),
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': RATE_LIMITS[limitType].requests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.resetTime.toString(),
            },
          }
        );
      }
      
      // Execute the handler
      const response = await handler(request);
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', RATE_LIMITS[limitType].requests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
      
      return response;
    };
  };
}

/**
 * Get rate limit status for a client
 */
export function getRateLimitStatus(
  request: NextRequest,
  limitType: keyof typeof RATE_LIMITS
): {
  limit: number;
  remaining: number;
  resetTime: number;
  resetIn: number;
} {
  const config = RATE_LIMITS[limitType];
  const clientId = getClientId(request);
  const key = `${limitType}:${clientId}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    return {
      limit: config.requests,
      remaining: config.requests,
      resetTime: now + config.windowMs,
      resetIn: config.windowMs,
    };
  }
  
  return {
    limit: config.requests,
    remaining: Math.max(0, config.requests - entry.count),
    resetTime: entry.resetTime,
    resetIn: Math.max(0, entry.resetTime - now),
  };
}

/**
 * Reset rate limit for a specific client (admin function)
 */
export function resetRateLimit(
  clientId: string,
  limitType: keyof typeof RATE_LIMITS
): boolean {
  const key = `${limitType}:${clientId}`;
  return rateLimitStore.delete(key);
}

/**
 * Get all rate limit statistics (admin function)
 */
export function getRateLimitStatistics(): {
  totalClients: number;
  activeWindows: number;
  topClients: Array<{
    clientId: string;
    limitType: string;
    count: number;
    resetTime: number;
  }>;
} {
  const now = Date.now();
  const activeEntries: Array<{
    clientId: string;
    limitType: string;
    count: number;
    resetTime: number;
  }> = [];
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now <= entry.resetTime) {
      const [limitType, clientId] = key.split(':', 2);
      activeEntries.push({
        clientId,
        limitType,
        count: entry.count,
        resetTime: entry.resetTime,
      });
    }
  }
  
  // Sort by count descending
  activeEntries.sort((a, b) => b.count - a.count);
  
  const uniqueClients = new Set(activeEntries.map(e => e.clientId));
  
  return {
    totalClients: uniqueClients.size,
    activeWindows: activeEntries.length,
    topClients: activeEntries.slice(0, 10), // Top 10
  };
}

/**
 * Configure rate limits (admin function)
 */
export function updateRateLimit(
  limitType: keyof typeof RATE_LIMITS,
  requests: number,
  windowMs?: number
): void {
  // Update environment variables (in-memory for this session)
  const envKey = `RATE_LIMIT_${limitType.replace(/_/g, '_').toUpperCase()}`;
  process.env[envKey] = requests.toString();
  
  if (windowMs) {
    // Note: Window duration is currently fixed at 1 minute
    // This would require a more sophisticated implementation to change
    console.warn('Window duration changes require application restart');
  }
  
  // Clear existing entries for this limit type to apply new limits immediately
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(`${limitType}:`)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Middleware for global API rate limiting
 */
export function globalRateLimitMiddleware(request: NextRequest) {
  return createRateLimitMiddleware('GLOBAL_API')(request);
}

/**
 * Check if request is from admin (for bypassing rate limits)
 */
export function isAdminRequest(request: NextRequest): boolean {
  const userRole = request.headers.get('x-user-role') || 
                   request.cookies.get('user-role')?.value;
  
  return userRole === 'admin';
}

/**
 * Rate limit with admin bypass
 */
export function withRateLimitAndAdminBypass(limitType: keyof typeof RATE_LIMITS) {
  return function decorator(handler: (request: NextRequest) => Promise<NextResponse>) {
    return async function rateLimitedHandler(request: NextRequest): Promise<NextResponse> {
      // Skip rate limiting for admin users
      if (isAdminRequest(request)) {
        return await handler(request);
      }
      
      return await withRateLimit(limitType)(handler)(request);
    };
  };
}

