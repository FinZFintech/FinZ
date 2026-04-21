import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ─── Firebase Configuration ─────────────────────────────────────────────────
//
// Create a Firebase project at https://console.firebase.google.com:
//   1. Create new project (e.g. "FinZ")
//   2. Add a Web app (</> icon)
//   3. Copy the firebaseConfig object below
//   4. Go to Firestore Database → Create database → Start in test mode
//   5. Choose a region close to your users (e.g. asia-south1 for India)
//
// The free Spark plan handles: 1 GB storage, 50K reads/day, 20K writes/day.

const firebaseConfig = {
  apiKey: 'AIzaSyCFJWb90Y0Cj11L0pNc1mJ0l4DW5uT0eZU',
  authDomain: 'finz-2e9dc.firebaseapp.com',
  projectId: 'finz-2e9dc',
  storageBucket: 'finz-2e9dc.firebasestorage.app',
  messagingSenderId: '47131445566',
  appId: '1:47131445566:web:d313e5c09e9daccf08046f',
  measurementId: 'G-REGJP0CEV4',
};

if (!firebaseConfig.apiKey) {
  console.warn(
    '[Firebase] Not configured — set firebaseConfig in src/config/firebase.js. ' +
    'Applications will only persist locally until Firebase is set up.',
  );
}

let app = null;
let db = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (err) {
  console.warn('[Firebase] Init failed:', err?.message);
}

export { app, db };
export const isFirebaseConfigured = () => !!db;
