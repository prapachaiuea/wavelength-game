// Same Firebase project as insider-game (Wavelength's data lives under a separate
// top-level "wavelength" path in the same Realtime Database — see firebase-rules.json).
// This is safe to commit: it identifies the project, it does not grant access on its own.
// Access control is enforced entirely by firebase-rules.json (published in the Realtime Database Rules tab).
export const firebaseConfig = {
  apiKey: "AIzaSyACYFkxZZIQ6L8027itBO8wtweP8yt7kBo",
  authDomain: "insider-1d53a.firebaseapp.com",
  databaseURL: "https://insider-1d53a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "insider-1d53a",
  storageBucket: "insider-1d53a.firebasestorage.app",
  messagingSenderId: "783029865509",
  appId: "1:783029865509:web:34089f18786490123743cc",
};
