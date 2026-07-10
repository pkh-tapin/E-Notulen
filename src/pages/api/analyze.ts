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
        return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel.' });
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
      1. HARGA MATI NAMA PEMATERI: JANGAN PERNAH menghapus nama orang!
      2. PENANGANAN PENDAPAT GANDA/SAMA: JANGAN DIBUANG.
      3. DILARANG BERSPEKULASI: JANGAN menambahkan opini.
      4. TUGAS ANDA HANYA MERAPIKAN.

      ATURAN FORMAT VISUAL (WAJIB DIIKUTI):
      - POIN UTAMA (Angka): Gunakan (1., 2., 3.). WAJIB HURUF KAPITAL SEMUA.
      - ANAK POIN (Abjad): Gunakan (a., b., c.). WAJIB beri awalan 4 spasi (    a.).
      - ANTI SIMBOL: Dilarang keras memakai (*), (**), (#), atau (•).

      Konteks Tambahan:
      Agenda: ${agenda || 'Pembahasan Umum'}
      Lokasi: ${tempat || '-'}
      Tanggal: ${tanggal || '-'}
      Pimpinan: ${pimpinan || '-'}
      
      Transkrip Mentah Rapat: 
      "${rawText}"
      
      KEMBALIKAN DALAM FORMAT JSON BERIKUT (WAJIB SAMA PERSIS):
      {
        "judul": "Judul Singkat Rapat Sesuai Topik",
        "isi_notulen": "1. [JUDUL TOPIK PERTAMA]\\n    a. Bapak X menyampaikan...\\n    b. Ibu Y menambahkan...\\n2. [JUDUL TOPIK KEDUA]\\n    a. [Penjelasan...]",
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
        if (!process.env.OPENAI_API_KEY) throw new Error("Semua API AI gagal.");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });
        responseText = completion.choices[0].message.content || "";
      }

      responseText = responseText.replace(/\*/g, '').replace(/```json/gi, '').replace(/```/g, '').trim();
      
      let aiStructured;
      try {
        aiStructured = JSON.parse(responseText);
      } catch (err) {
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
    return res.status(500).json({ error: error.message });
  }
}
