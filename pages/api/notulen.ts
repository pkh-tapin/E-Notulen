import type { NextApiRequest, NextApiResponse } from 'next';
import { processWithGemini, transcribeAudio } from '../../lib/ai';

// =========================================================================
// PERBAIKAN MUTLAK 1: ANTI-TIMEOUT VERCEL
// Mencegah Vercel memotong proses AI yang menghasilkan teks mentah "Error..."
// =========================================================================
export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // untuk file audio besar
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Setup CORS agar tidak di-block oleh browser dengan header lengkap
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  // Pengaman otomatis jika body masuk dalam bentuk string mentah
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    body = req.body;
  }

  const { action } = req.query;

  try {
    // 1. Action untuk ubah Suara ke Teks
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Data audio diperlukan' });
      }
      const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
      return res.status(200).json({ transcript });
    }

    // 2. Action untuk merapikan Teks jadi Notulen
    if (action === 'process') {
      const { transcript, agenda, tempat, tanggal, pimpinan } = body;
      if (!transcript) {
        return res.status(400).json({ error: 'Transcript diperlukan' });
      }
      
      // Panggil AI
      let result = await processWithGemini(transcript, { agenda, tempat, tanggal, pimpinan });
      
      // =========================================================================
      // PERBAIKAN MUTLAK 2: ANTI-HALUSINASI JSON GEMINI
      // Memastikan output selalu JSON murni, JANGAN PERNAH melempar teks mentah!
      // =========================================================================
      if (typeof result === 'string') {
        try {
          let cleanJson = String(result).replace(/```json/gi, '').replace(/```/g, '').trim();
          
          if (!cleanJson.startsWith('{') && cleanJson.includes('{')) {
            cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
          }

          // Perbaikan jika AI terpotong di akhir
          if (cleanJson.startsWith('{') && !cleanJson.endsWith('}')) {
             cleanJson += '"}'; 
          }
          
          const parsedResult = JSON.parse(cleanJson);
          return res.status(200).json(parsedResult); 

        } catch (parseError) {
          console.error('❌ Gagal mem-parsing teks AI:', parseError);
          // BACKUP CERDAS: Paksa bentuk jadi objek JSON agar frontend tidak crash membaca "Error"
          return res.status(200).json({ 
            judul: "Draft AI (Berhasil Ditangkap)",
            isi_notulen: String(result).replace(/```json/gi, '').replace(/```/g, ''),
            kesimpulan: "Sistem mengamankan format data AI agar tidak crash.",
            tindak_lanjut: "-"
          });
        }
      }

      // Jika sukses dan sudah berbentuk objek, kembalikan objek yang sudah rapi
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan: transcribe atau process' });
  } catch (error: any) {
    console.error('❌ AI API Error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server AI' });
  }
}
