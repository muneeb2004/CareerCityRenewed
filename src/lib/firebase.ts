// Prompt for Copilot: "Initialize Firebase with default Firestore database, no billing required"

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Development-time logs & runtime checks to help debugging env issues
if (process.env.NODE_ENV === 'development') {
  // Basic presence checks (don't log secrets in production)
  const missing: string[] = [];
  if (!firebaseConfig.apiKey) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!firebaseConfig.projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.authDomain) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] Missing env vars:', missing.join(', '), '\nEnsure .env.local is present and restart the dev server.');
  } else {
    // eslint-disable-next-line no-console
    console.log('[firebase] Initializing Firebase for project:', firebaseConfig.projectId);
  }
}

// Initialize Firestore (do not force a specific database id)
export const db = getFirestore(app);

export const auth = getAuth(app);
export default app;
