import { NextRequest, NextResponse } from 'next/server';
import { hasAnyUsers, createUser } from '@/lib/auth-service';
import { createAuditLog } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/api-security';

/**
 * POST /api/auth/setup
 * One-time setup to create the first admin user
 * Only works if no users exist in the database
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    // Check if any users exist
    const usersExist = await hasAnyUsers();
    
    if (usersExist) {
      await createAuditLog({
        action: 'access_denied',
        success: false,
        details: { 
          reason: 'setup_already_completed',
          endpoint: '/api/auth/setup',
        },
        ipAddress: ip,
      });
      
      return NextResponse.json(
        { error: 'Setup has already been completed. Admin user already exists.' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { username, password, name, email } = body;
    
    // Validate required fields
    if (!username || !password || !name) {
      return NextResponse.json(
        { error: 'Username, password, and name are required' },
        { status: 400 }
      );
    }
    
    // Create the first admin user
    const result = await createUser({
      username,
      password,
      name,
      role: 'admin',
      email,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    await createAuditLog({
      action: 'import', // Using 'import' as it's the closest to 'setup'
      userId: result.user?.id,
      userRole: 'admin',
      success: true,
      details: { 
        action: 'initial_admin_setup',
        username: result.user?.username,
      },
      ipAddress: ip,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully. You can now log in.',
      user: result.user,
    });
    
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/setup
 * Check if setup is needed (no users exist)
 */
export async function GET(request: NextRequest) {
  try {
    const usersExist = await hasAnyUsers();
    
    return NextResponse.json({
      setupRequired: !usersExist,
      message: usersExist 
        ? 'Setup has already been completed' 
        : 'No users found. Setup is required.',
    });
    
  } catch (error) {
    console.error('Setup check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
