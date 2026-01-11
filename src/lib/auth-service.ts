/**
 * Authentication Service
 * 
 * Provides secure authentication functions including:
 * - Password hashing and verification with bcrypt
 * - User authentication against database
 * - Account lockout after failed attempts
 * - Password validation
 */

import bcrypt from 'bcrypt';
import dbConnect from '@/lib/db';
import { User, IUser, PASSWORD_REGEX, PASSWORD_REQUIREMENTS } from '@/models/User';
import { createStaffSession, destroyStaffSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-logger';

// Configuration
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// =============================================================================
// Password Functions
// =============================================================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plain password with a hashed password
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Validate password meets requirements
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Authentication Functions
// =============================================================================

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    name: string;
    role: string;
    email?: string;
  };
  token?: string;
  error?: string;
  attemptsRemaining?: number;
  lockedUntil?: Date;
}

/**
 * Authenticate a user with username and password
 */
export async function authenticateUser(
  username: string,
  password: string,
  ipAddress: string
): Promise<AuthResult> {
  try {
    await dbConnect();
    
    // Normalize username
    const normalizedUsername = username.toLowerCase().trim();
    
    // Find user with password field
    const user = await User.findOne({ username: normalizedUsername }).select('+password');
    
    if (!user) {
      // Don't reveal if user exists or not
      await createAuditLog({
        action: 'access_denied',
        success: false,
        details: { 
          reason: 'invalid_credentials',
          attemptedUsername: normalizedUsername,
        },
        ipAddress,
      });
      
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }
    
    // Check if account is active
    if (!user.isActive) {
      await createAuditLog({
        action: 'access_denied',
        userId: user._id.toString(),
        success: false,
        details: { reason: 'account_disabled' },
        ipAddress,
      });
      
      return {
        success: false,
        error: 'Account is disabled. Please contact an administrator.',
      };
    }
    
    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await createAuditLog({
        action: 'access_denied',
        userId: user._id.toString(),
        success: false,
        details: { reason: 'account_locked' },
        ipAddress,
      });
      
      return {
        success: false,
        error: 'Account is temporarily locked due to too many failed attempts.',
        lockedUntil: user.lockedUntil,
      };
    }
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    
    if (!isValidPassword) {
      // Increment failed attempts
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates: Partial<IUser> = { 
        failedLoginAttempts: newAttempts,
      };
      
      // Lock account if max attempts exceeded
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        
        await createAuditLog({
          action: 'suspicious_activity',
          userId: user._id.toString(),
          success: false,
          details: { 
            reason: 'account_locked_failed_attempts',
            attempts: newAttempts,
            lockDurationMinutes: LOCKOUT_DURATION_MINUTES,
          },
          ipAddress,
        });
      }
      
      await User.updateOne({ _id: user._id }, { $set: updates });
      
      const attemptsRemaining = Math.max(0, MAX_LOGIN_ATTEMPTS - newAttempts);
      
      await createAuditLog({
        action: 'access_denied',
        userId: user._id.toString(),
        success: false,
        details: { 
          reason: 'invalid_password',
          attemptsRemaining,
        },
        ipAddress,
      });
      
      return {
        success: false,
        error: attemptsRemaining > 0 
          ? `Invalid credentials. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`
          : 'Invalid credentials. Account has been locked.',
        attemptsRemaining,
      };
    }
    
    // Success - clear failed attempts and update last login
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLogin: new Date(),
        },
      }
    );
    
    // Create session and get token
    const token = await createStaffSession(user.username, user.role);
    
    await createAuditLog({
      action: 'validate', // Using 'validate' as it's closest to login success
      userId: user._id.toString(),
      userRole: user.role,
      success: true,
      details: { action: 'login_success' },
      ipAddress,
    });
    
    return {
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'An error occurred during authentication',
    };
  }
}

/**
 * Logout the current user
 */
export async function logoutUser(): Promise<{ success: boolean }> {
  try {
    await destroyStaffSession();
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false };
  }
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbConnect();
    
    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('. '),
      };
    }
    
    // Find user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password);
    
    if (!isValidPassword) {
      return {
        success: false,
        error: 'Current password is incorrect',
      };
    }
    
    // Check new password is different from current
    const isSamePassword = await comparePassword(newPassword, user.password);
    if (isSamePassword) {
      return {
        success: false,
        error: 'New password must be different from current password',
      };
    }
    
    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    
    await User.updateOne(
      { _id: userId },
      { 
        $set: { 
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      }
    );
    
    await createAuditLog({
      action: 'validate',
      userId,
      success: true,
      details: { action: 'password_changed' },
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      error: 'Failed to change password',
    };
  }
}

// =============================================================================
// User Management Functions (Admin only)
// =============================================================================

export interface CreateUserInput {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'staff' | 'volunteer';
  email?: string;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<{
  success: boolean;
  user?: { id: string; username: string; name: string; role: string };
  error?: string;
}> {
  try {
    await dbConnect();
    
    // Validate password
    const validation = validatePassword(input.password);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('. '),
      };
    }
    
