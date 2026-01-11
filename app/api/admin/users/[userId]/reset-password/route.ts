import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/auth';
import { resetUserPassword, validatePassword } from '@/lib/auth-service';
import { createAuditLog } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/api-security';
import { User } from '@/models/User';
import dbConnect from '@/lib/db';

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset a user's password (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ip = getClientIp(request);
  
  try {
    const session = await getStaffSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    if (session.role !== 'admin') {
      await createAuditLog({
        action: 'access_denied',
        userId: session.username,
        userRole: session.role,
        success: false,
        details: { 
          endpoint: '/api/admin/users/:userId/reset-password',
          action: 'reset_password',
          reason: 'insufficient_permissions',
        },
        ipAddress: ip,
      });
      
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const { userId } = await params;
    const body = await request.json();
    const { newPassword } = body;
    
    // Validate new password
    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }
    
    // Get target user info for logging
    await dbConnect();
    const targetUser = await User.findById(userId);
    
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const result = await resetUserPassword(userId, newPassword);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    await createAuditLog({
      action: 'import',
      userId: session.username,
      userRole: session.role,
      success: true,
      details: { 
        action: 'password_reset_by_admin',
        targetUserId: userId,
        targetUsername: targetUser.username,
      },
      ipAddress: ip,
    });
    
    return NextResponse.json({ 
      success: true,
      message: `Password reset successfully for ${targetUser.username}`,
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
