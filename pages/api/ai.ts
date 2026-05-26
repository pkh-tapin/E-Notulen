import type { NextApiRequest, NextApiResponse } from 'next';
import { processWithGemini, transcribeAudio } from '../../lib/ai';

// =========================================================================
// TAMBAHAN CANGGIH 1: ANTI-TIMEOUT
// Mencegah server (Vercel) memotong paksa proses AI yang butuh waktu lama
// =========================================================================
export const maxDuration = 60; 

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // untuk file audio besar
    },
  },
};

// =========================================================================
// TAMBAHAN CANGGIH 2: MESIN PEMBERSIH JSON KELAS DEWA
// Menghapus karakter gaib (control characters) yang bikin JSON.parse hancur
// =========================================================================
const superCleanJSON = (str: string) => {
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  // Hapus karakter unicode/invisible yang sering diselipkan AI
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  
  // Deteksi otomatis jika AI lupa menutup kurung kurawal di akhir teks
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    cleaned += '"}'; // Penutup darurat
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
      
      try {
        const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
        return res.status(200).json({ transcript });
      } catch (transcribeErr: any) {
        console.error('❌ Gagal Transcribe:', transcribeErr);
        return res.status(500).json({ error: 'Gagal memproses audio, file mungkin korup atau format tidak didukung.' });
      }
    }

    // 2. Action untuk merapikan Teks jadi Notulen
    if (action === 'process') {
      const { transcript, agenda, tempat, tanggal, pimpinan } = body;
      
      if (!transcript) {
         return res.status(400).json({ error: 'Transcript kosong, tidak ada data untuk diproses.' });
      }

      console.log("🚀 Menghubungi Gemini AI...");
      const result = await processWithGemini(transcript, agenda, tempat, tanggal, pimpinan);
      
      if (!result) {
         throw new Error("Gemini AI tidak memberikan respons apapun.");
      }

      // ANTI-HALUSINASI JSON GEMINI (THE MAGIC FIX)
      // =========================================================================
      // Mencegah AI mengembalikan teks mentah atau format markdown seperti ```json
      if (typeof result === 'string') {
        try {
          // PERBAIKAN: Paksa TypeScript mengenali 'result' sebagai String mutlak 
          // menggunakan String() agar fungsi pembersih berjalan sempurna.
          let cleanJson = superCleanJSON(String(result));
          
          // ANTISIPASI EKSTRA: Jika AI memberikan teks pembuka sebelum tanda '{'
          if (!cleanJson.startsWith('{') && cleanJson.includes('{')) {
            cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
          }
          
          // Gunakan variabel baru 'parsedResult' agar tidak bentrok
          const parsedResult = JSON.parse(cleanJson);
          
          // PASTIKAN ANDA MENGIRIMKAN parsedResult SEBAGAI RESPONSE
          return res.status(200).json(parsedResult); 

        } catch (parseError) {
          console.error('❌ Gagal mem-parsing teks AI:', parseError);
          console.error('RAW TEXT DARI AI:', result); // Log untuk debug di console server
          
          // =====================================================================
          // TAMBAHAN CANGGIH 3: FALLBACK EKSTRIM (JARING PENGAMAN)
          // Jika AI ngawur parah dan JSON.parse tetap gagal, jangan lempar Error 500!
          // Paksa ambil teksnya dan jadikan JSON darurat agar aplikasi tetap berjalan.
          // =====================================================================
          return res.status(200).json({ 
            judul: "Draft Notulen (Auto-Recovery)",
            isi_notulen: String(result).replace(/```json/gi, '').replace(/```/g, ''),
            kesimpulan: "AI menghasilkan format yang sulit diproses otomatis. Silakan rapikan manual.",
            tindak_lanjut: "-"
          });
        }
      }

      // Jika sukses dan AI memang sudah merespons dalam bentuk objek (bukan string), kembalikan langsung
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Action tidak valid. Gunakan endpoint: transcribe atau process' });
  } catch (error: any) {
    console.error('❌ AI API Error Terluar:', error);
    // Pastikan error berbentuk JSON yang aman dan terbaca frontend
    return res.status(500).json({ 
      error: error?.message || 'Terjadi kesalahan sistem internal pada AI.',
      details: error?.toString() || ''
    });
  }
}
