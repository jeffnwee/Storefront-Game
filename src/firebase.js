import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBq5lzgJAY4H_7py32FCSHTnxuwvU-1Ixk",
  authDomain: "storefront-game.firebaseapp.com",
  databaseURL: "https://storefront-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "storefront-game",
  storageBucket: "storefront-game.firebasestorage.app",
  messagingSenderId: "805711728537",
  appId: "1:805711728537:web:9aace7f18cd32020e78d08"
};

// The kiosk staff account created in Firebase Authentication (Email/Password).
// The UID is not secret; the password is never stored in this code.
const STAFF_UID = "kkPf48QNkLNpCfmqGneazdInQ5o2";
const STAFF_EMAIL_KEY = "storefront-staff-email";

export const firebaseApp = initializeApp(firebaseConfig);

if (["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.startsWith("192.168.")) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider("6LcSsdItAAAAAByIYOLLgdp8E0HdfGOr2SoBjwyU"),
  isTokenAutoRefreshEnabled: true
});

export const db = getDatabase(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

// ---- Staff sign-in -------------------------------------------------------
// Staff type the password once on the kiosk. Firebase remembers the login on this device,
// so later reloads sign straight back in with no prompt.
let loginOverlay = null;

function showStaffLogin() {
  if (loginOverlay) {
    return;
  }

  loginOverlay = document.createElement("div");
  loginOverlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#151515;font-family:system-ui,sans-serif;color:#fff;";
  loginOverlay.innerHTML = `
    <form id="staffLoginForm" style="display:grid;gap:14px;width:min(360px,86vw);">
      <h1 style="margin:0;font-size:22px;">Staff sign-in</h1>
      <input id="staffEmail" type="email" placeholder="Staff email" autocomplete="username" required
        style="padding:12px;border-radius:8px;border:0;font-size:16px;">
      <input id="staffPassword" type="password" placeholder="Password" autocomplete="current-password" required
        style="padding:12px;border-radius:8px;border:0;font-size:16px;">
      <button type="submit" style="padding:12px;border-radius:8px;border:0;background:#ed1d24;color:#fff;font-size:16px;cursor:pointer;">Sign in</button>
      <p id="staffLoginError" style="margin:0;color:#ffb4b4;min-height:1.2em;"></p>
    </form>`;
  document.body.appendChild(loginOverlay);

  const emailInput = loginOverlay.querySelector("#staffEmail");
  const passwordInput = loginOverlay.querySelector("#staffPassword");
  const errorText = loginOverlay.querySelector("#staffLoginError");
  emailInput.value = window.localStorage.getItem(STAFF_EMAIL_KEY) || "";

  loginOverlay.querySelector("#staffLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    errorText.textContent = "Signing in...";
    try {
      await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
      window.localStorage.setItem(STAFF_EMAIL_KEY, emailInput.value.trim());
    } catch (error) {
      errorText.textContent = `Sign-in failed (${error.code || error.message})`;
      console.warn("Staff sign-in failed", error);
    }
  });
}

function hideStaffLogin() {
  loginOverlay?.remove();
  loginOverlay = null;
}

// Resolves once the staff account is signed in. Anonymous or other users are ignored.
export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user && user.uid === STAFF_UID) {
      hideStaffLogin();
      resolve(user);
      return;
    }
    showStaffLogin();
  });
});