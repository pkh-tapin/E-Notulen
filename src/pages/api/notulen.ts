import { NextApiRequest, NextApiResponse } from 'next';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove, push, child } from 'firebase/database';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', 
    },
  },
};

// =========================================================================
// 🔴 TITIK 1: KONEKSI DATABASE
// Jika aplikasi masih kosong setelah ini di-push, HAPUS tulisan `process.env...` 
// dan GANTI dengan konfigurasi string asli yang ada di file `firebase.ts` Anda.
// =========================================================================
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const cleanObjectData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (copy[key] === undefined || copy[key] === null) copy[key] = ''; 
    else if (typeof copy[key] === 'string') copy[key] = copy[key].replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    else if (typeof copy[key] === 'object') copy[key] = cleanObjectData(copy[key]); 
  }
  return copy;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getDatabase(app);
    
    // =========================================================================
    // 🔴 TITIK 2: PASTIKAN NAMA FOLDER SAMA PERSIS DENGAN DI FIREBASE ANDA
    // =========================================================================
    const collectionName = 'notulen'; // <-- Jika di gambar Firebase namanya lain (misal 'Data_Notulen'), ubah kata 'notulen' ini!
    
    const dbRef = ref(db, collectionName);

    let rawBody = req.body;
    if (typeof rawBody === 'string' && rawBody.trim() !== '') {
      try { rawBody = JSON.parse(rawBody); } catch (e) {}
    }

    if (req.method === 'GET') {
      const { id } = req.query;
      
      if (id) {
        const snapshot = await get(child(ref(db), `${collectionName}/${id}`));
        if (snapshot.exists()) return res.status(200).json(snapshot.val());
        return res.status(404).json({ error: 'Data tidak ditemukan' });
      }

      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const dataArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        return res.status(200).json(dataArray);
      }
      return res.status(200).json([]);
    } 
    
    else if (req.method === 'POST') {
      const cleanedData = cleanObjectData(rawBody);
      const newDocRef = push(dbRef);
      await set(newDocRef, { ...cleanedData, id: newDocRef.key, created_at: Date.now() });
      return res.status(201).json({ success: true, id: newDocRef.key, ...cleanedData });
    } 
    
    else if (req.method === 'PUT') {
      const { id, ...updateData } = rawBody; 
      const queryId = req.query.id || id; 

      if (!queryId) return res.status(400).json({ error: 'ID tidak ditemukan' });
      const cleanedData = cleanObjectData(updateData);
      const docToUpdateRef = ref(db, `${collectionName}/${queryId}`);
      
      await set(docToUpdateRef, { ...cleanedData, id: queryId, updated_at: Date.now() });
      return res.status(200).json({ success: true, id: queryId, ...cleanedData });
    }

    else if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID wajib disediakan' });
      const docToDeleteRef = ref(db, `${collectionName}/${id}`);
      await remove(docToDeleteRef);
      return res.status(200).json({ success: true, message: 'Data berhasil dihapus' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error("🔥 FATAL ERROR DB:", error);
    return res.status(500).json({ error: `Server Database Error: ${error.message}` });
  }
}
