import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const USERS_COLLECTION = 'staff_users';

/**
 * Create a new staff user (admin, sales, credit, operations).
 * Only admin can call this. The user logs in via phone OTP.
 */
export async function createStaffUser({ phone, email, name, role, loginMethod, createdBy }) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  if (!name || !role) throw new Error('Name and role are required');

  const usePhone = loginMethod !== 'email';
  const identifier = usePhone ? phone : email;
  if (!identifier) throw new Error(usePhone ? 'Phone number is required' : 'Email is required');

  // Validate phone pattern
  if (usePhone && !/^[6-9]\d{9}$/.test(phone)) {
    throw new Error('Invalid mobile number. Must start with 6-9 and be 10 digits.');
  }

  // Check duplicate by phone
  if (usePhone) {
    const existing = await getStaffUserByPhone(phone);
    if (existing) throw new Error(`A user with mobile ${phone} already exists (${existing.name}).`);
  }

  // Check duplicate by email
  if (!usePhone && email) {
    const existing = await getStaffUserByEmail(email);
    if (existing) throw new Error(`A user with email ${email} already exists (${existing.name}).`);
  }

  const userId = usePhone ? `staff_${phone}` : `staff_email_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const userData = {
    userId,
    phone: phone || '',
    email: email || '',
    name,
    role,
    loginMethod: loginMethod || 'phone',
    active: true,
    createdBy: createdBy || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, USERS_COLLECTION, userId), userData);
  console.log('[userService] Created staff user:', identifier, role);
  return { ...userData, userId };
}

/**
 * Disable (deactivate) a staff user. They can no longer log in.
 */
export async function disableStaffUser(identifier, disabledBy) {
  if (!isFirebaseConfigured()) return;
  const user = (await getStaffUserByPhone(identifier)) || (await getStaffUserByEmail(identifier));
  if (!user) throw new Error('User not found');

  await updateDoc(doc(db, USERS_COLLECTION, user.userId), {
    active: false,
    disabledBy: disabledBy || '',
    disabledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log('[userService] Disabled user:', identifier);
}

/**
 * Enable (reactivate) a staff user.
 * Accepts phone or email as identifier.
 */
export async function enableStaffUser(identifier, enabledBy) {
  if (!isFirebaseConfigured()) return;
  const user = (await getStaffUserByPhone(identifier)) || (await getStaffUserByEmail(identifier));
  if (!user) throw new Error('User not found');

  await updateDoc(doc(db, USERS_COLLECTION, user.userId), {
    active: true,
    enabledBy: enabledBy || '',
    updatedAt: serverTimestamp(),
  });
  console.log('[userService] Enabled user:', identifier);
}

/**
 * Look up a staff user by phone number.
 */
export async function getStaffUserByPhone(phone) {
  if (!isFirebaseConfigured() || !phone) return null;
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('phone', '==', phone),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docData = snapshot.docs[0].data();
    return { ...docData, id: snapshot.docs[0].id };
  } catch (err) {
    console.log('[userService] Lookup failed:', err?.message);
    return null;
  }
}

/**
 * Look up a staff user by email address.
 */
export async function getStaffUserByEmail(email) {
  if (!isFirebaseConfigured() || !email) return null;
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', email.toLowerCase().trim()),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docData = snapshot.docs[0].data();
    return { ...docData, id: snapshot.docs[0].id };
  } catch (err) {
    console.log('[userService] Email lookup failed:', err?.message);
    return null;
  }
}

/**
 * Get all staff users (for admin user management screen).
 */
export async function getAllStaffUsers() {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(q);
    const users = [];
    snapshot.forEach((d) => users.push({ ...d.data(), id: d.id }));
    return users;
  } catch (err) {
    console.log('[userService] Load all failed:', err?.message);
    return [];
  }
}

/**
 * Update a staff user's role.
 */
export async function updateStaffUserRole(phone, newRole, updatedBy) {
  if (!isFirebaseConfigured()) return;
  const user = await getStaffUserByPhone(phone);
  if (!user) throw new Error('User not found');

  await updateDoc(doc(db, USERS_COLLECTION, user.userId), {
    role: newRole,
    updatedBy: updatedBy || '',
    updatedAt: serverTimestamp(),
  });
  console.log('[userService] Updated role:', phone, '→', newRole);
}

// ─── Case Assignment ──────────────────────────────────────────────────────

/**
 * Assign an application to a specific staff user.
 */
export async function assignApplication(applicationId, assignedTo, assignedBy) {
  if (!isFirebaseConfigured() || !applicationId) return;
  try {
    await setDoc(doc(db, 'applications', applicationId), {
      assignedTo,
      assignedBy: assignedBy || '',
      assignedAt: serverTimestamp(),
      _updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[userService] Assigned:', applicationId, '→', assignedTo);
  } catch (err) {
    console.log('[userService] Assign failed:', err?.message);
  }
}

/**
 * Move application to a specific workflow bucket.
 * salesComplete → credit bucket (if not auto-approved)
 * creditApprove → operations bucket
 */
export async function moveToWorkflowBucket(applicationId, bucket, movedBy, reason) {
  if (!isFirebaseConfigured() || !applicationId) return;
  try {
    await setDoc(doc(db, 'applications', applicationId), {
      workflowBucket: bucket,
      workflowHistory: {
        [new Date().toISOString()]: {
          from: bucket === 'credit' ? 'sales' : bucket === 'operations' ? 'credit' : 'unknown',
          to: bucket,
          by: movedBy || '',
          reason: reason || '',
        },
      },
      _updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[userService] Moved to bucket:', applicationId, '→', bucket);
  } catch (err) {
    console.log('[userService] Move failed:', err?.message);
  }
}

/**
 * Request rejection (from sales) — parks the application for
 * credit/admin review.
 */
export async function requestRejection(applicationId, requestedBy, reason) {
  if (!isFirebaseConfigured() || !applicationId) return;
  try {
    await setDoc(doc(db, 'applications', applicationId), {
      rejectionRequested: true,
      rejectionRequest: {
        by: requestedBy || '',
        reason: reason || '',
        at: new Date().toISOString(),
      },
      _updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[userService] Rejection requested:', applicationId);
  } catch (err) {
    console.log('[userService] Request rejection failed:', err?.message);
  }
}

/**
 * Get all active sales users (for assignment dropdown).
 */
export async function getSalesUsers() {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'sales'),
      where('active', '==', true),
    );
    const snapshot = await getDocs(q);
    const users = [];
    snapshot.forEach((d) => users.push({ ...d.data(), id: d.id }));
    return users;
  } catch (err) {
    console.log('[userService] Get sales users failed:', err?.message);
    return [];
  }
}
