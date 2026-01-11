import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/auth';
import { updateUser, deleteUser, getUserById } from '@/lib/auth-service';
import { createAuditLog } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/api-security';
import { User } from '@/models/User';
import dbConnect from '@/lib/db';

/**
 * GET /api/admin/users/:userId
 * Get a specific user (admin only)
 */
export async function GET(
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
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const { userId } = await params;
    const result = await getUserById(userId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ user: result.user });
    
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/:userId
 * Update a user (admin only)
 */
export async function PUT(
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
          endpoint: '/api/admin/users/:userId',
          action: 'update_user',
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
    const { name, email, role, isActive } = body;
    
    // Validate role if provided
    if (role && !['admin', 'staff', 'volunteer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, staff, or volunteer' },
        { status: 400 }
      );
    }
    
    const result = await updateUser(userId, {
      name,
      email,
      role,
      isActive,
    });
    
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
        action: 'user_updated',
        targetUserId: userId,
        updates: { name, email, role, isActive },
      },
      ipAddress: ip,
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/:userId
 * Delete a user (soft delete, admin only)
 */
export async function DELETE(
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
          endpoint: '/api/admin/users/:userId',
          action: 'delete_user',
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
    
    // Prevent self-deletion
    await dbConnect();
    const targetUser = await User.findById(userId);
    
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (targetUser.username === session.username) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }
    
    const result = await deleteUser(userId);
    
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
        action: 'user_deleted',
        targetUserId: userId,
        targetUsername: targetUser.username,
      },
      ipAddress: ip,
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
