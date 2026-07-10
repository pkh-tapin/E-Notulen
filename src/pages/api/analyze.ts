import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.query;

  try {
    // =========================================================================
    // 1. FITUR TRANSCRIBE AUDIO (VOICE NEURAL LINK)
    // =========================================================================
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) return res.status(400).json({ error: 'Data audio tidak terdeteksi.' });

      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ error: 'Kunci API Gemini (GEMINI_API_KEY) belum dipasang di Vercel.' });
      }

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Sesuai instruksi khusus: menggunakan gemini-2.5-flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = "Tolong transkrip audio ini ke dalam teks bahasa Indonesia dengan akurat. Abaikan suara bising.";
        
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType || "audio/webm"
            }
          }
        ]);

        return res.status(200).json({ transcript: result.response.text() });
      } catch (audioError: any) {
        return res.status(400).json({ error: `Gagal proses suara: ${audioError.message}` });
      }
    }

    // =========================================================================
    // 2. FITUR PROCESS AI (MERAPIKAN TEKS KE FORMAT NOTULEN)
    // =========================================================================
    if (action === 'process' || !action) {
      const { transcript, text, agenda, tempat, tanggal, pimpinan } = req.body;
      const rawText = transcript || text; 

      if (!rawText) return res.status(400).json({ error: 'Teks transkrip tidak boleh kosong' });

      // PROMPT DOKTRIN KESETIAAN MUTLAK
      const prompt = `Anda adalah Asisten Notulis Eksekutif di SDM PKH Tapin. 
      Tugas Anda: Merapikan catatan mentah/transkrip suara menjadi notulensi. PATOKAN MUTLAK ADALAH TEKS ASLI.

      DOKTRIN KESETIAAN DATA (WAJIB DIPATUHI 100%):
      1. HARGA MATI NAMA PEMATERI: JANGAN PERNAH menghapus nama orang! Jika teks asli menyebutkan "Bapak X menyampaikan...", Anda WAJIB MENCANTUMKAN nama Bapak/Ibu tersebut.
      2. PENANGANAN PENDAPAT GANDA/SAMA: Jika ada tokoh yang menyampaikan hal yang sama/mirip, JANGAN DIBUANG. Tuliskan dengan rapi.
      3. DILARANG BERSPEKULASI: JANGAN menambahkan opini, kata-kata yang tidak ada konteksnya di teks asli, atau membuang data.
      4. TUGAS ANDA HANYA MERAPIKAN: Rapikan bahasa lisannya, perbaiki typo, dan perjelas kalimat yang rumpang tanpa keluar dari konteks.

      ATURAN FORMAT VISUAL (WAJIB DIIKUTI):
      - POIN UTAMA (Angka): Gunakan (1., 2., 3.). WAJIB HURUF KAPITAL SEMUA untuk judul poinnya.
      - ANAK POIN (Abjad): Gunakan (a., b., c.). WAJIB beri awalan 4 spasi (    a.) agar menjorok ke dalam (alenia).
      - ANTI SIMBOL: Dilarang keras memakai bintang (*), tebal (**), hashtag (#), atau peluru (•).
      - Kesimpulan & Tindak Lanjut dibuat sangat ringkas, padat, jelas menggunakan angka murni.

      Konteks Ekstra:
      Agenda: ${agenda || 'Pembahasan Umum'}
      Lokasi: ${tempat || '-'}
      Tanggal: ${tanggal || '-'}
      Pimpinan: ${pimpinan || '-'}
      
      Transkrip Mentah Rapat: 
      "${rawText}"
      
      KEMBALIKAN DALAM FORMAT JSON DENGAN NAMA KEY YANG TEPAT (WAJIB SAMA PERSIS SEPERTI INI):
      {
        "judul": "Judul Singkat Rapat Sesuai Topik",
        "isi_notulen": "1. [JUDUL TOPIK PERTAMA]\\n    a. Bapak X menyampaikan bahwa...\\n    b. Ibu Y menambahkan terkait...\\n2. [JUDUL TOPIK KEDUA]\\n    a. [Penjelasan...]",
        "kesimpulan": "1. [Kesimpulan satu]\\n2. [Kesimpulan dua]",
        "tindak_lanjut": "1. [Tindakan satu]\\n2. [Tindakan dua]"
      }`;

      let responseText = "";

      try {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum dipasang di Vercel.");
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Sesuai instruksi khusus: menggunakan gemini-2.5-flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();

      } catch (geminiError: any) {
        console.warn("Gemini Error, mencoba OpenAI fallback...", geminiError.message);
        
        if (!process.env.OPENAI_API_KEY) {
          // Gagal keduanya. Mengirimkan pesan error spesifik agar tidak Error 500
          return res.status(400).json({ error: `AI Server Ditolak: ${geminiError.message}` });
        }

        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          });
          responseText = completion.choices[0].message.content || "";
        } catch (openAiError: any) {
          return res.status(400).json({ error: `Gagal proses OpenAI: ${openAiError.message}` });
        }
      }

      // Pembersihan Karakter Nakal Markdown sebelum Parsing JSON
      responseText = responseText.replace(/\*/g, '').replace(/```json/gi, '').replace(/```/g, '').trim();
      
      let aiStructured;
      try {
        aiStructured = JSON.parse(responseText);
      } catch (err) {
        // Fallback jika format AI hancur
        aiStructured = {
          judul: "Draft AI (Gagal Format JSON)",
          isi_notulen: responseText,
          kesimpulan: "",
          tindak_lanjut: ""
        };
      }

      return res.status(200).json(aiStructured);
    }

  } catch (error: any) {
    console.error("Endpoint API Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
