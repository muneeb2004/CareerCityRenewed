import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/auth';
import { 
  getAllUsers, 
  createUser, 
  CreateUserInput 
} from '@/lib/auth-service';
import { createAuditLog } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/api-security';

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
export async function GET(request: NextRequest) {
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
          endpoint: '/api/admin/users',
          reason: 'insufficient_permissions',
        },
        ipAddress: ip,
      });
      
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const result = await getAllUsers();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ users: result.users });
    
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user (admin only)
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
    
    if (session.role !== 'admin') {
      await createAuditLog({
        action: 'access_denied',
        userId: session.username,
        userRole: session.role,
        success: false,
        details: { 
          endpoint: '/api/admin/users',
          action: 'create_user',
          reason: 'insufficient_permissions',
        },
        ipAddress: ip,
      });
      
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { username, password, name, role, email } = body;
    
    // Validate required fields
    if (!username || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Username, password, name, and role are required' },
        { status: 400 }
      );
    }
    
    // Validate role
    if (!['admin', 'staff', 'volunteer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, staff, or volunteer' },
        { status: 400 }
      );
    }
    
    const input: CreateUserInput = {
      username,
      password,
      name,
      role,
      email,
    };
    
    const result = await createUser(input);
    
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
        action: 'user_created',
        createdUsername: result.user?.username,
        createdRole: result.user?.role,
      },
      ipAddress: ip,
    });
    
    return NextResponse.json({
      success: true,
      user: result.user,
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
