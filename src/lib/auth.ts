import { cookies } from 'next/headers';
import { verifyToken } from './jwt';

export * from './jwt';

export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get('staff_session')?.value;
  if (!token) return null;
  return await verifyToken(token);
}