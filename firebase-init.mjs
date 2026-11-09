import { initializeApp, getApps, getApp } from
  "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from
  "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from
  "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { getDatabase } from
  "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const required = ["apiKey", "authDomain", "projectId", "appId"];
const missing = required.filter((key) => {
  const value = firebaseConfig?.[key];
  return !value || String(value).startsWith("PASTE_") ||
    String(value).startsWith("YOUR_");
});

if (missing.length) {
  throw new Error(
    `Firebase config is incomplete. Fill these fields in firebase-config.js: ${missing.join(", ")}`
  );
}

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

// RTDB URL must be the exact URL shown in Firebase Console.
export const realtimeDb = firebaseConfig.databaseURL
  ? getDatabase(firebaseApp)
  : null;

export const firebaseReady = Object.freeze({
  initialized: true,
  projectId: firebaseConfig.projectId,
  hasRealtimeDatabase: Boolean(realtimeDb)
});
