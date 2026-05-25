import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllNotulen, getNotulenByDate, saveNotulen, deleteNotulen } from '../../lib/sheets';
import { randomUUID } from 'crypto';

// CRITICAL: Ditingkatkan ke 50MB agar teks AI seberapa pun panjangnya TIDAK kena Error 413 (Payload Too Large)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', 
    },
  },
};

// Fungsi Helper: Google Sheets & Supabase benci 'undefined'. Ini akan mengubah undefined menjadi string kosong.
const sanitizeData = (obj: any) => {
  const sanitized = { ...obj };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      sanitized[key] = '';
    }
  });
  return sanitized;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. SETTING CORS KELAS BERAT (Anti-Gagal di Browser Modern)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 2. BYPASS PREFLIGHT CORS CEPAT
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // =========================================================================
    // METHOD GET: MENGAMBIL DATA
    // =========================================================================
    if (req.method === 'GET') {
      const { tanggal, id } = req.query;

      if (id) {
        const all = await getAllNotulen();
        const found = all.find((n: any) => String(n.id) === String(id));
        if (!found) return res.status(404).json({ error: 'Notulen tidak ditemukan' });
        return res.status(200).json(found);
      }

      if (tanggal) {
        const data = await getNotulenByDate(tanggal as string);
        return res.status(200).json(data);
      }

      const data = await getAllNotulen();
      // Auto-sorting pintar: Terbaru di atas
      const sorted = data.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || a.tanggal || 0).getTime();
        const dateB = new Date(b.created_at || b.tanggal || 0).getTime();
        return dateB - dateA;
      });
      
      return res.status(200).json(sorted);
    }

    // =========================================================================
    // METHOD POST: SIMPAN DATA BARU (DARI AI GENERATOR)
    // =========================================================================
    if (req.method === 'POST') {
      const body = req.body;
      
      if (!body.judul || !body.tanggal) {
        return res.status(400).json({ error: 'Gagal Simpan: Judul dan tanggal wajib diisi' });
      }
      
      console.log('🔄 Memulai proses simpan NOTULEN AI ke Database...');

      // Injeksi Cerdas: Pastikan selalu ada ID dan Timestamp
      const payloadToSave = sanitizeData({
        ...body,
        id: body.id || randomUUID(),
        created_at: body.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const saved = await saveNotulen(payloadToSave);
      console.log('✅ Berhasil simpan ke Database dengan ID:', payloadToSave.id);
      
      // Return objek data langsung agar dibaca mulus oleh frontend
      return res.status(201).json(saved || payloadToSave);
    }

    // =========================================================================
    // METHOD PUT: UPDATE DATA EXISTING
    // =========================================================================
    if (req.method === 'PUT') {
      const body = req.body;
      if (!body.id) return res.status(400).json({ error: 'ID wajib diisi untuk update' });
      
      console.log(`🔄 Mengupdate Notulen ID: ${body.id}`);
      
      const payloadToUpdate = sanitizeData({
        ...body,
        updated_at: new Date().toISOString()
      });

      const saved = await saveNotulen(payloadToUpdate);
      return res.status(200).json(saved || payloadToUpdate);
    }

    // =========================================================================
    // METHOD DELETE: HAPUS DATA
    // =========================================================================
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID wajib diisi untuk delete' });
      
      console.log(`🗑️ Menghapus Notulen ID: ${id}`);
      const ok = await deleteNotulen(id as string);
      return res.status(200).json({ success: ok });
    }

    // Jika method nyasar
    return res.status(405).json({ error: 'Method tidak diizinkan' });

  } catch (error: any) {
    // Error Logging Terminal yang Canggih
    console.error('❌ [FATAL ERROR] API Notulen Gagal:', error);
    return res.status(500).json({ 
      error: 'Terjadi kesalahan internal server saat menyimpan notulen.',
      details: error.message 
    });
  }
}
