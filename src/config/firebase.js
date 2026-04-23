import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Firebase Cloud Storage requires the Blaze (paid) plan since late 2024.
// Until the project is upgraded, there's no bucket to write to, so flip
// this to false — the app then skips all image upload attempts and
// strips large base64 blobs out of the Firestore payload too (docs are
// capped at 1 MB). Flip to true after running
//   gsutil cors set scripts/storage-cors.json gs://<bucket>
// on a Blaze-enabled project.
export const STORAGE_UPLOADS_ENABLED = false;

if (!firebaseConfig.apiKey) {
  console.warn(
    '[Firebase] Not configured — set firebaseConfig in src/config/firebase.js. ' +
    'Applications will only persist locally until Firebase is set up.',
  );
}

let app = null;
let db = null;
let storage = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    // Only initialise Cloud Storage when uploads are explicitly enabled.
    // Otherwise even importing getStorage() sets up the XHR plumbing that
    // triggers the CORS preflight on every upload attempt.
    if (STORAGE_UPLOADS_ENABLED) {
      storage = getStorage(app);
    }
  }
} catch (err) {
  console.warn('[Firebase] Init failed:', err?.message);
}

export { app, db, storage };
export const isFirebaseConfigured = () => !!db;
