/**
 * Centralized Error Handler
 * 
 * Provides safe error handling that doesn't leak internal details in production.
 * Logs detailed errors for debugging while returning generic messages to clients.
 */

// Known error types that can have their messages exposed
const SAFE_ERROR_TYPES = [
  'ValidationError',
  'AuthenticationError',
  'AuthorizationError',
  'RateLimitError',
  'NotFoundError',
] as const;

type SafeErrorType = typeof SAFE_ERROR_TYPES[number];

/**
 * Custom error class with safe error type
 */
export class AppError extends Error {
  public readonly type: SafeErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    type: SafeErrorType = 'ValidationError',
    statusCode: number = 400
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = true; // Marks this as a known, handled error
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Predefined error factory functions
 */
export const errors = {
  validation: (message: string) => new AppError(message, 'ValidationError', 400),
  authentication: (message: string = 'Please log in to continue') => 
    new AppError(message, 'AuthenticationError', 401),
  authorization: (message: string = 'You do not have permission to perform this action') => 
    new AppError(message, 'AuthorizationError', 403),
  notFound: (resource: string = 'Resource') => 
    new AppError(`${resource} not found`, 'NotFoundError', 404),
  rateLimit: (retryAfter?: number) => 
    new AppError(
      retryAfter 
        ? `Too many requests. Please try again in ${Math.ceil(retryAfter / 1000)} seconds.`
        : 'Too many requests. Please try again later.',
      'RateLimitError',
      429
    ),
};

/**
 * Generic error messages for production
 */
const GENERIC_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Please log in to continue.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  429: 'Too many requests. Please try again later.',
  500: 'An unexpected error occurred. Please try again.',
};

/**
 * Handles an error and returns a safe message for the client
 * Logs the full error details for debugging
 */
export function handleError(error: unknown): { 
  message: string; 
  statusCode: number;
  type?: string;
} {
  const isDev = process.env.NODE_ENV === 'development';

  // Handle our custom AppError
  if (error instanceof AppError) {
    // Log for debugging
    console.error(`[${error.type}] ${error.message}`, isDev ? error.stack : '');
    
    return {
      message: error.message, // Safe to expose
      statusCode: error.statusCode,
      type: error.type,
    };
  }

  // Handle standard Error
  if (error instanceof Error) {
    // Always log full error for debugging
    console.error('[UnhandledError]', error.message, error.stack);

    // In development, show the actual error
    if (isDev) {
      return {
        message: error.message,
        statusCode: 500,
      };
    }

    // In production, return generic message
    return {
      message: GENERIC_MESSAGES[500],
      statusCode: 500,
    };
  }

  // Handle unknown error types
  console.error('[UnknownError]', error);
  
  return {
    message: isDev ? String(error) : GENERIC_MESSAGES[500],
    statusCode: 500,
  };
}

/**
 * Wraps an async server action with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  action: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await action(...args);
    } catch (error) {
      const handled = handleError(error);
      throw new Error(handled.message);
    }
  }) as T;
}

/**
 * Safe error message for specific error codes
 */
export function getSafeErrorMessage(statusCode: number, fallback?: string): string {
  return GENERIC_MESSAGES[statusCode] || fallback || GENERIC_MESSAGES[500];
}

/**
 * Checks if an error is an operational (expected) error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Type guard to check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
