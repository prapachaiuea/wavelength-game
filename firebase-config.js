// Same Firebase project as insider-game (Wavelength's data lives under a separate
// top-level "wavelength" path in the same Realtime Database — see firebase-rules.json).
// This is safe to commit: it identifies the project, it does not grant access on its own.
// Access control is enforced entirely by firebase-rules.json (published in the Realtime Database Rules tab).
export const firebaseConfig = {
  apiKey: "AIzaSyAFWtuAA3oWrKMua_MqF_LqYtDMKciDqjc",
  authDomain: "wavelength-game-323f3.firebaseapp.com",
  databaseURL: "https://wavelength-game-323f3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wavelength-game-323f3",
  storageBucket: "wavelength-game-323f3.firebasestorage.app",
  messagingSenderId: "259465241760",
  appId: "1:259465241760:web:6b45ae3d119b1e9bc955c5"
};
