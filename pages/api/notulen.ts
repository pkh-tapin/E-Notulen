import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllNotulen, getNotulenByDate, saveNotulen, deleteNotulen } from '../../lib/sheets';

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', 
    },
  },
};

const cleanObjectData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (copy[key] === undefined || copy[key] === null) {
      copy[key] = ''; 
    } else if (typeof copy[key] === 'string') {
      copy[key] = copy[key].replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
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

    if (req.method === 'POST') {
      const body = req.body;
      console.log('📥 Menerima Data Baru untuk Disimpan');
      
      let cleanedBody = cleanObjectData(body);
      
      // Auto-ID Guard
      if (!cleanedBody.id) {
        cleanedBody.id = `NTLN-${Date.now()}`;
      }
      
      // Anti-1899 Date Recovery Guard
      if (!cleanedBody.tanggal || String(cleanedBody.tanggal).includes('1899') || cleanedBody.tanggal === '') {
        const tglSekarang = new Date();
        const yyyy = tglSekarang.getFullYear();
        const mm = String(tglSekarang.getMonth() + 1).padStart(2, '0');
        const dd = String(tglSekarang.getDate()).padStart(2, '0');
        cleanedBody.tanggal = `${yyyy}-${mm}-${dd}`;
      }

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
      const saved = await saveNotulen(cleanedBody);
      
      return res.status(200).json(saved || cleanedBody);
    }

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
