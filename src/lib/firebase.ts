// Prompt for Copilot: "Initialize Firebase with default Firestore database, no billing required"

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "AIzaSyBEspoXEl1p0bQh5p6WQPz-N51Tf6W3fto",
  authDomain: "career-city-2026.firebaseapp.com",
  databaseURL: "https://career-city-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "career-city-2026",
  storageBucket: "career-city-2026.firebasestorage.app",
  messagingSenderId: "653099471884",
  appId: "1:653099471884:web:4d120f575387c31a1a4a29",
  measurementId: "G-TMKHB83F82"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Use DEFAULT Firestore database (no billing required)
export const db = getFirestore(app); // This connects to (default) database

export const auth = getAuth(app);
export default app;