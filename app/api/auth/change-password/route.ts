import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/auth';
import { changePassword } from '@/lib/auth-service';
import { User } from '@/models/User';
import dbConnect from '@/lib/db';
import { createAuditLog } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/api-security';

/**
 * POST /api/auth/change-password
 * Change the current user's password
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    const session = await getStaffSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }
    
    // Find user by username to get their ID
    await dbConnect();
    const user = await User.findOne({ username: session.username });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Change password
    const result = await changePassword(
      user._id.toString(),
      currentPassword,
      newPassword
    );
    
    if (!result.success) {
      await createAuditLog({
        action: 'access_denied',
        userId: user._id.toString(),
        success: false,
        details: { 
          action: 'password_change_failed',
          reason: result.error,
        },
        ipAddress: ip,
      });
      
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    await createAuditLog({
      action: 'validate',
      userId: user._id.toString(),
      userRole: session.role,
      success: true,
      details: { action: 'password_changed' },
      ipAddress: ip,
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
