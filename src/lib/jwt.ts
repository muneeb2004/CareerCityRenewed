import { SignJWT, jwtVerify } from 'jose';
import { logInvalidToken, logSessionExpired } from './security-logger';

// CRITICAL: JWT_SECRET must be set in environment variables
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (SECRET_KEY.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
const key = new TextEncoder().encode(SECRET_KEY);

export async function signToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // Log token verification failures
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        await logSessionExpired();
      } else {
        await logInvalidToken(error.message);
      }
    }
    return null;
  }
}
