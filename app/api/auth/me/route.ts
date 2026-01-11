import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/auth';
import { getUserByUsername } from '@/lib/auth-service';

/**
 * GET /api/auth/me
 * Returns current authenticated user info
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getStaffSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Fetch full user details from database
    const result = await getUserByUsername(session.username);

    if (!result.success || !result.user) {
         // Fallback to session data if DB fetch fails (shouldn't happen usually)
        return NextResponse.json({
            username: session.username,
            role: session.role,
            type: session.type,
            name: session.username, // Fallback
        });
    }

    return NextResponse.json({
      id: result.user.id,
      username: result.user.username,
      name: result.user.name,
      role: result.user.role,
      email: result.user.email,
      type: session.type,
    });
    
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}