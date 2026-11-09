import { auth } from "./firebase-init.mjs";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, sendEmailVerification,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const $ = (id) => document.getElementById(id);
const status = (message, isError = false) => {
  $("status").textContent = message;
  $("status").style.color = isError ? "#ffaaa8" : "#c8e7f7";
};
const email = () => $("email").value.trim();
const password = () => $("password").value;
function validate() {
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email())) throw new Error("सही Email address लिखें।");
  if (password().length < 6) throw new Error("Password कम से कम 6 अक्षर का होना चाहिए।");
}
async function run(buttonId, task) {
  const button = $(buttonId);
  button.disabled = true;
  try { await task(); }
  catch (error) { status(error?.message || "कार्य पूरा नहीं हुआ।", true); }
  finally { button.disabled = false; }
}
$("emailRegister").addEventListener("click", () => run("emailRegister", async () => {
  validate();
  const result = await createUserWithEmailAndPassword(auth, email(), password());
  await sendEmailVerification(result.user);
  status("खाता बन गया। Verification email भेजा गया है। Inbox और Spam folder देखें।");
}));
$("emailLogin").addEventListener("click", () => run("emailLogin", async () => {
  validate();
  const result = await signInWithEmailAndPassword(auth, email(), password());
  status(result.user.emailVerified ? "Login सफल। Email verified है।" : "Login सफल, लेकिन Email verification बाकी है।");
}));
$("googleLogin").addEventListener("click", () => run("googleLogin", async () => {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  status(`Google Login सफल: ${result.user.email || "ईमेल उपलब्ध नहीं"}`);
}));
$("resetPassword").addEventListener("click", () => run("resetPassword", async () => {
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email())) throw new Error("पहले Email address लिखें।");
  await sendPasswordResetEmail(auth, email());
  status("Password reset email भेजा गया है। Inbox और Spam folder देखें।");
}));
$("verifyEmail").addEventListener("click", () => run("verifyEmail", async () => {
  if (!auth.currentUser) throw new Error("पहले Login करें।");
  await sendEmailVerification(auth.currentUser);
  status("Verification email फिर से भेजा गया है।");
}));
$("logout").addEventListener("click", () => run("logout", async () => {
  await signOut(auth);
  status("Logout सफल।");
}));
onAuthStateChanged(auth, (user) => {
  $("signedOut").classList.toggle("hidden", Boolean(user));
  $("signedIn").classList.toggle("hidden", !user);
  if (user) {
    $("userInfo").textContent = `Logged in: ${user.email || "Google account"}\nEmail verified: ${user.emailVerified ? "हाँ" : "नहीं"}`;
  }
});
