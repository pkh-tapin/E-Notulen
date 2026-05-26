import type { NextApiRequest, NextApiResponse } from 'next';
import { processWithGemini, transcribeAudio } from '../../lib/ai';

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
      
      // Panggil AI
      let result = await processWithGemini(transcript, { agenda, tempat, tanggal, pimpinan });
      
      // =========================================================================
      // ANTI-HALUSINASI JSON GEMINI (THE MAGIC FIX)
      // =========================================================================
      // Mencegah AI mengembalikan teks mentah atau format markdown seperti ```json
      if (typeof result === 'string') {
        try {
          // PERBAIKAN: Paksa TypeScript (Vercel) mengenali 'result' sebagai String mutlak 
          // menggunakan String() agar fungsi .replace() bisa berjalan sempurna.
          let cleanJson = String(result).replace(/```json/gi, '').replace(/```/g, '').trim();
          
          // ANTISIPASI EKSTRA: Jika AI memberikan teks pembuka sebelum tanda '{'
          if (!cleanJson.startsWith('{') && cleanJson.includes('{')) {
            cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
          }
          
          // Gunakan variabel baru 'parsedResult' agar tidak bentrok dengan tipe data 'result' sebelumnya
          const parsedResult = JSON.parse(cleanJson);
          
          // PASTIKAN ANDA MENGIRIMKAN parsedResult SEBAGAI RESPONSE
          return res.status(200).json(parsedResult); 

        } catch (parseError) {
          console.error('❌ Gagal mem-parsing teks AI:', parseError);
          return res.status(500).json({ 
            error: 'AI gagal merespons dengan format yang benar. Silakan coba generate lagi.', 
            rawText: result 
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
