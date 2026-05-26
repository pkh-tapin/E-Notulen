import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllNotulen, getNotulenByDate, saveNotulen, deleteNotulen } from '../../lib/sheets';

// CANGGIH: Kapasitas besar agar teks AI super panjang tidak terkena Error 413 (Payload Too Large)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', 
    },
  },
};

// HELPER SANITIZER: Mengubah nilai 'undefined' atau 'null' menjadi string kosong "" 
// agar Google Sheets API tidak mogok/error saat proses penulisan data.
const cleanObjectData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (copy[key] === undefined || copy[key] === null) {
      copy[key] = ''; // Ganti semua yang kosong dengan string aman
    } else if (typeof copy[key] === 'object') {
      copy[key] = cleanObjectData(copy[key]); // Bersihkan rekursif jika ada objek bersarang
    }
  }
  return copy;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // KEAMANAN BROWSER: CORS Headers Lengkap agar tidak di-block browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // =========================================================================
    // METHOD GET: AMBIL DATA NOTULEN
    // =========================================================================
    if (req.method === 'GET') {
      const { tanggal } = req.query;
      let data;
      if (tanggal) {
        data = await getNotulenByDate(tanggal as string);
      } else {
        data = await getAllNotulen();
      }
      return res.status(200).json(data);
    }

    // =========================================================================
    // METHOD POST: TAMBAH DATA BARU
    // =========================================================================
    if (req.method === 'POST') {
      const body = req.body;
      const cleanedBody = cleanObjectData(body);
      const saved = await saveNotulen(cleanedBody);
      return res.status(201).json(saved || cleanedBody);
    }

    // =========================================================================
    // METHOD PUT: UPDATE DATA NOTULEN
    // =========================================================================
    if (req.method === 'PUT') {
      const body = req.body;
      if (!body || !body.id) {
        return res.status(400).json({ error: 'ID wajib diisi untuk melakukan pembaruan' });
      }
      const cleanedBody = cleanObjectData(body);
      const saved = await saveNotulen(cleanedBody);
      return res.status(200).json(saved || cleanedBody);
    }

    // =========================================================================
    // METHOD DELETE: HAPUS NOTULEN (Dipertahankan di API untuk keamanan admin)
    // =========================================================================
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID wajib disediakan' });
      const ok = await deleteNotulen(id as string);
      return res.status(200).json({ success: ok });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan' });

  } catch (error: any) {
    console.error('❌ [CRITICAL SYSTEM ERROR]:', error);
    return res.status(500).json({ 
      error: 'Gagal memproses permintaan', 
      details: error.message 
    });
  }
}
