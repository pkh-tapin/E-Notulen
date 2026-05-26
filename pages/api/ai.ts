import type { NextApiRequest, NextApiResponse } from 'next';
// GUNAKAN @ UNTUK IMPORT AGAR TIDAK ERROR "CANNOT FIND MODULE"
import { processWithGemini, transcribeAudio } from '@/lib/ai'; 

// Mencegah Vercel memotong proses (Max 60 Detik)
export const maxDuration = 60; 

// Konfigurasi wajib untuk membaca file/audio raksasa (50MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', 
    },
  },
};

// Mesin Pembersih Halusinasi AI
const superCleanJSON = (str: string) => {
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    cleaned += '"}'; 
  }
  return cleaned;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Setup Keamanan Lintas Server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan' });

  // 🛡️ PENANGANAN FILE CERDAS: Jika payload dikirim sebagai string raksasa
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      console.warn("⚠️ Peringatan: Body tidak bisa di-parse otomatis. Mungkin berisi format binary/file mentah.");
    }
  }

  const { action } = req.query;

  try {
    // =======================================================
    // ACTION 1: TRANSCRIBE (SUARA KE TEKS)
    // =======================================================
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = body;
      
      // Validasi Ekstra untuk memastikan file benar-benar masuk
      if (!audioBase64) {
        return res.status(400).json({ 
          error: 'Data audio tidak ditemukan. Pastikan frontend mengirim dengan key "audioBase64" (bukan FormData murni).' 
        });
      }
      
      try {
        console.log("🎙️ Mulai membaca file audio...");
        const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
        return res.status(200).json({ transcript });
      } catch (transcribeErr: any) {
        console.error('❌ Gagal Membaca File Audio:', transcribeErr);
        return res.status(500).json({ error: 'Sistem AI gagal membaca file audio Anda.' });
      }
    }

    // =======================================================
    // ACTION 2: PROCESS (TEKS KE NOTULEN)
    // =======================================================
    if (action === 'process') {
      const { transcript, agenda, tempat, tanggal, pimpinan } = body;
      
      if (!transcript) {
         return res.status(400).json({ error: 'Transcript kosong!' });
      }

      console.log("🚀 Menghubungi Gemini AI...");
      const result = await processWithGemini(transcript, agenda, tempat, tanggal, pimpinan);
      
      if (!result) throw new Error("Gemini AI tidak merespons.");

      // Anti-Error JSON dari Gemini AI
      if (typeof result === 'string') {
        try {
          let cleanJson = superCleanJSON(String(result));
          
          if (!cleanJson.startsWith('{') && cleanJson.includes('{')) {
            cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
          }
          
          return res.status(200).json(JSON.parse(cleanJson)); 

        } catch (parseError) {
          console.error('❌ Gagal mem-parsing teks AI:', parseError);
          // Fallback Darurat agar tidak crash di frontend
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
    console.error('❌ SYSTEM ERROR:', error);
    return res.status(500).json({ 
      error: error?.message || 'Terjadi kesalahan internal AI.'
    });
  }
}
