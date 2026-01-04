import { NextResponse } from 'next/server';
import { createStaffSession } from '@/lib/auth';
import credentials from '@/lib/staff-credentials.json';
import { 
  logLoginSuccess, 
  logLoginFailure, 
  logUnhandledError,
  getClientIp,
} from '@/lib/security-logger';
import {
  checkLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
  getAttemptStatus,
} from '@/lib/login-limiter';

export async function POST(request: Request) {
  const ip = await getClientIp();
  
  try {
    const body = await request.json();
    const { username, password } = body;

    // Check if login is allowed (brute force protection)
    const loginCheck = await checkLoginAllowed(username || 'unknown', ip);
    
    if (!loginCheck.allowed) {
      await logLoginFailure(username || 'unknown', 'account_locked');
      
      return NextResponse.json(
        { 
          message: loginCheck.message || 'Too many failed attempts. Please try again later.',
          lockedUntil: loginCheck.lockedUntil,
          attemptsRemaining: 0,
        },
        { status: 429 } // Too Many Requests
      );
    }

    const user = credentials.users.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      // Record failed login attempt
      await recordFailedLogin(username || 'unknown', ip);
      await logLoginFailure(username || 'unknown', 'invalid_credentials');
      
      // Get updated attempt status
      const status = await getAttemptStatus(username || 'unknown', ip);
      const attemptsRemaining = Math.max(0, 5 - status.usernameAttempts);
      
      return NextResponse.json(
        { 
          message: attemptsRemaining > 0 
            ? `Invalid credentials. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`
            : 'Invalid credentials.',
          attemptsRemaining,
        },
        { status: 401 }
      );
    }

    // Success - create session and clear failed attempts
    await createStaffSession(user.username, user.role);
    await clearLoginAttempts(username, ip);
    await logLoginSuccess(user.username, user.role);

    return NextResponse.json({ success: true });
  } catch (error) {
    // Log unhandled error
    await logUnhandledError(error, 'login_route');
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
