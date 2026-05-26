import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllNotulen, getNotulenByDate, saveNotulen, deleteNotulen } from '../../lib/sheets';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Optimal untuk Vercel Serverless agar tidak memicu error payload
    },
  },
};

const cleanObjectData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (copy[key] === undefined || copy[key] === null) {
      copy[key] = ''; 
    } else if (typeof copy[key] === 'object') {
      copy[key] = cleanObjectData(copy[key]); 
    }
  }
  return copy;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
      const sorted = data.sort((a: any, b: any) => {
        const dateA = new Date(a.tanggal || 0).getTime();
        const dateB = new Date(b.tanggal || 0).getTime();
        return dateB - dateA;
      });
      return res.status(200).json(sorted);
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !body.judul || !body.tanggal) {
        return res.status(400).json({ error: 'Judul dan tanggal wajib diisi' });
      }

      const cleanedBody = cleanObjectData(body);
      const saved = await saveNotulen(cleanedBody);
      return res.status(201).json(saved || cleanedBody);
    }

    if (req.method === 'PUT') {
      const body = req.body;
      if (!body || !body.id) {
        return res.status(400).json({ error: 'ID wajib diisi untuk melakukan pembaruan' });
      }

      console.log(`🔄 Mengupdate Data Notulen ID: ${body.id}`);
      const cleanedBody = cleanObjectData(body);
      
      // CATATAN KRITIS: Pastikan fungsi saveNotulen di lib/sheets mampu mendeteksi 'id' 
      // dan melakukan operasi UPDATE baris, bukan ADD ROW.
      const saved = await saveNotulen(cleanedBody);
      
      return res.status(200).json(saved || cleanedBody);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID wajib disediakan' });

      const ok = await deleteNotulen(id as string);
      return res.status(200).json({ success: ok });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan' });

  } catch (error: any) {
    console.error('❌ [CRITICAL SYSTEM ERROR]:', error);
    // Mengembalikan JSON terstruktur agar Vercel tidak melempar 500 HTML mentah
    return res.status(500).json({ 
      error: 'Gagal memproses data ke database (Google Sheets)', 
      details: error.message || error.toString() 
    });
  }
}
