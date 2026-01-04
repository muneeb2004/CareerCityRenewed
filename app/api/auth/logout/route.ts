import { NextResponse } from 'next/server';
import { destroyStaffSession, getStaffSession } from '@/lib/auth';
import { logLogout } from '@/lib/security-logger';

export async function POST() {
  try {
    // Get current user before logging out
    const session = await getStaffSession();
    if (session?.username) {
      await logLogout(session.username);
    }
  } catch {
    // Silent fail for logging - don't block logout
  }
  
  await destroyStaffSession();
  return NextResponse.json({ success: true });
}
