import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllNotulen, getNotulenByDate, saveNotulen, deleteNotulen } from '../../lib/sheets';

// CRITICAL: Tambahkan ini agar data teks panjang dari AI tidak kena Error 413 (Payload Too Large)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', 
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Head Headers untuk keamanan & akses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // --- METHOD GET: Mengambil Data ---
    if (req.method === 'GET') {
      const { tanggal, id } = req.query;

      if (id) {
        const all = await getAllNotulen();
        const found = all.find((n: any) => n.id === id);
        if (!found) return res.status(404).json({ error: 'Notulen tidak ditemukan' });
        return res.status(200).json(found);
      }

      if (tanggal) {
        const data = await getNotulenByDate(tanggal as string);
        return res.status(200).json(data);
      }

      const data = await getAllNotulen();
      const sorted = data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return res.status(200).json(sorted);
    }

    // --- METHOD POST: Simpan Baru ---
    if (req.method === 'POST') {
      const body = req.body;
      if (!body.judul || !body.tanggal) {
        return res.status(400).json({ error: 'Judul dan tanggal wajib diisi' });
      }
      
      console.log('Memulai proses simpan ke Google Sheets...');
      const saved = await saveNotulen(body);
      console.log('Berhasil simpan ID:', saved.id);
      
      return res.status(201).json(saved);
    }

    // --- METHOD PUT: Update Data ---
    if (req.method === 'PUT') {
      const body = req.body;
      if (!body.id) return res.status(400).json({ error: 'ID wajib diisi untuk update' });
      
      const saved = await saveNotulen(body);
      return res.status(200).json(saved);
    }

    // --- METHOD DELETE: Hapus Data ---
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID wajib diisi untuk delete' });
      
      const ok = await deleteNotulen(id as string);
      return res.status(200).json({ success: ok });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan' });

  } catch (error: any) {
    // Log error lebih detail di terminal agar kita tahu penyebab pastinya
    console.error('API Error Details:', error.message);
    return res.status(500).json({ 
      error: 'Gagal memproses data ke Spreadsheet',
      details: error.message 
    });
  }
}
