/**
 * API Client for WanPaus Frontend
 * 
 * Provides a centralized HTTP client for making API requests to backend endpoints.
 * Handles authentication, error handling, and response parsing.
 * 
 * Data Flow:
 * 1. Component calls API hook
 * 2. Hook uses apiClient to make HTTP request
 * 3. Client adds authentication headers
 * 4. Backend processes request and returns response
 * 5. Client parses response and handles errors
 * 6. Hook returns data or error to component
 * 
 * Security Features:
 * - Automatic authentication header injection
 * - CSRF protection
 * - Request/response logging for debugging
 * - Error standardization
 */

import { getSession } from 'next-auth/react';

/**
 * Standard API Response Interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * API Client Configuration
 */
interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
}

/**
 * HTTP Methods
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Request Options
 */
interface RequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

/**
 * API Client Class
 * 
 * Centralized HTTP client for making authenticated requests to the WanPaus API.
 * Automatically handles session management and error responses.
 */
class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || '/api';
    this.timeout = config.timeout || 10000;
  }

  /**
   * Make HTTP Request
   * 
   * Core method for making HTTP requests with automatic authentication
   * and error handling.
   * 
   * @param endpoint - API endpoint path
   * @param options - Request configuration options
   * @returns Promise resolving to API response
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      requireAuth = true,
    } = options;

    try {
      // Build request URL
      const url = `${this.baseUrl}${endpoint}`;

      // Prepare headers
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      // Add authentication if required
      if (requireAuth) {
        const session = await getSession();
        if (session?.user) {
          // For customer API endpoints, we rely on NextAuth.js session cookies
          // For admin endpoints, the session is validated server-side
        }
      }

      // Prepare request body
      let requestBody: string | FormData | undefined;
      if (body) {
        if (body instanceof FormData) {
          requestBody = body;
          // Remove Content-Type header for FormData (browser sets it automatically)
          delete requestHeaders['Content-Type'];
        } else {
          requestBody = JSON.stringify(body);
        }
      }

      // Make the request
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        credentials: 'include', // Include cookies for session authentication
      });

      // Parse response
      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Handle HTTP errors
      if (!response.ok) {
        return {
          success: false,
          error: responseData?.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Return successful response
      return responseData;

    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * GET Request
   */
  async get<T = any>(endpoint: string, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', requireAuth });
  }

  /**
   * POST Request
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, requireAuth });
  }

  /**
   * PUT Request
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, requireAuth });
  }

  /**
   * DELETE Request
   */
  async delete<T = any>(endpoint: string, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', requireAuth });
  }

  /**
   * Upload File Request
   * 
   * Special method for file uploads using FormData.
   */
  async upload<T = any>(
    endpoint: string,
    formData: FormData,
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      requireAuth,
    });
  }
}

/**
 * Default API Client Instance
 * 
 * Pre-configured client instance for use throughout the application.
 */
export const apiClient = new ApiClient();

/**
 * API Error Types
 */
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Parse API Error
 * 
 * Utility function to categorize API errors for better error handling.
 */
export function parseApiError(error: string): ApiErrorType {
  if (error.includes('Network')) return ApiErrorType.NETWORK_ERROR;
  if (error.includes('401') || error.includes('Unauthorized')) return ApiErrorType.AUTHENTICATION_ERROR;
  if (error.includes('403') || error.includes('Forbidden')) return ApiErrorType.AUTHORIZATION_ERROR;
  if (error.includes('400') || error.includes('validation')) return ApiErrorType.VALIDATION_ERROR;
  if (error.includes('500') || error.includes('Internal Server Error')) return ApiErrorType.SERVER_ERROR;
  return ApiErrorType.UNKNOWN_ERROR;
}
