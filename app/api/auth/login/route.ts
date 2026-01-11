import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-service';
import { 
  logUnhandledError,
} from '@/lib/security-logger';
import {
  checkLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
  getAttemptStatus,
} from '@/lib/login-limiter';
import { getClientIp } from '@/lib/api-security';

// Session cookie configuration
const SESSION_CONFIG = {
  cookieName: 'staff_session',
  maxAge: 60 * 60 * 24, // 24 hours in seconds
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check if login is allowed (brute force protection at IP level)
    const loginCheck = await checkLoginAllowed(username || 'unknown', ip);
    
    if (!loginCheck.allowed) {
      return NextResponse.json(
        { 
          error: loginCheck.message || 'Too many failed attempts. Please try again later.',
          lockedUntil: loginCheck.lockedUntil,
          attemptsRemaining: 0,
        },
        { status: 429 }
      );
    }

    // Authenticate user against database
    const result = await authenticateUser(username, password, ip);

    if (!result.success) {
      // Record failed login attempt for IP-based limiting
      await recordFailedLogin(username || 'unknown', ip);
      
      // Get updated attempt status
      const status = await getAttemptStatus(username || 'unknown', ip);
      const attemptsRemaining = Math.max(0, 5 - status.usernameAttempts);
      
      return NextResponse.json(
        { 
          error: result.error || 'Invalid credentials',
          attemptsRemaining: result.attemptsRemaining ?? attemptsRemaining,
          lockedUntil: result.lockedUntil,
        },
        { status: result.lockedUntil ? 429 : 401 }
      );
    }

    // Success - clear IP-based failed attempts
    await clearLoginAttempts(username, ip);

    // Create response with cookie
    const response = NextResponse.json({ 
      success: true,
      user: result.user,
    });

    // Set the session cookie explicitly in the response
    if (result.token) {
      response.cookies.set(SESSION_CONFIG.cookieName, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_CONFIG.maxAge,
      });
    }

    return response;
    
  } catch (error) {
    await logUnhandledError(error, 'login_route');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
