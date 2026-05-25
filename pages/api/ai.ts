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
  // Setup CORS agar tidak di-block oleh browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  const { action } = req.query;

  try {
    // 1. Action untuk ubah Suara ke Teks
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Data audio diperlukan' });
      }
      const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
      return res.status(200).json({ transcript });
    }

    // 2. Action untuk merapikan Teks jadi Notulen
    if (action === 'process') {
      const { transcript, agenda, tempat, tanggal, pimpinan } = req.body;
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
          // Hilangkan format markdown backticks jika ada, lalu paksa jadi Objek JSON
          let cleanJson = result.replace(/```json/gi, '').replace(/```/g, '').trim();
          result = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error('❌ Gagal mem-parsing teks AI:', parseError);
          return res.status(500).json({ 
            error: 'AI gagal merespons dengan format yang benar. Silakan coba generate lagi.', 
            rawText: result 
          });
        }
      }

      // Jika sukses, kembalikan objek yang sudah rapi
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan: transcribe atau process' });
  } catch (error: any) {
    console.error('❌ AI API Error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server AI' });
  }
}
