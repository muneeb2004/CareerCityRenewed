/**
 * Blocked Resource Endpoint
 * Returns 403 Forbidden for protected resources
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST() {
  return new NextResponse('Forbidden', { status: 403 });
}

export async function PUT() {
  return new NextResponse('Forbidden', { status: 403 });
}

export async function DELETE() {
  return new NextResponse('Forbidden', { status: 403 });
}
