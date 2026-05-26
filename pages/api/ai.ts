import type { NextApiRequest, NextApiResponse } from 'next';
// KEMBALIKAN KE PATH ASLI ANDA:
import { processWithGemini, transcribeAudio } from '../../lib/ai'; 

export const maxDuration = 60; 

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', 
    },
  },
};

const superCleanJSON = (str: string) => {
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    cleaned += '"}'; 
  }
  return cleaned;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const { action } = req.query;

  try {
    // TRANSCRIBE ACTION
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = body;
      if (!audioBase64) return res.status(400).json({ error: 'Data audio diperlukan' });
      
      const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
      return res.status(200).json({ transcript });
    }

    // PROCESS ACTION
    if (action === 'process') {
      const { transcript, agenda, tempat, tanggal, pimpinan } = body;
      if (!transcript) return res.status(400).json({ error: 'Transcript kosong!' });

      const result = await processWithGemini(transcript, agenda, tempat, tanggal, pimpinan);
      if (!result) throw new Error("Gemini AI tidak merespons.");

      if (typeof result === 'string') {
        try {
          let cleanJson = superCleanJSON(String(result));
          if (!cleanJson.startsWith('{') && cleanJson.includes('{')) {
            cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
          }
          return res.status(200).json(JSON.parse(cleanJson)); 
        } catch (parseError) {
          return res.status(200).json({ 
            judul: "Draft Notulen (Auto-Recovery)",
            isi_notulen: String(result).replace(/```json/gi, '').replace(/```/g, ''),
            kesimpulan: "Sistem mendeteksi format aneh, silakan rapikan manual.",
            tindak_lanjut: "-"
          });
        }
      }
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak valid!' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Terjadi kesalahan internal AI.' });
  }
}
