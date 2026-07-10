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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAp-8B3CXLQikB-8-b9-pKlqH2aTX-5lcU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "e-notulen-ecfd7.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://e-notulen-ecfd7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-notulen-ecfd7",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "e-notulen-ecfd7.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "278047156272",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:278047156272:web:73735a002662bee33525f5"
};

// FILTER BAJA: Membersihkan data agar bug [object Object] tidak meracuni Firebase Anda
const cleanObjectData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (copy[key] === undefined || copy[key] === null) {
      copy[key] = ''; 
    } else if (typeof copy[key] === 'string') {
      copy[key] = copy[key].replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    } else if (typeof copy[key] === 'object') {
      copy[key] = cleanObjectData(copy[key]); 
    }
  }
  return copy;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // KEAMANAN BROWSER: CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getDatabase(app);
    
    // NAMA KOLEKSI HARGA MATI (SINKRONISASI UTAMA)
    const collectionName = 'notulen'; 
    const dbRef = ref(db, collectionName);

    let rawBody = req.body;
    if (typeof rawBody === 'string' && rawBody.trim() !== '') {
      try { rawBody = JSON.parse(rawBody); } catch (e) { console.error("Parse JSON error"); }
    }

    if (req.method === 'GET') {
      const { id } = req.query;
      
      // Mengambil 1 dokumen untuk Edit
      if (id) {
        const snapshot = await get(child(ref(db), `${collectionName}/${id}`));
        if (snapshot.exists()) return res.status(200).json(snapshot.val());
        return res.status(404).json({ error: 'Data tidak ditemukan' });
      }

      // Mengambil semua data untuk Dashboard
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