    // Check if username exists
    const existingUser = await User.findOne({ 
      username: input.username.toLowerCase().trim() 
    });
    
    if (existingUser) {
      return {
        success: false,
        error: 'Username already exists',
      };
    }
    
    // Check if email exists (if provided)
    if (input.email) {
      const existingEmail = await User.findOne({ 
        email: input.email.toLowerCase().trim() 
      });
      
      if (existingEmail) {
        return {
          success: false,
          error: 'Email already exists',
        };
      }
    }
    
    // Hash password
    const hashedPassword = await hashPassword(input.password);
    
    // Create user
    const user = await User.create({
      username: input.username.toLowerCase().trim(),
      password: hashedPassword,
      name: input.name.trim(),
      role: input.role,
      email: input.email?.toLowerCase().trim(),
      isActive: true,
      failedLoginAttempts: 0,
    });
    
    return {
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
    
  } catch (error: unknown) {
    console.error('Create user error:', error);
    
    // Handle MongoDB duplicate key error
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return {
        success: false,
        error: 'Username or email already exists',
      };
    }
    
    return {
      success: false,
      error: 'Failed to create user',
    };
  }
}

/**
 * Get all users (without passwords)
 */
export async function getAllUsers(): Promise<{
  success: boolean;
  users?: Array<{
    id: string;
    username: string;
    name: string;
    role: string;
    email?: string;
    isActive: boolean;
    lastLogin?: Date;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    await dbConnect();
    
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    
    return {
      success: true,
      users: users.map(user => ({
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      })),
    };
    
  } catch (error) {
    console.error('Get users error:', error);
    return {
      success: false,
      error: 'Failed to fetch users',
    };
  }
}

/**
 * Update a user
 */
export async function updateUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    role?: 'admin' | 'staff' | 'volunteer';
    isActive?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbConnect();
    
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    // Check email uniqueness if changing
    if (updates.email && updates.email !== user.email) {
      const existingEmail = await User.findOne({ 
        email: updates.email.toLowerCase().trim(),
        _id: { $ne: userId },
      });
      
      if (existingEmail) {
        return {
          success: false,
          error: 'Email already exists',
        };
      }
    }
    
    // Apply updates
    const updateData: Record<string, unknown> = {};
    if (updates.name) updateData.name = updates.name.trim();
    if (updates.email !== undefined) updateData.email = updates.email?.toLowerCase().trim() || null;
    if (updates.role) updateData.role = updates.role;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    
    await User.updateOne({ _id: userId }, { $set: updateData });
    
    return { success: true };
    
  } catch (error) {
    console.error('Update user error:', error);
    return {
      success: false,
      error: 'Failed to update user',
    };
  }
}

/**
 * Delete a user (soft delete by setting isActive to false)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await dbConnect();
    
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    // Soft delete - set isActive to false
    await User.updateOne({ _id: userId }, { $set: { isActive: false } });
    
    return { success: true };
    
  } catch (error) {
    console.error('Delete user error:', error);
    return {
      success: false,
      error: 'Failed to delete user',
    };
  }
}

/**
 * Reset a user's password (admin function)
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbConnect();
    
    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('. '),
      };
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    
    await User.updateOne(
      { _id: userId },
      { 
        $set: { 
          password: hashedPassword,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }
    );
    
    return { success: true };
    
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      error: 'Failed to reset password',
    };
  }
}

/**
 * Check if any users exist in the database
 */
export async function hasAnyUsers(): Promise<boolean> {
  try {
    await dbConnect();
    const count = await User.countDocuments();
    return count > 0;
  } catch (error) {
    console.error('Check users error:', error);
    return false;
  }
}

/**
 * Get user by ID (without password)
 */
export async function getUserById(userId: string): Promise<{
  success: boolean;
  user?: {
    id: string;
    username: string;
    name: string;
    role: string;
    email?: string;
    isActive: boolean;
  };
  error?: string;
}> {
  try {
    await dbConnect();
    
    const user = await User.findById(userId).select('-password').lean();
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    return {
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        isActive: user.isActive,
      },
    };
    
  } catch (error) {
    console.error('Get user error:', error);
    return {
      success: false,
      error: 'Failed to fetch user',
    };
  }
}

/**
 * Get user by Username (without password)
 */
export async function getUserByUsername(username: string): Promise<{
  success: boolean;
  user?: {
    id: string;
    username: string;
    name: string;
    role: string;
    email?: string;
    isActive: boolean;
  };
  error?: string;
}> {
  try {
    await dbConnect();
    
    const user = await User.findOne({ username: username.toLowerCase().trim() }).select('-password').lean();
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    return {
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        isActive: user.isActive,
      },
    };
    
  } catch (error) {
    console.error('Get user by username error:', error);
    return {
      success: false,
      error: 'Failed to fetch user',
    };
  }
}
