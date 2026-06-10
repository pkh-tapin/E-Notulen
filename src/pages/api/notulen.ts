import { NextApiRequest, NextApiResponse } from 'next';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove, push } from 'firebase/database';

// Inisialisasi Firebase langsung di dalam API agar tidak ada masalah jalur (path)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Pastikan konfigurasi Firebase terbaca
    if (!firebaseConfig.databaseURL) {
      console.error("🔥 ERROR FIREBASE: Variabel .env untuk Firebase kosong!");
      return res.status(500).json({ error: "Konfigurasi Database Hilang" });
    }

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getDatabase(app);
    const notesRef = ref(db, 'notes');

    if (req.method === 'GET') {
      const snapshot = await get(notesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const dataArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        return res.status(200).json(dataArray);
      }
      return res.status(200).json([]);
    } 
    
    else if (req.method === 'POST') {
      const newData = req.body;
      const newNoteRef = push(notesRef);
      await set(newNoteRef, { ...newData, created_at: Date.now() });
      return res.status(201).json({ success: true, id: newNoteRef.key });
    } 
    
    else if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      if (!id) return res.status(400).json({ error: 'ID tidak ditemukan untuk update' });
      const noteToUpdateRef = ref(db, `notes/${id}`);
      await set(noteToUpdateRef, { ...updateData, updated_at: Date.now() });
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error("🔥 FATAL ERROR DB:", error);
    return res.status(500).json({ error: `Server Database Error: ${error.message}` });
  }
}