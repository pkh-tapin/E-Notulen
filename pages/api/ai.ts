import type { NextApiRequest, NextApiResponse } from 'next';
import { processWithGemini, transcribeAudio } from '../../lib/ai';

// =========================================================================
// TAMBAHAN CANGGIH: ANTI-TIMEOUT VERCEL (60 DETIK)
// =========================================================================
export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // untuk file audio besar
    },
  },
};

// PEMBERSIH STRUKTUR JSON TINGKAT TINGGI
const superCleanJSON = (str: string) => {
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    cleaned += '"}';
  }
  return cleaned;
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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
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
      
      // Panggil AI (Tetap mempertahankan parameter asli Anda)
      let result = await processWithGemini(transcript, { agenda, tempat, tanggal, pimpinan });
      
      // ANTI-HALUSINASI JSON GEMINI (THE MAGIC FIX)
      if (typeof result === 'string') {
        try {
          let cleanJson = String(result).replace(/```json/gi, '').replace(/```/g, '').trim();
          
          if (!cleanJson.startsWith('{') && cleanJson.includes('{')) {
            cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
          }
          
          const parsedResult = JSON.parse(cleanJson);
          
          // =========================================================================
          // TAMBAHAN CANGGIH: SMART DATA MERGER
          // Memastikan metadata input tidak hilang saat objek dikirim ke database
          // =========================================================================
          const finalPayload = {
            id: parsedResult.id || `NTLN-${Date.now()}`,
            agenda: agenda || parsedResult.agenda || '',
            tempat: tempat || parsedResult.tempat || '',
            tanggal: tanggal || parsedResult.tanggal || '',
            pimpinan: pimpinan || parsedResult.pimpinan || '',
            judul: parsedResult.judul || 'Notulen Hasil AI',
            isi_notulen: parsedResult.isi_notulen || cleanJson,
            kesimpulan: parsedResult.kesimpulan || '',
            tindak_lanjut: parsedResult.tindak_lanjut || ''
          };

          return res.status(200).json(finalPayload); 

        } catch (parseError) {
          console.error('❌ Gagal mem-parsing teks AI:', parseError);
          
          // JARING PENGAMAN: Jika parse gagal, buat struktur darurat agar tidak crash saat disimpan
          return res.status(200).json({ 
            id: `NTLN-${Date.now()}`,
            agenda: agenda || '',
            tempat: tempat || '',
            tanggal: tanggal || '',
            pimpinan: pimpinan || '',
            judul: "Draft Notulen (Auto-Recovery)",
            isi_notulen: String(result).replace(/```json/gi, '').replace(/```/g, ''),
            kesimpulan: "AI merespons dengan format teks biasa.",
            tindak_lanjut: "-"
          });
        }
      }

      // Jika dari sananya sudah berbentuk objek, pastikan metadatanya lengkap sebelum di-return
      if (result && typeof result === 'object') {
        const mergedResult = {
          id: result.id || `NTLN-${Date.now()}`,
          agenda: result.agenda || agenda || '',
          tempat: result.tempat || tempat || '',
          tanggal: result.tanggal || tanggal || '',
          pimpinan: result.pimpinan || pimpinan || '',
          ...result
        };
        return res.status(200).json(mergedResult);
      }

      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan: transcribe atau process' });
  } catch (error: any) {
    console.error('❌ AI API Error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server AI' });
  }
}
