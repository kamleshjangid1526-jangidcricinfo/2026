import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { auth, firestore } from "./firebase-init.mjs";

const googleProvider = new GoogleAuthProvider();

function requireEmailAndPassword(email, password) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("कृपया सही Gmail/Email address लिखें।");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Password कम से कम 6 अक्षरों का होना चाहिए।");
  }
}

async function saveBasicProfile(user, profile = {}) {
  // User profile only; never store passwords or client-controlled admin flags.
  await setDoc(doc(firestore, "users", user.uid), {
    uid: user.uid,
    email: user.email || null,
    displayName: profile.fullName || user.displayName || null,
    mobile: profile.mobile || null,
    address: profile.address || null,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function registerWithEmail(email, password, profile = {}) {
  requireEmailAndPassword(email, password);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (profile.fullName) {
    await updateProfile(credential.user, { displayName: profile.fullName });
  }
  await sendEmailVerification(credential.user);
  await saveBasicProfile(credential.user, profile);
  return credential.user;
}

export async function loginWithEmail(email, password) {
  requireEmailAndPassword(email, password);
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  await saveBasicProfile(credential.user);
  return credential.user;
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error("पहले Login करें।");
  await sendEmailVerification(auth.currentUser);
}

export async function sendPasswordReset(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("कृपया सही Email address लिखें।");
  }
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logout() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
