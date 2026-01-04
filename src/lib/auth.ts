import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { logInvalidToken, logSessionExpired } from './security-logger';

// =============================================================================
// Configuration
// =============================================================================

const SECRET_KEY = process.env.JWT_SECRET_KEY || 'your-super-secret-key-change-this';
const key = new TextEncoder().encode(SECRET_KEY);

// Session configuration
const SESSION_CONFIG = {
  // Staff session duration (24 hours)
  staffSessionDuration: '24h',
  staffSessionMaxAge: 60 * 60 * 24, // 24 hours in seconds
  
  // Student session duration (7 days)
  studentSessionDuration: '7d',
  studentSessionMaxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  
  // Token refresh threshold (refresh when less than this remaining)
  refreshThresholdHours: 2,
  
  // Cookie names
  staffCookieName: 'staff_session',
  studentCookieName: 'student_session',
};

// =============================================================================
// Types
// =============================================================================

export interface StaffSession extends JWTPayload {
  username: string;
  role: string;
  type: 'staff';
}

export interface StudentSession extends JWTPayload {
  studentId: string;
  email: string;
  type: 'student';
}

export type Session = StaffSession | StudentSession;

// =============================================================================
// Token Functions
// =============================================================================

/**
 * Sign a JWT token with the given payload
 */
export async function signToken(
  payload: Record<string, unknown>,
  expiresIn: string = SESSION_CONFIG.staffSessionDuration
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // Log token verification failures
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        await logSessionExpired();
      } else {
        await logInvalidToken(error.message);
      }
    }
    return null;
  }
}

/**
 * Check if a token needs refreshing
 */
export function shouldRefreshToken(payload: JWTPayload): boolean {
  if (!payload.exp) return false;
  
  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const thresholdMs = SESSION_CONFIG.refreshThresholdHours * 60 * 60 * 1000;
  
  return expiresAt - now < thresholdMs;
}

// =============================================================================
// Staff Session Functions
// =============================================================================

/**
 * Create a staff session
 */
export async function createStaffSession(
  username: string,
  role: string
): Promise<string> {
  const payload: Omit<StaffSession, keyof JWTPayload> = {
    username,
    role,
    type: 'staff',
  };
  
  const token = await signToken(payload, SESSION_CONFIG.staffSessionDuration);
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_CONFIG.staffCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_CONFIG.staffSessionMaxAge,
  });
  
  return token;
}

/**
 * Get the current staff session
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_CONFIG.staffCookieName)?.value;
    
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'staff') return null;
    
    return payload as StaffSession;
  } catch {
    return null;
  }
}

/**
 * Refresh staff session if needed
 */
export async function refreshStaffSessionIfNeeded(): Promise<boolean> {
  const session = await getStaffSession();
  if (!session) return false;
  
  if (shouldRefreshToken(session)) {
    await createStaffSession(session.username, session.role);
    return true;
  }
  
  return false;
}

/**
 * Destroy staff session
 */
export async function destroyStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_CONFIG.staffCookieName);
}

// =============================================================================
// Student Session Functions
// =============================================================================

/**
 * Create a student session
 */
export async function createStudentSession(
  studentId: string,
  email: string
): Promise<string> {
  const payload: Omit<StudentSession, keyof JWTPayload> = {
    studentId,
    email,
    type: 'student',
  };
  
  const token = await signToken(payload, SESSION_CONFIG.studentSessionDuration);
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_CONFIG.studentCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // Stricter for student sessions
    path: '/',
    maxAge: SESSION_CONFIG.studentSessionMaxAge,
  });
  
  return token;
}

/**
 * Get the current student session
 */
export async function getStudentSession(): Promise<StudentSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_CONFIG.studentCookieName)?.value;
    
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'student') return null;
    
    return payload as StudentSession;
  } catch {
    return null;
  }
}

/**
 * Refresh student session if needed
 */
export async function refreshStudentSessionIfNeeded(): Promise<boolean> {
  const session = await getStudentSession();
  if (!session) return false;
  
  if (shouldRefreshToken(session)) {
    await createStudentSession(session.studentId, session.email);
    return true;
  }
  
  return false;
}

/**
 * Destroy student session
 */
export async function destroyStudentSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_CONFIG.studentCookieName);
}

// =============================================================================
// Generic Session Functions (Backward Compatibility)
// =============================================================================

/**
 * Get any active session (staff or student)
 * @deprecated Use getStaffSession() or getStudentSession() instead
 */
export async function getSession(): Promise<Session | null> {
  // Try staff session first
  const staffSession = await getStaffSession();
  if (staffSession) return staffSession;
  
  // Try student session
  const studentSession = await getStudentSession();
  if (studentSession) return studentSession;
  
  return null;
}

/**
 * Require staff authentication
 */
export async function requireStaffAuth(): Promise<StaffSession> {
  const session = await getStaffSession();
  
  if (!session) {
    throw new Error('Unauthorized: Staff login required');
  }
  
  return session;
}

/**
 * Require student authentication
 */
export async function requireStudentAuth(): Promise<StudentSession> {
  const session = await getStudentSession();
  
  if (!session) {
    throw new Error('Unauthorized: Please log in');
  }
  
  return session;
}

/**
 * Require specific staff role
 */
export async function requireRole(allowedRoles: string[]): Promise<StaffSession> {
  const session = await requireStaffAuth();
  
  if (!allowedRoles.includes(session.role)) {
    throw new Error(`Forbidden: Requires one of roles: ${allowedRoles.join(', ')}`);
  }
  
  return session;
}

// =============================================================================
// Session Validation Utilities
// =============================================================================

/**
 * Check if user is authenticated (any session type)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Check if user is staff
 */
export async function isStaff(): Promise<boolean> {
  const session = await getStaffSession();
  return session !== null;
}

/**
 * Check if user is student
 */
export async function isStudent(): Promise<boolean> {
  const session = await getStudentSession();
  return session !== null;
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const session = await getStaffSession();
  return session?.role === role;
}