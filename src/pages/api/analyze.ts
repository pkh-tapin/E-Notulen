import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Tangkap parameter 'action' dari URL (transcribe atau process)
  const { action } = req.query;

  try {
    // =========================================================================
    // 1. FITUR TRANSCRIBE AUDIO (VOICE NEURAL LINK)
    // =========================================================================
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) return res.status(400).json({ error: 'Data audio tidak terdeteksi.' });

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel.' });
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      // WAJIB menggunakan model gemini-1.5-flash karena mendukung pemrosesan audio/suara
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    }

    // =========================================================================
    // 2. FITUR PROCESS AI (MERAPIKAN TEKS KE FORMAT NOTULEN)
    // =========================================================================
    if (action === 'process' || !action) {
      // Sesuaikan nama variabel yang dikirim dari tambah.tsx (transcript, agenda, tempat, dll)
      const { transcript, text, agenda, tempat, tanggal, pimpinan } = req.body;
      const rawText = transcript || text; 

      if (!rawText) return res.status(400).json({ error: 'Teks transkrip tidak boleh kosong' });

      // PROMPT DOKTRIN KESETIAAN MUTLAK
      const prompt = `Anda adalah Asisten Notulis Eksekutif di SDM PKH Tapin. 
      Tugas Anda: Merapikan catatan mentah/transkrip suara menjadi notulensi. PATOKAN MUTLAK ADALAH TEKS ASLI.

      DOKTRIN KESETIAAN DATA (WAJIB DIPATUHI 100%):
      1. HARGA MATI NAMA PEMATERI: JANGAN PERNAH menghapus nama orang! Jika teks asli menyebutkan "Bapak X menyampaikan..." atau "Ibu Y menanyakan...", Anda WAJIB MENCANTUMKAN nama Bapak/Ibu tersebut di dalam rincian Anda.
      2. PENANGANAN PENDAPAT GANDA/SAMA: Jika ada tokoh yang menyampaikan hal yang sama/mirip, JANGAN DIBUANG. Tuliskan dengan rapi, contoh: "Sejalan dengan penyampaian Bapak A, Ibu B menegaskan kembali bahwa..."
      3. DILARANG BERSPEKULASI: JANGAN menambahkan opini, kata-kata yang tidak ada konteksnya di teks asli, atau membuang data. Kunci pemahaman Anda sama persis dengan apa yang diketik/direkam.
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
        if (!process.env.GEMINI_API_KEY) throw new Error("Key hilang");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      } catch (geminiError: any) {
        console.warn("Gemini Error, mencoba OpenAI fallback...", geminiError);
        if (!process.env.OPENAI_API_KEY) throw new Error("Semua API AI gagal atau key belum diatur.");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });
        responseText = completion.choices[0].message.content || "";
      }

      // Pembersihan Karakter Nakal Markdown sebelum Parsing JSON
      responseText = responseText.replace(/\*/g, '').replace(/```json/gi, '').replace(/```/g, '').trim();
      
      let aiStructured;
      try {
        aiStructured = JSON.parse(responseText);
      } catch (err) {
        // Jika AI gagal memberikan format JSON, tangkap teks mentahnya agar tidak error 500
        aiStructured = {
          judul: "Draft AI (Gagal Format)",
          isi_notulen: responseText,
          kesimpulan: "",
          tindak_lanjut: ""
        };
      }

      // Langsung kembalikan objek JSON murni agar frontend bisa menanganinya
      return res.status(200).json(aiStructured);
    }

  } catch (error: any) {
    console.error("Endpoint API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
