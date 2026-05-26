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

// FILTER BAJA: Membersihkan nilai kosong dan menghapus karakter aneh yang membuat Google Sheets Error 500
const cleanObjectData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (copy[key] === undefined || copy[key] === null) {
      copy[key] = ''; // Ganti semua yang kosong dengan string aman
    } else if (typeof copy[key] === 'string') {
      // Hapus karakter unicode tersembunyi yang sering merusak query Google Sheets
      copy[key] = copy[key].replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
    } else if (typeof copy[key] === 'object') {
      // MODIFIKASI AMAN: Jika properti adalah objek/array tingkat dalam, bersihkan secara rekursif.
      // Namun, jika objek ini langsung ditujukan untuk cell baris Google Sheets, pastikan di-stringified 
      // agar tidak menghasilkan "[object Object]" atau merusak payload API Google Sheets.
      const deeplyCleaned = cleanObjectData(copy[key]);
      if (Array.isArray(deeplyCleaned) || typeof deeplyCleaned === 'object') {
        // Jangan stringify jika ini adalah root level array saat iterasi awal,
        // Stringify dilakukan jika merupakan properti child dari data utama agar muat dalam 1 cell sheet.
        copy[key] = JSON.stringify(deeplyCleaned);
      } else {
        copy[key] = deeplyCleaned;
      }
    }
  }
  return copy;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // KEAMANAN BROWSER: CORS Headers Lengkap agar tidak di-block browser (FIXED: Menambahkan Allow-Headers)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Pengaman otomatis jika body masuk dalam bentuk string mentah
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  try {
    // =========================================================================
    // METHOD GET: AMBIL DATA
    // =========================================================================
    if (req.method === 'GET') {
      const { id, date } = req.query;

      if (id) {
        const data = await getAllNotulen();
        const item = data.find((d: any) => String(d.id) === String(id));
        if (!item) return res.status(404).json({ error: 'Data notulen tidak ditemukan' });
        return res.status(200).json(item);
      }

      if (date) {
        const data = await getNotulenByDate(date as string);
        return res.status(200).json(data);
      }

      const allData = await getAllNotulen();
      return res.status(200).json(allData);
    }

    // =========================================================================
    // METHOD POST: SIMPAN DATA BARU
    // =========================================================================
    if (req.method === 'POST') {
      console.log('📥 Menerima Data Baru untuk Disimpan');
      
      const cleanedBody = cleanObjectData(body);
      const saved = await saveNotulen(cleanedBody);
      
      return res.status(201).json(saved || cleanedBody);
    }

    // =========================================================================
    // METHOD PUT: UPDATE DATA NOTULEN
    // =========================================================================
    if (req.method === 'PUT') {
      if (!body || !body.id) {
        return res.status(400).json({ error: 'ID wajib diisi untuk melakukan pembaruan' });
      }

      console.log(`🔄 Mengupdate Data Notulen ID: ${body.id}`);
      const cleanedBody = cleanObjectData(body);
      const saved = await saveNotulen(cleanedBody);
      
      return res.status(200).json(saved || cleanedBody);
    }

    // =========================================================================
    // METHOD DELETE: HAPUS NOTULEN
    // =========================================================================
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID wajib disediakan' });

      console.log(`🗑️ Menghapus Notulen ID: ${id}`);
      const ok = await deleteNotulen(id as string);
      return res.status(200).json({ success: ok });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan' });

  } catch (error: any) {
    console.error('❌ [CRITICAL SYSTEM ERROR]:', error);
    return res.status(500).json({ 
      error: 'Gagal memproses data ke Spreadsheet',
      details: error.message || 'Terjadi kesalahan sistem internal'
    });
  }
}
