import {
  doc, setDoc, getDoc, getDocs, collection,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const USERS_COLLECTION = 'user_profiles';
const GUARDIANS_COLLECTION = 'guardian_links';

// ─── User Profile ────────────────────────────────────────────────────────

/**
 * Save or update a user profile in Firestore.
 * Called after every login and profile update.
 */
export async function saveUserProfile(userData) {
  if (!isFirebaseConfigured() || !userData?.phone) return;
  try {
    const userId = `user_${userData.phone}`;
    await setDoc(doc(db, USERS_COLLECTION, userId), {
      userId,
      phone: userData.phone,
      name: userData.name || '',
      email: userData.email || '',
      dob: userData.dob || '',
      gender: userData.gender || '',
      address: userData.address || '',
      role: userData.role || 'customer',
      kycVerified: userData.kycVerified || false,
      lastLoginAt: userData.lastLoginAt || new Date().toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[userProfile] Saved profile:', userData.phone);
  } catch (err) {
    console.log('[userProfile] Save failed:', err?.message);
  }
}

/**
 * Load a user profile from Firestore.
 */
export async function loadUserProfile(phone) {
  if (!isFirebaseConfigured() || !phone) return null;
  try {
    const userId = `user_${phone}`;
    const snap = await getDoc(doc(db, USERS_COLLECTION, userId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.log('[userProfile] Load failed:', err?.message);
    return null;
  }
}

// ─── Guardian Links ──────────────────────────────────────────────────────

/**
 * Save a guardian link: student → parent/guardian relationship.
 * Stored bidirectionally so both student and guardian can query.
 */
export async function saveGuardianLink({
  studentPhone,
  studentName,
  guardianPhone,
  guardianName,
  relation,
  addedBy,
}) {
  if (!isFirebaseConfigured() || !studentPhone || !guardianPhone) return;
  try {
    const linkId = `${studentPhone}_${guardianPhone}`;
    await setDoc(doc(db, GUARDIANS_COLLECTION, linkId), {
      linkId,
      studentPhone,
      studentName: studentName || '',
      guardianPhone,
      guardianName: guardianName || '',
      relation: relation || 'Guardian',
      addedBy: addedBy || studentPhone,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[guardianLink] Saved:', studentPhone, '→', guardianPhone, relation);
  } catch (err) {
    console.log('[guardianLink] Save failed:', err?.message);
  }
}

/**
 * Get all guardians linked to a student.
 */
export async function getGuardiansForStudent(studentPhone) {
  if (!isFirebaseConfigured() || !studentPhone) return [];
  try {
    const q = query(
      collection(db, GUARDIANS_COLLECTION),
      where('studentPhone', '==', studentPhone),
      where('active', '==', true),
    );
    const snapshot = await getDocs(q);
    const guardians = [];
    snapshot.forEach((d) => guardians.push(d.data()));
    return guardians;
  } catch (err) {
    console.log('[guardianLink] Load guardians failed:', err?.message);
    return [];
  }
}

/**
 * Get all students linked to a guardian (parent).
 * Used to show the guardian all loans initiated by their wards.
 */
export async function getStudentsForGuardian(guardianPhone) {
  if (!isFirebaseConfigured() || !guardianPhone) return [];
  try {
    const q = query(
      collection(db, GUARDIANS_COLLECTION),
      where('guardianPhone', '==', guardianPhone),
      where('active', '==', true),
    );
    const snapshot = await getDocs(q);
    const students = [];
    snapshot.forEach((d) => students.push(d.data()));
    return students;
  } catch (err) {
    console.log('[guardianLink] Load students failed:', err?.message);
    return [];
  }
}

/**
 * Get all loan applications visible to a guardian.
 * Queries the applications collection for all linked student phones.
 */
export async function getLoansForGuardian(guardianPhone) {
  if (!isFirebaseConfigured() || !guardianPhone) return [];
  try {
    // First get all linked students
    const students = await getStudentsForGuardian(guardianPhone);
    if (students.length === 0) return [];

    const studentPhones = students.map((s) => s.studentPhone);

    // Query applications where borrowerDetails.phone matches any student phone
    // Firestore 'in' supports up to 10 values
    const batches = [];
    for (let i = 0; i < studentPhones.length; i += 10) {
      const batch = studentPhones.slice(i, i + 10);
      const q = query(
        collection(db, 'applications'),
        where('borrowerDetails.phone', 'in', batch),
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.applicationId) batches.push(data);
      });
    }

    // Also check applications where the guardian is the borrower
    const guardianQ = query(
      collection(db, 'applications'),
      where('borrowerDetails.phone', '==', guardianPhone),
    );
    const guardianSnap = await getDocs(guardianQ);
    guardianSnap.forEach((d) => {
      const data = d.data();
      if (data.applicationId && !batches.find((b) => b.applicationId === data.applicationId)) {
        batches.push(data);
      }
    });

    console.log('[guardianLink] Found', batches.length, 'loan(s) for guardian:', guardianPhone);
    return batches;
  } catch (err) {
    console.log('[guardianLink] Load loans failed:', err?.message);
    return [];
  }
}
