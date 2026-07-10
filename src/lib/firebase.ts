import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAp-8B3CXLQikB-8-b9-pKlqH2aTX-5lcU",
  authDomain: "e-notulen-ecfd7.firebaseapp.com",
  databaseURL: "https://e-notulen-ecfd7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-notulen-ecfd7",
  storageBucket: "e-notulen-ecfd7.firebasestorage.app",
  messagingSenderId: "278047156272",
  appId: "1:278047156272:web:73735a002662bee33525f5"
};

// Mencegah inisialisasi ganda saat Next.js melakukan re-render
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Realtime Database
const db = getDatabase(app);

export { app, db };
