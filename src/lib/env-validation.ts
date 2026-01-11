/**
 * Environment Variable Validation
 * 
 * Validates required environment variables on application startup.
 * Prevents deployment with missing or invalid configuration.
 */

interface EnvConfig {
  // Required
  MONGODB_URI: string;
  JWT_SECRET: string;
  
  // Optional with defaults
  NODE_ENV: 'development' | 'production' | 'test';
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates environment variables against expected schema
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate MONGODB_URI format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
    errors.push('MONGODB_URI must be a valid MongoDB connection string');
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
  }

  // Warning for development defaults
  if (process.env.NODE_ENV === 'production') {
    // Additional production checks
    if (!process.env.MONGODB_URI?.includes('mongodb+srv://')) {
      warnings.push('Consider using MongoDB Atlas (mongodb+srv://) for production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates and logs environment status
 * Call this during application startup
 */
export function checkEnvironment(): void {
  const result = validateEnv();

  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (!result.isValid) {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    
    // In production, fail hard
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment configuration. Please check your environment variables.');
    }
  } else {
    console.log('✅ Environment validation passed');
  }
}

/**
 * Get typed environment variable with fallback
 */
export function getEnvVar<T extends keyof EnvConfig>(
  key: T,
  defaultValue?: EnvConfig[T]
): EnvConfig[T] {
  const value = process.env[key] as EnvConfig[T] | undefined;
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  
  return value;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
