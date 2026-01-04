'use server';

/**
 * Authentication Server Actions
 * OWASP A07:2021 - Identification and Authentication Failures
 * 
 * Provides secure authentication flows with:
 * - Login attempt limiting for brute force protection
 * - Secure session management
 * - Proper logging for security monitoring
 */

import { 
  createStaffSession, 
  destroyStaffSession,
  createStudentSession,
  destroyStudentSession,
  getStaffSession,
  getStudentSession,
  refreshStaffSessionIfNeeded,
  refreshStudentSessionIfNeeded,
} from '@/lib/auth';
import { 
  checkLoginAllowed, 
  recordFailedLogin, 
  clearLoginAttempts,
  getAttemptStatus,
} from '@/lib/login-limiter';
import { 
  logLoginSuccess, 
  logLoginFailure, 
  logLogout,
  logUnhandledError,
  getClientIp,
} from '@/lib/security-logger';
import credentials from '@/lib/staff-credentials.json';

// =============================================================================
// Types
// =============================================================================

export interface LoginResult {
  success: boolean;
  message?: string;
  attemptsRemaining?: number;
  lockedUntil?: number;
}

export interface SessionInfo {
  isAuthenticated: boolean;
  type?: 'staff' | 'student';
  username?: string;
  studentId?: string;
  role?: string;
}

// =============================================================================
// Staff Authentication
// =============================================================================

/**
 * Staff login action with brute force protection
 */
export async function staffLogin(
  username: string,
  password: string
): Promise<LoginResult> {
  const ip = await getClientIp();
  
  try {
    // Check if login is allowed (not locked out)
    const loginCheck = await checkLoginAllowed(username, ip);
    
    if (!loginCheck.allowed) {
      await logLoginFailure(username, 'account_locked');
      
      return {
        success: false,
        message: loginCheck.message || 'Too many failed attempts. Please try again later.',
        attemptsRemaining: 0,
        lockedUntil: loginCheck.lockedUntil,
      };
    }
    
    // Validate credentials
    const user = credentials.users.find(
      (u) => u.username === username && u.password === password
    );
    
    if (!user) {
      // Record failed attempt
      await recordFailedLogin(username, ip);
      await logLoginFailure(username, 'invalid_credentials');
      
      // Get updated attempt status
      const status = await getAttemptStatus(username, ip);
      const attemptsRemaining = Math.max(0, 5 - status.usernameAttempts);
      
      return {
        success: false,
        message: attemptsRemaining > 0 
          ? `Invalid credentials. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`
          : 'Invalid credentials.',
        attemptsRemaining,
      };
    }
    
    // Success - create session and clear attempts
    await createStaffSession(user.username, user.role);
    await clearLoginAttempts(username, ip);
    await logLoginSuccess(user.username, user.role);
    
    return {
      success: true,
      message: 'Login successful',
    };
  } catch (error) {
    await logUnhandledError(error, 'staffLogin');
    
    return {
      success: false,
      message: 'An error occurred during login. Please try again.',
    };
  }
}

/**
 * Staff logout action
 */
export async function staffLogout(): Promise<{ success: boolean }> {
  try {
    const session = await getStaffSession();
    
    if (session) {
      await logLogout(session.username);
    }
    
    await destroyStaffSession();
    
    return { success: true };
  } catch (error) {
    await logUnhandledError(error, 'staffLogout');
    return { success: false };
  }
}

/**
 * Get current staff session info
 */
export async function getStaffSessionInfo(): Promise<SessionInfo> {
  try {
    const session = await getStaffSession();
    
    if (!session) {
      return { isAuthenticated: false };
    }
    
    return {
      isAuthenticated: true,
      type: 'staff',
      username: session.username,
      role: session.role,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Refresh staff session if needed
 */
export async function refreshStaffSession(): Promise<{ refreshed: boolean }> {
  try {
    const refreshed = await refreshStaffSessionIfNeeded();
    return { refreshed };
  } catch {
    return { refreshed: false };
  }
}

// =============================================================================
// Student Authentication
// =============================================================================

/**
 * Student login/registration action
 * Students authenticate by providing their student ID and email
 */
export async function studentLogin(
  studentId: string,
  email: string
): Promise<LoginResult> {
  const ip = await getClientIp();
  
  try {
    // Check if login is allowed
    const loginCheck = await checkLoginAllowed(studentId, ip);
    
    if (!loginCheck.allowed) {
      await logLoginFailure(studentId, 'account_locked');
      
      return {
        success: false,
        message: loginCheck.message || 'Too many failed attempts. Please try again later.',
        attemptsRemaining: 0,
        lockedUntil: loginCheck.lockedUntil,
      };
    }
    
    // Validate student ID format (should match the schema pattern)
    const studentIdPattern = /^[a-zA-Z]{2}\d{5}$/;
    if (!studentIdPattern.test(studentId)) {
      await recordFailedLogin(studentId, ip);
      await logLoginFailure(studentId, 'invalid_format');
      
      return {
        success: false,
        message: 'Invalid student ID format',
      };
    }
    
    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      await recordFailedLogin(studentId, ip);
      await logLoginFailure(studentId, 'invalid_email');
      
      return {
        success: false,
        message: 'Invalid email format',
      };
    }
    
    // Create student session
    await createStudentSession(studentId, email);
    await clearLoginAttempts(studentId, ip);
    await logLoginSuccess(studentId, 'student');
    
    return {
      success: true,
      message: 'Login successful',
    };
  } catch (error) {
    await logUnhandledError(error, 'studentLogin');
    
    return {
      success: false,
      message: 'An error occurred during login. Please try again.',
    };
  }
}

/**
 * Student logout action
 */
export async function studentLogout(): Promise<{ success: boolean }> {
  try {
    const session = await getStudentSession();
    
    if (session) {
      await logLogout(session.studentId);
    }
    
    await destroyStudentSession();
    
    return { success: true };
  } catch (error) {
    await logUnhandledError(error, 'studentLogout');
    return { success: false };
  }
}

/**
 * Get current student session info
 */
export async function getStudentSessionInfo(): Promise<SessionInfo> {
  try {
    const session = await getStudentSession();
    
    if (!session) {
      return { isAuthenticated: false };
    }
    
    return {
      isAuthenticated: true,
      type: 'student',
      studentId: session.studentId,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Refresh student session if needed
 */
export async function refreshStudentSession(): Promise<{ refreshed: boolean }> {
  try {
    const refreshed = await refreshStudentSessionIfNeeded();
    return { refreshed };
  } catch {
    return { refreshed: false };
  }
}

// =============================================================================
// Generic Session Actions
// =============================================================================

/**
 * Check login attempt status for a given identifier
 */
export async function checkAttemptStatus(
  identifier: string
): Promise<{
  usernameAttempts: number;
  ipAttempts: number;
  isLocked: boolean;
  lockExpires?: number;
}> {
  const ip = await getClientIp();
  return await getAttemptStatus(identifier, ip);
}

/**
 * Get any active session info
 */
export async function getAnySessionInfo(): Promise<SessionInfo> {
  // Try staff first
  const staffInfo = await getStaffSessionInfo();
  if (staffInfo.isAuthenticated) {
    return staffInfo;
  }
  
  // Try student
  return await getStudentSessionInfo();
}
